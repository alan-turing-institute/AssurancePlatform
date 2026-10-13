import { gzipSync } from "node:zlib";
import { embed, generateText } from "ai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chatModelFor, embeddingModelFor } from "@/lib/models/adapters";
import {
	GuardedFetchError,
	type GuardedFetchErrorCode,
	guardedFetch,
} from "@/lib/models/guarded-fetch";
import {
	type CountingServer,
	countingLookup,
	json,
	lookupReturning,
	sleep,
	startServer,
} from "@/src/__tests__/utils/model-adversarial-kit";

const KEY = "sk-adversarial-SECRET-4711";
const AUTH = { authorization: `Bearer ${KEY}` };

/** The guard with a short time limit, so that a request that should have been refused does not hang. */
function limited(
	input: Parameters<typeof guardedFetch>[0],
	init?: Parameters<typeof guardedFetch>[1],
	options: Parameters<typeof guardedFetch>[2] = {}
) {
	return guardedFetch(input, init, { timeoutMs: 2000, ...options });
}

const servers: CountingServer[] = [];
async function server(
	handler?: Parameters<typeof startServer>[0]
): Promise<CountingServer> {
	const started = await startServer(handler);
	servers.push(started);
	return started;
}

beforeEach(() => {
	vi.unstubAllEnvs();
	vi.stubEnv("TEA_MODELS_LOCAL_ADDRESSES", "");
});

afterEach(async () => {
	vi.unstubAllEnvs();
	await Promise.all(servers.splice(0).map((started) => started.close()));
});

async function failure(promise: Promise<unknown>): Promise<GuardedFetchError> {
	try {
		await promise;
	} catch (error) {
		// biome-ignore lint/suspicious/noMisplacedAssertion: called from inside it() blocks
		expect(error).toBeInstanceOf(GuardedFetchError);
		return error as GuardedFetchError;
	}
	throw new Error("The request was expected to be refused");
}

async function refusedWith(
	code: GuardedFetchErrorCode,
	promise: Promise<unknown>
): Promise<GuardedFetchError> {
	const error = await failure(promise);
	// biome-ignore lint/suspicious/noMisplacedAssertion: called from inside it() blocks
	expect(error.code).toBe(code);
	return error;
}

function expectNoLeak(error: Error, ...secrets: string[]) {
	const everything = [
		error.message,
		error.stack ?? "",
		String(error),
		JSON.stringify(error),
		...Object.getOwnPropertyNames(error).map((name) =>
			String((error as unknown as Record<string, unknown>)[name])
		),
	].join("\n");
	for (const secret of secrets) {
		// biome-ignore lint/suspicious/noMisplacedAssertion: called from inside it() blocks
		expect(everything).not.toContain(secret);
	}
}

