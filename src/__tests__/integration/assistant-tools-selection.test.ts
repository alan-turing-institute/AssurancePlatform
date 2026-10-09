// biome-ignore-all lint/performance/useTopLevelRegex: inline patterns keep each assertion readable
import { MockLanguageModelV3, simulateReadableStream } from "ai/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	createTestCase,
	createTestElement,
	createTestPluginState,
	createTestUser,
} from "../utils/prisma-factories";

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/plugins/assistant/model", () => ({
	createAssistantModel: vi.fn(),
}));

const decryptSpy = vi.hoisted(() => ({ throwOnDecrypt: false, calls: 0 }));
vi.mock("@/lib/auth/token-encryption", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@/lib/auth/token-encryption")>();
	return {
		...actual,
		decryptToken: (stored: string) => {
			decryptSpy.calls += 1;
			if (decryptSpy.throwOnDecrypt) {
				throw new Error("decrypt must not be called");
			}
			return actual.decryptToken(stored);
		},
	};
});

const PLUGIN = "tea.assistant";
const SECRET = "sk-test-SECRET-value-123";
const ALLOWED = "https://llm.example/v1";

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

async function modelFactory() {
	const mod = await import("@/lib/plugins/assistant/model");
	return vi.mocked(mod.createAssistantModel);
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

async function setup(
	settings: Record<string, unknown> | null = {
		provider: "openai-compatible",
		baseUrl: ALLOWED,
		model: "m",
	},
	withKey = true,
	enabled = true
) {
	const user = await createTestUser();
	const kase = await createTestCase(user.id);
	const root = await createTestElement(kase.id, user.id, {
		name: "G1",
		description: "The model is robust",
	});
	// The assistant is off until the user turns it on, so an enabling row is
	// always written unless the test asks for the user to have switched it off.
	if (enabled) {
		await createTestPluginState(user.id, {
			pluginId: PLUGIN,
			settings: settings ?? undefined,
			enabled: true,
		});
	}
	if (withKey) {
		const { writeUserApiKey } = await import(
			"@/lib/plugins/assistant/key-store"
		);
		await writeUserApiKey(user.id, SECRET);
	}
	await mockAuth(user.id, user.username, user.email);
	return { user, kase, root };
}

beforeEach(async () => {
	await mockNoAuth();
	vi.stubEnv("ASSISTANT_ALLOWED_BASE_URLS", ALLOWED);
	(await modelFactory()).mockReset();
});

afterEach(() => {
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
});

function systemPromptOf(options: unknown): string {
	const prompt = (options as { prompt: { role: string; content: unknown }[] })
		.prompt;
	return prompt
		.filter((m) => m.role === "system")
		.map((m) => String(m.content))
		.join("\n");
}

async function capturePrompt(kase: { id: string }, extra: object = {}) {
	let seen = "";
	(await modelFactory()).mockImplementation(() =>
		textModel((o) => {
			seen = systemPromptOf(o);
		})
	);
	const res = await post(kase.id, { ...MESSAGES, ...extra });
	await res.text();
	return { res, prompt: seen };
}

describe("assistant selected element in the system prompt", () => {
	it("names the selected element's label, type and text and what 'this claim' means", async () => {
		const { kase, root } = await setup();
		const { res, prompt } = await capturePrompt(kase, {
			selectedElementId: root.id,
		});
		expect(res.status).toBe(200);
		expect(prompt).toMatch(
			/The user has selected G1 \(\w+\): The model is robust\. "This claim", "this element" and "the selected element" mean it\./
		);
	});

	it("adds nothing when no element is selected", async () => {
		const { kase } = await setup();
		const { prompt } = await capturePrompt(kase);
		expect(prompt).not.toContain("The user has selected");
	});

	it("adds nothing, and raises no error, for an id that is not in any case", async () => {
		const { kase } = await setup();
		const { res, prompt } = await capturePrompt(kase, {
			selectedElementId: crypto.randomUUID(),
		});
		expect(res.status).toBe(200);
		expect(prompt).not.toContain("The user has selected");
	});

	it("adds nothing for an element of another case the user can also read", async () => {
		const { user, kase } = await setup();
		const other = await createTestCase(user.id);
		const foreign = await createTestElement(other.id, user.id, {
			name: "FOREIGN-LABEL",
			description: "foreign-description-text",
		});
		const { res, prompt } = await capturePrompt(kase, {
			selectedElementId: foreign.id,
		});
		expect(res.status).toBe(200);
		expect(prompt).not.toContain("The user has selected");
		expect(prompt).not.toContain("FOREIGN-LABEL");
		expect(prompt).not.toContain("foreign-description-text");
	});

	it("finds a nested element and does not print null for an empty description", async () => {
		const { user, kase, root } = await setup();
		const child = await createTestElement(kase.id, user.id, {
			name: "P1",
			elementType: "PROPERTY_CLAIM",
			parentId: root.id,
			description: "",
		});
		const { prompt } = await capturePrompt(kase, {
			selectedElementId: child.id,
		});
		expect(prompt).toMatch(/The user has selected P1 \(\w+\): \./);
		expect(prompt).not.toMatch(/selected[^\n]*(null|undefined)/);
	});
});

describe("assistant suggest_techniques through the route", () => {
	const TECH_URL = "https://techniques.example/mcp";

	function stubTechniques(respond: () => Response | Promise<Response>) {
		const real = globalThis.fetch;
		const spy = vi
			.spyOn(globalThis, "fetch")
			.mockImplementation((input, init) =>
				String(input) === TECH_URL
					? Promise.resolve(respond())
					: real(input, init)
			);
		return spy;
	}

	const GOOD = () =>
		new Response(
			JSON.stringify({
				result: {
					structuredContent: {
						rankingAvailable: true,
						results: [
							{
								slug: "s",
								name: "SHAP",
								score: 0.9,
								retrievalScore: 0.2,
								goals: ["Explainability"],
								url: "https://techniques.example/shap",
							},
						],
					},
				},
			}),
			{ status: 200 }
		);

	it("carries the recommend-only-from-results rule in the prompt when the variable is set", async () => {
		vi.stubEnv("TECHNIQUES_MCP_URL", TECH_URL);
		const { kase } = await setup();
		const { prompt } = await capturePrompt(kase);
		expect(prompt).toMatch(/only from its results/i);
		expect(prompt).toMatch(/never invent/i);
	});

	it("says suggestions are unavailable when the variable is unset", async () => {
		vi.stubEnv("TECHNIQUES_MCP_URL", "");
		const { kase } = await setup();
		const { prompt } = await capturePrompt(kase);
		expect(prompt).toMatch(/unavailable in this deployment/i);
		expect(prompt).not.toMatch(/only from its results/i);
	});

	it("offers the tool to the model only when the variable is set", async () => {
		const names = async (url: string) => {
			vi.stubEnv("TECHNIQUES_MCP_URL", url);
			const { kase } = await setup();
			let tools: string[] = [];
			(await modelFactory()).mockImplementation(() =>
				textModel((o) => {
					tools = ((o as { tools?: { name: string }[] }).tools ?? []).map(
						(t) => t.name
					);
				})
			);
			await (await post(kase.id, MESSAGES)).text();
			return tools;
		};
		expect(await names(TECH_URL)).toContain("suggest_techniques");
		expect(await names("")).not.toContain("suggest_techniques");
	});

	it("defaults the claim to the selected element's text and posts to the configured URL", async () => {
		vi.stubEnv("TECHNIQUES_MCP_URL", TECH_URL);
		const { kase, root } = await setup();
		const spy = stubTechniques(GOOD);
		(await modelFactory()).mockImplementation(() =>
			toolThenTextModel("suggest_techniques", {})
		);
		const res = await post(kase.id, {
			...MESSAGES,
			selectedElementId: root.id,
		});
		await res.text();
		const call = spy.mock.calls.find((c) => String(c[0]) === TECH_URL);
		expect(call).toBeDefined();
		const body = JSON.parse(String(call?.[1]?.body));
		expect(body.method).toBe("tools/call");
		expect(body.params).toEqual({
			name: "suggest_techniques_for_claim",
			arguments: { claim: "The model is robust" },
		});
	});

	it("keeps the stream a 200 when the techniques service fails", async () => {
		vi.stubEnv("TECHNIQUES_MCP_URL", TECH_URL);
		const { kase } = await setup();
		stubTechniques(() => new Response("boom", { status: 500 }));
		(await modelFactory()).mockImplementation(() =>
			toolThenTextModel("suggest_techniques", { claimText: "c" })
		);
		const res = await post(kase.id, MESSAGES);
		const text = await res.text();
		expect(res.status).toBe(200);
		expect(text).toContain("The techniques service is not reachable.");
	});
});
