import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	answerEmbeddings,
	assertNoLeaks,
	type CountingServer,
	exactEmbedding,
	harness,
	json,
	makeSpec,
	resetHarness,
	startServer,
} from "../utils/model-adversarial-kit";
import {
	addConnection,
	connectionRows,
	makeUser,
	type Routes,
	rolesRow,
	routes,
	signInAs,
} from "../utils/model-adversarial-routes";

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/models/guarded-fetch", async (importOriginal) => {
	const { wrapGuardedFetch } = await import("../utils/model-adversarial-kit");
	return wrapGuardedFetch(
		await importOriginal<typeof import("@/lib/models/guarded-fetch")>()
	);
});

const KEY = "sk-ssrf-SECRET-1122";

let server: CountingServer;
let api: Routes;

beforeEach(async () => {
	resetHarness();
	const spec = makeSpec();
	const embeddings = answerEmbeddings(exactEmbedding(spec));
	server = await startServer((hit, response, request) => {
		if (hit.url === "/embedding-spec") {
			json(response, spec);
		} else if (hit.url === "/v1/embeddings") {
			embeddings(hit, response, request);
		} else {
			json(response, { models: [{ name: "m" }] });
		}
	});
	// The stub is listed only so that the specification can be read from it;
	// every connection below points somewhere else.
	vi.stubEnv("TEA_MODELS_LOCAL_ADDRESSES", "");
	vi.stubEnv("TECHNIQUES_MCP_URL", `${server.origin}/mcp`);
	harness.providerOrigin = server.origin;
	api = await routes();
});

afterEach(async () => {
	vi.unstubAllEnvs();
	await server.close();
	assertNoLeaks();
});

/** A connection address, and the addresses its name resolves to when it is a name. */
const targets: [string, string, string[]][] = [
	[
		"a name that resolves to the metadata address",
		"https://meta.example/v1",
		["169.254.169.254"],
	],
	[
		"a name that resolves to Azure's platform address",
		"https://azure.example/v1",
		["168.63.129.16"],
	],
	["a name that resolves to loopback", "https://loop.example", ["127.0.0.1"]],
	[
		"a name that resolves to loopback in IPv6",
		"https://loop6.example",
		["::1"],
	],
	[
		"a name that resolves to a private address",
		"https://lan.example:8443",
		["192.168.1.20"],
	],
	[
		"a name that resolves to a shared address",
		"https://cgnat.example",
		["100.64.0.9"],
	],
	[
		"a name that resolves to a unique-local address",
		"https://ula.example",
		["fd00::5"],
	],
	[
		"a name that resolves to a link-local IPv6 address",
		"https://ll.example",
		["fe80::1"],
	],
	[
		"a name that resolves to a multicast address",
		"https://mc.example",
		["224.0.0.251"],
	],
	[
		"a name that resolves to a 6to4 address",
		"https://sixtofour.example",
		["2002:c0a8:0101::"],
	],
	[
		"a name that resolves to a Teredo address",
		"https://teredo.example",
		["2001:0:4136:e378:8000:63bf:3fff:fdd2"],
	],
	[
		"a name that resolves to an IPv4-mapped metadata address",
		"https://mapped.example",
		["::ffff:169.254.169.254"],
	],
	[
		"a name with one private answer among public ones",
		"https://mixed.example",
		["203.0.113.7", "10.0.0.1", "203.0.113.8"],
	],
	["the metadata address itself", "https://169.254.169.254/latest", []],
	["Azure's platform address itself", "https://168.63.129.16", []],
	["an IPv6 loopback address", "https://[::1]:8443", []],
	["an IPv4-mapped address", "https://[::ffff:127.0.0.1]", []],
	["an address written as one number", "https://2130706433", []],
	["the metadata address over plain http", "http://169.254.169.254", []],
	["a local address over plain http", "http://localhost:11434", []],
	["a public name over plain http", "http://models.example", []],
];

describe("a connection to an address a server must not reach", () => {
	it.each(targets)("is not called for %s", async (_label, baseUrl, answers) => {
		const url = new URL(baseUrl);
		if (answers.length > 0) {
			harness.dns.set(url.hostname, answers);
		}
		const user = await makeUser();
		const connection = await addConnection(user.id, { baseUrl, apiKey: KEY });
		await signInAs(user);

		const tested = await api.test(connection.id);
		expect(tested.status).toBe(200);
		expect(tested.json?.ok).toBe(false);
		expect(tested.text).not.toContain(KEY);
		expect(tested.text).not.toContain(url.hostname);

		const saved = await api.setRoles({
			chat: null,
			ranking: null,
			search: { connectionId: connection.id, model: "embed" },
		});
		expect(saved.status).toBe(200);
		expect(saved.json?.searchCheck).toMatchObject({ ok: false });
		expect(saved.text).not.toContain(KEY);
		expect(saved.text).not.toContain(url.hostname);
		expect((await rolesRow(user.id))?.embeddingVerifiedFor).toBeNull();

		expect(
			server.hits.filter((hit) => hit.url.includes("embeddings"))
		).toHaveLength(0);
	});
});

describe("a body that is too large or not what a route takes", () => {
	it("is refused before anything is stored", async () => {
		const user = await makeUser();
		await signInAs(user);
		const huge = "x".repeat(20_000);
		const outcomes = [
			await api.create({ label: huge, type: "OLLAMA", baseUrl: server.origin }),
			await api.create({
				label: "x",
				type: "OLLAMA",
				baseUrl: server.origin,
				apiKey: huge,
			}),
			await api.quickSetup({ openRouterKey: huge }),
			await api.setRoles({
				chat: { connectionId: huge, model: "m" },
				ranking: null,
				search: null,
			}),
		];
		for (const outcome of outcomes) {
			expect(outcome.status).toBeGreaterThanOrEqual(400);
			expect(outcome.status).toBeLessThan(500);
		}
		expect(await connectionRows()).toHaveLength(0);
	});

	it("is refused when it is not JSON, or JSON of another shape", async () => {
		const user = await makeUser();
		await signInAs(user);
		for (const raw of [
			"",
			"not json",
			"[]",
			"null",
			"42",
			'"text"',
			"{",
			'{"label": 1}',
		]) {
			const created = await api.createRaw(raw);
			expect(created.status).toBe(400);
			const quick = await api.quickSetupRaw(raw);
			expect(quick.status).toBe(400);
		}
		expect(await connectionRows()).toHaveLength(0);
		expect(server.hits).toHaveLength(0);
	});
});
