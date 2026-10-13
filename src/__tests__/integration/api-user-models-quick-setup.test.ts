import { createHash } from "node:crypto";
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
import { POST } from "@/app/api/user/models/quick-setup/route";
import {
	type ModelServer,
	startModelServer,
} from "@/lib/models/__tests__/model-server";
import { CONNECTION_TYPES } from "@/lib/models/connection-types";
import prisma from "@/lib/prisma";
import {
	createConnection,
	getConnectionForUse,
	getRoles,
	listConnections,
	MAX_CONNECTIONS_PER_USER,
	setRoles,
} from "@/lib/services/model-connection-service";
import { expectSuccess } from "../utils/assertion-helpers";
import { mockNoAuth } from "../utils/auth-helpers";
import {
	modelRequest,
	modelResponder,
	SECRET,
	SPEC,
	type StubBehaviour,
	signedInUserWithModels,
	startTechniquesStub,
	stubBehaviour,
	wrongVectors,
} from "../utils/model-routes-kit";

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

// OpenRouter's address is fixed, so the stand-in server takes its place for
// these tests, and the recommended models can be set per test.
const openRouter = vi.hoisted(() => ({
	address: "https://openrouter.ai",
	recommended: {
		chat: null as string | null,
		ranking: "cloudflare/clef-flash" as string | null,
		search: null as string | null,
	},
}));

vi.mock("@/lib/models/connection-types", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@/lib/models/connection-types")>();
	return {
		...actual,
		CONNECTION_TYPES: {
			...actual.CONNECTION_TYPES,
			OPENROUTER: {
				...actual.CONNECTION_TYPES.OPENROUTER,
				get baseUrl() {
					return openRouter.address;
				},
			},
		},
	};
});

vi.mock("@/lib/models/recommended", () => ({
	recommendedModel: (_type: string, job: "chat" | "ranking" | "search") =>
		openRouter.recommended[job],
}));

const CHECKED_FOR = `${SPEC.modelId}#${createHash("sha256")
	.update(JSON.stringify(SPEC.probes.map((probe) => probe.text)))
	.digest("hex")}`;
const ENVELOPE = /^v\d+:/;

let models: ModelServer;
let techniques: ModelServer;
let behaviour: StubBehaviour;

beforeAll(async () => {
	models = await startModelServer();
	techniques = await startTechniquesStub();
	openRouter.address = models.origin;
});

afterAll(async () => {
	await models.close();
	await techniques.close();
});

beforeEach(async () => {
	behaviour = stubBehaviour();
	models.requests.length = 0;
	models.respond = modelResponder(behaviour);
	openRouter.recommended = {
		chat: null,
		ranking: "cloudflare/clef-flash",
		search: null,
	};
	vi.stubEnv("TEA_MODELS_LOCAL_ADDRESSES", models.origin);
	vi.stubEnv("TECHNIQUES_MCP_URL", `${techniques.origin}/mcp`);
	await mockNoAuth();
	// Every call below must reach the stand-in, never OpenRouter itself.
	if (CONNECTION_TYPES.OPENROUTER.baseUrl !== models.origin) {
		throw new Error("OpenRouter's address is not the stand-in server");
	}
});

afterEach(() => {
	vi.unstubAllEnvs();
});

const quickSetup = (body: unknown) =>
	POST(modelRequest("POST", "/quick-setup", body));

const embeddingRequests = () =>
	models.requests.filter((request) => request.url.endsWith("/embeddings"));

/** What the user has stored: connections, jobs and the stored key of each connection. */
async function stored(userId: string) {
	return {
		connections: await prisma.userModelConnection.count({ where: { userId } }),
		roles: await prisma.userModelRoles.count({ where: { userId } }),
	};
}

