import type { ServerResponse } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setRoles } from "@/lib/services/model-connection-service";
import {
	assertNoLeaks,
	type CountingServer,
	captureLogs,
	type Hit,
	harness,
	json,
	type LogCapture,
	resetHarness,
	startServer,
	streamChat,
} from "../utils/model-adversarial-kit";
import {
	addConnection,
	makeUser,
	signInAs,
} from "../utils/model-adversarial-routes";
import { createTestCaseWithGoal } from "../utils/prisma-factories";

/**
 * What the assistant's reply route does about a model that misbehaves: a model
 * that answers with far more tool calls than a reply should make, a model that
 * runs out of output room, and a provider whose error text quotes the key.
 */

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/models/guarded-fetch", async (importOriginal) => {
	const { wrapGuardedFetch } = await import("../utils/model-adversarial-kit");
	return wrapGuardedFetch(
		await importOriginal<typeof import("@/lib/models/guarded-fetch")>()
	);
});

vi.mock("@/lib/services/case-export-service", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@/lib/services/case-export-service")>();
	return { ...actual, exportCase: vi.fn(actual.exportCase) };
});

const { exportCase } = await import("@/lib/services/case-export-service");

const KEY = "sk-reply-SECRET-6642";
const CHAT = "/v1/chat/completions";
const OPENROUTER_CHAT = "/api/v1/chat/completions";
const TOO_MANY = "Too many tool calls in one reply.";

let server: CountingServer;
let logs: LogCapture;
let chatAnswer: (hit: Hit, response: ServerResponse) => void;

beforeEach(async () => {
	resetHarness();
	vi.mocked(exportCase).mockClear();
	chatAnswer = (_hit, response) => streamChat(response, "Done.");
	server = await startServer((hit, response) => {
		if (hit.url === CHAT || hit.url === OPENROUTER_CHAT) {
			chatAnswer(hit, response);
		} else {
			json(response, {}, 404);
		}
	});
	vi.stubEnv("TEA_MODELS_LOCAL_ADDRESSES", server.origin);
	vi.stubEnv("TECHNIQUES_MCP_URL", "");
	harness.providerOrigin = server.origin;
	logs = captureLogs((name, value) => vi.stubEnv(name, value));
});

afterEach(async () => {
	logs.stop();
	vi.unstubAllEnvs();
	await server.close();
	assertNoLeaks();
});

async function setup(type: "OLLAMA" | "OPENROUTER" = "OLLAMA") {
	const user = await makeUser();
	const testCase = await createTestCaseWithGoal(user.id);
	await signInAs(user);
	const connection = await addConnection(user.id, {
		label: "Chat host",
		type,
		baseUrl: type === "OLLAMA" ? server.origin : undefined,
		apiKey: KEY,
	});
	const saved = await setRoles(user.id, {
		chat: { connectionId: connection.id, model: "chat-model" },
		ranking: null,
		search: null,
	});
	if ("error" in saved) {
		throw new Error(saved.error);
	}
	return { testCase };
}

async function chat(caseId: string) {
	const { POST } = await import("@/app/api/cases/[id]/assistant/route");
	const response = await POST(
		new Request(`http://localhost:3000/api/cases/${caseId}/assistant`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				messages: [
					{
						id: "m1",
						role: "user",
						parts: [{ type: "text", text: "What does the case claim?" }],
					},
				],
			}),
		}),
		{ params: Promise.resolve({ id: caseId }) }
	);
	return { status: response.status, text: await response.text() };
}

/** One server-sent chunk of a streamed chat completion. */
const completionChunk = (delta: object, finish: string | null) =>
	`data: ${JSON.stringify({
		id: "1",
		object: "chat.completion.chunk",
		created: 1,
		model: "stub",
		choices: [{ index: 0, delta, finish_reason: finish }],
	})}\n\n`;

/** The first model call answers with `count` calls of `read_case`; the next answers in words. */
function answerWithToolCalls(count: number) {
	let turn = 0;
	chatAnswer = (_hit, response) => {
		turn += 1;
		if (turn > 1) {
			streamChat(response, "Here is what I found.");
			return;
		}
		response.writeHead(200, { "content-type": "text/event-stream" });
		response.write(
			completionChunk(
				{
					role: "assistant",
					content: null,
					tool_calls: Array.from({ length: count }, (_, index) => ({
						index,
						id: `call_${index}`,
						type: "function",
						function: { name: "read_case", arguments: "{}" },
					})),
				},
				null
			)
		);
		response.write(completionChunk({}, "tool_calls"));
		response.end("data: [DONE]\n\n");
	};
}

