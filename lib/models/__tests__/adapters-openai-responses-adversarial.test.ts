import { type LanguageModel, streamText } from "ai";
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
import {
	type ReplyParts,
	reply,
	wire,
} from "@/src/__tests__/utils/openai-responses-wire";
import {
	chatModelFor,
	chatProviderOptions,
	embeddingModelFor,
} from "../adapters";
import {
	CONNECTION_TYPES,
	type ConnectionTypeSpec,
	connectionTypeCanDo,
	type ModelConnectionAccess,
	type ModelConnectionType,
} from "../connection-types";
import { type ModelServer, sendJson, startModelServer } from "./model-server";

/**
 * Chat requests per connection type once OpenAI's chat goes through the
 * Responses endpoint: OpenAI's own request, the unchanged requests of every
 * other type, the refusals, and the network guard. Only the network edge is
 * replaced (see the wire helper); local model servers stand in for the
 * other types.
 */

vi.mock("undici", async (importOriginal) => {
	const actual = await importOriginal<typeof import("undici")>();
	const { routeFetch } = await import(
		"@/src/__tests__/utils/openai-responses-wire"
	);
	return { ...actual, fetch: routeFetch(actual.fetch as never) };
});

const KEY = "sk-test-secret-key";
const ENV_KEY = "sk-ENV-key-that-must-not-be-used";
const LIMIT = 8192;
const OPENAI_ADDRESS = "https://api.openai.com/v1";
const RESPONSES_URL = `${OPENAI_ADDRESS}/responses`;
const ANSWER: ReplyParts = { text: { id: "msg_1", text: "hello" } };

let server: ModelServer;

