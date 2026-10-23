import { readFileSync } from "node:fs";
import type { ServerResponse } from "node:http";
import { generateText, type LanguageModel, streamText, type ToolSet } from "ai";
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { z } from "zod";
import { guardedFetch } from "../guarded-fetch";

vi.mock("../guarded-fetch", async (importOriginal) => {
	const original = await importOriginal<typeof import("../guarded-fetch")>();
	return { ...original, guardedFetch: vi.fn(original.guardedFetch) };
});

import {
	chatModelFor,
	chatProviderOptions,
	embeddingModelFor,
} from "../adapters";
import {
	CONNECTION_TYPES,
	type ModelConnectionAccess,
	type ModelConnectionType,
} from "../connection-types";
import {
	type ModelServer,
	type RecordedRequest,
	sendJson,
	startModelServer,
} from "./model-server";

/**
 * What a chat request carries for the reply's length limit, per connection
 * type, on the streamed path (which the assistant route uses) and the
 * non-streamed one.
 */

const KEY = "sk-test-secret-key";
const LIMIT = 8192;

type Body = Record<string, unknown>;
type Mode = "stream" | "generate";

let server: ModelServer;

/** When set, the first chat request is answered with a call to the `lookup` tool and the next with text. */
let callsToolFirst = false;

const TOOL_CALL = {
	id: "call_1",
	type: "function",
	function: { name: "lookup", arguments: JSON.stringify({ query: "x" }) },
};

function sendChatStream(response: ServerResponse, toolCall: boolean): void {
	response.writeHead(200, { "content-type": "text/event-stream" });
	const chunk = (delta: object, finish: string | null) =>
		`data: ${JSON.stringify({
			id: "chatcmpl-1",
			object: "chat.completion.chunk",
			created: 1,
			model: "m",
			choices: [{ index: 0, delta, finish_reason: finish }],
		})}\n\n`;
	if (toolCall) {
		response.write(
			chunk(
				{ role: "assistant", tool_calls: [{ index: 0, ...TOOL_CALL }] },
				null
			)
		);
		response.write(chunk({}, "tool_calls"));
	} else {
		response.write(chunk({ role: "assistant", content: "hello" }, null));
		response.write(chunk({}, "stop"));
	}
	response.end("data: [DONE]\n\n");
}

function answer(request: RecordedRequest, response: ServerResponse): void {
	if (request.url.endsWith("/chat/completions")) {
		const body = JSON.parse(request.body) as Body;
		const sentToolResult = (body.messages as { role: string }[]).some(
			(message) => message.role === "tool"
		);
		const toolCall = callsToolFirst && !sentToolResult;
		if (body.stream === true) {
			sendChatStream(response, toolCall);
			return;
		}
		sendJson(response, {
			id: "chatcmpl-1",
			object: "chat.completion",
			created: 1,
			model: "m",
			choices: [
				{
					index: 0,
					message: toolCall
						? { role: "assistant", content: null, tool_calls: [TOOL_CALL] }
						: { role: "assistant", content: "hello" },
					finish_reason: toolCall ? "tool_calls" : "stop",
				},
			],
			usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
		});
	} else if (request.url.endsWith("/messages")) {
		sendJson(response, {
			id: "msg_1",
			type: "message",
			role: "assistant",
			model: "m",
			content: [{ type: "text", text: "hello" }],
			stop_reason: "end_turn",
			stop_sequence: null,
			usage: { input_tokens: 1, output_tokens: 1 },
		});
	} else {
		sendJson(response, { error: "not found" }, 404);
	}
}

beforeAll(async () => {
	server = await startModelServer(answer);
});

afterAll(() => server.close());

beforeEach(() => {
	server.requests.length = 0;
	vi.stubEnv("TEA_MODELS_LOCAL_ADDRESSES", server.origin);
});

afterEach(() => {
	vi.mocked(guardedFetch).mockRestore();
	vi.unstubAllEnvs();
	callsToolFirst = false;
});

function connection(
	type: ModelConnectionType,
	overrides: Partial<ModelConnectionAccess> = {}
): ModelConnectionAccess {
	return { type, baseUrl: server.origin, apiKey: KEY, ...overrides };
}

function lastBody(): Body {
	const request = server.requests.at(-1);
	if (!request) {
		throw new Error("The server received no request");
	}
	return JSON.parse(request.body) as Body;
}

interface CallOptions {
	maxOutputTokens?: number;
	providerOptions?: ReturnType<typeof chatProviderOptions>;
	seed?: number;
	stopSequences?: string[];
	system?: string;
	temperature?: number;
	tools?: ToolSet;
	topP?: number;
}

/** Makes one chat call in the given mode and returns the body the server received. */
async function sentBody(
	model: LanguageModel,
	mode: Mode,
	extra: CallOptions = {}
): Promise<Body> {
	const options = { model, prompt: "hi", maxRetries: 0, ...extra };
	if (mode === "stream") {
		const result = streamText(options);
		await result.consumeStream();
		await result.text;
	} else {
		await generateText(options);
	}
	return lastBody();
}

const MODES: Mode[] = ["stream", "generate"];
const OTHER_OPENAI_STYLE = [
	"OPENROUTER",
	"OLLAMA",
	"OPENAI_COMPATIBLE",
] as const;

