import { createServer, type Server } from "node:http";
import {
	type AddressInfo,
	type LookupFunction,
	setDefaultAutoSelectFamily,
} from "node:net";
import { fetch as undiciFetch } from "undici";
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
	createGuardedAgent,
	GuardedFetchError,
	guardedFetch,
} from "../guarded-fetch";
import { type ModelServer, startModelServer } from "./model-server";

const KEY = "sk-test-secret-key";
const NAMES_THE_DNS_ANSWER = /public|resolve/i;

let server: Server;
let port: number;
let hits: string[] = [];

beforeAll(async () => {
	server = createServer((req, res) => {
		hits.push(req.url ?? "");
		switch (req.url) {
			case "/ok":
				res.writeHead(200, { "content-type": "application/json" });
				res.end('{"ok":true}');
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
			case "/stalls-after-headers":
				res.writeHead(200);
				res.write("first");
				break;
			case "/undecodable-then-close":
				res.writeHead(200, {
					"content-encoding": "gzip, gzip, gzip, gzip, gzip, gzip",
					"content-length": "1000",
				});
				res.write("x");
				setTimeout(() => res.socket?.destroy(), 20);
				break;
			case "/status-999":
				res.writeHead(999);
				res.write("unfinished");
				break;
			default:
				// Never answers.
				break;
		}
	});
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	port = (server.address() as AddressInfo).port;
});

afterAll(() => {
	server.closeAllConnections();
	server.close();
});

beforeEach(() => {
	hits = [];
});

afterEach(() => {
	vi.unstubAllEnvs();
});

/** A resolver that answers from a table and records each call. */
function resolverFor(answers: Record<string, string[]>) {
	return vi.fn<LookupFunction>((hostname, _options, callback) => {
		callback(
			null,
			(answers[hostname] ?? []).map((address) => ({
				address,
				family: address.includes(":") ? 6 : 4,
			}))
		);
	});
}

function listLocalServer() {
	vi.stubEnv("TEA_MODELS_LOCAL_ADDRESSES", `http://127.0.0.1:${port}`);
}

