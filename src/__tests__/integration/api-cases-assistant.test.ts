import { MockLanguageModelV3, simulateReadableStream } from "ai/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readUserApiKey } from "@/lib/plugins/assistant/key-store";
import { setPluginEnabledForUser } from "@/lib/services/plugin-enablement-service";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	addTeamMember,
	createTestCase,
	createTestComment,
	createTestElement,
	createTestPermission,
	createTestPluginState,
	createTestTeam,
	createTestTeamPermission,
	createTestUser,
} from "../utils/prisma-factories";

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

// The model provider is replaced: no test here may reach a real model.
vi.mock("@/lib/plugins/assistant/key-store", () => ({
	readUserApiKey: vi.fn().mockResolvedValue("ollama"),
}));

const mockModel = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/lib/plugins/assistant/model", () => ({
	createAssistantModel: () => mockModel.current,
}));

const PLUGIN_ID = "tea.assistant";
const BASE_URL = "http://localhost:11434/v1";
const NONEXISTENT_ID = "00000000-0000-0000-0000-000000000000";
const COMMENT_TEXT = "private reviewer remark";

const USAGE = {
	inputTokens: {
		total: 1,
		noCache: 1,
		cacheRead: undefined,
		cacheWrite: undefined,
	},
	outputTokens: { total: 1, text: 1, reasoning: undefined },
};
const FINISH = (unified: "stop" | "tool-calls") => ({
	type: "finish" as const,
	finishReason: { unified, raw: undefined },
	usage: USAGE,
});

function textStep(text: string) {
	return {
		stream: simulateReadableStream({
			chunks: [
				{ type: "stream-start" as const, warnings: [] },
				{ type: "text-start" as const, id: "t1" },
				{ type: "text-delta" as const, id: "t1", delta: text },
				{ type: "text-end" as const, id: "t1" },
				FINISH("stop"),
			],
		}),
	};
}

function toolStep(toolName: string, input: object) {
	return {
		stream: simulateReadableStream({
			chunks: [
				{ type: "stream-start" as const, warnings: [] },
				{
					type: "tool-call" as const,
					toolCallId: "call-1",
					toolName,
					input: JSON.stringify(input),
				},
				FINISH("tool-calls"),
			],
		}),
	};
}

function useModel(
	steps: (ReturnType<typeof textStep> | ReturnType<typeof toolStep>)[]
) {
	mockModel.current = new MockLanguageModelV3({ doStream: steps });
}

beforeEach(async () => {
	await mockNoAuth();
	vi.stubEnv("ASSISTANT_ALLOWED_BASE_URLS", BASE_URL);
	useModel([textStep("ok")]);
});

afterEach(() => {
	vi.unstubAllEnvs();
});

async function configure(userId: string) {
	await createTestPluginState(userId, {
		pluginId: PLUGIN_ID,
		settings: {
			provider: "openai-compatible",
			baseUrl: BASE_URL,
			model: "small-model",
		},
	});
}

async function setup() {
	const owner = await createTestUser();
	const testCase = await createTestCase(owner.id);
	const goal = await createTestElement(testCase.id, owner.id, {
		elementType: "GOAL",
		name: "G1",
		description: "The system is acceptably safe",
		role: "TOP_LEVEL",
	});
	await createTestComment(owner.id, {
		caseId: testCase.id,
		elementId: goal.id,
		content: COMMENT_TEXT,
	});
	return { owner, testCase, goal };
}

function postRequest(caseId: string, body: unknown = defaultBody()): Request {
	return new Request(`http://localhost:3000/api/cases/${caseId}/assistant`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(body),
	});
}

function defaultBody() {
	return {
		messages: [
			{
				id: "m1",
				role: "user",
				parts: [{ type: "text", text: "What does G1 claim?" }],
			},
		],
	};
}

async function post(caseId: string, body?: unknown) {
	const { POST } = await import("@/app/api/cases/[id]/assistant/route");
	return POST(postRequest(caseId, body), {
		params: Promise.resolve({ id: caseId }),
	});
}