describe("guardedFetch: a name that resolves to an address a request must not reach", () => {
	const blockedAnswers = [
		"127.0.0.1",
		"127.8.8.8",
		"10.0.0.5",
		"172.16.4.4",
		"172.31.255.255",
		"192.168.1.1",
		"169.254.169.254",
		"168.63.129.16",
		"100.64.0.1",
		"0.0.0.0",
		"224.0.0.251",
		"255.255.255.255",
		"::1",
		"::",
		"fe80::1",
		"fd00::1",
		"ff02::1",
		"2002:a9fe:a9fe::",
		"2001:0:4136:e378:8000:63bf:3fff:fdd2",
		"::ffff:127.0.0.1",
		"::ffff:a9fe:a9fe",
		"64:ff9b::7f00:1",
	];

	it.each(
		blockedAnswers
	)("refuses a name that resolves to %s", async (address) => {
		const error = await refusedWith(
			"blocked-address",
			limited(
				"https://model.example/v1/models",
				{ headers: AUTH },
				{
					lookup: lookupReturning(address),
				}
			)
		);
		expectNoLeak(error, "model.example", KEY, address);
	});

	it("never connects to a loopback server when a name resolves to it", async () => {
		const target = await server((_hit, response) => json(response, {}));
		await refusedWith(
			"blocked-address",
			limited(`https://model.example:${target.port}/`, undefined, {
				lookup: lookupReturning("127.0.0.1"),
			})
		);
		await sleep(50);
		expect(target.connections).toBe(0);
		expect(target.hits).toHaveLength(0);
	});

	it("refuses when any one of several answers is blocked, whichever position it is in", async () => {
		const target = await server();
		for (const answers of [
			["203.0.113.7", "127.0.0.1"],
			["127.0.0.1", "203.0.113.7"],
			["203.0.113.7", "203.0.113.8", "169.254.169.254"],
			["2606:4700:4700::1111", "::1"],
		]) {
			await refusedWith(
				"blocked-address",
				limited(`https://model.example:${target.port}/`, undefined, {
					lookup: lookupReturning(...answers),
				})
			);
		}
		expect(target.connections).toBe(0);
	});

	it("refuses a name that resolves to nothing", async () => {
		await refusedWith(
			"blocked-address",
			limited("https://model.example/", undefined, {
				lookup: ((
					_host: string,
					_options: unknown,
					callback: (...a: unknown[]) => void
				) => callback(null, [])) as never,
			})
		);
	});

	it("reports a failed lookup with fixed text that does not name the host", async () => {
		const error = await failure(
			limited(
				"https://secret-host.example/",
				{ headers: AUTH },
				{
					lookup: ((
						host: string,
						_options: unknown,
						callback: (...a: unknown[]) => void
					) =>
						callback(
							Object.assign(new Error(`getaddrinfo ENOTFOUND ${host}`), {
								code: "ENOTFOUND",
								hostname: host,
							})
						)) as never,
				}
			)
		);
		expect(error.code).toBe("request-failed");
		expectNoLeak(error, "secret-host", KEY);
	});

	it("asks the resolver once for a request and connects to that answer", async () => {
		const target = await server((_hit, response) =>
			json(response, { ok: true })
		);
		vi.stubEnv(
			"TEA_MODELS_LOCAL_ADDRESSES",
			`http://rebind.test:${target.port}`
		);
		const first = lookupReturning("127.0.0.1");
		const counted = countingLookup(first);
		const response = await limited(
			`http://rebind.test:${target.port}/ping`,
			undefined,
			{ lookup: counted.lookup }
		);
		expect(await response.json()).toEqual({ ok: true });
		expect(counted.calls).toHaveLength(1);
		expect(target.hits).toHaveLength(1);
	});
});

describe("guardedFetch: an address written as an IP in the URL", () => {
	const blockedUrls = [
		"https://127.0.0.1/",
		"https://127.0.0.1:8443/",
		"https://127.1/",
		"https://2130706433/",
		"https://0x7f000001/",
		"https://0x7f.0.0.1/",
		"https://017700000001/",
		"https://127.0.0.1./",
		"https://[::1]/",
		"https://[::]/",
		"https://0.0.0.0/",
		"https://10.1.2.3/",
		"https://172.16.0.1/",
		"https://192.168.0.10/",
		"https://169.254.169.254/latest/meta-data/",
		"https://168.63.129.16/machine?comp=goalstate",
		"https://100.100.100.200/",
		"https://224.0.0.1/",
		"https://[fe80::1]/",
		"https://[fd00::1]/",
		"https://[ff02::1]/",
		"https://[::ffff:127.0.0.1]/",
		"https://[::ffff:7f00:1]/",
		"https://[::ffff:169.254.169.254]/",
		"https://[2002:7f00:1::]/",
		"https://[2001:0:4136:e378:8000:63bf:3fff:fdd2]/",
	];

	it.each(blockedUrls)("refuses %s without asking DNS", async (url) => {
		const dnsAsked = vi.fn();
		const error = await refusedWith(
			"blocked-address",
			limited(
				url,
				{ headers: AUTH },
				{
					lookup: ((...args: unknown[]) => {
						dnsAsked(args[0]);
					}) as never,
				}
			)
		);
		expect(dnsAsked).not.toHaveBeenCalled();
		expectNoLeak(error, KEY);
	});

	it("refuses an IP written in the URL even when its origin is listed over https", async () => {
		const target = await server();
		vi.stubEnv("TEA_MODELS_LOCAL_ADDRESSES", target.origin);
		await refusedWith(
			"blocked-address",
			limited(`https://127.0.0.1:${target.port}/`, undefined, {
				timeoutMs: 1000,
			})
		);
		expect(target.connections).toBe(0);
	});
});