describe("refusals before any connection", () => {
	it("refuses http to a public host", async () => {
		const lookup = resolverFor({ "models.example.test": ["93.184.216.34"] });
		await expect(
			guardedFetch("http://models.example.test/v1", undefined, { lookup })
		).rejects.toMatchObject({ code: "insecure-url" });
		expect(lookup).not.toHaveBeenCalled();
	});

	it("refuses a name whose lookup returns the cloud metadata address", async () => {
		const lookup = resolverFor({ "models.example.test": ["169.254.169.254"] });
		await expect(
			guardedFetch("https://models.example.test/v1", undefined, { lookup })
		).rejects.toMatchObject({ code: "blocked-address" });
		expect(lookup).toHaveBeenCalledTimes(1);
	});

	it("words a refused address and a name that does not resolve the same way, while keeping their codes apart", async () => {
		const notFound = vi.fn<LookupFunction>((_hostname, _options, callback) => {
			callback(
				Object.assign(new Error("getaddrinfo ENOTFOUND"), {
					code: "ENOTFOUND",
				}),
				[]
			);
		});
		const lookup = resolverFor({ "internal.example.test": ["10.0.0.5"] });

		const refused = await guardedFetch(
			"https://internal.example.test/v1",
			undefined,
			{ lookup }
		).catch((error: unknown) => error);
		const missing = await guardedFetch(
			"https://nowhere.example.test/v1",
			undefined,
			{ lookup: notFound }
		).catch((error: unknown) => error);

		expect(refused).toMatchObject({ code: "blocked-address" });
		expect(missing).toMatchObject({ code: "request-failed" });
		expect((refused as Error).message).toBe((missing as Error).message);
		expect((refused as Error).message).not.toMatch(NAMES_THE_DNS_ANSWER);
	});

	it("refuses a mixed answer when any address is private", async () => {
		const lookup = resolverFor({
			"models.example.test": ["93.184.216.34", "10.0.0.5"],
		});
		await expect(
			guardedFetch("https://models.example.test/v1", undefined, { lookup })
		).rejects.toMatchObject({ code: "blocked-address" });
	});

	it.each([
		["a loopback name", ["127.0.0.1"]],
		["an IPv6 loopback name", ["::1"]],
		["an IPv4-mapped name", ["::ffff:7f00:1"]],
		["a unique-local name", ["fd00::1"]],
	])("refuses %s", async (_label, addresses) => {
		const lookup = resolverFor({ "models.example.test": addresses });
		await expect(
			guardedFetch("https://models.example.test/v1", undefined, { lookup })
		).rejects.toMatchObject({ code: "blocked-address" });
	});

	it.each([
		"https://127.0.0.1/v1",
		"https://10.1.2.3/v1",
		"https://169.254.169.254/latest/meta-data/",
		"https://2130706433/v1",
		"https://[::1]/v1",
		"https://[::ffff:7f00:1]/v1",
		"https://[::ffff:169.254.169.254]/v1",
		"https://[fe80::1]/v1",
	])("refuses the literal address in %s without resolving anything", async (url) => {
		const lookup = resolverFor({});
		await expect(
			guardedFetch(url, undefined, { lookup })
		).rejects.toMatchObject({ code: "blocked-address" });
		expect(lookup).not.toHaveBeenCalled();
	});

	it("refuses an address with a user name or password, and never repeats it", async () => {
		const error = await guardedFetch(
			"https://user:pass-secret@models.example.test/v1"
		).catch((caught: unknown) => caught);
		expect(error).toMatchObject({ code: "credentials-in-url" });
		expect(String(error)).not.toContain("pass-secret");
	});

	it("refuses input that is not a URL or a string", async () => {
		await expect(
			guardedFetch(new Request("https://models.example.test/v1"))
		).rejects.toMatchObject({ code: "unsupported-input" });
		await expect(guardedFetch("/relative")).rejects.toMatchObject({
			code: "invalid-url",
		});
	});

	it("never puts the key in a refusal", async () => {
		const lookup = resolverFor({ "models.example.test": ["169.254.169.254"] });
		const init = { headers: { authorization: `Bearer ${KEY}` } };
		const errors = await Promise.all([
			guardedFetch("https://models.example.test/v1", init, { lookup }).catch(
				(caught: unknown) => caught
			),
			guardedFetch("http://models.example.test/v1", init, { lookup }).catch(
				(caught: unknown) => caught
			),
			guardedFetch("https://127.0.0.1/v1", init, { lookup }).catch(
				(caught: unknown) => caught
			),
		]);
		for (const error of errors) {
			expect(error).toBeInstanceOf(GuardedFetchError);
			expect(String(error)).not.toContain(KEY);
			expect(JSON.stringify(error)).not.toContain(KEY);
		}
	});
});

describe("the operator's local list", () => {
	it("allows http to a listed origin on a private address", async () => {
		listLocalServer();
		const response = await guardedFetch(`http://127.0.0.1:${port}/ok`);
		expect(await response.json()).toEqual({ ok: true });
	});

	it("allows a listed name that resolves to a private address", async () => {
		vi.stubEnv(
			"TEA_MODELS_LOCAL_ADDRESSES",
			`http://ollama.example.test:${port}`
		);
		const lookup = resolverFor({ "ollama.example.test": ["127.0.0.1"] });
		const response = await guardedFetch(
			`http://ollama.example.test:${port}/ok`,
			undefined,
			{ lookup }
		);
		expect(response.status).toBe(200);
		expect(lookup).toHaveBeenCalledTimes(1);
	});

	it("refuses the same host on another port", async () => {
		listLocalServer();
		await expect(
			guardedFetch(`http://127.0.0.1:${port + 1}/ok`)
		).rejects.toMatchObject({ code: "insecure-url" });
		await expect(
			guardedFetch(`https://127.0.0.1:${port}/ok`)
		).rejects.toMatchObject({ code: "blocked-address" });
		expect(hits).toEqual([]);
	});
});

