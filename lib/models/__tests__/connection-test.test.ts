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
	MAX_MODEL_NAME_CHARS,
	MAX_MODELS_PER_LIST,
	testConnection,
} from "../connection-test";
import type {
	ModelConnectionAccess,
	ModelConnectionType,
} from "../connection-types";
import {
	type ModelServer,
	type Responder,
	sendJson,
	startModelServer,
} from "./model-server";

const KEY = "sk-test-secret-key";
const NAMES_THE_DNS_ANSWER = /public|resolve/i;

let server: ModelServer;

beforeAll(async () => {
	server = await startModelServer();
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

const listOf = (...ids: string[]) => ({ data: ids.map((id) => ({ id })) });

/** Answers each path with its own body; any other path is a 404. */
function routes(table: Record<string, unknown>): Responder {
	return (request, response) => {
		if (request.url in table) {
			sendJson(response, table[request.url]);
		} else {
			sendJson(response, { error: "not found" }, 404);
		}
	};
}

const OPENROUTER_ROUTES = {
	"/api/v1/key": { data: { label: "test" } },
	"/api/v1/models?supported_parameters=tools": listOf(
		"vendor/chat-a",
		"vendor/chat-b"
	),
	"/api/v1/models?output_modalities=decisions": listOf("cloudflare/clef-flash"),
	"/api/v1/embeddings/models": listOf("vendor/embed-a"),
};

describe("OpenRouter", () => {
	it("checks the key, then lists chat, ranking and embedding models separately", async () => {
		server.respond = routes(OPENROUTER_ROUTES);

		const result = await testConnection(connection("OPENROUTER"));

		expect(result).toEqual({
			ok: true,
			message: "The connection works.",
			models: {
				chat: ["vendor/chat-a", "vendor/chat-b"],
				ranking: ["cloudflare/clef-flash"],
				search: ["vendor/embed-a"],
			},
		});
		expect(server.requests[0]?.url).toBe("/api/v1/key");
		expect(
			server.requests
				.slice(1)
				.map((request) => request.url)
				.sort()
		).toEqual([
			"/api/v1/embeddings/models",
			"/api/v1/models?output_modalities=decisions",
			"/api/v1/models?supported_parameters=tools",
		]);
		for (const request of server.requests) {
			expect(request.method).toBe("GET");
			expect(request.headers.authorization).toBe(`Bearer ${KEY}`);
		}
	});

	it("stops at a refused key without asking for any list", async () => {
		server.respond = (_request, response) =>
			sendJson(response, { error: { message: `bad key ${KEY}` } }, 401);

		const result = await testConnection(connection("OPENROUTER"));

		expect(result).toEqual({
			ok: false,
			message: "The server did not accept the key.",
			models: { chat: [], ranking: [], search: [] },
		});
		expect(server.requests).toHaveLength(1);
	});

	it("still works when one list cannot be read, and leaves that list empty", async () => {
		server.respond = routes({
			...OPENROUTER_ROUTES,
			"/api/v1/models?output_modalities=decisions": "not a list",
		});

		const result = await testConnection(connection("OPENROUTER"));

		expect(result.ok).toBe(true);
		expect(result.message).toBe(
			"The connection works, but a model list could not be read."
		);
		expect(result.models.ranking).toEqual([]);
		expect(result.models.chat).toEqual(["vendor/chat-a", "vendor/chat-b"]);
	});

	it("reads a model list of about a megabyte", async () => {
		const big = {
			data: Array.from({ length: 1000 }, (_unused, index) => ({
				id: `vendor/model-${index}`,
				description: "d".repeat(1000),
			})),
		};
		server.respond = routes({
			...OPENROUTER_ROUTES,
			"/api/v1/models?supported_parameters=tools": big,
		});

		const result = await testConnection(connection("OPENROUTER"));

		expect(result.ok).toBe(true);
		expect(result.models.chat).toHaveLength(1000);
	});

	it("gives up on a model list above four megabytes", async () => {
		const huge = {
			data: Array.from({ length: 1000 }, (_unused, index) => ({
				id: `vendor/model-${index}`,
				description: "d".repeat(4500),
			})),
		};
		server.respond = routes({
			...OPENROUTER_ROUTES,
			"/api/v1/models?supported_parameters=tools": huge,
		});

		const result = await testConnection(connection("OPENROUTER"));

		expect(result.ok).toBe(true);
		expect(result.message).toContain("a model list could not be read");
		expect(result.models.chat).toEqual([]);
		expect(result.models.search).toEqual(["vendor/embed-a"]);
	});
});

describe("Ollama", () => {
	it("lists the installed models for every job from one request", async () => {
		server.respond = routes({
			"/api/tags": {
				models: [
					{ name: "clef-flash:latest", model: "clef-flash:latest" },
					{ name: "qwen3-embedding:4b" },
				],
			},
		});

		const result = await testConnection(connection("OLLAMA"));

		const names = ["clef-flash:latest", "qwen3-embedding:4b"];
		expect(result).toEqual({
			ok: true,
			message: "The connection works.",
			models: { chat: names, ranking: names, search: names },
		});
		expect(server.requests).toHaveLength(1);
		expect(server.requests[0]?.url).toBe("/api/tags");
		expect(server.requests[0]?.headers.authorization).toBe(`Bearer ${KEY}`);
	});

	it("sends no Authorization header without a key", async () => {
		server.respond = routes({ "/api/tags": { models: [] } });
		const result = await testConnection(connection("OLLAMA", { apiKey: null }));
		expect(result.ok).toBe(true);
		expect(server.requests[0]?.headers.authorization).toBeUndefined();
	});

	it("reports a model list in the wrong shape as unreadable", async () => {
		server.respond = routes({ "/api/tags": { data: [] } });
		expect(await testConnection(connection("OLLAMA"))).toEqual({
			ok: false,
			message: "The server's answer could not be read.",
			models: { chat: [], ranking: [], search: [] },
		});
	});
});

describe("OpenAI-compatible servers", () => {
	it("lists models for chat and search, and none for ranking", async () => {
		server.respond = routes({ "/v1/models": listOf("gpt-x", "embed-y") });

		const result = await testConnection(
			connection("OPENAI_COMPATIBLE", { baseUrl: `${server.origin}/v1/` })
		);

		expect(result.models).toEqual({
			chat: ["gpt-x", "embed-y"],
			ranking: [],
			search: ["gpt-x", "embed-y"],
		});
		expect(result.ok).toBe(true);
		expect(server.requests[0]?.headers.authorization).toBe(`Bearer ${KEY}`);
	});
});

describe("Anthropic", () => {
	it("lists chat models with the key and version headers and a full page size", async () => {
		server.respond = routes({
			"/v1/models?limit=1000": {
				...listOf("claude-a", "claude-b"),
				has_more: false,
			},
		});

		const result = await testConnection(connection("ANTHROPIC"));

		expect(result.models).toEqual({
			chat: ["claude-a", "claude-b"],
			ranking: [],
			search: [],
		});
		const request = server.requests[0];
		expect(request?.headers["x-api-key"]).toBe(KEY);
		expect(request?.headers["anthropic-version"]).toBe("2023-06-01");
		expect(request?.headers.authorization).toBeUndefined();
	});

	it("reports a missing key as refused", async () => {
		server.respond = (_request, response) => sendJson(response, {}, 401);
		const result = await testConnection(
			connection("ANTHROPIC", { apiKey: null })
		);
		expect(result.ok).toBe(false);
		expect(result.message).toBe("The server did not accept the key.");
		expect(server.requests[0]?.headers["x-api-key"]).toBeUndefined();
	});
});

describe("model lists", () => {
	it("keeps at most the allowed number of names, without repeats, blanks or overlong names", async () => {
		const ids = [
			"first",
			"first",
			"  padded  ",
			"",
			"   ",
			"x".repeat(MAX_MODEL_NAME_CHARS + 1),
			...Array.from(
				{ length: MAX_MODELS_PER_LIST + 500 },
				(_u, index) => `m${index}`
			),
		];
		server.respond = routes({ "/models": listOf(...ids) });

		const result = await testConnection(connection("OPENAI_COMPATIBLE"));

		expect(result.models.chat).toHaveLength(MAX_MODELS_PER_LIST);
		expect(result.models.chat.slice(0, 3)).toEqual(["first", "padded", "m0"]);
		expect(result.models.chat).not.toContain("");
	});

	it("skips an entry without a name and keeps the rest", async () => {
		server.respond = routes({
			"/models": { data: [{ id: "good" }, { name: "no id" }, null, { id: 7 }] },
		});
		const result = await testConnection(connection("OPENAI_COMPATIBLE"));
		expect(result.models.chat).toEqual(["good"]);
	});

	it("refuses an answer above half a megabyte from a server that is not OpenRouter", async () => {
		const big = {
			data: Array.from({ length: 600 }, (_unused, index) => ({
				id: `model-${index}`,
				description: "d".repeat(1000),
			})),
		};
		server.respond = routes({ "/models": big });

		const result = await testConnection(connection("OPENAI_COMPATIBLE"));

		expect(result.ok).toBe(false);
		expect(result.message).toBe(
			"The model server's response is larger than the allowed size."
		);
	});
});

describe("failures", () => {
	it("names the HTTP status of a server error", async () => {
		server.respond = (_request, response) => sendJson(response, {}, 500);
		const result = await testConnection(connection("OLLAMA"));
		expect(result).toMatchObject({
			ok: false,
			message: "The server answered with an error (HTTP 500).",
		});
	});

	it("reports a body that is not JSON as unreadable", async () => {
		server.respond = (_request, response) => {
			response.writeHead(200);
			response.end("<html>login</html>");
		};
		const result = await testConnection(connection("OPENAI_COMPATIBLE"));
		expect(result.message).toBe("The server's answer could not be read.");
	});

	it("reports the guard's reason for an address it refuses", async () => {
		vi.stubEnv("TEA_MODELS_LOCAL_ADDRESSES", "");
		const result = await testConnection(
			connection("OLLAMA", { baseUrl: "http://models.example.test:11434" })
		);
		expect(result).toEqual({
			ok: false,
			message: "The model address must use https.",
			models: { chat: [], ranking: [], search: [] },
		});
		expect(server.requests).toEqual([]);
	});

	it("reports a server that is not reachable", async () => {
		const closed = await startModelServer();
		const origin = closed.origin;
		await closed.close();
		vi.stubEnv("TEA_MODELS_LOCAL_ADDRESSES", origin);

		const result = await testConnection(
			connection("OLLAMA", { baseUrl: origin })
		);

		expect(result.ok).toBe(false);
		expect(result.message).toBe(
			"The model address could not be reached or is not allowed."
		);
	});

	it("gives one message for an address that is refused and one that is not reachable, so a name's DNS answer is not revealed", async () => {
		const closed = await startModelServer();
		const origin = closed.origin;
		await closed.close();
		vi.stubEnv("TEA_MODELS_LOCAL_ADDRESSES", "");

		const refused = await testConnection(
			connection("OPENAI_COMPATIBLE", { baseUrl: "https://10.1.2.3" })
		);
		const metadata = await testConnection(
			connection("OPENAI_COMPATIBLE", { baseUrl: "https://169.254.169.254" })
		);
		vi.stubEnv("TEA_MODELS_LOCAL_ADDRESSES", origin);
		const unreachable = await testConnection(
			connection("OLLAMA", { baseUrl: origin })
		);

		expect(refused.ok).toBe(false);
		expect(refused.message).toBe(unreachable.message);
		expect(metadata.message).toBe(unreachable.message);
		expect(unreachable.message).not.toMatch(NAMES_THE_DNS_ANSWER);
	});

	it("reports a redirect and does not follow it", async () => {
		server.respond = (_request, response) => {
			response.writeHead(302, { location: "/elsewhere" });
			response.end();
		};
		const result = await testConnection(connection("OLLAMA"));
		expect(result.ok).toBe(false);
		expect(server.requests).toHaveLength(1);
	});

	it("never puts the key, the address or the server's own words in a message", async () => {
		const failures: Responder[] = [
			(_request, response) => sendJson(response, { error: KEY }, 401),
			(_request, response) => sendJson(response, { error: KEY }, 500),
			(_request, response) => {
				response.writeHead(200);
				response.end(`not json ${KEY} ${server.origin}`);
			},
			(_request, response) =>
				sendJson(response, { models: `${KEY} ${server.origin}` }),
		];
		for (const type of [
			"OPENROUTER",
			"OLLAMA",
			"OPENAI_COMPATIBLE",
			"ANTHROPIC",
		] as const) {
			for (const failure of failures) {
				server.respond = failure;
				const result = await testConnection(connection(type));
				const text = JSON.stringify(result);
				expect(text).not.toContain(KEY);
				expect(text).not.toContain(server.origin);
				expect(text).not.toContain("127.0.0.1");
			}
		}
	});
});
