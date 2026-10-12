import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decryptToken } from "@/lib/auth/token-encryption";
import prisma from "@/lib/prisma";
import {
	createConnection,
	createConnectionWithJobs,
	getConnectionForUse,
	listConnections,
	setRoles,
	updateConnection,
} from "@/lib/services/model-connection-service";
import {
	assertNoLeaks,
	type CountingServer,
	captureLogs,
	harness,
	json,
	type LogCapture,
	resetHarness,
	startServer,
} from "../utils/model-adversarial-kit";
import {
	type Answer,
	addConnection,
	connectionRows,
	makeUser,
	type Routes,
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

const KEY = "sk-keys-SECRET-77a1b2c3";
const SECOND_KEY = "sk-keys-SECOND-99d4e5f6";
const ENVELOPE = /^v\d+:/;
const ENVELOPE_IN_TEXT = /v\d+:[A-Za-z0-9+/=:_-]{20,}/;

let server: CountingServer;
let api: Routes;
let logs: LogCapture;

beforeEach(async () => {
	resetHarness();
	server = await startServer((_hit, response) =>
		json(response, { models: [{ name: "m" }] })
	);
	vi.stubEnv("TEA_MODELS_LOCAL_ADDRESSES", server.origin);
	harness.providerOrigin = server.origin;
	logs = captureLogs((name, value) => vi.stubEnv(name, value));
	api = await routes();
});

afterEach(async () => {
	logs.stop();
	vi.unstubAllEnvs();
	await server.close();
	assertNoLeaks();
});

/** Every ciphertext in the table, for searching a response or a log. */
async function ciphertexts(): Promise<string[]> {
	const rows = await connectionRows();
	return rows.flatMap((row) =>
		row.apiKeyEncrypted ? [row.apiKeyEncrypted] : []
	);
}

describe("a key is never returned", () => {
	it("is absent from every answer of every route, which say only whether one is set", async () => {
		const user = await makeUser();
		await signInAs(user);
		const answers: Answer[] = [];

		const created = await api.create({
			label: "Mine",
			type: "OLLAMA",
			baseUrl: server.origin,
			apiKey: KEY,
		});
		expect(created.status).toBe(201);
		expect(created.json).toMatchObject({ hasKey: true });
		const id = String(created.json?.id);
		answers.push(created);

		answers.push(await api.list());
		answers.push(await api.patch(id, { label: "Renamed" }));
		answers.push(await api.patch(id, { apiKey: SECOND_KEY }));
		answers.push(await api.test(id));
		answers.push(
			await api.setRoles({
				chat: { connectionId: id, model: "m" },
				ranking: { connectionId: id, model: "clef-flash" },
				search: null,
			})
		);
		answers.push(await api.list());
		answers.push(await api.patch(id, { apiKey: null }));
		answers.push(await api.list());
		answers.push(await api.remove(id));

		const quick = await api.quickSetup({ openRouterKey: KEY });
		expect(quick.status).toBe(201);
		answers.push(quick);
		answers.push(await api.list());

		const secrets = [KEY, SECOND_KEY, ...(await ciphertexts())];
		expect(secrets.length).toBeGreaterThan(2);
		for (const response of answers) {
			for (const secret of secrets) {
				expect(response.text).not.toContain(secret);
			}
			expect(response.text).not.toContain('"apiKey"');
			expect(response.text).not.toContain("apiKeyEncrypted");
			expect(response.text).not.toContain("api_key_encrypted");
		}
	});

	it("is absent from answers that refuse the request", async () => {
		const user = await makeUser();
		await signInAs(user);
		const bad = `${KEY}\u0000tail`;
		const refusals = [
			await api.create({ label: "x", type: "OPENROUTER", apiKey: bad }),
			await api.create({ label: "", type: "OPENROUTER", apiKey: KEY }),
			await api.create({ label: "x", type: "NOPE", apiKey: KEY }),
			await api.create({
				label: "x",
				type: "OLLAMA",
				baseUrl: "not a url",
				apiKey: KEY,
			}),
			await api.create({
				label: "x",
				type: "OLLAMA",
				baseUrl: server.origin,
				apiKey: KEY,
				userId: "someone",
			}),
			await api.createRaw(`{"label":"x","apiKey":"${KEY}","type":`),
			await api.quickSetup({ openRouterKey: bad }),
			await api.quickSetup({ openRouterKey: KEY, extra: 1 }),
			await api.patch("nothing", { apiKey: bad }),
			await api.patch("nothing", { apiKey: KEY }),
		];
		for (const refusal of refusals) {
			expect(refusal.status).toBeGreaterThanOrEqual(400);
			expect(refusal.text).not.toContain("SECRET");
			expect(refusal.text).not.toContain(KEY);
		}
	});

	it("is absent from the answer to a connection test, whatever the server says back", async () => {
		const user = await makeUser();
		await signInAs(user);
		const connection = await addConnection(user.id, {
			baseUrl: server.origin,
			apiKey: KEY,
		});
		const replies: ((response: import("node:http").ServerResponse) => void)[] =
			[
				(response) =>
					json(
						response,
						{ error: { message: `bad key ${KEY} at ${server.origin}` } },
						401
					),
				(response) => json(response, { error: `${KEY} ${server.origin}` }, 500),
				(response) => {
					response.writeHead(200, { "content-type": "text/html" });
					response.end(`<html>${KEY} ${server.origin}</html>`);
				},
				(response) => json(response, { models: `${KEY} ${server.origin}` }),
				(response) => {
					response.writeHead(302, { location: `${server.origin}/${KEY}` });
					response.end();
				},
				(response) => {
					response.socket?.destroy();
				},
				(response) => {
					response.writeHead(200, { "content-type": "application/json" });
					response.end(`{"models": ["${"x".repeat(600_000)}"]}`);
				},
			];
		for (const reply of replies) {
			server.handler = (_hit, response) => reply(response);
			const outcome = await api.test(connection.id);
			expect(outcome.status).toBe(200);
			expect(outcome.json?.ok).toBe(false);
			expect(outcome.text).not.toContain(KEY);
			expect(outcome.text).not.toContain(String(server.port));
			expect(outcome.text).not.toContain("127.0.0.1");
		}
	});
});

describe("a key is never logged", () => {
	it("appears in no log entry through add, change, test, jobs, quick setup, failures and removal", async () => {
		const user = await makeUser();
		await signInAs(user);

		const created = await api.create({
			label: "Mine",
			type: "OLLAMA",
			baseUrl: server.origin,
			apiKey: KEY,
		});
		const id = String(created.json?.id);
		server.handler = (_hit, response) =>
			json(response, { error: `rejected ${KEY}` }, 401);
		await api.test(id);
		server.handler = (_hit, response) => {
			response.socket?.destroy();
		};
		await api.test(id);
		await api.patch(id, { apiKey: SECOND_KEY });
		await api.setRoles({
			chat: { connectionId: id, model: "m" },
			ranking: { connectionId: id, model: "clef-flash" },
			search: { connectionId: id, model: "embed" },
		});
		await api.quickSetup({ openRouterKey: KEY });
		server.handler = (_hit, response) => json(response, { error: KEY }, 401);
		await api.quickSetup({ openRouterKey: KEY });
		await api.create({ label: "x", type: "OPENROUTER", apiKey: `${KEY}\n` });
		await api.remove(id);

		const text = logs.text();
		for (const secret of [KEY, SECOND_KEY, ...(await ciphertexts())]) {
			expect(text).not.toContain(secret);
		}
	});

	it("appears in no log entry when the database refuses the write", async () => {
		const user = await makeUser();
		await signInAs(user);
		// The database itself refuses this label, so the insert fails.
		await prisma.$executeRawUnsafe(
			"ALTER TABLE user_model_connections ADD CONSTRAINT refuse_probe CHECK (label <> 'refused-label')"
		);
		try {
			const failed = await api.create({
				label: "refused-label",
				type: "OLLAMA",
				baseUrl: server.origin,
				apiKey: KEY,
			});
			expect(failed.status).toBe(500);
			expect(failed.text).not.toContain(KEY);
			expect(logs.text()).not.toContain(KEY);
			const stored = await connectionRows();
			expect(stored).toHaveLength(0);
			expect(logs.text()).not.toMatch(ENVELOPE_IN_TEXT);
		} finally {
			await prisma.$executeRawUnsafe(
				"ALTER TABLE user_model_connections DROP CONSTRAINT refuse_probe"
			);
		}
	});

	it("appears in no log entry or answer when the database's error text repeats the failed call", async () => {
		const user = await makeUser();
		await signInAs(user);
		// Prisma's own errors can quote the arguments of the call that failed,
		// and for a new connection those arguments hold the encrypted key.
		const echoing = vi.spyOn(prisma, "$transaction").mockImplementation((async (
			callback: (tx: unknown) => Promise<unknown>
		) => {
			const tx = {
				$queryRaw: () => Promise.resolve([]),
				userModelConnection: {
					count: () => Promise.resolve(0),
					create: (args: unknown) =>
						Promise.reject(
							new Error(
								`Invalid \`create()\` invocation: ${JSON.stringify(args)}`
							)
						),
				},
			};
			return await callback(tx);
		}) as never);
		try {
			const failed = await api.create({
				label: "x",
				type: "OLLAMA",
				baseUrl: server.origin,
				apiKey: KEY,
			});
			expect(failed.status).toBe(500);
			expect(failed.text).not.toContain(KEY);
			expect(failed.text).not.toMatch(ENVELOPE_IN_TEXT);
			expect(echoing).toHaveBeenCalled();
		} finally {
			echoing.mockRestore();
		}
		expect(logs.text()).not.toContain(KEY);
		expect(logs.text()).not.toMatch(ENVELOPE_IN_TEXT);
		expect(logs.entries.length).toBeGreaterThan(0);
	});
});

describe("a key is stored only encrypted", () => {
	it("keeps no plaintext in the table and decrypts back to the key", async () => {
		const user = await makeUser();
		const connection = await addConnection(user.id, {
			baseUrl: server.origin,
			apiKey: KEY,
		});
		const [row] = await connectionRows(user.id);
		expect(row?.apiKeyEncrypted).toMatch(ENVELOPE);
		expect(row?.apiKeyEncrypted).not.toContain(KEY);
		expect(decryptToken(row?.apiKeyEncrypted ?? "")).toBe(KEY);

		const dump = await prisma.$queryRaw<
			{ line: string }[]
		>`SELECT t::text AS line FROM user_model_connections t`;
		expect(JSON.stringify(dump)).not.toContain(KEY);

		const summary = await listConnections(user.id);
		expect(JSON.stringify(summary)).not.toContain(KEY);
		expect(JSON.stringify(summary)).not.toContain(row?.apiKeyEncrypted ?? "?");
		expect(connection.hasKey).toBe(true);
	});

	it("encrypts the same key differently each time", async () => {
		const user = await makeUser();
		await addConnection(user.id, { baseUrl: server.origin, apiKey: KEY });
		await addConnection(user.id, { baseUrl: server.origin, apiKey: KEY });
		const [first, second] = await ciphertexts();
		expect(first).not.toBe(second);
	});

	it("keeps the new key and nothing of the old one when a key is replaced", async () => {
		const user = await makeUser();
		const connection = await addConnection(user.id, {
			baseUrl: server.origin,
			apiKey: KEY,
		});
		await updateConnection(user.id, connection.id, { apiKey: SECOND_KEY });
		const [row] = await connectionRows(user.id);
		expect(decryptToken(row?.apiKeyEncrypted ?? "")).toBe(SECOND_KEY);
		const dump = JSON.stringify(
			await prisma.$queryRaw`SELECT t::text AS line FROM user_model_connections t`
		);
		expect(dump).not.toContain(KEY);
		expect(dump).not.toContain(SECOND_KEY);
	});

	it("reports a damaged stored key as an error, without throwing or showing it", async () => {
		const user = await makeUser();
		const connection = await addConnection(user.id, {
			baseUrl: server.origin,
			apiKey: KEY,
		});
		const [stored] = await ciphertexts();
		const [version, iv, payload] = (stored ?? "").split(":");
		const flipped = `${payload?.startsWith("A") ? "B" : "A"}${payload?.slice(1)}`;
		await prisma.userModelConnection.update({
			where: { id: connection.id },
			data: { apiKeyEncrypted: `${version}:${iv}:${flipped}` },
		});
		const result = await getConnectionForUse(user.id, connection.id);
		expect("error" in result).toBe(true);
		expect(JSON.stringify(result)).not.toContain(KEY);
		await signInAs(user);
		const tested = await api.test(connection.id);
		expect(tested.status).toBeGreaterThanOrEqual(400);
		expect(tested.text).not.toContain(KEY);
		expect(server.hits).toHaveLength(0);
	});

	it("stores nothing, and answers 503, when token encryption is not configured", async () => {
		const user = await makeUser();
		await signInAs(user);
		for (const value of ["", "not-a-valid-key", "AAAA"]) {
			vi.stubEnv("TOKEN_ENCRYPTION_KEY", value);
			const refused = await api.create({
				label: "x",
				type: "OLLAMA",
				baseUrl: server.origin,
				apiKey: KEY,
			});
			expect(refused.status).toBe(503);
			expect(refused.text).not.toContain(KEY);
			const quick = await api.quickSetup({ openRouterKey: KEY });
			expect(quick.status).toBe(503);
			expect(quick.text).not.toContain(KEY);
		}
		expect(await connectionRows()).toHaveLength(0);
		expect(await prisma.userModelRoles.count()).toBe(0);
	});
});

describe("a key is removed with its connection and its user", () => {
	it("leaves no ciphertext after the connection is removed", async () => {
		const user = await makeUser();
		await signInAs(user);
		const connection = await addConnection(user.id, {
			baseUrl: server.origin,
			apiKey: KEY,
		});
		await api.setRoles({
			chat: { connectionId: connection.id, model: "m" },
			ranking: null,
			search: null,
		});
		expect((await api.remove(connection.id)).status).toBe(200);
		expect(await connectionRows()).toHaveLength(0);
		const dump = JSON.stringify(
			await prisma.$queryRaw`SELECT t::text AS line FROM user_model_connections t`
		);
		expect(dump).toBe("[]");
	});

	it("leaves no connection and no jobs after the user is deleted", async () => {
		const user = await makeUser();
		const keep = await makeUser();
		const connection = await addConnection(user.id, {
			baseUrl: server.origin,
			apiKey: KEY,
		});
		await addConnection(keep.id, {
			baseUrl: server.origin,
			apiKey: SECOND_KEY,
		});
		await setRoles(user.id, {
			chat: { connectionId: connection.id, model: "m" },
			ranking: null,
			search: null,
		});
		await prisma.user.delete({ where: { id: user.id } });
		expect(await connectionRows(user.id)).toHaveLength(0);
		expect(
			await prisma.userModelRoles.count({ where: { userId: user.id } })
		).toBe(0);
		expect(await connectionRows(keep.id)).toHaveLength(1);
		expect(await prisma.userModelRoles.count()).toBe(0);
	});

	it("removes a key with null on a type that does not need one, and refuses to on a type that does", async () => {
		const user = await makeUser();
		await signInAs(user);
		const ollama = await addConnection(user.id, {
			baseUrl: server.origin,
			apiKey: KEY,
		});
		const removed = await api.patch(ollama.id, { apiKey: null });
		expect(removed.status).toBe(200);
		expect(removed.json).toMatchObject({ hasKey: false });
		expect((await connectionRows(user.id))[0]?.apiKeyEncrypted).toBeNull();

		const router = await addConnection(user.id, {
			type: "OPENROUTER",
			baseUrl: undefined,
			apiKey: KEY,
		});
		const refused = await api.patch(router.id, { apiKey: null });
		expect(refused.status).toBe(400);
		const kept = await getConnectionForUse(user.id, router.id);
		expect("data" in kept && kept.data.apiKey).toBe(KEY);
	});
});

describe("keys with control characters or non-ASCII are refused", () => {
	const bad = [
		["a NUL", "sk-\u0000-x"],
		["a line feed", "sk-\n-x"],
		["a carriage return", "sk-\r-x"],
		["a tab", "sk-\t-x"],
		["an escape", "sk-\u001b-x"],
		["a delete", "sk-\u007f-x"],
		["a space", "sk- -x"],
		["a C1 control", "sk-\u0085-x"],
		["an accented letter", "sk-é-x"],
		["a character above Latin-1", "sk-Ā-x"],
		["a Chinese character", "sk-日本-x"],
		["an emoji", "sk-😀-x"],
		["a zero-width space", "sk-​-x"],
		["a right-to-left override", "sk-‮-x"],
	] as const;

	it.each(
		bad
	)("refuses a key with %s in every route that takes one, and stores and sends nothing", async (_name, key) => {
		const user = await makeUser();
		await signInAs(user);
		const connection = await addConnection(user.id, {
			baseUrl: server.origin,
			apiKey: KEY,
		});

		const created = await api.create({
			label: "x",
			type: "OPENROUTER",
			apiKey: key,
		});
		const changed = await api.patch(connection.id, { apiKey: key });
		const quick = await api.quickSetup({ openRouterKey: key });
		for (const outcome of [created, changed, quick]) {
			expect(outcome.status).toBe(400);
		}
		expect(await connectionRows(user.id)).toHaveLength(1);
		const kept = await getConnectionForUse(user.id, connection.id);
		expect("data" in kept && kept.data.apiKey).toBe(KEY);
		expect(server.hits).toHaveLength(0);
	});

	it.each(
		bad
	)("refuses a key with %s even when the service is called directly", async (_name, key) => {
		const user = await makeUser();
		const added = await createConnection(user.id, {
			label: "x",
			type: "OPENROUTER",
			apiKey: key,
		});
		expect(added).toMatchObject({ code: "VALIDATION" });

		const connection = await addConnection(user.id, { baseUrl: server.origin });
		expect(
			await updateConnection(user.id, connection.id, { apiKey: key })
		).toMatchObject({ code: "VALIDATION" });

		const withJobs = await createConnectionWithJobs(
			user.id,
			{ label: "x", type: "OPENROUTER", apiKey: key },
			{ ranking: "m" }
		);
		expect(withJobs).toMatchObject({ code: "VALIDATION" });
		expect(await connectionRows(user.id)).toHaveLength(1);
		expect(await prisma.userModelRoles.count()).toBe(0);
	});

	it("keeps a clean key and drops whitespace around it", async () => {
		const user = await makeUser();
		await signInAs(user);
		const created = await api.create({
			label: "x",
			type: "OLLAMA",
			baseUrl: server.origin,
			apiKey: `  \n${KEY}\t `,
		});
		expect(created.status).toBe(201);
		const stored = await getConnectionForUse(user.id, String(created.json?.id));
		expect("data" in stored && stored.data.apiKey).toBe(KEY);
	});
});

describe("the address of a connection", () => {
	it("is fixed for OpenRouter and Anthropic, whatever the request or the table says", async () => {
		const user = await makeUser();
		await signInAs(user);
		const created = await api.create({
			label: "x",
			type: "OPENROUTER",
			apiKey: KEY,
			baseUrl: "http://169.254.169.254/latest",
		});
		expect(created.status).toBe(201);
		expect(created.json?.baseUrl).toBe("https://openrouter.ai");
		const id = String(created.json?.id);
		expect((await connectionRows(user.id))[0]?.baseUrl).toBeNull();

		const patched = await api.patch(id, { baseUrl: "http://169.254.169.254" });
		expect(patched.json?.baseUrl).toBe("https://openrouter.ai");

		await prisma.userModelConnection.update({
			where: { id },
			data: { baseUrl: "http://169.254.169.254" },
		});
		const forUse = await getConnectionForUse(user.id, id);
		expect("data" in forUse && forUse.data.baseUrl).toBe(
			"https://openrouter.ai"
		);

		await api.test(id);
		expect(
			harness.requests.every((url) => url.startsWith("https://openrouter.ai"))
		).toBe(true);
		expect(harness.requests.length).toBeGreaterThan(0);
	});

	it.each([
		["no address", undefined],
		["an empty address", ""],
		["a bare host", "localhost:11434"],
		["a scheme that is not web", "ftp://models.example"],
		["a file address", "file:///etc/passwd"],
		["a script address", "javascript:alert(1)"],
		["an address with a password", "https://user:pw@models.example"],
		["an address with a user name", "https://user@models.example"],
		["an address with a query", "https://models.example/v1?x=1"],
		["an address with a lone question mark", "https://models.example/v1?"],
		["an address with a fragment", "https://models.example/v1#frag"],
		["an address with a lone hash", "https://models.example/v1#"],
		["an address with a space", "https://models .example"],
		["an address that is too long", `https://${"h".repeat(500)}.example`],
	] as const)("is refused for an Ollama connection with %s", async (_name, baseUrl) => {
		const user = await makeUser();
		await signInAs(user);
		const outcome = await api.create({ label: "x", type: "OLLAMA", baseUrl });
		expect(outcome.status).toBe(400);
		expect(await connectionRows(user.id)).toHaveLength(0);
	});

	it("is stored without trailing slashes", async () => {
		const user = await makeUser();
		await signInAs(user);
		const outcome = await api.create({
			label: "x",
			type: "OPENAI_COMPATIBLE",
			baseUrl: "https://models.example/v1///",
		});
		expect(outcome.json?.baseUrl).toBe("https://models.example/v1");
	});

	it("is not accepted for a type that needs a key without one", async () => {
		const user = await makeUser();
		await signInAs(user);
		for (const type of ["OPENROUTER", "ANTHROPIC"]) {
			expect((await api.create({ label: "x", type })).status).toBe(400);
			expect(
				(await api.create({ label: "x", type, apiKey: "   " })).status
			).toBe(400);
		}
		expect(await connectionRows(user.id)).toHaveLength(0);
	});
});

describe("the limit on connections", () => {
	it("holds at ten for one user and leaves other users alone", async () => {
		const user = await makeUser();
		const other = await makeUser();
		await signInAs(user);
		for (let index = 0; index < 10; index += 1) {
			const outcome = await api.create({
				label: `c${index}`,
				type: "OLLAMA",
				baseUrl: server.origin,
			});
			expect(outcome.status).toBe(201);
		}
		const eleventh = await api.create({
			label: "c10",
			type: "OLLAMA",
			baseUrl: server.origin,
		});
		expect(eleventh.status).toBe(409);
		expect(await connectionRows(user.id)).toHaveLength(10);
		await signInAs(other);
		expect(
			(await api.create({ label: "o", type: "OLLAMA", baseUrl: server.origin }))
				.status
		).toBe(201);
	});

	it("holds at ten when many requests arrive together", async () => {
		const user = await makeUser();
		await signInAs(user);
		const outcomes = await Promise.all(
			Array.from({ length: 16 }, (_, index) =>
				api.create({
					label: `c${index}`,
					type: "OLLAMA",
					baseUrl: server.origin,
				})
			)
		);
		expect(outcomes.filter((outcome) => outcome.status === 201)).toHaveLength(
			10
		);
		expect(outcomes.filter((outcome) => outcome.status === 409)).toHaveLength(
			6
		);
		expect(await connectionRows(user.id)).toHaveLength(10);
	});

	it("holds at ten for quick setup, which then writes nothing", async () => {
		const user = await makeUser();
		await signInAs(user);
		for (let index = 0; index < 10; index += 1) {
			await addConnection(user.id, {
				label: `c${index}`,
				baseUrl: server.origin,
			});
		}
		const outcome = await api.quickSetup({ openRouterKey: KEY });
		expect(outcome.status).toBe(409);
		expect(await connectionRows(user.id)).toHaveLength(10);
		expect(await prisma.userModelRoles.count()).toBe(0);
	});
});
