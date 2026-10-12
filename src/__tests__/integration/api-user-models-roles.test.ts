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
import { POST as testConnectionRoute } from "@/app/api/user/models/connections/[id]/test/route";
import { PUT } from "@/app/api/user/models/roles/route";
import { GET } from "@/app/api/user/models/route";
import {
	type ModelServer,
	startModelServer,
} from "@/lib/models/__tests__/model-server";
import prisma from "@/lib/prisma";
import {
	createConnection,
	getRoles,
	setRoles,
} from "@/lib/services/model-connection-service";
import { expectSuccess } from "../utils/assertion-helpers";
import { mockNoAuth } from "../utils/auth-helpers";
import {
	idParams,
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

/** What a passed check is stored against: the catalogue's model, then the hash of the probe sentences. */
const CHECKED_FOR = `${SPEC.modelId}#${createHash("sha256")
	.update(SPEC.probes.map((probe) => probe.text).join("\n"))
	.digest("hex")}`;

let models: ModelServer;
let techniques: ModelServer;
let behaviour: StubBehaviour;

beforeAll(async () => {
	models = await startModelServer();
	techniques = await startTechniquesStub();
});

afterAll(async () => {
	await models.close();
	await techniques.close();
});

beforeEach(async () => {
	behaviour = stubBehaviour();
	models.requests.length = 0;
	models.respond = modelResponder(behaviour);
	vi.stubEnv("TEA_MODELS_LOCAL_ADDRESSES", models.origin);
	vi.stubEnv("TECHNIQUES_MCP_URL", `${techniques.origin}/mcp`);
	await mockNoAuth();
});

afterEach(() => {
	vi.unstubAllEnvs();
});

const embeddingRequests = () =>
	models.requests.filter((request) => request.url.endsWith("/embeddings"));

function addOllama(userId: string, apiKey: string | null = SECRET) {
	return createConnection(userId, {
		label: "Local",
		type: "OLLAMA",
		baseUrl: models.origin,
		apiKey,
	});
}

const job = (connectionId: string, model: string) => ({ connectionId, model });

const put = (body: unknown) => PUT(modelRequest("PUT", "/roles", body));

describe("PUT /api/user/models/roles: saving the jobs", () => {
	it("saves the three jobs, switches a job off with null, and reads back through GET", async () => {
		const user = await signedInUserWithModels();
		const local = expectSuccess(await addOllama(user.id));

		const saved = await put({
			chat: job(local.id, " llama3 "),
			ranking: job(local.id, "clef-flash"),
			search: null,
		});

		expect(saved.status).toBe(200);
		expect(await saved.json()).toEqual({
			roles: {
				chat: job(local.id, "llama3"),
				ranking: job(local.id, "clef-flash"),
				search: null,
				searchCheck: null,
			},
			searchCheck: null,
		});

		const cleared = await put({ chat: null, ranking: null, search: null });
		expect((await cleared.json()).roles.chat).toBeNull();
		expect((await (await GET()).json()).roles.ranking).toBeNull();
		expect(models.requests).toEqual([]);
	});

	it("answers 400 for a body that is not all three jobs in the right shape", async () => {
		const user = await signedInUserWithModels();
		const local = expectSuccess(await addOllama(user.id));
		const none = { chat: null, ranking: null, search: null };

		for (const bad of [
			{},
			{ chat: null },
			{ ...none, extra: 1 },
			{ ...none, chat: { connectionId: local.id } },
			{ ...none, chat: { connectionId: local.id, model: " " } },
			{ ...none, chat: { connectionId: local.id, model: "m".repeat(201) } },
			{ ...none, chat: { connectionId: "", model: "m" } },
			{ ...none, chat: { connectionId: local.id, model: "m", extra: 1 } },
			{ ...none, chat: "llama3" },
		]) {
			expect((await put(bad)).status).toBe(400);
		}
		expect(
			await prisma.userModelRoles.count({ where: { userId: user.id } })
		).toBe(0);
	});

	it("maps the service's refusals to their statuses and saves nothing", async () => {
		const user = await signedInUserWithModels();
		const local = expectSuccess(await addOllama(user.id));
		const claude = expectSuccess(
			await createConnection(user.id, {
				label: "Claude",
				type: "ANTHROPIC",
				apiKey: SECRET,
			})
		);
		const none = { chat: null, ranking: null, search: null };

		const unsupported = await put({
			...none,
			search: job(claude.id, "m"),
		});
		expect(unsupported.status).toBe(400);
		expect(await unsupported.json()).toEqual({
			error: "This connection type cannot be used for search",
			code: "VALIDATION",
		});

		const missing = await put({
			...none,
			chat: job("no-such-connection", "m"),
		});
		expect(missing.status).toBe(404);

		expect(
			await prisma.userModelRoles.count({ where: { userId: user.id } })
		).toBe(0);
		expect(local.id).toBeDefined();
		expect(models.requests).toEqual([]);
	});
});

describe("PUT /api/user/models/roles: the search check", () => {
	/** A user with an Ollama connection, and a request that sets it as the search job. */
	async function withSearchRequest(model = "embed") {
		const user = await signedInUserWithModels();
		const local = expectSuccess(await addOllama(user.id));
		const body = { chat: null, ranking: null, search: job(local.id, model) };
		return { user, local, body };
	}

	const storedCheck = async (userId: string) =>
		(
			await prisma.userModelRoles.findUnique({
				where: { userId },
				select: { embeddingVerifiedFor: true, embeddingVerifiedAt: true },
			})
		)?.embeddingVerifiedFor ?? null;

	it("records the check when the user's vectors match, against the catalogue model and the hash of the probe sentences", async () => {
		const { user, body } = await withSearchRequest();

		const res = await put(body);
		const answer = await res.json();

		expect(res.status).toBe(200);
		expect(answer.searchCheck.ok).toBe(true);
		expect(answer.searchCheck.lowestCosine).toBeCloseTo(1, 10);
		expect(answer.roles.searchCheck.verifiedFor).toBe(CHECKED_FOR);
		expect(await storedCheck(user.id)).toBe(CHECKED_FOR);

		// The probes went to the search connection, with the key and the query prefix.
		expect(embeddingRequests()).toHaveLength(1);
		const request = embeddingRequests()[0];
		expect(request?.headers.authorization).toBe(`Bearer ${SECRET}`);
		const sent = JSON.parse(request?.body ?? "{}") as {
			input: string[];
			model: string;
		};
		expect(sent.model).toBe("embed");
		expect(sent.input).toEqual(
			SPEC.probes.map((probe) => `${SPEC.queryPrefix}${probe.text}`)
		);
		expect(JSON.stringify(answer)).not.toContain(SECRET);
	});

	it("does not record the check when the vectors do not match", async () => {
		const { user, body } = await withSearchRequest();
		behaviour.vectorFor = wrongVectors;

		const res = await put(body);
		const answer = await res.json();

		expect(res.status).toBe(200);
		expect(answer.searchCheck).toEqual({ ok: false, lowestCosine: 0 });
		expect(answer.roles.search).toEqual(body.search);
		expect(answer.roles.searchCheck).toBeNull();
		expect(await storedCheck(user.id)).toBeNull();
	});

	it("does not record the check when the connection cannot embed", async () => {
		const { user, body } = await withSearchRequest();
		models.respond = (_request, response) => {
			response.writeHead(500, { "content-type": "application/json" });
			response.end(JSON.stringify({ error: SECRET }));
		};

		const res = await put(body);
		const text = await res.clone().text();

		expect(res.status).toBe(200);
		expect(JSON.parse(text).searchCheck).toEqual({
			ok: false,
			lowestCosine: null,
		});
		expect(text).not.toContain(SECRET);
		expect(await storedCheck(user.id)).toBeNull();
	});

	it("does not record the check when the search job changed while the check ran", async () => {
		const { user, local, body } = await withSearchRequest("embed");
		let release: (() => void) | undefined;
		behaviour.onEmbeddings = (send) => {
			release = send;
		};

		const pending = put(body);
		await vi.waitFor(() => expect(release).toBeDefined());
		// A second change lands before the first check's answer is recorded.
		expectSuccess(
			await setRoles(user.id, {
				chat: null,
				ranking: null,
				search: job(local.id, "another-embed"),
			})
		);
		release?.();
		const res = await pending;
		const answer = await res.json();

		expect(res.status).toBe(200);
		expect(answer.searchCheck.ok).toBe(false);
		expect(answer.roles.search).toEqual(job(local.id, "another-embed"));
		expect(answer.roles.searchCheck).toBeNull();
		expect(await storedCheck(user.id)).toBeNull();
	});

	it("does not record the check when the search job was removed while the check ran", async () => {
		const { user, body } = await withSearchRequest();
		let release: (() => void) | undefined;
		behaviour.onEmbeddings = (send) => {
			release = send;
		};

		const pending = put(body);
		await vi.waitFor(() => expect(release).toBeDefined());
		expectSuccess(
			await setRoles(user.id, { chat: null, ranking: null, search: null })
		);
		release?.();
		const answer = await (await pending).json();

		expect(answer.searchCheck.ok).toBe(false);
		expect(answer.roles.search).toBeNull();
		expect(await storedCheck(user.id)).toBeNull();
	});

	it("saves the jobs and reports the check as unavailable when the techniques service gives no spec", async () => {
		const { user, body } = await withSearchRequest();
		vi.stubEnv("TECHNIQUES_MCP_URL", "");

		const res = await put(body);
		const answer = await res.json();

		expect(res.status).toBe(200);
		expect(answer.searchCheck).toEqual({ unavailable: true });
		expect(answer.roles.search).toEqual(body.search);
		expect(embeddingRequests()).toEqual([]);
		expect(await storedCheck(user.id)).toBeNull();
	});

	it("runs the check again only when the search job changes", async () => {
		const { user, local, body } = await withSearchRequest("embed");
		expect((await (await put(body)).json()).searchCheck.ok).toBe(true);
		expect(embeddingRequests()).toHaveLength(1);

		// The same search job with other jobs changed: no new check, and the old one stands.
		const same = await put({ ...body, chat: job(local.id, "llama3") });
		expect((await same.json()).searchCheck).toBeNull();
		expect(embeddingRequests()).toHaveLength(1);
		expect(await storedCheck(user.id)).toBe(CHECKED_FOR);

		// Another search model: checked again, against the new model name.
		const other = await put({ ...body, search: job(local.id, "other-embed") });
		expect((await other.json()).searchCheck.ok).toBe(true);
		expect(embeddingRequests()).toHaveLength(2);

		// Switching search off clears the check and calls nothing.
		const off = await put({ ...body, search: null });
		const offAnswer = await off.json();
		expect(offAnswer.searchCheck).toBeNull();
		expect(offAnswer.roles.searchCheck).toBeNull();
		expect(embeddingRequests()).toHaveLength(2);
		expect(await storedCheck(user.id)).toBeNull();
		expect(expectSuccess(await getRoles(user.id)).search).toBeNull();
	});

	it("runs the check again for an unchanged search job that has no passed check", async () => {
		const { user, body } = await withSearchRequest();
		behaviour.vectorFor = wrongVectors;
		expect((await (await put(body)).json()).searchCheck.ok).toBe(false);
		expect(embeddingRequests()).toHaveLength(1);

		behaviour.vectorFor = stubBehaviour().vectorFor;
		const again = await put(body);
		const answer = await again.json();

		expect(answer.searchCheck.ok).toBe(true);
		expect(answer.roles.searchCheck.verifiedFor).toBe(CHECKED_FOR);
		expect(embeddingRequests()).toHaveLength(2);
		expect(await storedCheck(user.id)).toBe(CHECKED_FOR);
	});

	it("runs the check again when the recorded check is for another catalogue model, and leaves a recorded pass alone when the techniques service gives no spec", async () => {
		const { user, body } = await withSearchRequest();
		expect((await (await put(body)).json()).searchCheck.ok).toBe(true);
		await prisma.userModelRoles.update({
			where: { userId: user.id },
			data: { embeddingVerifiedFor: "an-earlier-model#hash" },
		});

		vi.stubEnv("TECHNIQUES_MCP_URL", "");
		const unreachable = await put(body);
		expect((await unreachable.json()).searchCheck).toBeNull();
		expect(await storedCheck(user.id)).toBe("an-earlier-model#hash");
		expect(embeddingRequests()).toHaveLength(1);

		vi.stubEnv("TECHNIQUES_MCP_URL", `${techniques.origin}/mcp`);
		const current = await put(body);
		expect((await current.json()).searchCheck.ok).toBe(true);
		expect(await storedCheck(user.id)).toBe(CHECKED_FOR);
		expect(embeddingRequests()).toHaveLength(2);
	});
});

describe("PUT /api/user/models/roles: the limit on provider calls", () => {
	const spendCalls = (userId: string, count: number) =>
		prisma.rateLimitAttempt.createMany({
			data: Array.from({ length: count }, () => ({
				endpoint: "model_calls",
				identifier: userId,
				identifierType: "user_id",
			})),
		});

	it("answers 429 with no detail when the search job changes after the budget is spent, saves nothing and calls nothing", async () => {
		const user = await signedInUserWithModels();
		const local = expectSuccess(await addOllama(user.id));
		await spendCalls(user.id, 20);

		const res = await put({
			chat: null,
			ranking: null,
			search: job(local.id, "embed"),
		});

		expect(res.status).toBe(429);
		expect(await res.json()).toEqual({
			error: "Too many requests",
			code: "RATE_LIMITED",
		});
		expect(
			await prisma.userModelRoles.count({ where: { userId: user.id } })
		).toBe(0);
		expect(models.requests).toEqual([]);
	});

	it("answers 429 when an unchanged search job with no passed check is saved after the budget is spent", async () => {
		const user = await signedInUserWithModels();
		const local = expectSuccess(await addOllama(user.id));
		const body = { chat: null, ranking: null, search: job(local.id, "embed") };
		behaviour.vectorFor = wrongVectors;
		expect((await put(body)).status).toBe(200);
		await spendCalls(user.id, 20);
		models.requests.length = 0;

		const res = await put({ ...body, chat: job(local.id, "llama3") });

		expect(res.status).toBe(429);
		expect(expectSuccess(await getRoles(user.id)).chat).toBeNull();
		expect(embeddingRequests()).toEqual([]);
	});

	it("does not count a save that makes no provider call", async () => {
		const user = await signedInUserWithModels();
		const local = expectSuccess(await addOllama(user.id));
		await spendCalls(user.id, 20);

		const res = await put({
			chat: job(local.id, "llama3"),
			ranking: null,
			search: null,
		});

		expect(res.status).toBe(200);
		expect(
			await prisma.rateLimitAttempt.count({
				where: { endpoint: "model_calls", identifier: user.id },
			})
		).toBe(20);
	});

	it("shares one budget between connection tests and search checks", async () => {
		const user = await signedInUserWithModels();
		const local = expectSuccess(await addOllama(user.id));
		await spendCalls(user.id, 19);

		// The twentieth call is a connection test.
		const tested = await testConnectionRoute(
			modelRequest("POST", `/connections/${local.id}/test`),
			idParams(local.id)
		);
		expect(tested.status).toBe(200);

		// The next one, a search check, is refused.
		const refused = await put({
			chat: null,
			ranking: null,
			search: job(local.id, "embed"),
		});
		expect(refused.status).toBe(429);
		expect(embeddingRequests()).toEqual([]);

		// The same budget is not shared across users.
		const other = await signedInUserWithModels();
		const theirs = expectSuccess(await addOllama(other.id));
		const allowed = await put({
			chat: null,
			ranking: null,
			search: job(theirs.id, "embed"),
		});
		expect(allowed.status).toBe(200);
	});
});
