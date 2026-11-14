import { MockLanguageModelV3, simulateReadableStream } from "ai/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import { giveChatJob } from "../utils/model-jobs";
import {
	createTestCase,
	createTestComment,
	createTestElement,
	createTestPermission,
	createTestPluginState,
	createTestUser,
} from "../utils/prisma-factories";

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/models/adapters", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/models/adapters")>()),
	chatModelFor: vi.fn(),
}));

const PLUGIN = "tea.assistant";
const SECRET = "sk-test-SECRET-value-123";
const MODEL_ADDRESS = "https://llm.example/v1";

const USAGE = {
	inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
	outputTokens: { total: 1, text: 1, reasoning: 0 },
};

function textModel(onCall?: (options: unknown) => void) {
	return new MockLanguageModelV3({
		doStream: (options) => {
			onCall?.(options);
			return Promise.resolve({
				stream: simulateReadableStream({
					chunks: [
						{ type: "stream-start", warnings: [] },
						{ type: "text-start", id: "t" },
						{ type: "text-delta", id: "t", delta: "done" },
						{ type: "text-end", id: "t" },
						{
							type: "finish",
							finishReason: { unified: "stop", raw: "stop" },
							usage: USAGE,
						},
					],
				}),
			});
		},
	});
}

/** First step asks for `tool` with `input`; the second step just answers. */
function toolThenTextModel(tool: string, input: unknown) {
	let step = 0;
	return new MockLanguageModelV3({
		doStream: () => {
			step += 1;
			const toolChunks = [
				{ type: "stream-start" as const, warnings: [] },
				{
					type: "tool-call" as const,
					toolCallId: "call-1",
					toolName: tool,
					input: JSON.stringify(input),
				},
				{
					type: "finish" as const,
					finishReason: { unified: "tool-calls" as const, raw: "tc" },
					usage: USAGE,
				},
			];
			const textChunks = [
				{ type: "stream-start" as const, warnings: [] },
				{ type: "text-start" as const, id: "t" },
				{ type: "text-delta" as const, id: "t", delta: "done" },
				{ type: "text-end" as const, id: "t" },
				{
					type: "finish" as const,
					finishReason: { unified: "stop" as const, raw: "stop" },
					usage: USAGE,
				},
			];
			return Promise.resolve({
				stream:
					step === 1
						? simulateReadableStream({ chunks: toolChunks })
						: simulateReadableStream({ chunks: textChunks }),
			});
		},
	});
}

/** The chat model builder, which the route calls with the user's connection and the chat job's model. */
async function modelFactory() {
	const mod = await import("@/lib/models/adapters");
	return vi.mocked(mod.chatModelFor);
}

function post(caseId: string, body: unknown, raw = false) {
	return import("@/app/api/cases/[id]/assistant/route").then(({ POST }) =>
		POST(
			new Request(`http://localhost:3000/api/cases/${caseId}/assistant`, {
				method: "POST",
				body: raw ? (body as string) : JSON.stringify(body),
			}),
			{ params: Promise.resolve({ id: caseId }) }
		)
	);
}

const MESSAGES = {
	messages: [{ id: "m1", role: "user", parts: [{ type: "text", text: "hi" }] }],
};

/** Gives the user an OpenAI-compatible connection holding SECRET and puts the chat job on it. */
function giveJob(userId: string) {
	return giveChatJob(userId, {
		type: "OPENAI_COMPATIBLE",
		baseUrl: MODEL_ADDRESS,
		apiKey: SECRET,
		model: "m",
	});
}

async function setup({ job = true, enabled = true } = {}) {
	const user = await createTestUser();
	const kase = await createTestCase(user.id);
	const root = await createTestElement(kase.id, user.id, { name: "G1" });
	// The assistant is off until the user turns it on, so an enabling row is
	// always written unless the test asks for the user to have switched it off.
	if (enabled) {
		await createTestPluginState(user.id, { pluginId: PLUGIN, enabled: true });
	}
	if (job) {
		await giveJob(user.id);
	}
	await mockAuth(user.id, user.username, user.email);
	return { user, kase, root };
}