describe("guardedFetch: plain http and the operator's list", () => {
	it("refuses http when nothing is listed, without connecting", async () => {
		const target = await server((_hit, response) => json(response, {}));
		const error = await refusedWith(
			"insecure-url",
			limited(`${target.origin}/v1/models`, { headers: AUTH })
		);
		expectNoLeak(error, KEY, String(target.port));
		await sleep(30);
		expect(target.connections).toBe(0);
	});

	it("refuses http to a public name", async () => {
		await refusedWith(
			"insecure-url",
			limited("http://api.example.org/v1", undefined, {
				lookup: lookupReturning("203.0.113.7"),
			})
		);
	});

	it.each([
		"file:///etc/passwd",
		"ftp://model.example/x",
		"data:text/plain,hello",
		"ws://model.example/x",
		"javascript:alert(1)",
	])("refuses the scheme of %s", async (url) => {
		await refusedWith(
			"insecure-url",
			limited(url, undefined, { lookup: lookupReturning("203.0.113.7") })
		);
	});

	it("refuses text that is not a URL, and input that is not a string or URL", async () => {
		await refusedWith("invalid-url", limited("not a url"));
		await refusedWith("invalid-url", limited("//model.example/x"));
		await refusedWith(
			"unsupported-input",
			limited(new Request("https://model.example/x"))
		);
	});

	it("refuses user names and passwords in the URL, and does not repeat them", async () => {
		for (const url of [
			"https://user:SECRETPASS@model.example/",
			"https://SECRETUSER@model.example/",
			"http://127.0.0.1:1@model.example/",
		]) {
			const error = await refusedWith(
				"credentials-in-url",
				limited(url, undefined, {
					lookup: lookupReturning("203.0.113.7"),
				})
			);
			expectNoLeak(error, "SECRETPASS", "SECRETUSER", "model.example");
		}
	});

	it("does not read a backslash or at-sign trick as another host", async () => {
		const target = await server();
		vi.stubEnv("TEA_MODELS_LOCAL_ADDRESSES", target.origin);
		const dns = countingLookup(lookupReturning("203.0.113.7"));
		// The parser reads the host as evil.example; the listed origin is not it.
		await refusedWith(
			"insecure-url",
			limited(`http://evil.example\\@127.0.0.1:${target.port}/`, undefined, {
				lookup: dns.lookup,
			})
		);
		expect(target.connections).toBe(0);
	});

	it("reaches a listed origin over http and returns its answer", async () => {
		const target = await server((_hit, response) => json(response, { ok: 1 }));
		vi.stubEnv("TEA_MODELS_LOCAL_ADDRESSES", target.origin);
		const response = await limited(`${target.origin}/api/tags`, {
			headers: AUTH,
		});
		expect(await response.json()).toEqual({ ok: 1 });
		expect(target.hits[0]?.headers.authorization).toBe(`Bearer ${KEY}`);
	});

	it("allows exactly the origin that is named: not another port, host or scheme", async () => {
		const listed = await server((_hit, response) => json(response, {}));
		const other = await server((_hit, response) => json(response, {}));
		vi.stubEnv("TEA_MODELS_LOCAL_ADDRESSES", listed.origin);

		await refusedWith("insecure-url", limited(`${other.origin}/`));
		await refusedWith(
			"insecure-url",
			limited(`http://localhost:${listed.port}/`, undefined, {
				lookup: lookupReturning("127.0.0.1"),
			})
		);
		await refusedWith(
			"blocked-address",
			limited(`https://127.0.0.1:${listed.port}/`, undefined, {
				timeoutMs: 1000,
			})
		);
		await refusedWith(
			"blocked-address",
			limited(`https://model.example:${listed.port}/`, undefined, {
				lookup: lookupReturning("127.0.0.1"),
				timeoutMs: 1000,
			})
		);
		expect(other.connections).toBe(0);
		expect(listed.connections).toBe(0);
	});

	it("reads an entry with a path, spaces or a trailing slash as its origin only", async () => {
		const target = await server((_hit, response) => json(response, {}));
		vi.stubEnv(
			"TEA_MODELS_LOCAL_ADDRESSES",
			`  not-a-url , ${target.origin}/some/path/ ,, ftp://x.example `
		);
		const response = await limited(`${target.origin}/other`);
		expect(response.status).toBe(200);
	});

	it.each([
		["a wildcard", "*"],
		["a wildcard host", "http://*"],
		["a bare host", "127.0.0.1"],
		["a scheme only", "http://"],
		["an entry with a password", "http://user:pw@127.0.0.1:__PORT__"],
		["a non-web scheme", "tcp://127.0.0.1:__PORT__"],
	])("lists nothing for %s", async (_label, entry) => {
		const target = await server();
		vi.stubEnv(
			"TEA_MODELS_LOCAL_ADDRESSES",
			entry.replace("__PORT__", String(target.port))
		);
		await refusedWith("insecure-url", limited(`${target.origin}/`));
		expect(target.connections).toBe(0);
	});
});