describe("an OpenAI Responses request", () => {
	const access = {
		type: "OPENAI",
		baseUrl: "https://ignored.example",
		apiKey: KEY,
	} as const;
	const fixture = readFileSync(
		"lib/plugins/assistant/__tests__/fixtures/openai-answer.sse",
		"utf8"
	);

	async function request(
		model = "gpt-6.1-sol",
		maxOutputTokens: number | undefined = LIMIT
	) {
		vi.mocked(guardedFetch).mockResolvedValue(
			new Response(fixture, {
				headers: { "content-type": "text/event-stream" },
			})
		);
		const result = streamText({
			model: chatModelFor(access, model),
			prompt: "hi",
			maxOutputTokens,
			providerOptions: chatProviderOptions(access),
			maxRetries: 0,
			tools: { lookup: { inputSchema: z.object({ query: z.string() }) } },
		});
		await result.consumeStream();
		const text = await result.text;
		const [url, init, guard] = vi.mocked(guardedFetch).mock.calls.at(-1)!;
		return { url, init, guard, text, body: JSON.parse(String(init?.body)) };
	}

	it("posts tools, the connection key and max_output_tokens to the fixed Responses address through the capped guard", async () => {
		const { url, init, guard, body, text } = await request();
		expect(text).toBe("The case is ready.");
		expect(url).toBe("https://api.openai.com/v1/responses");
		expect(init?.method).toBe("POST");
		expect(new Headers(init?.headers).get("authorization")).toBe(
			`Bearer ${KEY}`
		);
		expect(guard).toEqual({ maxBytes: 4 * 1024 * 1024 });
		expect(body).toMatchObject({
			model: "gpt-6.1-sol",
			store: false,
			max_output_tokens: LIMIT,
			tools: [{ type: "function", name: "lookup" }],
		});
		expect(body).not.toHaveProperty("max_tokens");
		expect(body).not.toHaveProperty("max_completion_tokens");
		expect(
			vi
				.mocked(guardedFetch)
				.mock.calls.every(([address]) => String(address).endsWith("/responses"))
		).toBe(true);
	});

	it("requests encrypted reasoning with storage off and leaves reasoning effort at the model default", async () => {
		const { body } = await request();
		expect(chatProviderOptions(access)).toEqual({ openai: { store: false } });
		expect(body.include).toContain("reasoning.encrypted_content");
		expect(body).not.toHaveProperty("reasoning");
		expect(body).not.toHaveProperty("reasoning_effort");
	});

	it("sends no reasoning parameters to a non-reasoning model", async () => {
		const { body } = await request("gpt-4.1");
		expect(body.store).toBe(false);
		expect(body).not.toHaveProperty("reasoning");
		expect(body).not.toHaveProperty("reasoning_effort");
		expect(body.include ?? []).not.toContain("reasoning.encrypted_content");
	});

	it("uses the requested limit rather than a fixed value", async () => {
		expect((await request("gpt-4.1", 77)).body.max_output_tokens).toBe(77);
	});

	it("rejects a missing connection key even when the server has one", () => {
		vi.stubEnv("OPENAI_API_KEY", "server-key");
		expect(() =>
			chatModelFor({ ...access, apiKey: null }, "gpt-6.1-sol")
		).toThrow("An OPENAI connection needs a key to chat");
	});

	it("refuses to build when the type has no fixed address, whatever the server's environment holds", () => {
		vi.stubEnv("OPENAI_BASE_URL", "https://elsewhere.example/v1");
		const spec = CONNECTION_TYPES.OPENAI;
		Object.defineProperty(spec, "baseUrl", { value: null });
		try {
			expect(() => chatModelFor(access, "gpt-6.1-sol")).toThrow(
				"has no fixed address"
			);
		} finally {
			Object.defineProperty(spec, "baseUrl", {
				value: "https://api.openai.com/v1",
			});
		}
	});

	it("continues to refuse the search job", () => {
		expect(() => embeddingModelFor(access, "text-embedding-3-small")).toThrow(
			"cannot do the search job"
		);
	});
});

describe("a chat request on every other type", () => {
	it.each(
		OTHER_OPENAI_STYLE.flatMap((type) =>
			MODES.map((mode) => [type, mode] as const)
		)
	)("%s still sends max_tokens and no max_completion_tokens when %s", async (type, mode) => {
		const body = await sentBody(
			chatModelFor(connection(type), "some-model"),
			mode,
			{ maxOutputTokens: LIMIT }
		);

		expect(body.max_tokens).toBe(LIMIT);
		expect(body).not.toHaveProperty("max_completion_tokens");
	});

	it.each(
		OTHER_OPENAI_STYLE
	)("%s sends neither field when no limit is set", async (type) => {
		const body = await sentBody(
			chatModelFor(connection(type), "some-model"),
			"stream"
		);

		expect(body).not.toHaveProperty("max_tokens");
		expect(body).not.toHaveProperty("max_completion_tokens");
	});

	it("leaves an Anthropic request with its own max_tokens and adds no max_completion_tokens", async () => {
		const body = await sentBody(
			chatModelFor(connection("ANTHROPIC"), "claude-test"),
			"generate",
			{ maxOutputTokens: LIMIT }
		);

		expect(body.max_tokens).toBe(LIMIT);
		expect(body).not.toHaveProperty("max_completion_tokens");
	});

	it("still embeds on an OpenAI-compatible connection", () => {
		expect(() =>
			embeddingModelFor(connection("OPENAI_COMPATIBLE"), "m")
		).not.toThrow();
	});
});