/** The tool results the reply sent back to the model on its second call. */
function toolResultsSentBack(): string[] {
	const second = server.hits.filter((hit) => hit.url === CHAT)[1];
	const { messages } = JSON.parse(second?.body ?? "{}") as {
		messages: { content: unknown; role: string }[];
	};
	return messages
		.filter((message) => message.role === "tool")
		.map((message) => String(message.content));
}

describe("a model that answers with a great many tool calls in one step", () => {
	it("is held to 24 calls, exports the case once, and is told the rest were refused", async () => {
		answerWithToolCalls(50);
		const { testCase } = await setup();

		const outcome = await chat(testCase.id);

		expect(outcome.status).toBe(200);
		expect(outcome.text).toContain("Here is what I found.");
		const results = toolResultsSentBack();
		expect(results).toHaveLength(50);
		expect(results.filter((result) => result.includes(TOO_MANY))).toHaveLength(
			26
		);
		expect(
			results.filter((result) => result.includes('"found":true'))
		).toHaveLength(24);
		expect(exportCase).toHaveBeenCalledTimes(1);
	});

	it("exports the case again for the next reply, with a fresh cap", async () => {
		answerWithToolCalls(30);
		const { testCase } = await setup();
		await chat(testCase.id);
		expect(exportCase).toHaveBeenCalledTimes(1);

		server.hits.length = 0;
		answerWithToolCalls(30);
		await chat(testCase.id);

		expect(exportCase).toHaveBeenCalledTimes(2);
		expect(
			toolResultsSentBack().filter((result) => result.includes(TOO_MANY))
		).toHaveLength(6);
	});
});

describe("what the route logs when the provider fails", () => {
	it("records the error's name and the HTTP status, and nothing the provider said", async () => {
		chatAnswer = (_hit, response) =>
			json(
				response,
				{ error: { message: `Invalid key ${KEY} for ${server.origin}` } },
				401
			);
		const { testCase } = await setup();

		const outcome = await chat(testCase.id);

		expect(outcome.text).not.toContain(KEY);
		const entry = logs.entries.find(
			(logged) => logged.msg === "Assistant stream failed"
		);
		expect(entry).toBeDefined();
		expect(entry?.errorName).toEqual(expect.any(String));
		expect(entry?.errorName).not.toBe("unknown");
		expect(entry?.httpStatus).toBe(401);
		expect(Object.keys(entry ?? {}).sort()).toEqual([
			"component",
			"errorName",
			"httpStatus",
			"level",
			"msg",
			"ts",
		]);
		expect(logs.text()).not.toContain(KEY);
	});
});

/** A reply that is cut off by the model's output limit after some text. */
function answerCutShort() {
	chatAnswer = (_hit, response) => {
		response.writeHead(200, { "content-type": "text/event-stream" });
		response.write(
			completionChunk({ role: "assistant", content: "Half an ans" }, null)
		);
		response.write(completionChunk({}, "length"));
		response.end("data: [DONE]\n\n");
	};
}

describe("a model that runs out of output room", () => {
	it("is asked for up to 8192 tokens, and the reply carries a notice when it is cut short", async () => {
		answerCutShort();
		const { testCase } = await setup();

		const outcome = await chat(testCase.id);

		const sent = JSON.parse(
			server.hits.find((hit) => hit.url === CHAT)?.body ?? "{}"
		) as { max_tokens?: number };
		expect(sent.max_tokens).toBe(8192);
		expect(outcome.text).toContain("Half an ans");
		expect(outcome.text).toContain('"type":"data-notice","data":"length"');
	});

	it("carries no notice when the model finished its answer", async () => {
		const { testCase } = await setup();

		const outcome = await chat(testCase.id);

		expect(outcome.text).toContain("Done.");
		expect(outcome.text).not.toContain("data-notice");
	});

	it("bounds a reasoning model's thinking on OpenRouter, and sends no such parameter to Ollama", async () => {
		const openRouter = await setup("OPENROUTER");
		await chat(openRouter.testCase.id);
		const routed = JSON.parse(
			server.hits.find((hit) => hit.url === OPENROUTER_CHAT)?.body ?? "{}"
		) as { max_tokens?: number; reasoning?: unknown };
		expect(routed.max_tokens).toBe(8192);
		expect(routed.reasoning).toEqual({ max_tokens: 3072 });

		server.hits.length = 0;
		const ollama = await setup("OLLAMA");
		await chat(ollama.testCase.id);
		const local = JSON.parse(
			server.hits.find((hit) => hit.url === CHAT)?.body ?? "{}"
		) as Record<string, unknown>;
		expect(local.max_tokens).toBe(8192);
		expect(local).not.toHaveProperty("reasoning");
	});
});