describe("guardedFetch: redirects", () => {
	it.each([
		301, 302, 303, 307, 308,
	])("does not follow a %i to a second server", async (status) => {
		const second = await server((_hit, response) =>
			json(response, { reached: true })
		);
		vi.stubEnv("TEA_MODELS_LOCAL_ADDRESSES", `${second.origin}`);
		const first = await server((_hit, response) => {
			response.writeHead(status, { location: `${second.origin}/secret` });
			response.end();
		});
		vi.stubEnv(
			"TEA_MODELS_LOCAL_ADDRESSES",
			`${first.origin},${second.origin}`
		);
		const error = await refusedWith(
			"redirect",
			limited(`${first.origin}/start`, { headers: AUTH })
		);
		expectNoLeak(error, "/secret", String(second.port));
		await sleep(50);
		expect(second.connections).toBe(0);
		expect(second.hits).toHaveLength(0);
		expect(first.hits).toHaveLength(1);
	});

	it("does not follow a redirect to the metadata address", async () => {
		const first = await server((_hit, response) => {
			response.writeHead(302, {
				location: "http://169.254.169.254/latest/meta-data/",
			});
			response.end();
		});
		vi.stubEnv("TEA_MODELS_LOCAL_ADDRESSES", first.origin);
		const error = await refusedWith("redirect", limited(`${first.origin}/`));
		expectNoLeak(error, "169.254.169.254");
		expect(first.hits).toHaveLength(1);
	});

	it("does not follow a redirect to a path on the same server", async () => {
		const first = await server((hit, response) => {
			if (hit.url === "/start") {
				response.writeHead(302, { location: "/elsewhere" });
				response.end();
				return;
			}
			json(response, { followed: true });
		});
		vi.stubEnv("TEA_MODELS_LOCAL_ADDRESSES", first.origin);
		await refusedWith("redirect", limited(`${first.origin}/start`));
		expect(first.hits.map((hit) => hit.url)).toEqual(["/start"]);
	});

	it("hands a 304 or other non-redirect status back as it is", async () => {
		const first = await server((_hit, response) =>
			json(response, { no: 1 }, 418)
		);
		vi.stubEnv("TEA_MODELS_LOCAL_ADDRESSES", first.origin);
		const response = await limited(`${first.origin}/`);
		expect(response.status).toBe(418);
	});
});