describe("POST /api/user/models/quick-setup: a key OpenRouter refuses", () => {
	it("answers 422 with a fixed message and writes nothing", async () => {
		const user = await signedInUserWithModels();
		behaviour.keyAccepted = false;

		const res = await quickSetup({ openRouterKey: SECRET });
		const text = await res.clone().text();

		expect(res.status).toBe(422);
		expect(await res.json()).toEqual({
			error: "The server did not accept the key.",
			code: "UNPROCESSABLE",
		});
		expect(text).not.toContain(SECRET);
		expect(await stored(user.id)).toEqual({ connections: 0, roles: 0 });
		// Only the key check went out.
		expect(models.requests.map((request) => request.url)).toEqual([
			"/api/v1/key",
		]);
		expect(models.requests[0]?.headers.authorization).toBe(`Bearer ${SECRET}`);
	});

	it("answers 422 and writes nothing when OpenRouter cannot be reached", async () => {
		const user = await signedInUserWithModels();
		vi.stubEnv("TEA_MODELS_LOCAL_ADDRESSES", "");

		const res = await quickSetup({ openRouterKey: SECRET });

		expect(res.status).toBe(422);
		expect(JSON.stringify(await res.json())).not.toContain(SECRET);
		expect(await stored(user.id)).toEqual({ connections: 0, roles: 0 });
		expect(models.requests).toEqual([]);
	});

	it("answers 400 for a body or key of the wrong shape, without calling anything", async () => {
		const user = await signedInUserWithModels();

		for (const bad of [
			{},
			{ openRouterKey: "" },
			{ openRouterKey: 7 },
			{ openRouterKey: "sk-leak☃" },
			{ openRouterKey: "sk-leak tail" },
			{ openRouterKey: "sk-leak\u0000" },
			{ openRouterKey: SECRET, label: "x" },
		]) {
			const res = await quickSetup(bad);
			expect(res.status).toBe(400);
			expect(JSON.stringify(await res.json())).not.toContain("sk-leak");
		}
		expect(models.requests).toEqual([]);
		expect(await stored(user.id)).toEqual({ connections: 0, roles: 0 });
	});
});

describe("POST /api/user/models/quick-setup: a good key", () => {
	it("adds one OpenRouter connection and the recommended jobs, and lists the jobs still unset", async () => {
		const user = await signedInUserWithModels();

		const res = await quickSetup({ openRouterKey: ` ${SECRET} ` });
		const text = await res.clone().text();
		const body = await res.json();

		expect(res.status).toBe(201);
		expect(body.connection).toEqual({
			id: expect.any(String),
			label: "OpenRouter",
			type: "OPENROUTER",
			baseUrl: models.origin,
			hasKey: true,
		});
		expect(body.roles).toEqual({
			chat: null,
			ranking: {
				connectionId: body.connection.id,
				model: "cloudflare/clef-flash",
			},
			search: null,
			searchCheck: null,
		});
		expect(body.searchCheck).toBeNull();
		expect(body.unsetJobs).toEqual(["chat", "search"]);

		expect(await stored(user.id)).toEqual({ connections: 1, roles: 1 });
		expect(
			expectSuccess(await getConnectionForUse(user.id, body.connection.id))
				.apiKey
		).toBe(SECRET);
		const row = await prisma.userModelConnection.findUniqueOrThrow({
			where: { id: body.connection.id },
		});
		expect(row.apiKeyEncrypted).toMatch(ENVELOPE);
		expect(text).not.toContain(SECRET);
		expect(text).not.toContain(row.apiKeyEncrypted as string);

		// The key was checked against OpenRouter, with the key trimmed, and the model lists read.
		expect(models.requests[0]?.url).toBe("/api/v1/key");
		expect(models.requests[0]?.headers.authorization).toBe(`Bearer ${SECRET}`);
		expect(embeddingRequests()).toEqual([]);
	});

	it("sets every job that has a recommendation, runs the search check and lists nothing unset", async () => {
		const user = await signedInUserWithModels();
		openRouter.recommended = {
			chat: "vendor/chat-model",
			ranking: "cloudflare/clef-flash",
			search: "vendor/embed-model",
		};

		const res = await quickSetup({ openRouterKey: SECRET });
		const body = await res.json();

		expect(res.status).toBe(201);
		const at = (model: string) => ({ connectionId: body.connection.id, model });
		expect(body.roles).toMatchObject({
			chat: at("vendor/chat-model"),
			ranking: at("cloudflare/clef-flash"),
			search: at("vendor/embed-model"),
		});
		expect(body.unsetJobs).toEqual([]);
		expect(body.searchCheck.ok).toBe(true);
		expect(body.roles.searchCheck.verifiedFor).toBe(CHECKED_FOR);
		expect(
			(
				await prisma.userModelRoles.findUniqueOrThrow({
					where: { userId: user.id },
				})
			).embeddingVerifiedFor
		).toBe(CHECKED_FOR);

		expect(embeddingRequests()).toHaveLength(1);
		expect(embeddingRequests()[0]?.url).toBe("/api/v1/embeddings");
		const sent = JSON.parse(embeddingRequests()[0]?.body ?? "{}") as {
			model: string;
		};
		expect(sent.model).toBe("vendor/embed-model");
	});

	it("keeps the connection and jobs, and leaves search unchecked, when the vectors do not match", async () => {
		const user = await signedInUserWithModels();
		openRouter.recommended.search = "vendor/embed-model";
		behaviour.vectorFor = wrongVectors;

		const res = await quickSetup({ openRouterKey: SECRET });
		const body = await res.json();

		expect(res.status).toBe(201);
		expect(body.searchCheck).toEqual({ ok: false, lowestCosine: 0 });
		expect(body.roles.search?.model).toBe("vendor/embed-model");
		expect(body.roles.searchCheck).toBeNull();
		expect(body.unsetJobs).toEqual(["chat"]);
		expect(await stored(user.id)).toEqual({ connections: 1, roles: 1 });
	});

	it("reports the search check as unavailable when the techniques service gives no spec", async () => {
		await signedInUserWithModels();
		openRouter.recommended.search = "vendor/embed-model";
		vi.stubEnv("TECHNIQUES_MCP_URL", "");

		const body = await (await quickSetup({ openRouterKey: SECRET })).json();

		expect(body.searchCheck).toEqual({ unavailable: true });
		expect(body.roles.search?.model).toBe("vendor/embed-model");
		expect(embeddingRequests()).toEqual([]);
	});

	it("leaves a job without a recommendation as the user had it, and does not run a check for it", async () => {
		const user = await signedInUserWithModels();
		const local = expectSuccess(
			await createConnection(user.id, {
				label: "Local",
				type: "OLLAMA",
				baseUrl: models.origin,
			})
		);
		expectSuccess(
			await setRoles(user.id, {
				chat: { connectionId: local.id, model: "llama3" },
				ranking: { connectionId: local.id, model: "old-ranking" },
				search: { connectionId: local.id, model: "old-embed" },
			})
		);

		const body = await (await quickSetup({ openRouterKey: SECRET })).json();

		expect(body.roles.chat).toEqual({
			connectionId: local.id,
			model: "llama3",
		});
		expect(body.roles.search).toEqual({
			connectionId: local.id,
			model: "old-embed",
		});
		expect(body.roles.ranking).toEqual({
			connectionId: body.connection.id,
			model: "cloudflare/clef-flash",
		});
		expect(body.unsetJobs).toEqual([]);
		expect(body.searchCheck).toBeNull();
		expect(embeddingRequests()).toEqual([]);
		expect(expectSuccess(await listConnections(user.id))).toHaveLength(2);
	});
});

