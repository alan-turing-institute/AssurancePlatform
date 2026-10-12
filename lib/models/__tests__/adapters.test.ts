import { embed, generateText } from "ai";
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
import { chatModelFor, embeddingModelFor } from "../adapters";
import type {
	ModelConnectionAccess,
	ModelConnectionType,
} from "../connection-types";
import { GuardedFetchError } from "../guarded-fetch";
import { type ModelServer, sendJson, startModelServer } from "./model-server";

const KEY = "sk-test-secret-key";

let server: ModelServer;

beforeAll(async () => {
	server = await startModelServer((request, response) => {
		const path = request.url;
		if (path.endsWith("/chat/completions")) {
			sendJson(response, {
				id: "chatcmpl-1",
				object: "chat.completion",
				created: 1,
				model: "m",
				choices: [
					{
						index: 0,
						message: { role: "assistant", content: "hello" },
						finish_reason: "stop",
					},
				],
				usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
			});
		} else if (path.endsWith("/messages")) {
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
		} else if (path.endsWith("/embeddings")) {
			sendJson(response, {
				object: "list",
				data: [{ object: "embedding", index: 0, embedding: [0.25, 0.5] }],
				model: "m",
				usage: { prompt_tokens: 1, total_tokens: 1 },
			});
		} else {
			sendJson(response, { error: "not found" }, 404);
		}
	});
});

afterAll(() => server.close());

beforeEach(() => {
	server.requests.length = 0;
	vi.stubEnv("TEA_MODELS_LOCAL_ADDRESSES", server.origin);
});

afterEach(() => {
	vi.unstubAllEnvs();
});

function connection(
	type: ModelConnectionType,
	overrides: Partial<ModelConnectionAccess> = {}
): ModelConnectionAccess {
	return { type, baseUrl: server.origin, apiKey: KEY, ...overrides };
}

function lastRequest() {
	const request = server.requests.at(-1);
	if (!request) {
		throw new Error("The server received no request");
	}
	return { ...request, json: JSON.parse(request.body) as { model?: string } };
}

/** Where each OpenAI-style type puts its API, as a suffix of the address the user entered. */
const OPENAI_STYLE_TYPES = [
	["OPENROUTER", "", "/api/v1"],
	["OLLAMA", "", "/v1"],
	["OPENAI_COMPATIBLE", "/v1/", "/v1"],
] as const;

describe("chatModelFor", () => {
	it.each(
		OPENAI_STYLE_TYPES
	)("sends a %s chat request to the type's path with a Bearer key and the job's model", async (type, entered, path) => {
		const result = await generateText({
			model: chatModelFor(
				connection(type, { baseUrl: `${server.origin}${entered}` }),
				"the-chat-model"
			),
			prompt: "hi",
			maxRetries: 0,
		});

		expect(result.text).toBe("hello");
		const request = lastRequest();
		expect(request.method).toBe("POST");
		expect(request.url).toBe(`${path}/chat/completions`);
		expect(request.headers.authorization).toBe(`Bearer ${KEY}`);
		expect(request.json.model).toBe("the-chat-model");
	});

	it("sends an Anthropic chat request with the key and version headers", async () => {
		const result = await generateText({
			model: chatModelFor(connection("ANTHROPIC"), "the-claude-model"),
			prompt: "hi",
			maxRetries: 0,
		});

		expect(result.text).toBe("hello");
		const request = lastRequest();
		expect(request.url).toBe("/v1/messages");
		expect(request.headers["x-api-key"]).toBe(KEY);
		expect(request.headers["anthropic-version"]).toBe("2023-06-01");
		expect(request.headers.authorization).toBeUndefined();
		expect(request.json.model).toBe("the-claude-model");
	});

	it("sends no Authorization header when a keyless server has no key", async () => {
		await generateText({
			model: chatModelFor(connection("OLLAMA", { apiKey: null }), "m"),
			prompt: "hi",
			maxRetries: 0,
		});
		expect(lastRequest().headers.authorization).toBeUndefined();
	});

	it("refuses an Anthropic connection without a key rather than using the server's own", () => {
		vi.stubEnv("ANTHROPIC_API_KEY", "sk-operator-key");
		expect(() =>
			chatModelFor(connection("ANTHROPIC", { apiKey: null }), "m")
		).toThrow("needs a key");
		expect(() =>
			chatModelFor(connection("ANTHROPIC", { apiKey: "" }), "m")
		).toThrow("needs a key");
	});

	it("goes through the network guard", async () => {
		vi.stubEnv("TEA_MODELS_LOCAL_ADDRESSES", "");
		const error = await generateText({
			model: chatModelFor(connection("OLLAMA"), "m"),
			prompt: "hi",
			maxRetries: 0,
		}).catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(GuardedFetchError);
		expect(error).toMatchObject({ code: "insecure-url" });
		expect(String(error)).not.toContain(KEY);
		expect(server.requests).toEqual([]);
	});
});

describe("embeddingModelFor", () => {
	it.each(
		OPENAI_STYLE_TYPES
	)("sends a %s embedding request to the type's path with a Bearer key and the job's model", async (type, entered, path) => {
		const result = await embed({
			model: embeddingModelFor(
				connection(type, { baseUrl: `${server.origin}${entered}` }),
				"the-embedding-model"
			),
			value: "a claim",
			maxRetries: 0,
		});

		expect(result.embedding).toEqual([0.25, 0.5]);
		const request = lastRequest();
		expect(request.url).toBe(`${path}/embeddings`);
		expect(request.headers.authorization).toBe(`Bearer ${KEY}`);
		expect(request.json.model).toBe("the-embedding-model");
	});

	it("goes through the network guard", async () => {
		vi.stubEnv("TEA_MODELS_LOCAL_ADDRESSES", "");
		const error = await embed({
			model: embeddingModelFor(connection("OPENROUTER"), "m"),
			value: "a claim",
			maxRetries: 0,
		}).catch((caught: unknown) => caught);

		expect(error).toMatchObject({ code: "insecure-url" });
		expect(server.requests).toEqual([]);
	});
});

describe("a job the type cannot do", () => {
	it("throws for embeddings on an Anthropic connection, without the key in the message", () => {
		let message = "";
		try {
			embeddingModelFor(connection("ANTHROPIC"), "m");
		} catch (error) {
			message = String(error);
		}
		expect(message).toContain("cannot do the search job");
		expect(message).not.toContain(KEY);
	});
});