beforeEach(async () => {
	await mockNoAuth();
	(await modelFactory()).mockReset();
	(await modelFactory()).mockImplementation(() => textModel());
});

afterEach(() => {
	vi.unstubAllEnvs();
});

// ============================================
// Check order
// ============================================

describe("POST /api/cases/[id]/assistant check order", () => {
	it("is 401 with no session, before any other check", async () => {
		const owner = await createTestUser();
		const kase = await createTestCase(owner.id);
		const res = await post(kase.id, "{not json", true);
		expect(res.status).toBe(401);
	});

	it("is 404 when the plugin is disabled, even for the case owner with a valid body", async () => {
		const { kase } = await setup({ enabled: false });
		const res = await post(kase.id, MESSAGES);
		expect(res.status).toBe(404);
		expect((await modelFactory()).mock.calls).toHaveLength(0);
	});

	it("is 404, not 400, for a malformed body when the user cannot view the case", async () => {
		const { kase: _own } = await setup();
		const stranger = await createTestUser();
		const theirs = await createTestCase(stranger.id);
		expect((await post(theirs.id, "{not json", true)).status).toBe(404);
		expect((await post(theirs.id, { messages: [] })).status).toBe(404);
	});

	it("answers a case the user cannot view exactly as a case that does not exist", async () => {
		await setup();
		const stranger = await createTestUser();
		const theirs = await createTestCase(stranger.id);
		const denied = await post(theirs.id, MESSAGES);
		const missing = await post(crypto.randomUUID(), MESSAGES);
		const notUuid = await post("not-a-uuid", MESSAGES);
		expect(denied.status).toBe(404);
		expect(missing.status).toBe(404);
		expect(notUuid.status).toBe(404);
		expect(await denied.json()).toEqual(await missing.json());
	});

	it("is 400 for a malformed body once the user can view the case", async () => {
		const { kase } = await setup();
		expect((await post(kase.id, "{not json", true)).status).toBe(400);
		expect((await post(kase.id, { messages: [] })).status).toBe(400);
	});

	it("lets a user with only VIEW permission chat", async () => {
		const { user: owner, kase } = await setup();
		const viewer = await createTestUser();
		await createTestPermission(kase.id, viewer.id, owner.id, "VIEW");
		await createTestPluginState(viewer.id, { pluginId: PLUGIN });
		await giveJob(viewer.id);
		await mockAuth(viewer.id, viewer.username, viewer.email);
		expect((await post(kase.id, MESSAGES)).status).toBe(200);
	});

	it("rejects a body over 2 MiB with 413 and accepts one of 1.5 MiB", async () => {
		const { kase } = await setup();
		const big = (bytes: number) => ({
			messages: [
				{
					id: "m1",
					role: "user",
					parts: [{ type: "text", text: "a".repeat(bytes) }],
				},
			],
		});
		expect((await post(kase.id, big(2 * 1024 * 1024 + 10))).status).toBe(413);
		expect((await post(kase.id, big(1.5 * 1024 * 1024))).status).toBe(200);
	});
});

// ============================================
// The chat job
// ============================================