describe("POST /api/cases/[id]/assistant — who may chat", () => {
	it("streams a reply for the owner", async () => {
		const { owner, testCase } = await setup();
		await configure(owner.id);
		await mockAuth(owner.id, owner.username, owner.email);

		const response = await post(testCase.id);

		expect(response.status).toBe(200);
		expect(await response.text()).toContain("ok");
	});

	it.each([
		"VIEW",
		"COMMENT",
		"EDIT",
		"ADMIN",
	] as const)("streams a reply for a user with direct %s permission", async (level) => {
		const { owner, testCase } = await setup();
		const user = await createTestUser();
		await configure(user.id);
		await createTestPermission(testCase.id, user.id, owner.id, level);
		await mockAuth(user.id, user.username, user.email);

		const response = await post(testCase.id);

		expect(response.status).toBe(200);
	});

	it("streams a reply for a member of a team with access", async () => {
		const { owner, testCase } = await setup();
		const member = await createTestUser();
		await configure(member.id);
		const team = await createTestTeam(owner.id);
		await addTeamMember(team.id, member.id);
		await createTestTeamPermission(testCase.id, team.id, owner.id, "VIEW");
		await mockAuth(member.id, member.username, member.email);

		const response = await post(testCase.id);

		expect(response.status).toBe(200);
	});

	it("returns 404 for a user with no permission", async () => {
		const { testCase } = await setup();
		const outsider = await createTestUser();
		await configure(outsider.id);
		await mockAuth(outsider.id, outsider.username, outsider.email);

		const response = await post(testCase.id);

		expect(response.status).toBe(404);
	});

	it("returns 401 with no session", async () => {
		const { testCase } = await setup();

		const response = await post(testCase.id);

		expect(response.status).toBe(401);
	});

	it("returns a 404 identical to the no-permission 404 for a missing case", async () => {
		const { testCase } = await setup();
		const outsider = await createTestUser();
		await configure(outsider.id);
		await mockAuth(outsider.id, outsider.username, outsider.email);

		const noAccess = await post(testCase.id);
		const missing = await post(NONEXISTENT_ID);

		expect(missing.status).toBe(404);
		expect(await missing.json()).toEqual(await noAccess.json());
	});
});

describe("POST /api/cases/[id]/assistant — plugin and configuration", () => {
	it("returns 404 when the user has turned the plugin off", async () => {
		const { owner, testCase } = await setup();
		await configure(owner.id);
		await setPluginEnabledForUser(PLUGIN_ID, owner.id, { enabled: false });
		await mockAuth(owner.id, owner.username, owner.email);

		const response = await post(testCase.id);

		expect(response.status).toBe(404);
	});

	it("returns 404 when the deployment withholds the plugin", async () => {
		const { owner, testCase } = await setup();
		await configure(owner.id);
		vi.stubEnv("TEA_PLUGINS_DISABLED", PLUGIN_ID);
		await mockAuth(owner.id, owner.username, owner.email);

		const response = await post(testCase.id);

		expect(response.status).toBe(404);
	});

	it("returns 409 with a reason when no provider is configured", async () => {
		const { owner, testCase } = await setup();
		await mockAuth(owner.id, owner.username, owner.email);

		const response = await post(testCase.id);

		expect(response.status).toBe(409);
		expect((await response.json()).code).toBe("CONFLICT");
	});

	it("returns 409 when the stored base URL is not on the allow-list", async () => {
		const { owner, testCase } = await setup();
		await configure(owner.id);
		vi.stubEnv("ASSISTANT_ALLOWED_BASE_URLS", "http://other.example/v1");
		await mockAuth(owner.id, owner.username, owner.email);

		const response = await post(testCase.id);

		expect(response.status).toBe(409);
	});

	it("returns 409 when no API key is available", async () => {
		const { owner, testCase } = await setup();
		await configure(owner.id);
		vi.mocked(readUserApiKey).mockResolvedValueOnce(null);
		await mockAuth(owner.id, owner.username, owner.email);

		const response = await post(testCase.id);

		expect(response.status).toBe(409);
	});

	it("returns 400 for a malformed body", async () => {
		const { owner, testCase } = await setup();
		await configure(owner.id);
		await mockAuth(owner.id, owner.username, owner.email);

		const response = await post(testCase.id, { messages: [] });

		expect(response.status).toBe(400);
	});
});

describe("POST /api/cases/[id]/assistant — tools", () => {
	it("answers through a read_case call whose result holds the case and no comments", async () => {
		const { owner, testCase } = await setup();
		await configure(owner.id);
		useModel([toolStep("read_case", {}), textStep("G1 claims safety")]);
		await mockAuth(owner.id, owner.username, owner.email);

		const response = await post(testCase.id);
		const text = await response.text();

		expect(text).toContain("read_case");
		expect(text).toContain("The system is acceptably safe");
		expect(text).toContain("G1 claims safety");
		expect(text).not.toContain(COMMENT_TEXT);
	});

	it("reports an element id from another case as not found", async () => {
		const { owner, testCase } = await setup();
		const other = await createTestCase(owner.id);
		const foreign = await createTestElement(other.id, owner.id, {
			elementType: "GOAL",
			name: "FOREIGN",
			description: "belongs elsewhere",
		});
		await configure(owner.id);
		useModel([
			toolStep("read_element", { elementId: foreign.id }),
			textStep("not in this case"),
		]);
		await mockAuth(owner.id, owner.username, owner.email);

		const response = await post(testCase.id);
		const text = await response.text();

		expect(text).toContain("Not found in this case");
		expect(text).not.toContain("belongs elsewhere");
	});
});