describe("POST /api/user/models/quick-setup: when a step after the key check fails", () => {
	it("answers 409 at the connection limit and changes no job", async () => {
		const user = await signedInUserWithModels();
		for (let i = 0; i < MAX_CONNECTIONS_PER_USER; i++) {
			expectSuccess(
				await createConnection(user.id, {
					label: `C${i}`,
					type: "OLLAMA",
					baseUrl: `http://host-${i}:11434`,
				})
			);
		}

		const res = await quickSetup({ openRouterKey: SECRET });

		expect(res.status).toBe(409);
		expect(await stored(user.id)).toEqual({
			connections: MAX_CONNECTIONS_PER_USER,
			roles: 0,
		});
		expect(expectSuccess(await getRoles(user.id)).ranking).toBeNull();
	});

	it("answers 503 when the server cannot encrypt the key, and stores nothing", async () => {
		const user = await signedInUserWithModels();
		vi.stubEnv("TOKEN_ENCRYPTION_KEY", "");

		const res = await quickSetup({ openRouterKey: SECRET });

		expect(res.status).toBe(503);
		expect(JSON.stringify(await res.json())).not.toContain(SECRET);
		expect(await stored(user.id)).toEqual({ connections: 0, roles: 0 });
	});
});

describe("POST /api/user/models/quick-setup: the limit on provider calls", () => {
	it("answers 429 with no detail once the budget is spent, and calls and writes nothing", async () => {
		const user = await signedInUserWithModels();
		await prisma.rateLimitAttempt.createMany({
			data: Array.from({ length: 20 }, () => ({
				endpoint: "model_calls",
				identifier: user.id,
				identifierType: "user_id",
			})),
		});

		const res = await quickSetup({ openRouterKey: SECRET });

		expect(res.status).toBe(429);
		expect(await res.json()).toEqual({
			error: "Too many requests",
			code: "RATE_LIMITED",
		});
		expect(models.requests).toEqual([]);
		expect(await stored(user.id)).toEqual({ connections: 0, roles: 0 });
	});

	it("spends one call from the shared budget", async () => {
		const user = await signedInUserWithModels();

		await quickSetup({ openRouterKey: SECRET });

		expect(
			await prisma.rateLimitAttempt.count({
				where: { endpoint: "model_calls", identifier: user.id },
			})
		).toBe(1);
	});
});
