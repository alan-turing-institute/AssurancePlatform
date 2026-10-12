import { createServer, type Server } from "node:http";
import type { AddressInfo, Socket } from "node:net";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { streamText } from "ai";
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
import { guardedFetch } from "../guarded-fetch";

/**
 * Each guarded call gets its own connection pool, which must be gone once the
 * exchange is over. The server counts the client sockets it still has open: a
 * pool kept alive would keep its idle socket open for seconds.
 */

let server: Server;
let port: number;
const open = new Set<Socket>();
let connections = 0;
let releaseSecondChunk: () => void = () => undefined;

/** One server-sent event of an OpenAI-style streamed chat completion. */
function completionChunk(
	delta: { content: string; role?: string },
	finishReason: string | null = null
): string {
	const chunk = {
		id: "chatcmpl-1",
		object: "chat.completion.chunk",
		created: 1,
		model: "m",
		choices: [{ index: 0, delta, finish_reason: finishReason }],
	};
	return `data: ${JSON.stringify(chunk)}\n\n`;
}

beforeAll(async () => {
	server = createServer((req, res) => {
		switch (req.url) {
			case "/ok":
				res.writeHead(200, { "content-type": "application/json" });
				res.end('{"ok":true}');
				break;
			case "/no-content":
				res.writeHead(204);
				res.end();
				break;
			case "/redirect":
				res.writeHead(302, { location: "/ok" });
				res.end();
				break;
			case "/chunked":
				res.writeHead(200);
				for (let index = 0; index < 10; index += 1) {
					res.write("x".repeat(1000));
				}
				res.end();
				break;
			case "/declared-large":
				res.writeHead(200, { "content-length": "1000000" });
				res.write("x");
				break;
			case "/status-999":
				res.writeHead(999);
				res.write("unfinished");
				break;
			case "/stalls-after-headers":
				res.writeHead(200);
				res.write("first");
				break;
			case "/two-chunks":
				res.writeHead(200);
				res.write("first");
				releaseSecondChunk = () => res.end("second");
				break;
			case "/v1/chat/completions":
				res.writeHead(200, { "content-type": "text/event-stream" });
				res.write(completionChunk({ role: "assistant", content: "Hel" }));
				releaseSecondChunk = () => {
					res.write(completionChunk({ content: "lo" }, "stop"));
					res.end("data: [DONE]\n\n");
				};
				break;
			default:
				// Never answers.
				break;
		}
	});
	server.on("connection", (socket) => {
		connections += 1;
		open.add(socket);
		socket.on("close", () => open.delete(socket));
	});
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	port = (server.address() as AddressInfo).port;
});

afterAll(() => {
	server.closeAllConnections();
	server.close();
});

beforeEach(() => {
	connections = 0;
	vi.stubEnv("TEA_MODELS_LOCAL_ADDRESSES", `http://127.0.0.1:${port}`);
});

afterEach(() => {
	vi.unstubAllEnvs();
	server.closeAllConnections();
});

const url = (path: string) => `http://127.0.0.1:${port}${path}`;

/** Resolves once the server has no client socket open; rejects if one stays open. */
function expectNoOpenConnections(): Promise<void> {
	return vi.waitFor(
		() => {
			if (open.size > 0) {
				throw new Error(`${open.size} connection(s) still open`);
			}
		},
		{ timeout: 1500 }
	);
}