describe("the connection", () => {
	it("is refused inside the connect step, before a socket is opened", async () => {
		const resolve = resolverFor({ "pinned.example.test": ["127.0.0.1"] });
		await expect(
			undiciFetch(`http://pinned.example.test:${port}/ok`, {
				dispatcher: createGuardedAgent(resolve),
			})
		).rejects.toMatchObject({ cause: { code: "blocked-address" } });
		expect(hits).toEqual([]);
	});

	it("is made to the address the checked lookup returned, from one resolution", async () => {
		let calls = 0;
		const resolve = vi.fn<LookupFunction>((_hostname, _options, callback) => {
			calls += 1;
			callback(null, [
				{ address: calls === 1 ? "127.0.0.1" : "10.0.0.9", family: 4 },
			]);
		});
		const response = await undiciFetch(
			`http://pinned.example.test:${port}/ok`,
			{ dispatcher: createGuardedAgent(resolve, () => false) }
		);
		expect(response.status).toBe(200);
		expect(hits).toEqual(["/ok"]);
		expect(resolve).toHaveBeenCalledTimes(1);
		expect(resolve.mock.calls[0]?.[1]).toMatchObject({ all: true });
	});

	describe("when the socket asks for one address", () => {
		beforeEach(() => {
			setDefaultAutoSelectFamily(false);
		});

		afterEach(() => {
			setDefaultAutoSelectFamily(true);
		});

		it("connects to the first checked address", async () => {
			const resolve = resolverFor({
				"pinned.example.test": ["127.0.0.1", "10.0.0.9"],
			});
			const response = await undiciFetch(
				`http://pinned.example.test:${port}/ok`,
				{ dispatcher: createGuardedAgent(resolve, () => false) }
			);
			expect(response.status).toBe(200);
			expect(hits).toEqual(["/ok"]);
			expect(resolve).toHaveBeenCalledTimes(1);
			expect(resolve.mock.calls[0]?.[1]).toMatchObject({ all: true });
		});

		it("refuses when any resolved address is blocked", async () => {
			const resolve = resolverFor({
				"pinned.example.test": ["127.0.0.1", "10.0.0.9"],
			});
			await expect(
				undiciFetch(`http://pinned.example.test:${port}/ok`, {
					dispatcher: createGuardedAgent(resolve),
				})
			).rejects.toMatchObject({ cause: { code: "blocked-address" } });
			expect(hits).toEqual([]);
		});
	});
});

describe("failures the guard does not recognise", () => {
	it("replaces a header error that would quote the key with fixed text", async () => {
		listLocalServer();
		const error = await guardedFetch(`http://127.0.0.1:${port}/ok`, {
			headers: { authorization: `Bearer ${KEY}\nx-injected: 1` },
		}).catch((caught: unknown) => caught);
		expect(error).toBeInstanceOf(GuardedFetchError);
		expect(error).toMatchObject({ code: "request-failed" });
		expect((error as Error).cause).toBeUndefined();
		expect(String(error)).not.toContain(KEY);
		expect(JSON.stringify(error)).not.toContain(KEY);
		expect(hits).toEqual([]);
	});

	it("replaces a connection failure with fixed text that does not name the address", async () => {
		const closed = createServer();
		await new Promise<void>((resolve) =>
			closed.listen(0, "127.0.0.1", resolve)
		);
		const closedPort = (closed.address() as AddressInfo).port;
		await new Promise<void>((resolve) => closed.close(() => resolve()));
		vi.stubEnv("TEA_MODELS_LOCAL_ADDRESSES", `http://127.0.0.1:${closedPort}`);

		const error = await guardedFetch(`http://127.0.0.1:${closedPort}/ok`).catch(
			(caught: unknown) => caught
		);
		expect(error).toMatchObject({ code: "request-failed" });
		expect(String(error)).not.toContain("127.0.0.1");
		expect(String(error)).not.toContain(String(closedPort));
		expect((error as Error).cause).toBeUndefined();
	});

	it("returns a GuardedFetchError and keeps serving when a response cannot be decoded", async () => {
		listLocalServer();
		const outcome = await guardedFetch(
			`http://127.0.0.1:${port}/undecodable-then-close`
		).then(
			(response) => response.text().catch((caught: unknown) => caught),
			(caught: unknown) => caught
		);
		expect(outcome).toBeInstanceOf(GuardedFetchError);
		// A follow-up request proves the worker is still serving.
		const next = await guardedFetch(`http://127.0.0.1:${port}/ok`);
		expect(next.status).toBe(200);
	});

	it("refuses a response whose status code a Response cannot hold", async () => {
		listLocalServer();
		await expect(
			guardedFetch(`http://127.0.0.1:${port}/status-999`)
		).rejects.toMatchObject({ code: "invalid-response" });
	});
});

