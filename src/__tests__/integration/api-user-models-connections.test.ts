import { randomUUID } from "node:crypto";
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
import { DELETE, PATCH } from "@/app/api/user/models/connections/[id]/route";
import { POST as testConnectionRoute } from "@/app/api/user/models/connections/[id]/test/route";
import { POST } from "@/app/api/user/models/connections/route";
import { POST as quickSetup } from "@/app/api/user/models/quick-setup/route";
import { PUT as putRoles } from "@/app/api/user/models/roles/route";
import { GET } from "@/app/api/user/models/route";
import { modelServiceErrorResponse } from "@/lib/model-routes";
import {
	type ModelServer,
	startModelServer,
} from "@/lib/models/__tests__/model-server";
import prisma from "@/lib/prisma";
import {
	createConnection,
	getConnectionForUse,
	listConnections,
	MAX_CONNECTIONS_PER_USER,
	type ModelServiceErrorCode,
	setRoles,
} from "@/lib/services/model-connection-service";
import { captureLogs } from "../helpers/capture-logs";
import { expectSuccess } from "../utils/assertion-helpers";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	idParams,
	modelRequest,
	modelResponder,
	SECRET,
	type StubBehaviour,
	signedInUserWithModels,
	stubBehaviour,
} from "../utils/model-routes-kit";
import { createTestUser } from "../utils/prisma-factories";

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

const ENVELOPE = /^v\d+:/;

let server: ModelServer;
let behaviour: StubBehaviour;

beforeAll(async () => {
	server = await startModelServer();
});

afterAll(() => server.close());

beforeEach(async () => {
	behaviour = stubBehaviour();
	server.requests.length = 0;
	server.respond = modelResponder(behaviour);
	vi.stubEnv("TEA_MODELS_LOCAL_ADDRESSES", server.origin);
	await mockNoAuth();
});

afterEach(() => {
	vi.unstubAllEnvs();
});

/** An Ollama connection at the local model server, with a key unless told otherwise. */
function addOllama(userId: string, apiKey: string | null = SECRET) {
	return createConnection(userId, {
		label: "Local",
		type: "OLLAMA",
		baseUrl: server.origin,
		apiKey,
	});
}

