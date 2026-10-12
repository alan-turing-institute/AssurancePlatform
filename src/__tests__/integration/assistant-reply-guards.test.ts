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
 * that answers with far more tool calls than a reply should make, and a
 * provider whose error text quotes the key.
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
const TOO_MANY = "Too many tool calls in one reply.";

let server: CountingServer;
let logs: LogCapture;
let chatAnswer: (hit: Hit, response: ServerResponse) => void;

beforeEach(async () => {
	resetHarness();
	vi.mocked(exportCase).mockClear();
	chatAnswer = (_hit, response) => streamChat(response, "Done.");
	server = await startServer((hit, response) => {
		if (hit.url === CHAT) {
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

async function setup() {
	const user = await makeUser();
	const testCase = await createTestCaseWithGoal(user.id);
	await signInAs(user);
	const connection = await addConnection(user.id, {
		label: "Chat host",
		baseUrl: server.origin,
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
		const chunk = (delta: object, finish: string | null) =>
			`data: ${JSON.stringify({
				id: "1",
				object: "chat.completion.chunk",
				created: 1,
				model: "stub",
				choices: [{ index: 0, delta, finish_reason: finish }],
			})}\n\n`;
		response.write(
			chunk(
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
		response.write(chunk({}, "tool_calls"));
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