describe("limits", () => {
	it("errors on a redirect and does not follow it", async () => {
		listLocalServer();
		await expect(
			guardedFetch(`http://127.0.0.1:${port}/redirect`)
		).rejects.toMatchObject({ code: "redirect" });
		expect(hits).toEqual(["/redirect"]);
	});

	it("cuts a body off at the byte cap", async () => {
		listLocalServer();
		const response = await guardedFetch(
			`http://127.0.0.1:${port}/chunked`,
			undefined,
			{ maxBytes: 2500 }
		);
		await expect(response.text()).rejects.toMatchObject({
			code: "response-too-large",
		});
	});

	it("passes a body that fits the cap", async () => {
		listLocalServer();
		const response = await guardedFetch(
			`http://127.0.0.1:${port}/chunked`,
			undefined,
			{ maxBytes: 10_000 }
		);
		expect((await response.text()).length).toBe(10_000);
	});

	it("refuses a response that declares more than the cap", async () => {
		listLocalServer();
		await expect(
			guardedFetch(`http://127.0.0.1:${port}/declared-large`, undefined, {
				maxBytes: 1000,
			})
		).rejects.toMatchObject({ code: "response-too-large" });
	});

	it("times out when the server does not answer", async () => {
		listLocalServer();
		await expect(
			guardedFetch(`http://127.0.0.1:${port}/never`, undefined, {
				timeoutMs: 100,
			})
		).rejects.toMatchObject({ code: "timeout" });
	});

	it("times out when the body stalls after the headers", async () => {
		listLocalServer();
		const response = await guardedFetch(
			`http://127.0.0.1:${port}/stalls-after-headers`,
			undefined,
			{ timeoutMs: 200 }
		);
		await expect(response.text()).rejects.toMatchObject({ code: "timeout" });
	});

	it("ends when the caller aborts, without reporting a timeout", async () => {
		listLocalServer();
		const controller = new AbortController();
		const pending = guardedFetch(
			`http://127.0.0.1:${port}/never`,
			{ signal: controller.signal },
			{ timeoutMs: 5000 }
		).catch((caught: unknown) => caught);
		setTimeout(() => controller.abort(), 50);
		const error = await pending;
		expect(error).toBeInstanceOf(Error);
		expect(error).not.toBeInstanceOf(GuardedFetchError);
	});
});

describe("the error a caller receives", () => {
	it("is named GuardedFetchError", () => {
		const error = new GuardedFetchError("redirect");
		expect(error.name).toBe("GuardedFetchError");
		expect(String(error).startsWith("GuardedFetchError: ")).toBe(true);
	});
});

describe("an address given as a URL object", () => {
	it("is fetched like the same address as a string", async () => {
		listLocalServer();
		const response = await guardedFetch(new URL(`http://127.0.0.1:${port}/ok`));
		expect(await response.json()).toStrictEqual({ ok: true });
		expect(hits).toStrictEqual(["/ok"]);
	});

	it.each([
		["https://user:pass-secret@models.example.test/v1", "credentials-in-url"],
		["http://models.example.test/v1", "insecure-url"],
		["https://127.0.0.1/v1", "blocked-address"],
	])("is refused for %s", async (address, code) => {
		await expect(guardedFetch(new URL(address))).rejects.toMatchObject({
			code,
		});
	});
});

