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
import { testConnection } from "../connection-test";
import type { ModelConnectionAccess } from "../connection-types";
import {
	type ModelServer,
	type Responder,
	sendJson,
	startModelServer,
} from "./model-server";

/** The Test button on an OpenAI connection. */

const KEY = "sk-test-secret-key";
const REPLY_TEXT = "Incorrect API key provided: sk-proj-LEAKED-IN-REPLY";
const NO_LISTS = { chat: [], ranking: [], search: [] };

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

function openAi(
	overrides: Partial<ModelConnectionAccess> = {}
): ModelConnectionAccess {
	return {
		type: "OPENAI",
		baseUrl: `${server.origin}/v1`,
		apiKey: KEY,
		...overrides,
	};
}

function answers(status: number, body: unknown): Responder {
	return (_request, response) => sendJson(response, body, status);
}

describe("testing an OpenAI connection", () => {
	it("lists /models with the Bearer key into chat only", async () => {
		server.respond = answers(200, {
			object: "list",
			data: [
				{ id: "gpt-a", object: "model" },
				{ id: "gpt-b", object: "model" },
				{ id: "text-embedding-3-small", object: "model" },
			],
		});

		const result = await testConnection(openAi());

		expect(result).toEqual({
			ok: true,
			message: "The connection works.",
			models: {
				chat: ["gpt-a", "gpt-b", "text-embedding-3-small"],
				ranking: [],
				search: [],
			},
		});
		expect(server.requests).toHaveLength(1);
		const [request] = server.requests;
		expect(request?.method).toBe("GET");
		expect(request?.url).toBe("/v1/models");
		expect(request?.headers.authorization).toBe(`Bearer ${KEY}`);
		expect(request?.headers["x-api-key"]).toBeUndefined();
	});

	it("does not double the slash when the address ends in one", async () => {
		server.respond = answers(200, { data: [{ id: "gpt-a" }] });

		await testConnection(openAi({ baseUrl: `${server.origin}/v1/` }));

		expect(server.requests.at(-1)?.url).toBe("/v1/models");
	});

	it("reports a refused key with the fixed message and no lists, for 401 and 403", async () => {
		for (const status of [401, 403]) {
			server.respond = answers(status, {
				error: { message: REPLY_TEXT, code: "invalid_api_key" },
			});

			const result = await testConnection(openAi());

			expect(result).toEqual({
				ok: false,
				message: "The server did not accept the key.",
				models: NO_LISTS,
			});
		}
	});

	it("never puts the key or the reply's text in the message, whatever the status or body", async () => {
		const replies: [number, unknown][] = [
			[401, { error: { message: `bad key ${KEY}` } }],
			[403, REPLY_TEXT],
			[429, { error: { message: REPLY_TEXT } }],
			[500, { error: { message: `${REPLY_TEXT} ${KEY}` } }],
			[200, REPLY_TEXT],
			[200, { data: REPLY_TEXT }],
			[200, { error: { message: REPLY_TEXT } }],
		];
		for (const [status, body] of replies) {
			server.respond = answers(status, body);

			const result = await testConnection(openAi());

			expect(result.ok).toBe(false);
			expect(result.models).toEqual(NO_LISTS);
			const everything = JSON.stringify(result);
			expect(everything).not.toContain(KEY);
			expect(everything).not.toContain("LEAKED-IN-REPLY");
			expect(everything).not.toContain(server.origin);
		}
	});

	it("keeps a success message free of anything the server sent beyond the model ids", async () => {
		server.respond = answers(200, {
			object: "list",
			data: [{ id: "gpt-a", owned_by: REPLY_TEXT }],
			note: REPLY_TEXT,
		});

		const result = await testConnection(openAi());

		expect(result.ok).toBe(true);
		expect(result.message).toBe("The connection works.");
		expect(JSON.stringify(result)).not.toContain("LEAKED-IN-REPLY");
	});

	it("drops model names that are empty, repeated or too long, as for the other types", async () => {
		server.respond = answers(200, {
			data: [
				{ id: "gpt-a" },
				{ id: "gpt-a" },
				{ id: "  " },
				{ id: "x".repeat(201) },
				{ object: "model" },
			],
		});

		const result = await testConnection(openAi());

		expect(result.models.chat).toEqual(["gpt-a"]);
		expect(result.models.ranking).toEqual([]);
		expect(result.models.search).toEqual([]);
	});

	it("reports an unreadable answer with a fixed message", async () => {
		server.respond = (_request, response) => {
			response.writeHead(200, { "content-type": "application/json" });
			response.end("<html>not json</html>");
		};

		const result = await testConnection(openAi());

		expect(result).toEqual({
			ok: false,
			message: "The server's answer could not be read.",
			models: NO_LISTS,
		});
	});

	it("goes through the network guard", async () => {
		vi.stubEnv("TEA_MODELS_LOCAL_ADDRESSES", "");

		const result = await testConnection(openAi());

		expect(result.ok).toBe(false);
		expect(JSON.stringify(result)).not.toContain(KEY);
		expect(server.requests).toEqual([]);
	});
});