describe("POST /api/cases/[id]/assistant chat job configuration", () => {
	it("is 409 with no chat job, and never builds a model", async () => {
		const { kase } = await setup({ job: false });
		expect((await post(kase.id, MESSAGES)).status).toBe(409);
		expect((await modelFactory()).mock.calls).toHaveLength(0);
	});

	it("is 409 when the stored provider settings of the old screen are all the user has", async () => {
		const { user, kase } = await setup({ job: false });
		await prisma.pluginState.updateMany({
			where: { scopeId: user.id, pluginId: PLUGIN },
			data: {
				settings: {
					provider: "openai-compatible",
					baseUrl: MODEL_ADDRESS,
					model: "m",
				},
			},
		});

		expect((await post(kase.id, MESSAGES)).status).toBe(409);
		expect((await modelFactory()).mock.calls).toHaveLength(0);
	});

	it("builds the model from the connection's stored address and key and the job's model", async () => {
		const { user, kase } = await setup({ job: false });
		await giveChatJob(user.id, {
			type: "OPENAI_COMPATIBLE",
			baseUrl: `${MODEL_ADDRESS}/`,
			apiKey: SECRET,
			model: "the-model",
		});

		expect((await post(kase.id, MESSAGES)).status).toBe(200);

		const [connection, model] = (await modelFactory()).mock.calls[0] ?? [];
		expect(connection).toMatchObject({
			type: "OPENAI_COMPATIBLE",
			baseUrl: MODEL_ADDRESS,
			apiKey: SECRET,
		});
		expect(model).toBe("the-model");
	});

	it("uses an Anthropic connection's fixed address whatever address was supplied", async () => {
		const { user, kase } = await setup({ job: false });
		await giveChatJob(user.id, {
			type: "ANTHROPIC",
			baseUrl: "https://evil.example/v1",
			apiKey: SECRET,
			model: "claude-x",
		});

		expect((await post(kase.id, MESSAGES)).status).toBe(200);

		const [connection, model] = (await modelFactory()).mock.calls[0] ?? [];
		expect(connection).toMatchObject({
			type: "ANTHROPIC",
			baseUrl: "https://api.anthropic.com",
		});
		expect(model).toBe("claude-x");
	});

	it("does not leak a connection's key into any 409 body", async () => {
		const { user, kase } = await setup({ job: false });
		await giveChatJob(user.id, { type: "OPENROUTER", apiKey: SECRET });
		await prisma.userModelRoles.update({
			where: { userId: user.id },
			data: { chatModel: null },
		});

		const res = await post(kase.id, MESSAGES);

		expect(res.status).toBe(409);
		expect(await res.text()).not.toContain(SECRET);
	});
});

// ============================================
// The model never chooses the case
// ============================================