describe("access to the model routes", () => {
	it("answers 401 on every route when nobody is signed in", async () => {
		const id = randomUUID();
		const answers = await Promise.all([
			GET(),
			POST(modelRequest("POST", "/connections", {})),
			PATCH(modelRequest("PATCH", `/connections/${id}`, {}), idParams(id)),
			DELETE(modelRequest("DELETE", `/connections/${id}`), idParams(id)),
			testConnectionRoute(
				modelRequest("POST", `/connections/${id}/test`),
				idParams(id)
			),
			putRoles(modelRequest("PUT", "/roles", {})),
			quickSetup(modelRequest("POST", "/quick-setup", {})),
		]);

		expect(answers.map((res) => res.status)).toEqual(answers.map(() => 401));
		expect(server.requests).toEqual([]);
	});

	it("answers 403 on every route but DELETE while no plugin that uses models is on", async () => {
		const user = await createTestUser();
		const connection = expectSuccess(await addOllama(user.id));
		await mockAuth(user.id, user.username, user.email);
		const id = connection.id;

		const answers = await Promise.all([
			GET(),
			POST(modelRequest("POST", "/connections", {})),
			PATCH(
				modelRequest("PATCH", `/connections/${id}`, { label: "x" }),
				idParams(id)
			),
			testConnectionRoute(
				modelRequest("POST", `/connections/${id}/test`),
				idParams(id)
			),
			putRoles(modelRequest("PUT", "/roles", {})),
			quickSetup(modelRequest("POST", "/quick-setup", {})),
		]);
		expect(answers.map((res) => res.status)).toEqual(answers.map(() => 403));
		expect(server.requests).toEqual([]);

		const removed = await DELETE(
			modelRequest("DELETE", `/connections/${id}`),
			idParams(id)
		);
		expect(removed.status).toBe(200);
		expect(expectSuccess(await listConnections(user.id))).toEqual([]);
	});

	it("answers 404, exactly as for a missing connection, for another user's connection on every route that takes an id", async () => {
		const owner = await createTestUser();
		const theirs = expectSuccess(await addOllama(owner.id));
		const intruder = await signedInUserWithModels();
		const mine = expectSuccess(await addOllama(intruder.id));
		const missing = randomUUID();

		const attempt = async (id: string) => {
			const answers = [
				await PATCH(
					modelRequest("PATCH", `/connections/${id}`, {
						label: "mine now",
						apiKey: "stolen",
					}),
					idParams(id)
				),
				await testConnectionRoute(
					modelRequest("POST", `/connections/${id}/test`),
					idParams(id)
				),
				await putRoles(
					modelRequest("PUT", "/roles", {
						chat: { connectionId: id, model: "m" },
						ranking: null,
						search: null,
					})
				),
				await DELETE(
					modelRequest("DELETE", `/connections/${id}`),
					idParams(id)
				),
			];
			return Promise.all(
				answers.map(async (res) => ({
					status: res.status,
					body: await res.json(),
				}))
			);
		};

		const theirsAnswers = await attempt(theirs.id);
		expect(theirsAnswers.map((a) => a.status)).toEqual([404, 404, 404, 404]);
		expect(theirsAnswers).toEqual(await attempt(missing));

		const stillTheirs = await prisma.userModelConnection.findUniqueOrThrow({
			where: { id: theirs.id },
		});
		expect(stillTheirs.label).toBe("Local");
		expect(
			expectSuccess(await getConnectionForUse(owner.id, theirs.id)).apiKey
		).toBe(SECRET);
		expect(
			await prisma.userModelRoles.count({ where: { userId: intruder.id } })
		).toBe(0);
		expect(expectSuccess(await listConnections(intruder.id))).toHaveLength(1);
		expect(mine.id).not.toBe(theirs.id);
		expect(server.requests).toEqual([]);
	});
});

describe("GET /api/user/models", () => {
	it("lists connections, jobs, recommendations and types, and shows only whether a key is set", async () => {
		const user = await signedInUserWithModels();
		const keyed = expectSuccess(await addOllama(user.id));
		const open = expectSuccess(await addOllama(user.id, null));
		expectSuccess(
			await setRoles(user.id, {
				chat: { connectionId: keyed.id, model: "llama3" },
				ranking: null,
				search: null,
			})
		);

		const res = await GET();
		const text = JSON.stringify(await res.clone().json());
		const body = await res.json();

		expect(res.status).toBe(200);
		expect(body.connections).toEqual([
			{
				id: keyed.id,
				label: "Local",
				type: "OLLAMA",
				baseUrl: server.origin,
				hasKey: true,
			},
			{
				id: open.id,
				label: "Local",
				type: "OLLAMA",
				baseUrl: server.origin,
				hasKey: false,
			},
		]);
		expect(body.roles).toEqual({
			chat: { connectionId: keyed.id, model: "llama3" },
			ranking: null,
			search: null,
			searchCheck: null,
		});
		expect(body.recommended.OPENROUTER.ranking).toBe("cloudflare/clef-flash");
		expect(body.connectionTypes.map((t: { type: string }) => t.type)).toEqual([
			"OPENROUTER",
			"OLLAMA",
			"OPENAI_COMPATIBLE",
			"ANTHROPIC",
		]);
		expect(body.connectionTypes[3]).toEqual({
			type: "ANTHROPIC",
			baseUrl: "https://api.anthropic.com",
			jobs: ["chat"],
			keyRequired: true,
		});

		expect(text).not.toContain(SECRET);
		const rows = await prisma.userModelConnection.findMany({
			where: { userId: user.id },
		});
		expect(rows.filter((row) => row.apiKeyEncrypted !== null)).toHaveLength(1);
		for (const row of rows) {
			if (row.apiKeyEncrypted !== null) {
				expect(text).not.toContain(row.apiKeyEncrypted);
			}
		}
		expect(text).not.toContain("apiKey");
	});

	it("shows nothing of another user's connections", async () => {
		const owner = await createTestUser();
		expectSuccess(await addOllama(owner.id));
		await signedInUserWithModels();

		const body = await (await GET()).json();

		expect(body.connections).toEqual([]);
		expect(body.roles).toEqual({
			chat: null,
			ranking: null,
			search: null,
			searchCheck: null,
		});
	});
});

