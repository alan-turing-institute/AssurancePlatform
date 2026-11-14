import type { ServerResponse } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testConnection } from "@/lib/models/connection-test";
import type { ModelConnectionAccess } from "@/lib/models/connection-types";
import {
	type CountingServer,
	captureLogs,
	json,
	type LogCapture,
	startServer,
} from "@/src/__tests__/utils/model-adversarial-kit";

const KEY = "sk-test-SECRET-5544";

let target: CountingServer;
let logs: LogCapture;

beforeEach(async () => {
	target = await startServer();
	vi.stubEnv("TEA_MODELS_LOCAL_ADDRESSES", target.origin);
	logs = captureLogs((name, value) => vi.stubEnv(name, value));
});

afterEach(async () => {
	logs.stop();
	vi.unstubAllEnvs();
	await target.close();
});

function connection(
	type: ModelConnectionAccess["type"],
	apiKey: string | null = KEY
): ModelConnectionAccess {
	return { type, baseUrl: target.origin, apiKey };
}

const FIXED_MESSAGES = new Set([
	"The connection works.",
	"The connection works, but a model list could not be read.",
	"The server did not accept the key.",
	"The server's answer could not be read.",
	"The model address could not be reached or is not allowed.",
	"The model address is not a valid URL.",
	"The model address must not contain a user name or password.",
	"The model address must use https.",
	"The model server answered with a redirect, which is not followed.",
	"The model server's response is larger than the allowed size.",
	"The model server did not answer in time.",
	"The model server's response could not be used.",
]);

function isFixed(message: string): boolean {
	return (
		FIXED_MESSAGES.has(message) ||
		message.startsWith("The server answered with an error (HTTP ")
	);
}

describe("testConnection: what it asks each type of server", () => {
	it("asks OpenRouter to confirm the key before it lists anything, and stops on a refusal", async () => {
		target.handler = (_hit, response) => json(response, { error: "no" }, 401);
		const result = await testConnection(connection("OPENROUTER"));
		expect(result).toEqual({
			ok: false,
			message: "The server did not accept the key.",
			models: { chat: [], ranking: [], search: [] },
		});
		expect(target.hits.map((hit) => hit.url)).toEqual(["/api/v1/key"]);
		expect(target.hits[0]?.headers.authorization).toBe(`Bearer ${KEY}`);
	});

	it("lists OpenRouter's chat, ranking and embedding models from their own lists", async () => {
		target.handler = (hit, response) => {
			if (hit.url === "/api/v1/key") {
				json(response, { data: {} });
			} else if (hit.url.includes("supported_parameters=tools")) {
				json(response, { data: [{ id: "chat/a" }, { id: "chat/b" }] });
			} else if (hit.url.includes("output_modalities=decisions")) {
				json(response, { data: [{ id: "cloudflare/clef-flash" }] });
			} else if (hit.url === "/api/v1/embeddings/models") {
				json(response, { data: [{ id: "embed/x" }] });
			} else {
				json(response, {}, 404);
			}
		};
		const result = await testConnection(connection("OPENROUTER"));
		expect(result.ok).toBe(true);
		expect(result.message).toBe("The connection works.");
		expect(result.models).toEqual({
			chat: ["chat/a", "chat/b"],
			ranking: ["cloudflare/clef-flash"],
			search: ["embed/x"],
		});
	});

	it("still reports a working OpenRouter key when a list cannot be read, and says so", async () => {
		target.handler = (hit, response) => {
			if (hit.url === "/api/v1/key") {
				json(response, { data: {} });
			} else if (hit.url === "/api/v1/embeddings/models") {
				json(response, { oops: true }, 500);
			} else {
				json(response, { data: [{ id: "m" }] });
			}
		};
		const result = await testConnection(connection("OPENROUTER"));
		expect(result.ok).toBe(true);
		expect(result.message).toBe(
			"The connection works, but a model list could not be read."
		);
		expect(result.models.search).toEqual([]);
		expect(result.models.chat).toEqual(["m"]);
	});

	it("asks Anthropic with its own headers and not a bearer token, and lists chat models only", async () => {
		target.handler = (_hit, response) =>
			json(response, { data: [{ id: "claude-a" }] });
		const result = await testConnection(connection("ANTHROPIC"));
		const [hit] = target.hits;
		expect(hit?.url).toBe("/v1/models?limit=1000");
		expect(hit?.headers["x-api-key"]).toBe(KEY);
		expect(hit?.headers["anthropic-version"]).toBe("2023-06-01");
		expect(hit?.headers.authorization).toBeUndefined();
		expect(result.models).toEqual({
			chat: ["claude-a"],
			ranking: [],
			search: [],
		});
	});

	it("asks Ollama for its installed models and offers them for every job", async () => {
		target.handler = (_hit, response) =>
			json(response, {
				models: [{ name: "llama3:8b" }, { name: "clef-flash" }],
			});
		const result = await testConnection(connection("OLLAMA", null));
		expect(target.hits[0]?.url).toBe("/api/tags");
		expect(target.hits[0]?.headers.authorization).toBeUndefined();
		const names = ["llama3:8b", "clef-flash"];
		expect(result.models).toEqual({
			chat: names,
			ranking: names,
			search: names,
		});
	});

	it("asks an OpenAI-style server for its models and offers them for chat and search, never ranking", async () => {
		target.handler = (_hit, response) =>
			json(response, { data: [{ id: "gpt-x" }] });
		const result = await testConnection(connection("OPENAI_COMPATIBLE"));
		expect(target.hits[0]?.url).toBe("/models");
		expect(target.hits[0]?.headers.authorization).toBe(`Bearer ${KEY}`);
		expect(result.models).toEqual({
			chat: ["gpt-x"],
			ranking: [],
			search: ["gpt-x"],
		});
	});
});