/** A resolver that ignores `all` and answers with one address, the older callback form. */
function singleAnswer(address: string, family: number): LookupFunction {
	const lookup = (
		_hostname: string,
		_options: unknown,
		callback: (...args: unknown[]) => void
	) => callback(null, address, family);
	return lookup as unknown as LookupFunction;
}

describe("a resolver that answers with one address", () => {
	it("connects to that address", async () => {
		vi.stubEnv(
			"TEA_MODELS_LOCAL_ADDRESSES",
			`http://ollama.example.test:${port}`
		);
		const response = await guardedFetch(
			`http://ollama.example.test:${port}/ok`,
			undefined,
			{ lookup: singleAnswer("127.0.0.1", 4) }
		);
		expect(response.status).toBe(200);
		expect(hits).toStrictEqual(["/ok"]);
	});

	it("is refused when that address is blocked", async () => {
		await expect(
			guardedFetch("https://models.example.test/v1", undefined, {
				lookup: singleAnswer("10.0.0.5", 4),
			})
		).rejects.toMatchObject({ code: "blocked-address" });
	});
});

/** An error with `depth` wrappers around a cause that the guard recognises as a redirect. */
function redirectBehind(depth: number): Error {
	let error = new Error("unexpected redirect");
	for (let level = 0; level < depth; level += 1) {
		error = new Error("wrapper", { cause: error });
	}
	return error;
}

describe("a failure whose cause chain is long", () => {
	it.each([
		[0, "redirect"],
		[3, "redirect"],
		[4, "request-failed"],
		[8, "request-failed"],
	])("with a redirect %i wrappers deep is reported as %s", async (depth, code) => {
		vi.stubEnv(
			"TEA_MODELS_LOCAL_ADDRESSES",
			`http://ollama.example.test:${port}`
		);
		const failing = redirectBehind(depth);
		const lookup = vi.fn<LookupFunction>((_hostname, _options, callback) => {
			callback(failing, []);
		});
		await expect(
			guardedFetch(`http://ollama.example.test:${port}/ok`, undefined, {
				lookup,
			})
		).rejects.toMatchObject({ code });
		expect(hits).toStrictEqual([]);
	});
});

describe("the size cap on a response", () => {
	let sizes: ModelServer;

	beforeAll(async () => {
		sizes = await startModelServer((request, response) => {
			const [, kind, count] = request.url.split("/");
			const body = "x".repeat(Number(count));
			if (kind === "declared") {
				response.writeHead(200, { "content-length": String(body.length) });
				response.end(body);
				return;
			}
			response.writeHead(200);
			response.write(body.slice(0, 1));
			response.end(body.slice(1));
		});
	});

	afterAll(() => sizes.close());

	beforeEach(() => {
		vi.stubEnv("TEA_MODELS_LOCAL_ADDRESSES", sizes.origin);
	});

	it.each([
		[999, true],
		[1000, true],
		[1001, false],
	])("treats a declared length of %i bytes against a cap of 1000 (fits: %s)", async (count, fits) => {
		const pending = guardedFetch(
			`${sizes.origin}/declared/${count}`,
			undefined,
			{
				maxBytes: 1000,
			}
		);
		if (fits) {
			expect((await (await pending).text()).length).toBe(count);
		} else {
			await expect(pending).rejects.toMatchObject({
				code: "response-too-large",
			});
		}
	});

	it.each([
		[999, true],
		[1000, true],
		[1001, false],
	])("treats a streamed body of %i bytes against a cap of 1000 (fits: %s)", async (count, fits) => {
		const response = await guardedFetch(
			`${sizes.origin}/streamed/${count}`,
			undefined,
			{ maxBytes: 1000 }
		);
		if (fits) {
			expect((await response.text()).length).toBe(count);
		} else {
			await expect(response.text()).rejects.toMatchObject({
				code: "response-too-large",
			});
		}
	});
});