describe("POST /api/user/models/connections", () => {
	it("adds a connection, stores the key encrypted and never returns it", async () => {
		const user = await signedInUserWithModels();

		const res = await POST(
			modelRequest("POST", "/connections", {
				label: "  Laptop  ",
				type: "OLLAMA",
				baseUrl: `${server.origin}/`,
				apiKey: ` ${SECRET} `,
			})
		);
		const text = await res.clone().text();
		const body = await res.json();

		expect(res.status).toBe(201);
		expect(body).toEqual({
			id: expect.any(String),
			label: "Laptop",
			type: "OLLAMA",
			baseUrl: server.origin,
			hasKey: true,
		});
		expect(text).not.toContain(SECRET);
		const row = await prisma.userModelConnection.findUniqueOrThrow({
			where: { id: body.id },
		});
		expect(row.userId).toBe(user.id);
		expect(row.apiKeyEncrypted).toMatch(ENVELOPE);
		expect(text).not.toContain(row.apiKeyEncrypted as string);
	});

	it("takes the owner from the session, never from the body", async () => {
		const other = await createTestUser();
		const user = await signedInUserWithModels();

		const res = await POST(
			modelRequest("POST", "/connections", {
				label: "Mine",
				type: "OLLAMA",
				baseUrl: server.origin,
				userId: other.id,
			})
		);

		expect(res.status).toBe(400);
		expect(expectSuccess(await listConnections(other.id))).toEqual([]);
		expect(expectSuccess(await listConnections(user.id))).toEqual([]);
	});

	it("answers 400 for a body that does not fit the schema, without echoing a key", async () => {
		await signedInUserWithModels();
		const post = async (body: unknown) =>
			POST(modelRequest("POST", "/connections", body));
		const valid = { label: "L", type: "OLLAMA", baseUrl: server.origin };

		for (const bad of [
			{ ...valid, label: " " },
			{ ...valid, label: "x".repeat(61) },
			{ ...valid, type: "NOT_A_TYPE" },
			{ ...valid, extra: true },
			{ ...valid, apiKey: 7 },
			{ ...valid, apiKey: "sk-leak\u0000tail" },
			{ ...valid, apiKey: "sk-leakĀtail" },
			{ ...valid, apiKey: "sk-leak tail" },
			{ ...valid, apiKey: "k".repeat(2049) },
			[],
		]) {
			const res = await post(bad);
			expect(res.status).toBe(400);
			expect(JSON.stringify(await res.json())).not.toContain("sk-leak");
		}
	});

	it("accepts only printable ASCII in a key, so a character above U+00FF is refused before it can be saved", async () => {
		const user = await signedInUserWithModels();
		const logs = captureLogs();
		try {
			for (const bad of ["sk-leak☃tail", "sk-leak\u{1f511}tail", "sk-leaké"]) {
				const res = await POST(
					modelRequest("POST", "/connections", {
						label: "Router",
						type: "OPENROUTER",
						apiKey: bad,
					})
				);
				expect(res.status).toBe(400);
				expect(JSON.stringify(await res.json())).not.toContain("sk-leak");
			}
			expect(JSON.stringify(logs.entries)).not.toContain("sk-leak");
		} finally {
			logs.restore();
		}
		expect(expectSuccess(await listConnections(user.id))).toEqual([]);
	});

	it("maps each refusal from the connection service to its status", async () => {
		const user = await signedInUserWithModels();
		const post = (body: unknown) =>
			POST(modelRequest("POST", "/connections", body));

		// VALIDATION: a shape the schema lets through and the service refuses.
		const refused = await post({
			label: "L",
			type: "OLLAMA",
			baseUrl: "http://host:11434/v1?x=1",
		});
		expect(refused.status).toBe(400);
		expect((await refused.json()).code).toBe("VALIDATION");
		expect((await post({ label: "L", type: "OLLAMA" })).status).toBe(400);
		expect((await post({ label: "L", type: "OPENROUTER" })).status).toBe(400);

		// LIMIT_REACHED
		for (let i = 0; i < MAX_CONNECTIONS_PER_USER; i++) {
			expectSuccess(
				await createConnection(user.id, {
					label: `C${i}`,
					type: "OLLAMA",
					baseUrl: `http://host-${i}:11434`,
				})
			);
		}
		const full = await post({
			label: "One too many",
			type: "OLLAMA",
			baseUrl: server.origin,
		});
		expect(full.status).toBe(409);
		expect((await full.json()).code).toBe("CONFLICT");
	});

	it("answers 503 when the server cannot encrypt keys, and stores nothing", async () => {
		const user = await signedInUserWithModels();
		vi.stubEnv("TOKEN_ENCRYPTION_KEY", "");

		const res = await POST(
			modelRequest("POST", "/connections", {
				label: "Router",
				type: "OPENROUTER",
				apiKey: SECRET,
			})
		);

		expect(res.status).toBe(503);
		expect((await res.json()).code).toBe("SERVICE_UNAVAILABLE");
		vi.unstubAllEnvs();
		expect(expectSuccess(await listConnections(user.id))).toEqual([]);

		// A connection that needs no key does not need the encryption key.
		vi.stubEnv("TOKEN_ENCRYPTION_KEY", "");
		const open = await POST(
			modelRequest("POST", "/connections", {
				label: "Local",
				type: "OLLAMA",
				baseUrl: server.origin,
			})
		);
		expect(open.status).toBe(201);
	});
});

