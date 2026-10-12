import { createServer, type Server } from "node:http";
import type { AddressInfo, LookupFunction } from "node:net";
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

const KEY = "sk-test-secret-key";

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