beforeAll(async () => {
	server = await startModelServer((request, response) => {
		if (request.url.endsWith("/chat/completions")) {
			response.writeHead(200, { "content-type": "text/event-stream" });
			response.end(
				`data: ${JSON.stringify({
					id: "c1",
					object: "chat.completion.chunk",
					created: 1,
					model: "m",
					choices: [
						{
							index: 0,
							delta: { role: "assistant", content: "hello" },
							finish_reason: "stop",
						},
					],
				})}\n\ndata: [DONE]\n\n`
			);
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
	});
});

afterAll(() => server.close());

beforeEach(() => {
	wire.reset();
	server.requests.length = 0;
	vi.stubEnv("TEA_MODELS_LOCAL_ADDRESSES", server.origin);
	vi.stubEnv("OPENAI_API_KEY", ENV_KEY);
});

afterEach(() => {
	vi.unstubAllEnvs();
});

function connection(
	type: ModelConnectionType,
	overrides: Partial<ModelConnectionAccess> = {}
): ModelConnectionAccess {
	// A stored OpenAI connection always holds OpenAI's own address.
	const baseUrl = type === "OPENAI" ? OPENAI_ADDRESS : server.origin;
	return { type, baseUrl, apiKey: KEY, ...overrides };
}

/** One streamed chat call as the assistant route makes it. */
async function chat(
	conn: ModelConnectionAccess,
	model: LanguageModel = chatModelFor(conn, "some-model")
): Promise<unknown[]> {
	const errors: unknown[] = [];
	const result = streamText({
		model,
		prompt: "hi",
		maxOutputTokens: LIMIT,
		providerOptions: chatProviderOptions(conn),
		maxRetries: 0,
		onError: ({ error }) => {
			errors.push(error);
		},
	});
	await result.consumeStream({ onError: () => undefined });
	return errors;
}

function lastServerBody(): Record<string, unknown> {
	const request = server.requests.at(-1);
	if (!request) {
		throw new Error("The server received no request");
	}
	return JSON.parse(request.body) as Record<string, unknown>;
}

describe("the options sent with a chat request", () => {
	it.each([
		["OPENAI", { openai: { store: false } }],
		["OPENROUTER", { openrouter: { reasoning: { max_tokens: 3072 } } }],
		["OLLAMA", undefined],
		["OPENAI_COMPATIBLE", undefined],
		["ANTHROPIC", undefined],
	] as const)("are exactly the expected ones for %s", (type, expected) => {
		expect(chatProviderOptions(connection(type))).toEqual(expected);
	});
});

describe("an OpenAI chat connection without a key", () => {
	it.each([
		["null", null],
		["empty", ""],
	])("is refused when the key is %s, even with a key in the server's environment", (_name, apiKey) => {
		const bare = connection("OPENAI", { apiKey });

		expect(() => chatModelFor(bare, "gpt-test")).toThrow("needs a key");
		expect(wire.requests).toEqual([]);
	});

	it("uses its own key for the request, never the one in the server's environment", async () => {
		wire.replies.push(() => reply(ANSWER));

		await chat(connection("OPENAI"));

		expect(wire.requests).toHaveLength(1);
		expect(wire.requests[0]?.url).toBe(RESPONSES_URL);
		expect(wire.requests[0]?.headers.get("authorization")).toBe(
			`Bearer ${KEY}`
		);
		expect(JSON.stringify(wire.requests)).not.toContain(ENV_KEY);
	});
});

describe("a chat request on every other type", () => {
	it.each([
		"OPENAI_COMPATIBLE",
		"OLLAMA",
		"OPENROUTER",
	] as const)("%s still posts to /chat/completions with max_tokens and nothing from the Responses API", async (type) => {
		await chat(connection(type));

		const body = lastServerBody();
		expect(server.requests.at(-1)?.url.endsWith("/chat/completions")).toBe(
			true
		);
		expect(body.max_tokens).toBe(LIMIT);
		for (const field of [
			"max_completion_tokens",
			"max_output_tokens",
			"store",
			"include",
			"input",
		]) {
			expect(body).not.toHaveProperty(field);
		}
		expect(body.messages).toBeDefined();
		expect(wire.toOpenAi).toEqual([]);
	});

	it("still gives OpenRouter its reasoning bound, and gives no other type a reasoning field", async () => {
		await chat(connection("OPENROUTER"));
		const openRouter = lastServerBody();
		await chat(connection("OPENAI_COMPATIBLE"));
		const compatible = lastServerBody();

		expect(openRouter.reasoning).toEqual({ max_tokens: 3072 });
		expect(compatible).not.toHaveProperty("reasoning");
	});

	it("leaves an Anthropic request on /messages with its own max_tokens", async () => {
		await chat(connection("ANTHROPIC"));

		expect(server.requests.at(-1)?.url.endsWith("/messages")).toBe(true);
		expect(lastServerBody().max_tokens).toBe(LIMIT);
		expect(lastServerBody()).not.toHaveProperty("store");
		expect(wire.toOpenAi).toEqual([]);
	});

	it("keeps each type on its own endpoint when the models are built together and used in turn", async () => {
		const compatible = connection("OPENAI_COMPATIBLE");
		const openAi = connection("OPENAI");
		const models = [compatible, openAi, compatible, openAi].map(
			(conn) => [conn, chatModelFor(conn, "m")] as const
		);

		for (const [conn, model] of models) {
			wire.replies.push(() => reply(ANSWER));
			await chat(conn, model);
		}

		expect(wire.toOpenAi.map((request) => request.url)).toEqual([
			RESPONSES_URL,
			RESPONSES_URL,
		]);
		expect(server.requests.map((request) => request.url)).toEqual([
			"/chat/completions",
			"/chat/completions",
		]);
		for (const request of wire.toOpenAi) {
			expect(request.body.max_output_tokens).toBe(LIMIT);
			expect(request.body).not.toHaveProperty("max_tokens");
		}
	});
});

describe("OpenAI for the jobs it cannot do", () => {
	it.each(["ranking", "search"] as const)("is not allowed to do %s", (job) => {
		expect(connectionTypeCanDo("OPENAI", job)).toBe(false);
		expect(connectionTypeCanDo("OPENAI", "chat")).toBe(true);
	});

	it("is refused an embedding model, without a request", () => {
		expect(() => embeddingModelFor(connection("OPENAI"), "m")).toThrow(
			"cannot do the search job"
		);
		expect(wire.requests).toEqual([]);
		expect(server.requests).toEqual([]);
	});

	it("is the type, not the embedding call, that stops it: an OpenAI-compatible connection can still embed", () => {
		expect(() =>
			embeddingModelFor(connection("OPENAI_COMPATIBLE"), "m")
		).not.toThrow();
	});
});

describe("the network guard on an OpenAI chat request", () => {
	const mutable: Record<string, ConnectionTypeSpec> = CONNECTION_TYPES;
	const original = CONNECTION_TYPES.OPENAI;

	beforeEach(() => {
		vi.stubEnv("TEA_MODELS_LOCAL_ADDRESSES", "");
	});

	afterEach(() => {
		mutable.OPENAI = original;
	});

	it.each([
		["a plain http address", "http://169.254.169.254/v1", "insecure-url"],
		["a private literal address", "https://10.0.0.5/v1", "blocked-address"],
	])("refuses %s as the connection type's address, and sends nothing", async (_name, address, code) => {
		mutable.OPENAI = { ...original, baseUrl: address };

		const errors = await chat(connection("OPENAI"));

		expect(errors).toHaveLength(1);
		expect(errors[0]).toMatchObject({ code });
		expect(String(errors[0])).not.toContain(KEY);
		expect(wire.requests).toEqual([]);
	});

	it("sends the request through the guard when the address is OpenAI's", async () => {
		wire.replies.push(() => reply(ANSWER));

		const errors = await chat(connection("OPENAI"));

		expect(errors).toEqual([]);
		expect(wire.requests.map((request) => request.url)).toEqual([
			RESPONSES_URL,
		]);
	});
});