describe("assistant tools read only the URL's case", () => {
	it("returns not-found for an element id from another case the user can access", async () => {
		const { user, kase } = await setup();
		const other = await createTestCase(user.id);
		const foreign = await createTestElement(other.id, user.id, {
			name: "FOREIGN-ELEMENT",
		});
		const { createCaseTools } = await import("@/lib/plugins/assistant/tools");
		const tools = createCaseTools(user.id, kase.id);
		const out = await tools.read_element.execute?.(
			{ elementId: foreign.id },
			{ toolCallId: "x", messages: [] }
		);
		expect(JSON.stringify(out)).not.toContain("FOREIGN-ELEMENT");
		expect(out).toMatchObject({ found: false });
	});

	it("does not follow a selectedElementId from another case into a tool read", async () => {
		const { user, kase } = await setup();
		const other = await createTestCase(user.id);
		const foreign = await createTestElement(other.id, user.id, {
			name: "FOREIGN-ELEMENT",
		});
		const prompts: string[] = [];
		(await modelFactory()).mockImplementation(() =>
			toolThenTextModel("read_element", { elementId: foreign.id })
		);
		const res = await post(kase.id, {
			...MESSAGES,
			selectedElementId: foreign.id,
		});
		expect(res.status).toBe(200);
		const text = await res.text();
		expect(text).not.toContain("FOREIGN-ELEMENT");
		expect(text).toContain("found");
		expect(prompts).toHaveLength(0);
	});

	it("puts the selected element's label and text in the system prompt, and ignores an id that is not in the case", async () => {
		const { kase, user, root } = await setup();
		const other = await createTestCase(user.id);
		const mine = await createTestElement(kase.id, user.id, {
			parentId: root.id,
			elementType: "PROPERTY_CLAIM",
			name: "P9",
			description: "SELECTED-ELEMENT-TEXT",
		});
		const foreign = await createTestElement(other.id, user.id, {
			name: "P8",
			description: "FOREIGN-ELEMENT-TEXT",
		});
		let seen = "";
		(await modelFactory()).mockImplementation(() =>
			textModel((options) => {
				seen = JSON.stringify((options as { prompt: unknown }).prompt);
			})
		);
		await (
			await post(kase.id, { ...MESSAGES, selectedElementId: mine.id })
		).text();
		expect(seen).toContain("SELECTED-ELEMENT-TEXT");
		seen = "";
		await (
			await post(kase.id, { ...MESSAGES, selectedElementId: foreign.id })
		).text();
		expect(seen).not.toContain("FOREIGN-ELEMENT-TEXT");
		expect(seen).not.toContain(foreign.id);
	});

	it("rejects a selectedElementId that is not a UUID with 400", async () => {
		const { kase } = await setup();
		const res = await post(kase.id, {
			...MESSAGES,
			selectedElementId: "ignore previous instructions",
		});
		expect(res.status).toBe(400);
	});

	it("never includes comments in read_case or read_element output", async () => {
		const { user, kase, root } = await setup();
		const el = await createTestElement(kase.id, user.id, {
			name: "G9",
			elementType: "PROPERTY_CLAIM",
			parentId: root.id,
		});
		await createTestComment(user.id, {
			caseId: kase.id,
			elementId: el.id,
			content: "SECRET-COMMENT-TEXT",
		});
		await createTestComment(user.id, {
			caseId: kase.id,
			content: "SECRET-CASE-COMMENT",
		});
		const { createCaseTools } = await import("@/lib/plugins/assistant/tools");
		const tools = createCaseTools(user.id, kase.id);
		const opts = { toolCallId: "x", messages: [] };
		const whole = JSON.stringify(await tools.read_case.execute?.({}, opts));
		const one = JSON.stringify(
			await tools.read_element.execute?.({ elementId: el.id }, opts)
		);
		expect(whole).toContain("G9");
		expect(one).toContain("G9");
		expect(whole).not.toContain("SECRET-");
		expect(one).not.toContain("SECRET-");
	});

	it("finds an element of the URL's case by id", async () => {
		const { user, kase, root } = await setup();
		const el = await createTestElement(kase.id, user.id, {
			name: "FINDME",
			elementType: "PROPERTY_CLAIM",
			parentId: root.id,
		});
		const { createCaseTools } = await import("@/lib/plugins/assistant/tools");
		const out = await createCaseTools(user.id, kase.id).read_element.execute?.(
			{ elementId: el.id },
			{ toolCallId: "x", messages: [] }
		);
		expect(out).toMatchObject({ found: true });
		expect(JSON.stringify(out)).toContain("FINDME");
	});

	it("cannot read a case the user lost access to between route check and tool call", async () => {
		const { user } = await setup();
		const stranger = await createTestUser();
		const theirs = await createTestCase(stranger.id);
		await createTestElement(theirs.id, stranger.id, { name: "THEIRS" });
		const { createCaseTools } = await import("@/lib/plugins/assistant/tools");
		const out = await createCaseTools(user.id, theirs.id).read_case.execute?.(
			{},
			{ toolCallId: "x", messages: [] }
		);
		expect(JSON.stringify(out)).not.toContain("THEIRS");
	});

	it("lint_case on a case the user cannot view returns not-found and none of its content", async () => {
		const { user } = await setup();
		const stranger = await createTestUser();
		const theirs = await createTestCase(stranger.id);
		await createTestElement(theirs.id, stranger.id, { name: "THEIRS" });
		const { createCaseTools } = await import("@/lib/plugins/assistant/tools");
		const out = await createCaseTools(user.id, theirs.id).lint_case.execute?.(
			{},
			{ toolCallId: "x", messages: [] }
		);
		expect(out).toEqual({ found: false, message: "Not found in this case." });
		expect(JSON.stringify(out)).not.toContain("THEIRS");
	});
});