/** A reply whose first step sends no text, no thinking and no tool call, and ends for `reason`. */
function answerWithNothing(reason: string) {
	chatAnswer = (_hit, response) => {
		response.writeHead(200, { "content-type": "text/event-stream" });
		// The SDK drops empty content, so nothing of it reaches the stream.
		response.write(completionChunk({ role: "assistant", content: "" }, null));
		response.write(completionChunk({}, reason));
		response.end("data: [DONE]\n\n");
	};
}

describe("a model that answers with nothing", () => {
	it.each([
		["stop", "stop"],
		["content_filter", "content-filter"],
	])("ends the reply with a notice before the finish chunk when the model finishes with %s", async (providerReason, sdkReason) => {
		answerWithNothing(providerReason);
		const { testCase } = await setup();

		const outcome = await chat(testCase.id);

		const notice = outcome.text.indexOf('"type":"data-notice","data":"empty"');
		const finish = outcome.text.indexOf(`"finishReason":"${sdkReason}"`);
		expect(notice).toBeGreaterThan(-1);
		expect(finish).toBeGreaterThan(notice);
		expect(outcome.text).not.toContain("text-delta");
	});
});

/** Every model call answers with a short preamble and a call of `read_case`, so the reply never reaches an answer. */
function answerWithToolCallsEveryStep() {
	let turn = 0;
	chatAnswer = (_hit, response) => {
		turn += 1;
		response.writeHead(200, { "content-type": "text/event-stream" });
		response.write(
			completionChunk(
				{
					role: "assistant",
					content: "I'll read the case.",
					tool_calls: [
						{
							index: 0,
							id: `call_${turn}`,
							type: "function",
							function: { name: "read_case", arguments: "{}" },
						},
					],
				},
				null
			)
		);
		response.write(completionChunk({}, "tool_calls"));
		response.end("data: [DONE]\n\n");
	};
}

describe("a model that keeps calling tools", () => {
	it("is stopped after 8 steps, and the reply carries a notice that it hit the step limit", async () => {
		answerWithToolCallsEveryStep();
		const { testCase } = await setup();

		const outcome = await chat(testCase.id);

		expect(server.hits.filter((hit) => hit.url === CHAT)).toHaveLength(8);
		expect(outcome.text).toContain("I'll read the case.");
		expect(outcome.text).toContain('"type":"data-notice","data":"steps"');
	});
});

/** The text of the error the reply's stream ends with. */
function errorTextOf(stream: string): string {
	for (const line of stream.split("\n")) {
		if (line.startsWith("data: ")) {
			const chunk = JSON.parse(line.slice("data: ".length)) as {
				errorText?: string;
				type?: string;
			};
			if (chunk.type === "error") {
				return chunk.errorText ?? "";
			}
		}
	}
	return "";
}

describe("what the user is told when the provider refuses", () => {
	const REASON =
		"This model requires you to complete the following before use: 18+ age confirmation";

	it("shows the provider's own reason and nothing else, and logs none of it", async () => {
		chatAnswer = (_hit, response) =>
			json(response, { error: { message: REASON } }, 403);
		const { testCase } = await setup();

		const outcome = await chat(testCase.id);

		expect(errorTextOf(outcome.text)).toBe(REASON);
		// The same text is kept with the reply, ahead of the error.
		const kept = outcome.text.indexOf(
			JSON.stringify({ type: "data-error-reason", data: REASON })
		);
		expect(kept).toBeGreaterThan(-1);
		expect(outcome.text.indexOf('"type":"error"')).toBeGreaterThan(kept);
		expect(logs.text()).not.toContain("18+ age");
		expect(logs.text()).not.toContain(REASON);
	});

	it("removes the key and the address from what it shows, and cuts it to 300 characters", async () => {
		chatAnswer = (_hit, response) =>
			json(
				response,
				{
					error: {
						message: `Invalid key ${KEY} for ${server.origin}/v1; Bearer ${KEY}. ${"More. ".repeat(100)}`,
					},
				},
				401
			);
		const { testCase } = await setup();

		const outcome = await chat(testCase.id);

		expect(outcome.text).toContain("Invalid key [key removed] for");
		for (const secret of [KEY, String(server.port), "127.0.0.1"]) {
			expect(outcome.text).not.toContain(secret);
			expect(logs.text()).not.toContain(secret);
		}
		const shown = errorTextOf(outcome.text);
		expect(shown.length).toBeLessThanOrEqual(300);
		expect(shown.startsWith("Invalid key [key removed] for")).toBe(true);
	});

	it("gives only the fixed sentence when the address is refused", async () => {
		vi.stubEnv("TEA_MODELS_LOCAL_ADDRESSES", "");
		const { testCase } = await setup();

		const outcome = await chat(testCase.id);

		expect(errorTextOf(outcome.text)).toBe(
			"The model provider returned an error."
		);
	});
});