describe("guardedFetch: size and time limits", () => {
	it("cuts off a body that grows past the limit, and stops the server writing", async () => {
		let serverSawClose = false;
		const target = await server((_hit, response) => {
			response.writeHead(200, { "content-type": "text/plain" });
			response.on("close", () => {
				serverSawClose = true;
			});
			const timer = setInterval(() => {
				if (response.writableEnded || response.destroyed) {
					clearInterval(timer);
					return;
				}
				response.write("x".repeat(2000));
			}, 5);
		});
		vi.stubEnv("TEA_MODELS_LOCAL_ADDRESSES", target.origin);
		const response = await limited(`${target.origin}/`, undefined, {
			maxBytes: 5000,
			timeoutMs: 10_000,
		});
		const error = await failure(response.text());
		expect(error.code).toBe("response-too-large");
		await sleep(300);
		expect(serverSawClose).toBe(true);
	});

	it("refuses at once when the length is declared too large", async () => {
		const target = await server((_hit, response) => {
			response.writeHead(200, { "content-length": "999999999" });
			response.write("x".repeat(100));
		});
		vi.stubEnv("TEA_MODELS_LOCAL_ADDRESSES", target.origin);
		await refusedWith(
			"response-too-large",
			limited(`${target.origin}/`, undefined, { maxBytes: 1000 })
		);
	});

	it("lets a body of exactly the limit through and cuts one byte more", async () => {
		const target = await server((hit, response) => {
			const size = hit.url === "/exact" ? 1000 : 1001;
			response.writeHead(200, { "content-type": "text/plain" });
			response.write("y".repeat(size - 1));
			setTimeout(() => response.end("y"), 20);
		});
		vi.stubEnv("TEA_MODELS_LOCAL_ADDRESSES", target.origin);
		const exact = await limited(`${target.origin}/exact`, undefined, {
			maxBytes: 1000,
		});
		expect((await exact.text()).length).toBe(1000);
		const over = await limited(`${target.origin}/over`, undefined, {
			maxBytes: 1000,
		});
		expect((await failure(over.text())).code).toBe("response-too-large");
	});

	it("counts the bytes after decompression, so a compressed bomb is cut off", async () => {
		const bomb = gzipSync(Buffer.alloc(20 * 1024 * 1024, 0));
		expect(bomb.length).toBeLessThan(100_000);
		const target = await server((_hit, response) => {
			response.writeHead(200, {
				"content-type": "text/plain",
				"content-encoding": "gzip",
				"content-length": String(bomb.length),
			});
			response.end(bomb);
		});
		vi.stubEnv("TEA_MODELS_LOCAL_ADDRESSES", target.origin);
		const response = await limited(`${target.origin}/`, undefined, {
			maxBytes: 100_000,
		});
		expect((await failure(response.text())).code).toBe("response-too-large");
	});

	it("drops the connection of a request that timed out", async () => {
		let closed = false;
		const target = await server((_hit, response) => {
			response.socket?.on("close", () => {
				closed = true;
			});
		});
		vi.stubEnv("TEA_MODELS_LOCAL_ADDRESSES", target.origin);
		await refusedWith(
			"timeout",
			limited(`${target.origin}/`, undefined, { timeoutMs: 200 })
		);
		await sleep(300);
		expect(closed).toBe(true);
	});

	it("cuts off a server that never answers", async () => {
		const target = await server(() => undefined);
		vi.stubEnv("TEA_MODELS_LOCAL_ADDRESSES", target.origin);
		const started = Date.now();
		const error = await refusedWith(
			"timeout",
			limited(`${target.origin}/`, { headers: AUTH }, { timeoutMs: 300 })
		);
		expect(Date.now() - started).toBeLessThan(2500);
		expectNoLeak(error, KEY, String(target.port));
	});

	it("cuts off a body that stalls after the headers", async () => {
		const target = await server((_hit, response) => {
			response.writeHead(200, { "content-type": "text/plain" });
			response.write("start");
		});
		vi.stubEnv("TEA_MODELS_LOCAL_ADDRESSES", target.origin);
		const response = await limited(`${target.origin}/`, undefined, {
			timeoutMs: 300,
		});
		const started = Date.now();
		const error = await failure(response.text());
		expect(error.code).toBe("timeout");
		expect(Date.now() - started).toBeLessThan(2500);
	});

	it("cuts off a body that is sent slowly enough to stay under any idle limit", async () => {
		const target = await server((_hit, response) => {
			response.writeHead(200, { "content-type": "text/plain" });
			const timer = setInterval(() => {
				if (response.destroyed || response.writableEnded) {
					clearInterval(timer);
					return;
				}
				response.write("z");
			}, 40);
		});
		vi.stubEnv("TEA_MODELS_LOCAL_ADDRESSES", target.origin);
		const started = Date.now();
		const response = await limited(`${target.origin}/`, undefined, {
			timeoutMs: 500,
			maxBytes: 1_000_000,
		});
		const error = await failure(response.text());
		expect(error.code).toBe("timeout");
		expect(Date.now() - started).toBeLessThan(3000);
	});

	it("passes the caller's own abort on as an abort, not as a timeout", async () => {
		const target = await server(() => undefined);
		vi.stubEnv("TEA_MODELS_LOCAL_ADDRESSES", target.origin);
		const controller = new AbortController();
		const pending = limited(
			`${target.origin}/`,
			{ signal: controller.signal },
			{ timeoutMs: 20_000 }
		);
		setTimeout(() => controller.abort(), 100);
		const started = Date.now();
		await expect(pending).rejects.toSatisfy(
			(error: unknown) =>
				!(error instanceof GuardedFetchError && error.code === "timeout")
		);
		expect(Date.now() - started).toBeLessThan(2000);
	});
});