describe("model route error mapping", () => {
	it("answers each service code with its own status, and 500 for a failure with none", async () => {
		const answer = async (code?: ModelServiceErrorCode) => {
			const res = modelServiceErrorResponse({ error: "the message", code });
			return [res.status, (await res.json()).error];
		};

		expect(await answer("VALIDATION")).toEqual([400, "the message"]);
		expect(await answer("JOB_NOT_SUPPORTED")).toEqual([400, "the message"]);
		expect(await answer("NOT_FOUND")).toEqual([404, "the message"]);
		expect(await answer("LIMIT_REACHED")).toEqual([409, "the message"]);
		expect(await answer(undefined)).toEqual([500, "the message"]);
	});
});

describe("PATCH /api/user/models/connections/[id]", () => {
	it("changes the label and the key and returns the connection without the key", async () => {
		const user = await signedInUserWithModels();
		const connection = expectSuccess(await addOllama(user.id));
		const patch = (body: unknown) =>
			PATCH(
				modelRequest("PATCH", `/connections/${connection.id}`, body),
				idParams(connection.id)
			);

		const renamed = await patch({ label: "Renamed" });
		expect(renamed.status).toBe(200);
		expect(await renamed.json()).toEqual({ ...connection, label: "Renamed" });

		const rekeyed = await patch({ apiKey: "another-secret" });
		expect(rekeyed.status).toBe(200);
		expect(JSON.stringify(await rekeyed.json())).not.toContain(
			"another-secret"
		);
		expect(
			expectSuccess(await getConnectionForUse(user.id, connection.id)).apiKey
		).toBe("another-secret");

		const unkeyed = await patch({ apiKey: null });
		expect(unkeyed.status).toBe(200);
		expect((await unkeyed.json()).hasKey).toBe(false);
	});

	it("answers 400 for a body that is empty, has an unknown field or a bad key, and for a key a type needs", async () => {
		const user = await signedInUserWithModels();
		const local = expectSuccess(await addOllama(user.id));
		const router = expectSuccess(
			await createConnection(user.id, {
				label: "Router",
				type: "OPENROUTER",
				apiKey: SECRET,
			})
		);
		const patch = (id: string, body: unknown) =>
			PATCH(modelRequest("PATCH", `/connections/${id}`, body), idParams(id));

		for (const bad of [
			{},
			{ type: "ANTHROPIC" },
			{ label: "" },
			{ apiKey: "" },
			{ apiKey: "sk-leak☃" },
			{ apiKey: "sk-leak\u0007" },
		]) {
			const res = await patch(local.id, bad);
			expect(res.status).toBe(400);
			expect(JSON.stringify(await res.json())).not.toContain("sk-leak");
		}
		const keyless = await patch(router.id, { apiKey: null });
		expect(keyless.status).toBe(400);
		expect(
			expectSuccess(await getConnectionForUse(user.id, router.id)).apiKey
		).toBe(SECRET);
		expect(
			expectSuccess(await getConnectionForUse(user.id, local.id)).apiKey
		).toBe(SECRET);
	});
});