describe("the connection pool of a call", () => {
	it("is closed once the response body has been read", async () => {
		const response = await guardedFetch(url("/ok"));
		expect(await response.json()).toEqual({ ok: true });
		await expectNoOpenConnections();
	});

	it("is closed for a response that has no body", async () => {
		const response = await guardedFetch(url("/no-content"));
		expect(response.status).toBe(204);
		await expectNoOpenConnections();
	});

	it("is not shared with the next call", async () => {
		for (let call = 0; call < 3; call += 1) {
			const response = await guardedFetch(url("/ok"));
			await response.text();
		}
		await expectNoOpenConnections();
		expect(connections).toBe(3);
	});

	it("is closed when the reader gives up on the body", async () => {
		const response = await guardedFetch(url("/stalls-after-headers"));
		await response.body?.cancel();
		await expectNoOpenConnections();
	});

	it("is closed when the body passes the byte cap", async () => {
		const response = await guardedFetch(url("/chunked"), undefined, {
			maxBytes: 2500,
		});
		await expect(response.text()).rejects.toMatchObject({
			code: "response-too-large",
		});
		await expectNoOpenConnections();
	});

	it("is closed when the headers declare more than the byte cap", async () => {
		await expect(
			guardedFetch(url("/declared-large"), undefined, { maxBytes: 1000 })
		).rejects.toMatchObject({ code: "response-too-large" });
		await expectNoOpenConnections();
	});

	it("is closed when the server redirects", async () => {
		await expect(guardedFetch(url("/redirect"))).rejects.toMatchObject({
			code: "redirect",
		});
		await expectNoOpenConnections();
	});

	it("is closed when the server does not answer in time", async () => {
		await expect(
			guardedFetch(url("/never"), undefined, { timeoutMs: 100 })
		).rejects.toMatchObject({ code: "timeout" });
		await expectNoOpenConnections();
	});

	it("is closed when the caller aborts", async () => {
		const controller = new AbortController();
		const pending = guardedFetch(
			url("/never"),
			{ signal: controller.signal },
			{ timeoutMs: 5000 }
		).catch((caught: unknown) => caught);
		await vi.waitFor(() => expect(open.size).toBe(1));
		controller.abort();
		await pending;
		await expectNoOpenConnections();
	});

	it("is closed when the response status cannot be used", async () => {
		await expect(guardedFetch(url("/status-999"))).rejects.toMatchObject({
			code: "invalid-response",
		});
		await expectNoOpenConnections();
	});

	it("is closed at the timeout when nobody reads the body", async () => {
		await guardedFetch(url("/stalls-after-headers"), undefined, {
			timeoutMs: 200,
		});
		await expectNoOpenConnections();
	});

	it("is closed when the body stalls and the timeout passes", async () => {
		const response = await guardedFetch(
			url("/stalls-after-headers"),
			undefined,
			{ timeoutMs: 200 }
		);
		await expect(response.text()).rejects.toMatchObject({ code: "timeout" });
		await expectNoOpenConnections();
	});
});

describe("a streamed body", () => {
	it("reaches the reader chunk by chunk, before the server has finished", async () => {
		const response = await guardedFetch(url("/two-chunks"));
		const reader = response.body?.getReader();
		const decoder = new TextDecoder();

		const first = await reader?.read();
		expect(decoder.decode(first?.value)).toBe("first");
		expect(open.size).toBe(1);

		releaseSecondChunk();
		let rest = "";
		for (;;) {
			const next = await reader?.read();
			if (!next || next.done) {
				break;
			}
			rest += decoder.decode(next.value);
		}
		expect(rest).toBe("second");
		await expectNoOpenConnections();
	});

	it("reaches a chat stream token by token while the reply is still open", async () => {
		const model = createOpenAICompatible({
			name: "test",
			baseURL: url("/v1"),
			apiKey: "sk-test-secret-key",
			fetch: guardedFetch,
		}).chatModel("m");
		const result = streamText({ model, prompt: "hi", maxRetries: 0 });
		const reader = result.textStream.getReader();

		const first = await reader.read();
		expect(first.value).toBe("Hel");
		expect(open.size).toBe(1);

		releaseSecondChunk();
		let rest = "";
		for (;;) {
			const next = await reader.read();
			if (next.done) {
				break;
			}
			rest += next.value;
		}
		expect(rest).toBe("lo");
		await expectNoOpenConnections();
	});
});