describe("guardedFetch: errors carry no key and no address", () => {
	it("replaces a dropped connection with fixed text", async () => {
		const target = await server((_hit, response) => {
			response.socket?.destroy();
		});
		vi.stubEnv("TEA_MODELS_LOCAL_ADDRESSES", target.origin);
		const error = await refusedWith(
			"request-failed",
			limited(`${target.origin}/v1/chat`, {
				method: "POST",
				headers: AUTH,
				body: JSON.stringify({ secret: KEY }),
			})
		);
		expectNoLeak(error, KEY, String(target.port), "127.0.0.1");
	});

	it("replaces a refused connection with fixed text", async () => {
		const closed = await startServer();
		const { origin, port } = closed;
		await closed.close();
		vi.stubEnv("TEA_MODELS_LOCAL_ADDRESSES", origin);
		const error = await refusedWith(
			"request-failed",
			limited(`${origin}/`, { headers: AUTH })
		);
		expectNoLeak(error, KEY, String(port), "127.0.0.1", "ECONNREFUSED");
	});

	it("replaces a header the HTTP client refuses with fixed text that does not quote it", async () => {
		const target = await server();
		vi.stubEnv("TEA_MODELS_LOCAL_ADDRESSES", target.origin);
		for (const value of [
			`Bearer ${KEY}\r\nx-injected: 1`,
			`Bearer ${KEY}\nmore`,
			`Bearer ${KEY}Ā`,
		]) {
			const error = await failure(
				limited(`${target.origin}/`, { headers: { authorization: value } })
			);
			expect(["request-failed", "invalid-response"]).toContain(error.code);
			expectNoLeak(error, KEY);
		}
		expect(target.hits).toHaveLength(0);
	});
});