describe("DELETE /api/user/models/connections/[id]", () => {
	it("removes the connection and empties the jobs that used it", async () => {
		const user = await signedInUserWithModels();
		const connection = expectSuccess(await addOllama(user.id));
		expectSuccess(
			await setRoles(user.id, {
				chat: { connectionId: connection.id, model: "llama3" },
				ranking: { connectionId: connection.id, model: "clef-flash" },
				search: null,
			})
		);

		const res = await DELETE(
			modelRequest("DELETE", `/connections/${connection.id}`),
			idParams(connection.id)
		);

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ success: true });
		expect(expectSuccess(await listConnections(user.id))).toEqual([]);
		const roles = await (await GET()).json();
		expect(roles.roles).toEqual({
			chat: null,
			ranking: null,
			search: null,
			searchCheck: null,
		});
	});
});

describe("POST /api/user/models/connections/[id]/test", () => {
	const callTest = (id: string) =>
		testConnectionRoute(
			modelRequest("POST", `/connections/${id}/test`),
			idParams(id)
		);

	it("calls the connection with its stored key and returns the result and model lists", async () => {
		const user = await signedInUserWithModels();
		const connection = expectSuccess(await addOllama(user.id));

		const res = await callTest(connection.id);
		const text = await res.clone().text();

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			ok: true,
			message: "The connection works.",
			models: {
				chat: ["llama3", "embed"],
				ranking: ["llama3", "embed"],
				search: ["llama3", "embed"],
			},
		});
		expect(server.requests).toHaveLength(1);
		expect(server.requests[0]?.url).toBe("/api/tags");
		expect(server.requests[0]?.headers.authorization).toBe(`Bearer ${SECRET}`);
		expect(text).not.toContain(SECRET);
		expect(text).not.toContain(server.origin);
	});

	it("answers 200 with ok false and a fixed message when the connection fails, without the key or the address", async () => {
		const user = await signedInUserWithModels();
		const connection = expectSuccess(await addOllama(user.id));
		server.respond = (_request, response) => {
			response.writeHead(500, { "content-type": "application/json" });
			response.end(JSON.stringify({ error: SECRET }));
		};

		const res = await callTest(connection.id);
		const text = await res.clone().text();

		expect(res.status).toBe(200);
		const body = JSON.parse(text);
		expect(body.ok).toBe(false);
		expect(body.models).toEqual({ chat: [], ranking: [], search: [] });
		expect(text).not.toContain(SECRET);
		expect(text).not.toContain(server.origin);
	});

	it("does not reach an address the operator has not listed", async () => {
		const user = await signedInUserWithModels();
		const connection = expectSuccess(await addOllama(user.id));
		vi.stubEnv("TEA_MODELS_LOCAL_ADDRESSES", "");

		const res = await callTest(connection.id);

		expect(res.status).toBe(200);
		expect((await res.json()).ok).toBe(false);
		expect(server.requests).toEqual([]);
	});

	it("answers 503 when the stored key cannot be decrypted, and calls nothing", async () => {
		const user = await signedInUserWithModels();
		const connection = expectSuccess(await addOllama(user.id));
		vi.stubEnv("TOKEN_ENCRYPTION_KEY", "");

		const res = await callTest(connection.id);

		expect(res.status).toBe(503);
		expect(server.requests).toEqual([]);
	});

	it("answers 429 with no detail once the user's budget of provider calls is spent, and calls nothing", async () => {
		const user = await signedInUserWithModels();
		const connection = expectSuccess(await addOllama(user.id));
		await prisma.rateLimitAttempt.createMany({
			data: Array.from({ length: 20 }, () => ({
				endpoint: "model_calls",
				identifier: user.id,
				identifierType: "user_id",
			})),
		});

		const res = await callTest(connection.id);

		expect(res.status).toBe(429);
		expect(await res.json()).toEqual({
			error: "Too many requests",
			code: "RATE_LIMITED",
		});
		expect(res.headers.get("retry-after")).toBeNull();
		expect(server.requests).toEqual([]);

		// Another user is not held back by this user's calls.
		const other = await signedInUserWithModels();
		const theirs = expectSuccess(await addOllama(other.id));
		expect((await callTest(theirs.id)).status).toBe(200);
	});
});

