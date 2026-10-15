import type { ServerResponse } from "node:http";
import {
	embed,
	generateText,
	type LanguageModel,
	stepCountIs,
	streamText,
	type ToolSet,
	tool,
} from "ai";
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
import {
	chatModelFor,
	chatProviderOptions,
	embeddingModelFor,
} from "../adapters";
import type {
	ModelConnectionAccess,
	ModelConnectionType,
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

describe("an OpenAI chat request", () => {
	it.each(
		MODES
	)("sends the limit as max_completion_tokens and no max_tokens when %s", async (mode) => {
		const body = await sentBody(
			chatModelFor(connection("OPENAI"), "gpt-test"),
			mode,
			{ maxOutputTokens: LIMIT }
		);

		expect(body.max_completion_tokens).toBe(LIMIT);
		expect(body).not.toHaveProperty("max_tokens");
		expect(body.model).toBe("gpt-test");
	});

	it.each(
		MODES
	)("sends the limit it was given, not a fixed one, when %s", async (mode) => {
		const body = await sentBody(
			chatModelFor(connection("OPENAI"), "gpt-test"),
			mode,
			{ maxOutputTokens: 77 }
		);

		expect(body.max_completion_tokens).toBe(77);
		expect(body).not.toHaveProperty("max_tokens");
	});

	it.each(
		MODES
	)("sends neither field when no limit is set, when %s", async (mode) => {
		const body = await sentBody(
			chatModelFor(connection("OPENAI"), "gpt-test"),
			mode
		);

		expect(body).not.toHaveProperty("max_tokens");
		expect(body).not.toHaveProperty("max_completion_tokens");
	});

	it.each(
		MODES
	)("changes only the name of the limit: every other field matches an OpenAI-compatible request, when %s", async (mode) => {
		const lookup = tool({
			description: "Looks something up",
			inputSchema: z.object({ query: z.string() }),
			execute: ({ query }) => query,
		});
		const extra = {
			maxOutputTokens: LIMIT,
			temperature: 0.2,
			topP: 0.9,
			seed: 7,
			stopSequences: ["END"],
			system: "Be brief.",
			tools: { lookup },
		};

		const compatible = await sentBody(
			chatModelFor(connection("OPENAI_COMPATIBLE"), "gpt-test"),
			mode,
			extra
		);
		const openAi = await sentBody(
			chatModelFor(connection("OPENAI"), "gpt-test"),
			mode,
			extra
		);

		const { max_tokens: limit, ...rest } = compatible;
		expect(limit).toBe(LIMIT);
		expect(openAi).toEqual({ ...rest, max_completion_tokens: LIMIT });
		expect(openAi.tools).toBeDefined();
		expect(openAi.messages).toEqual(compatible.messages);
	});

	it.each(
		MODES
	)("carries the limit on every step of a reply that calls a tool, when %s", async (mode) => {
		callsToolFirst = true;
		const lookup = tool({
			description: "Looks something up",
			inputSchema: z.object({ query: z.string() }),
			execute: ({ query }) => query,
		});
		const options = {
			model: chatModelFor(connection("OPENAI"), "gpt-test"),
			prompt: "hi",
			maxRetries: 0,
			maxOutputTokens: LIMIT,
			tools: { lookup },
			stopWhen: stepCountIs(3),
		};
		if (mode === "stream") {
			const result = streamText(options);
			await result.consumeStream();
			await result.text;
		} else {
			await generateText(options);
		}

		expect(server.requests).toHaveLength(2);
		for (const request of server.requests) {
			const body = JSON.parse(request.body) as Body;
			expect(body.max_completion_tokens).toBe(LIMIT);
			expect(body).not.toHaveProperty("max_tokens");
		}
	});

	it("sends no reasoning setting that a non-reasoning OpenAI model would refuse", async () => {
		expect(chatProviderOptions(connection("OPENAI"))).toBeUndefined();

		const body = await sentBody(
			chatModelFor(connection("OPENAI"), "gpt-test"),
			"stream",
			{
				maxOutputTokens: LIMIT,
				providerOptions: chatProviderOptions(connection("OPENAI")),
			}
		);

		expect(body).not.toHaveProperty("reasoning");
		expect(body).not.toHaveProperty("reasoning_effort");
	});

	it("uses the address as stored with a Bearer key, and the chat path", async () => {
		await sentBody(
			chatModelFor(
				connection("OPENAI", { baseUrl: `${server.origin}/v1/` }),
				"gpt-test"
			),
			"generate"
		);

		const request = server.requests.at(-1);
		expect(request?.method).toBe("POST");
		expect(request?.url).toBe("/v1/chat/completions");
		expect(request?.headers.authorization).toBe(`Bearer ${KEY}`);
	});

	it("goes through the network guard on the streamed path", async () => {
		vi.stubEnv("TEA_MODELS_LOCAL_ADDRESSES", "");
		const errors: unknown[] = [];
		const result = streamText({
			model: chatModelFor(connection("OPENAI"), "gpt-test"),
			prompt: "hi",
			maxRetries: 0,
			onError: ({ error }) => {
				errors.push(error);
			},
		});
		await result.consumeStream({ onError: () => undefined });

		expect(errors).toHaveLength(1);
		expect(errors[0]).toMatchObject({ code: "insecure-url" });
		expect(String(errors[0])).not.toContain(KEY);
		expect(server.requests).toEqual([]);
	});

	it("is refused for embeddings, without making a request or naming the key", () => {
		let message = "";
		try {
			embeddingModelFor(connection("OPENAI"), "text-embedding-3-small");
		} catch (error) {
			message = String(error);
		}

		expect(message).toContain("cannot do the search job");
		expect(message).not.toContain(KEY);
		expect(server.requests).toEqual([]);
	});

	it("is refused for embeddings even when the model is used", async () => {
		const result = await Promise.resolve()
			.then(() =>
				embed({
					model: embeddingModelFor(connection("OPENAI"), "m"),
					value: "a claim",
					maxRetries: 0,
				})
			)
			.catch((caught: unknown) => caught);

		expect(String(result)).toContain("cannot do the search job");
		expect(server.requests).toEqual([]);
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

	it("keeps each connection's behaviour when the models are built together and used in turn", async () => {
		const compatible = chatModelFor(connection("OPENAI_COMPATIBLE"), "m");
		const openAi = chatModelFor(connection("OPENAI"), "m");
		const ollama = chatModelFor(connection("OLLAMA"), "m");
		const extra = { maxOutputTokens: LIMIT };

		const first = await sentBody(compatible, "stream", extra);
		const second = await sentBody(openAi, "stream", extra);
		const third = await sentBody(ollama, "generate", extra);
		const fourth = await sentBody(openAi, "generate", extra);

		expect(first.max_tokens).toBe(LIMIT);
		expect(first).not.toHaveProperty("max_completion_tokens");
		expect(second.max_completion_tokens).toBe(LIMIT);
		expect(second).not.toHaveProperty("max_tokens");
		expect(third.max_tokens).toBe(LIMIT);
		expect(third).not.toHaveProperty("max_completion_tokens");
		expect(fourth.max_completion_tokens).toBe(LIMIT);
		expect(fourth).not.toHaveProperty("max_tokens");
	});

	it("still embeds on an OpenAI-compatible connection", () => {
		expect(() =>
			embeddingModelFor(connection("OPENAI_COMPATIBLE"), "m")
		).not.toThrow();
	});
});