describe("testConnection: lists from a server are bounded and cleaned", () => {
	it("keeps at most 2000 names, none longer than 200 characters, trimmed and without repeats", async () => {
		const entries = [
			...Array.from({ length: 5000 }, (_, index) => ({
				name: `model-${index}`,
			})),
			{ name: "x".repeat(201) },
			{ name: "  padded  " },
			{ name: "model-1" },
			{ name: "" },
			{ name: "   " },
			{ name: 42 },
			{ nope: true },
			null,
			"text",
		];
		target.handler = (_hit, response) => json(response, { models: entries });
		const result = await testConnection(connection("OLLAMA"));
		expect(result.ok).toBe(true);
		const names = result.models.chat;
		expect(names.length).toBeLessThanOrEqual(2000);
		expect(names.every((name) => name.length > 0 && name.length <= 200)).toBe(
			true
		);
		expect(new Set(names).size).toBe(names.length);
		expect(names).not.toContain("x".repeat(201));
		expect(names.filter((name) => name === "model-1")).toHaveLength(1);
	});

	it("trims a name and drops one that is only spaces", async () => {
		target.handler = (_hit, response) =>
			json(response, { models: [{ name: "  padded  " }, { name: "   " }] });
		const result = await testConnection(connection("OLLAMA"));
		expect(result.models.chat).toEqual(["padded"]);
	});

	it("refuses an answer past the size limit, with a fixed message", async () => {
		target.handler = (_hit, response) => {
			response.writeHead(200, { "content-type": "application/json" });
			response.end(JSON.stringify({ models: [{ name: "a".repeat(700_000) }] }));
		};
		const result = await testConnection(connection("OLLAMA"));
		expect(result.ok).toBe(false);
		expect(result.message).toBe(
			"The model server's response is larger than the allowed size."
		);
		expect(result.models).toEqual({ chat: [], ranking: [], search: [] });
	});

	it("does not follow a redirect, and says so", async () => {
		const second = await startServer((_hit, response) =>
			json(response, { models: [{ name: "from-the-second" }] })
		);
		vi.stubEnv(
			"TEA_MODELS_LOCAL_ADDRESSES",
			`${target.origin},${second.origin}`
		);
		target.handler = (_hit, response) => {
			response.writeHead(302, { location: `${second.origin}/api/tags` });
			response.end();
		};
		try {
			const result = await testConnection(connection("OLLAMA"));
			expect(result.ok).toBe(false);
			expect(result.message).toBe(
				"The model server answered with a redirect, which is not followed."
			);
			expect(second.hits).toHaveLength(0);
		} finally {
			await second.close();
		}
	});
});

describe("testConnection: every message is fixed text, and it never throws", () => {
	const replies: [string, (response: ServerResponse) => void][] = [
		[
			"a refused key",
			(response) => json(response, { error: `bad ${KEY}` }, 401),
		],
		[
			"a forbidden key",
			(response) => json(response, { error: `bad ${KEY}` }, 403),
		],
		["a server error", (response) => json(response, { error: `${KEY}` }, 500)],
		["a missing page", (response) => json(response, { error: `${KEY}` }, 404)],
		[
			"a page that is not JSON",
			(response) => {
				response.writeHead(200, { "content-type": "text/html" });
				response.end(`<html>${KEY}</html>`);
			},
		],
		[
			"JSON of the wrong shape",
			(response) => json(response, { models: `${KEY}` }),
		],
		["JSON that is a bare string", (response) => json(response, KEY)],
		[
			"a dropped connection",
			(response) => {
				response.socket?.destroy();
			},
		],
		[
			"an answer cut short",
			(response) => {
				response.writeHead(200, {
					"content-type": "application/json",
					"content-length": "500",
				});
				response.write('{"models": [');
				response.socket?.destroy();
			},
		],
		[
			"a redirect that names the key",
			(response) => {
				response.writeHead(301, {
					location: `http://elsewhere.example/${KEY}`,
				});
				response.end();
			},
		],
	];

	for (const type of [
		"OLLAMA",
		"OPENAI_COMPATIBLE",
		"ANTHROPIC",
		"OPENROUTER",
		"OPENAI",
	] as const) {
		it.each(
			replies
		)(`gives fixed text for ${type} after %s`, async (_label, reply) => {
			target.handler = (_hit, response) => reply(response);
			const result = await testConnection(connection(type));
			expect(isFixed(result.message)).toBe(true);
			const text = JSON.stringify(result) + logs.text();
			expect(text).not.toContain(KEY);
			expect(text).not.toContain(String(target.port));
			expect(text).not.toContain("elsewhere.example");
		});
	}

	it("gives fixed text for an address the guard refuses", async () => {
		vi.stubEnv("TEA_MODELS_LOCAL_ADDRESSES", "");
		for (const baseUrl of [
			target.origin,
			"https://169.254.169.254",
			"https://168.63.129.16/x",
			"https://[::1]:8443",
			"https://10.0.0.5",
			"not a url",
			"https://user:pw@models.example",
		]) {
			const result = await testConnection({
				type: "OLLAMA",
				baseUrl,
				apiKey: KEY,
			});
			expect(result.ok).toBe(false);
			expect(isFixed(result.message)).toBe(true);
			expect(JSON.stringify(result)).not.toContain(KEY);
			expect(JSON.stringify(result)).not.toContain("pw@");
		}
		expect(target.connections).toBe(0);
	});

	it("gives up on a server that never answers", async () => {
		target.handler = () => undefined;
		const started = Date.now();
		const result = await testConnection(connection("OLLAMA"));
		expect(result.ok).toBe(false);
		expect(result.message).toBe("The model server did not answer in time.");
		expect(Date.now() - started).toBeLessThan(14_000);
	}, 20_000);
});