describe("secrets in responses and logs", () => {
	it("never put a key or its ciphertext in a response body or a log line, on success or failure", async () => {
		const user = await signedInUserWithModels();
		const logs = captureLogs();
		const bodies: string[] = [];
		const ciphertexts: string[] = [];
		const keep = async (res: Response) => {
			bodies.push(await res.text());
			return res;
		};
		try {
			const created = await keep(
				await POST(
					modelRequest("POST", "/connections", {
						label: "Local",
						type: "OLLAMA",
						baseUrl: server.origin,
						apiKey: SECRET,
					})
				)
			);
			const { id } = JSON.parse(bodies[0] ?? "{}") as { id: string };
			expect(created.status).toBe(201);
			await keep(await GET());
			await keep(
				await PATCH(
					modelRequest("PATCH", `/connections/${id}`, {
						apiKey: "second-secret",
					}),
					idParams(id)
				)
			);
			await keep(
				await testConnectionRoute(
					modelRequest("POST", `/connections/${id}/test`),
					idParams(id)
				)
			);
			await keep(
				await putRoles(
					modelRequest("PUT", "/roles", {
						chat: { connectionId: id, model: "llama3" },
						ranking: null,
						search: null,
					})
				)
			);
			// Refusals that handle a key.
			await keep(
				await POST(
					modelRequest("POST", "/connections", {
						label: "Bad",
						type: "OPENROUTER",
						apiKey: "sk-leak☃",
					})
				)
			);
			vi.stubEnv("TOKEN_ENCRYPTION_KEY", "");
			await keep(
				await POST(
					modelRequest("POST", "/connections", {
						label: "Router",
						type: "OPENROUTER",
						apiKey: SECRET,
					})
				)
			);
			vi.unstubAllEnvs();
			vi.stubEnv("TEA_MODELS_LOCAL_ADDRESSES", server.origin);
			const rows = await prisma.userModelConnection.findMany({
				where: { userId: user.id },
			});
			ciphertexts.push(...rows.map((row) => row.apiKeyEncrypted ?? ""));
			await keep(
				await DELETE(modelRequest("DELETE", `/connections/${id}`), idParams(id))
			);
		} finally {
			logs.restore();
		}

		const everything = JSON.stringify([bodies, logs.entries]);
		expect(ciphertexts.length).toBeGreaterThan(0);
		for (const secret of [SECRET, "second-secret", "sk-leak", ...ciphertexts]) {
			expect(everything).not.toContain(secret);
		}
	});
});