describe("the AI SDK providers send every request through the guard", () => {
	const noRetry = { maxRetries: 0 } as const;

	it.each([
		["OLLAMA", "/v1/chat/completions"],
		["OPENAI_COMPATIBLE", "/chat/completions"],
		["OPENROUTER", "/api/v1/chat/completions"],
		["ANTHROPIC", "/v1/messages"],
	] as const)("%s chat to an unlisted http address connects to nothing", async (type, _path) => {
		const target = await server((_hit, response) => json(response, {}, 500));
		const model = chatModelFor(
			{ type, baseUrl: target.origin, apiKey: KEY },
			"some-model"
		);
		const outcome = await generateText({
			model,
			prompt: "hi",
			...noRetry,
		}).then(
			() => null,
			(error: unknown) => error
		);
		expect(outcome).toBeInstanceOf(Error);
		expectNoLeak(outcome as Error, KEY, String(target.port));
		await sleep(30);
		expect(target.connections).toBe(0);
	});

	it.each([
		["OLLAMA", "/v1/chat/completions"],
		["OPENAI_COMPATIBLE", "/chat/completions"],
		["OPENROUTER", "/api/v1/chat/completions"],
		["ANTHROPIC", "/v1/messages"],
	] as const)("%s chat reaches a listed address, with the key it was given", async (type, path) => {
		const target = await server((_hit, response) => json(response, {}, 500));
		vi.stubEnv("TEA_MODELS_LOCAL_ADDRESSES", target.origin);
		const model = chatModelFor(
			{ type, baseUrl: target.origin, apiKey: KEY },
			"some-model"
		);
		await generateText({ model, prompt: "hi", ...noRetry }).catch(
			() => undefined
		);
		expect(target.hits[0]?.url).toBe(path);
		const sent = JSON.stringify(target.hits[0]?.headers);
		expect(sent).toContain(KEY);
	});

	it.each([
		"OLLAMA",
		"OPENAI_COMPATIBLE",
		"OPENROUTER",
	] as const)("%s embeddings to an unlisted http address connect to nothing", async (type) => {
		const target = await server((_hit, response) => json(response, {}, 500));
		const outcome = await embed({
			model: embeddingModelFor(
				{ type, baseUrl: target.origin, apiKey: KEY },
				"some-model"
			),
			value: "hello",
			...noRetry,
		}).then(
			() => null,
			(error: unknown) => error
		);
		expect(outcome).toBeInstanceOf(Error);
		expectNoLeak(outcome as Error, KEY, String(target.port));
		await sleep(30);
		expect(target.connections).toBe(0);
	});

	it("does not follow a redirect an AI SDK request meets", async () => {
		const second = await server((_hit, response) => json(response, {}));
		const first = await server((_hit, response) => {
			response.writeHead(307, {
				location: `${second.origin}/v1/chat/completions`,
			});
			response.end();
		});
		vi.stubEnv(
			"TEA_MODELS_LOCAL_ADDRESSES",
			`${first.origin},${second.origin}`
		);
		const outcome = await generateText({
			model: chatModelFor(
				{ type: "OLLAMA", baseUrl: first.origin, apiKey: KEY },
				"m"
			),
			prompt: "hi",
			...noRetry,
		}).then(
			() => null,
			(error: unknown) => error
		);
		expect(outcome).toBeInstanceOf(Error);
		expect(second.hits).toHaveLength(0);
		expect(second.connections).toBe(0);
	});

	it("refuses to build a model for a job the connection's type cannot do", () => {
		const anthropic = {
			type: "ANTHROPIC",
			baseUrl: "https://x.example",
			apiKey: KEY,
		} as const;
		expect(() => embeddingModelFor(anthropic, "m")).toThrow();
		expect(() =>
			chatModelFor(
				{ type: "ANTHROPIC", baseUrl: "https://x.example", apiKey: null },
				"m"
			)
		).toThrow();
	});

	it("never falls back to a key in the server's own environment", async () => {
		vi.stubEnv("OPENAI_API_KEY", "server-env-openai-key");
		vi.stubEnv("OPENROUTER_API_KEY", "server-env-openrouter-key");
		vi.stubEnv("ANTHROPIC_API_KEY", "server-env-anthropic-key");
		const target = await server((_hit, response) => json(response, {}, 500));
		vi.stubEnv("TEA_MODELS_LOCAL_ADDRESSES", target.origin);
		for (const type of ["OLLAMA", "OPENAI_COMPATIBLE", "OPENROUTER"] as const) {
			await generateText({
				model: chatModelFor(
					{ type, baseUrl: target.origin, apiKey: null },
					"m"
				),
				prompt: "hi",
				...noRetry,
			}).catch(() => undefined);
			await embed({
				model: embeddingModelFor(
					{ type, baseUrl: target.origin, apiKey: null },
					"m"
				),
				value: "hi",
				...noRetry,
			}).catch(() => undefined);
		}
		expect(target.hits.length).toBeGreaterThanOrEqual(6);
		expect(JSON.stringify(target.hits)).not.toContain("server-env");
		for (const hit of target.hits) {
			expect(hit.headers.authorization).toBeUndefined();
			expect(hit.headers["x-api-key"]).toBeUndefined();
		}
	});
});
