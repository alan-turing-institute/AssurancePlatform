import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
	createConnectionWithJobs,
	deleteConnection,
	getRoles,
	recordEmbeddingCheck,
	setRoles,
	updateConnection,
} from "@/lib/services/model-connection-service";
import { runSearchCheck } from "@/lib/services/model-search-check-service";
import {
	answerEmbeddings,
	assertNoLeaks,
	type CountingServer,
	exactEmbedding,
	gate,
	type Handler,
	harness,
	json,
	makeSpec,
	resetHarness,
	type SpecFixture,
	startServer,
	until,
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

const KEY = "sk-jobs-SECRET-5150";
const EMBEDDINGS = "/v1/embeddings";

let spec: SpecFixture;
let server: CountingServer;
let embeddings: Handler;
let api: Routes;

/** The id a passed check is recorded under, worked out here from the published sentences. */
function checkIdFor(published: SpecFixture): string {
	const hash = createHash("sha256")
		.update(JSON.stringify(published.probes.map((probe) => probe.text)))
		.digest("hex");
	return `${published.modelId}#${hash}`;
}

function embeddingHits() {
	return server.hits.filter((hit) => hit.url === EMBEDDINGS);
}

beforeEach(async () => {
	resetHarness();
	spec = makeSpec();
	embeddings = answerEmbeddings(exactEmbedding(spec));
	server = await startServer((hit, response, request) => {
		if (hit.url === "/embedding-spec") {
			json(response, spec);
		} else if (hit.url === EMBEDDINGS || hit.url === "/api/v1/embeddings") {
			embeddings(hit, response, request);
		} else if (hit.url === "/api/tags") {
			json(response, { models: [{ name: "m" }] });
		} else if (hit.url === "/api/v1/key") {
			json(response, { data: { label: "k" } });
		} else if (hit.url.startsWith("/api/v1/")) {
			json(response, { data: [{ id: "x" }] });
		} else {
			json(response, {}, 404);
		}
	});
	vi.stubEnv("TEA_MODELS_LOCAL_ADDRESSES", server.origin);
	vi.stubEnv("TECHNIQUES_MCP_URL", `${server.origin}/mcp`);
	harness.providerOrigin = server.origin;
	api = await routes();
});

afterEach(async () => {
	vi.unstubAllEnvs();
	await server.close();
	assertNoLeaks();
});

async function userWithConnection(
	overrides: Parameters<typeof addConnection>[1] = {}
) {
	const user = await makeUser();
	const connection = await addConnection(user.id, {
		label: "Local",
		baseUrl: server.origin,
		...overrides,
	});
	await signInAs(user);
	return { user, connection };
}

const searchJob = (connectionId: string, model = "embed") => ({
	connectionId,
	model,
});

function body(
	jobs: Partial<
		Record<
			"chat" | "ranking" | "search",
			{ connectionId: string; model: string }
		>
	>
) {
	return {
		chat: jobs.chat ?? null,
		ranking: jobs.ranking ?? null,
		search: jobs.search ?? null,
	};
}

describe("a connection can take only the jobs its type can do", () => {
	// From the design's table of connection types and their jobs.
	const table = {
		OPENROUTER: { chat: true, ranking: true, search: true },
		OLLAMA: { chat: true, ranking: true, search: true },
		OPENAI_COMPATIBLE: { chat: true, ranking: false, search: true },
		ANTHROPIC: { chat: true, ranking: false, search: false },
		OPENAI: { chat: true, ranking: false, search: false },
	} as const;

	for (const [type, jobs] of Object.entries(table)) {
		for (const [job, allowed] of Object.entries(jobs)) {
			it(`${allowed ? "accepts" : "refuses"} the ${job} job on ${type}`, async () => {
				vi.stubEnv("TECHNIQUES_MCP_URL", "");
				const user = await makeUser();
				const needsKey =
					type === "OPENROUTER" || type === "ANTHROPIC" || type === "OPENAI";
				const connection = await addConnection(user.id, {
					type: type as keyof typeof table,
					baseUrl: needsKey ? undefined : server.origin,
					apiKey: needsKey ? KEY : undefined,
				});
				await signInAs(user);
				const outcome = await api.setRoles(
					body({ [job]: { connectionId: connection.id, model: "m" } })
				);
				if (allowed) {
					expect(outcome.status).toBe(200);
					expect((outcome.json?.roles as Record<string, unknown>)[job]).toEqual(
						{ connectionId: connection.id, model: "m" }
					);
				} else {
					expect(outcome.status).toBe(400);
					expect(await rolesRow(user.id)).toBeNull();
					expect(outcome.text).not.toContain(KEY);
				}
			});
		}
	}

	it("refuses an unsupported job at the service as well, and stores nothing", async () => {
		const user = await makeUser();
		const refused = await createConnectionWithJobs(
			user.id,
			{ label: "x", type: "ANTHROPIC", apiKey: KEY },
			{ chat: "ok-model", search: "embed" }
		);
		expect(refused).toMatchObject({ code: "JOB_NOT_SUPPORTED" });
		expect(await connectionRows(user.id)).toHaveLength(0);
		expect(await rolesRow(user.id)).toBeNull();

		const ollama = await addConnection(user.id, { baseUrl: server.origin });
		const compat = await addConnection(user.id, {
			type: "OPENAI_COMPATIBLE",
			baseUrl: server.origin,
		});
		expect(
			await setRoles(user.id, {
				chat: { connectionId: ollama.id, model: "good" },
				ranking: { connectionId: compat.id, model: "bad" },
				search: null,
			})
		).toMatchObject({ code: "JOB_NOT_SUPPORTED" });
		expect(await rolesRow(user.id)).toBeNull();
	});

	it("does not let a client mark search as checked, or set anything beside the three jobs", async () => {
		const { connection } = await userWithConnection();
		for (const extra of [
			{
				searchCheck: {
					verifiedFor: "x#y",
					verifiedAt: new Date().toISOString(),
				},
			},
			{ embeddingVerifiedFor: "x#y" },
			{ embeddingVerifiedAt: new Date().toISOString() },
			{ userId: "someone-else" },
		]) {
			const outcome = await api.setRoles({
				...body({ search: searchJob(connection.id) }),
				...extra,
			});
			expect(outcome.status).toBe(400);
		}
		expect(
			await rolesRow((await connectionRows())[0]?.userId ?? "")
		).toBeNull();
	});
});

describe("a search check is recorded only for the job that was checked", () => {
	it("is recorded against the catalogue's model and sentences when the vectors match", async () => {
		const { user, connection } = await userWithConnection();
		const outcome = await api.setRoles(
			body({ search: searchJob(connection.id) })
		);
		expect(outcome.status).toBe(200);
		expect(outcome.json?.searchCheck).toMatchObject({ ok: true });
		const roles = outcome.json?.roles as {
			search: unknown;
			searchCheck: { verifiedFor: string };
		};
		expect(roles.search).toEqual(searchJob(connection.id));
		expect(roles.searchCheck.verifiedFor).toBe(checkIdFor(spec));
		expect((await rolesRow(user.id))?.embeddingVerifiedFor).toBe(
			checkIdFor(spec)
		);
	});

	it("is not recorded when the vectors do not match", async () => {
		embeddings = answerEmbeddings(() => [0, 0, 0, 1]);
		const { user, connection } = await userWithConnection();
		const outcome = await api.setRoles(
			body({ search: searchJob(connection.id) })
		);
		expect(outcome.status).toBe(200);
		expect(outcome.json?.searchCheck).toMatchObject({ ok: false });
		expect(
			(outcome.json?.roles as { searchCheck: unknown }).searchCheck
		).toBeNull();
		const row = await rolesRow(user.id);
		expect(row?.embeddingConnectionId).toBe(connection.id);
		expect(row?.embeddingVerifiedFor).toBeNull();
		expect(row?.embeddingVerifiedAt).toBeNull();
	});

	it("is not recorded when the techniques service gives no spec, and the answer says so", async () => {
		vi.stubEnv("TECHNIQUES_MCP_URL", "");
		const { user, connection } = await userWithConnection();
		const outcome = await api.setRoles(
			body({ search: searchJob(connection.id) })
		);
		expect(outcome.json?.searchCheck).toEqual({ unavailable: true });
		expect((await rolesRow(user.id))?.embeddingVerifiedFor).toBeNull();
		expect(embeddingHits()).toHaveLength(0);
	});

	it("is cleared by moving the search job to another model, another connection, or off", async () => {
		const { user, connection } = await userWithConnection();
		const other = await addConnection(user.id, {
			label: "Other",
			baseUrl: server.origin,
		});
		await api.setRoles(body({ search: searchJob(connection.id) }));
		expect((await rolesRow(user.id))?.embeddingVerifiedFor).not.toBeNull();

		embeddings = answerEmbeddings(() => [0, 0, 0, 1]);
		for (const moved of [
			body({ search: searchJob(connection.id, "another-model") }),
			body({ search: searchJob(other.id, "another-model") }),
		]) {
			embeddings = answerEmbeddings(exactEmbedding(spec));
			await api.setRoles(body({ search: searchJob(connection.id) }));
			expect((await rolesRow(user.id))?.embeddingVerifiedFor).not.toBeNull();
			embeddings = answerEmbeddings(() => [0, 0, 0, 1]);
			await api.setRoles(moved);
			expect((await rolesRow(user.id))?.embeddingVerifiedFor).toBeNull();
		}

		embeddings = answerEmbeddings(exactEmbedding(spec));
		await api.setRoles(body({ search: searchJob(connection.id) }));
		expect((await rolesRow(user.id))?.embeddingVerifiedFor).not.toBeNull();
		const off = await api.setRoles(body({}));
		expect(off.status).toBe(200);
		const row = await rolesRow(user.id);
		expect(row?.embeddingConnectionId).toBeNull();
		expect(row?.embeddingModel).toBeNull();
		expect(row?.embeddingVerifiedFor).toBeNull();
		expect(row?.embeddingVerifiedAt).toBeNull();
	});

	it("keeps a passed check when only the chat or ranking job changes, and does not embed again", async () => {
		const { user, connection } = await userWithConnection();
		await api.setRoles(body({ search: searchJob(connection.id) }));
		const before = embeddingHits().length;
		const outcome = await api.setRoles(
			body({
				search: searchJob(connection.id),
				chat: { connectionId: connection.id, model: "chat-1" },
				ranking: { connectionId: connection.id, model: "clef-flash" },
			})
		);
		expect(outcome.json?.searchCheck).toBeNull();
		expect(embeddingHits()).toHaveLength(before);
		expect((await rolesRow(user.id))?.embeddingVerifiedFor).toBe(
			checkIdFor(spec)
		);
	});

	it("runs again, when asked, for an unchanged job whose check failed, and records a pass once it passes", async () => {
		const { user, connection } = await userWithConnection();
		embeddings = answerEmbeddings(() => [0, 0, 0, 1]);
		await api.setRoles(body({ search: searchJob(connection.id) }));
		expect((await rolesRow(user.id))?.embeddingVerifiedFor).toBeNull();

		embeddings = answerEmbeddings(exactEmbedding(spec));
		const retry = await api.setRoles({
			...body({ search: searchJob(connection.id) }),
			recheckSearch: true,
		});
		expect(retry.json?.searchCheck).toMatchObject({ ok: true });
		expect((await rolesRow(user.id))?.embeddingVerifiedFor).toBe(
			checkIdFor(spec)
		);
	});

	it("runs again when asked, and is recorded anew, when the catalogue's model has changed since the pass", async () => {
		const { user, connection } = await userWithConnection();
		await api.setRoles(body({ search: searchJob(connection.id) }));
		const first = (await rolesRow(user.id))?.embeddingVerifiedFor;

		spec = makeSpec({ modelId: "a-newer-catalogue-model" });
		embeddings = answerEmbeddings(exactEmbedding(spec));
		const before = embeddingHits().length;
		const outcome = await api.setRoles({
			...body({ search: searchJob(connection.id) }),
			recheckSearch: true,
		});
		expect(embeddingHits().length).toBeGreaterThan(before);
		expect(outcome.json?.searchCheck).toMatchObject({ ok: true });
		const second = (await rolesRow(user.id))?.embeddingVerifiedFor;
		expect(second).toBe(checkIdFor(spec));
		expect(second).not.toBe(first);
	});

	it("is not recorded by the service for a job other than the one now saved", async () => {
		const { user, connection } = await userWithConnection();
		await setRoles(
			user.id,
			body({ search: searchJob(connection.id, "embed") })
		);
		const wrongModel = await recordEmbeddingCheck(user.id, "x#y", {
			connectionId: connection.id,
			model: "some-other-model",
		});
		expect(wrongModel).toEqual({ data: false });
		const other = await addConnection(user.id, { baseUrl: server.origin });
		const wrongConnection = await recordEmbeddingCheck(user.id, "x#y", {
			connectionId: other.id,
			model: "embed",
		});
		expect(wrongConnection).toEqual({ data: false });
		expect(
			await recordEmbeddingCheck(user.id, "", searchJob(connection.id))
		).toMatchObject({
			code: "VALIDATION",
		});
		expect((await rolesRow(user.id))?.embeddingVerifiedFor).toBeNull();

		const right = await recordEmbeddingCheck(
			user.id,
			"x#y",
			searchJob(connection.id)
		);
		expect(right).toEqual({ data: true });
		expect((await rolesRow(user.id))?.embeddingVerifiedFor).toBe("x#y");
	});

	it("is not recorded for a user with no search job at all", async () => {
		const { user, connection } = await userWithConnection();
		expect(
			await recordEmbeddingCheck(user.id, "x#y", searchJob(connection.id))
		).toEqual({ data: false });
		expect(await rolesRow(user.id)).toBeNull();
	});
});

describe("a search check is not recorded when the job changed while it ran", () => {
	async function startHeldCheck() {
		const { user, connection } = await userWithConnection();
		await setRoles(user.id, body({ search: searchJob(connection.id) }));
		const release = gate();
		embeddings = (hit, response) => {
			release.opened.then(() =>
				json(
					response,
					{
						object: "list",
						data: (JSON.parse(hit.body).input as string[]).map(
							(input, index) => ({
								object: "embedding",
								index,
								embedding: exactEmbedding(spec)(input),
							})
						),
						model: "stub",
						usage: { prompt_tokens: 1, total_tokens: 1 },
					},
					200
				)
			);
		};
		const finished = runSearchCheck(user.id, searchJob(connection.id));
		await until(() => embeddingHits().length > 0);
		return { user, connection, release, finished };
	}

	it("when the model was changed meanwhile", async () => {
		const { user, connection, release, finished } = await startHeldCheck();
		await setRoles(
			user.id,
			body({ search: searchJob(connection.id, "newer-model") })
		);
		release.open();
		const outcome = await finished;
		expect("ok" in outcome && outcome.ok).toBe(false);
		const row = await rolesRow(user.id);
		expect(row?.embeddingModel).toBe("newer-model");
		expect(row?.embeddingVerifiedFor).toBeNull();
	});

	it("when the connection was changed meanwhile", async () => {
		const { user, connection, release, finished } = await startHeldCheck();
		const other = await addConnection(user.id, {
			label: "Other",
			baseUrl: server.origin,
		});
		await setRoles(user.id, body({ search: searchJob(other.id) }));
		release.open();
		await finished;
		const row = await rolesRow(user.id);
		expect(row?.embeddingConnectionId).toBe(other.id);
		expect(row?.embeddingVerifiedFor).toBeNull();
		expect(connection.id).not.toBe(other.id);
	});

	it("when search was switched off meanwhile", async () => {
		const { user, release, finished } = await startHeldCheck();
		await setRoles(user.id, body({}));
		release.open();
		await finished;
		const row = await rolesRow(user.id);
		expect(row?.embeddingConnectionId).toBeNull();
		expect(row?.embeddingVerifiedFor).toBeNull();
	});

	it("when the connection was removed meanwhile", async () => {
		const { user, connection, release, finished } = await startHeldCheck();
		await deleteConnection(user.id, connection.id);
		release.open();
		await finished;
		expect((await rolesRow(user.id))?.embeddingVerifiedFor ?? null).toBeNull();
		expect(
			(await getRoles(user.id)) &&
				(await rolesRow(user.id))?.embeddingConnectionId
		).toBeNull();
	});

	it("when the connection's key was changed meanwhile", async () => {
		const { user, connection, release, finished } = await startHeldCheck();
		await updateConnection(user.id, connection.id, { apiKey: "a-new-key-1" });
		release.open();
		await finished;
		expect((await rolesRow(user.id))?.embeddingVerifiedFor).toBeNull();
	});

	it("when the connection's address was changed meanwhile", async () => {
		const second = await startServer((_hit, response) => json(response, {}));
		try {
			const { user, connection, release, finished } = await startHeldCheck();
			await updateConnection(user.id, connection.id, {
				baseUrl: second.origin,
			});
			release.open();
			await finished;
			expect((await rolesRow(user.id))?.embeddingVerifiedFor).toBeNull();
		} finally {
			await second.close();
		}
	});
});

describe("editing or removing a connection takes back what depended on it", () => {
	async function passedCheck() {
		const { user, connection } = await userWithConnection();
		const bystander = await addConnection(user.id, {
			label: "Bystander",
			baseUrl: server.origin,
		});
		await api.setRoles(
			body({
				search: searchJob(connection.id),
				chat: { connectionId: bystander.id, model: "chat-m" },
			})
		);
		return { user, connection, bystander };
	}

	it("clears the check when the key changes or is removed", async () => {
		const { user, connection } = await passedCheck();
		expect(
			(await api.patch(connection.id, { apiKey: "replacement-key" })).status
		).toBe(200);
		expect((await rolesRow(user.id))?.embeddingVerifiedFor).toBeNull();
		expect((await rolesRow(user.id))?.embeddingModel).toBe("embed");

		await api.setRoles({
			...body({ search: searchJob(connection.id) }),
			recheckSearch: true,
		});
		expect((await rolesRow(user.id))?.embeddingVerifiedFor).not.toBeNull();
		expect((await api.patch(connection.id, { apiKey: null })).status).toBe(200);
		expect((await rolesRow(user.id))?.embeddingVerifiedFor).toBeNull();
	});

	it("clears the check when the address changes, but not when it is only written differently", async () => {
		const { user, connection } = await passedCheck();
		await api.patch(connection.id, { baseUrl: `${server.origin}///` });
		expect((await rolesRow(user.id))?.embeddingVerifiedFor).not.toBeNull();
		const second = await startServer((_hit, response) => json(response, {}));
		try {
			await api.patch(connection.id, { baseUrl: second.origin });
			expect((await rolesRow(user.id))?.embeddingVerifiedFor).toBeNull();
		} finally {
			await second.close();
		}
	});

	it("keeps the check for changes that do not touch the address or the key, and for other connections", async () => {
		const { user, connection, bystander } = await passedCheck();
		await api.patch(connection.id, { label: "Renamed" });
		await api.patch(bystander.id, {
			label: "Renamed too",
			apiKey: "other-key",
		});
		await api.patch(bystander.id, { baseUrl: "http://elsewhere.example" });
		expect((await rolesRow(user.id))?.embeddingVerifiedFor).toBe(
			checkIdFor(spec)
		);
	});

	it("empties every job that used a removed connection, and nothing else", async () => {
		const { user, connection, bystander } = await passedCheck();
		await api.setRoles(
			body({
				chat: { connectionId: connection.id, model: "c" },
				ranking: { connectionId: connection.id, model: "clef-flash" },
				search: searchJob(connection.id),
			})
		);
		expect((await api.remove(bystander.id)).status).toBe(200);
		expect((await rolesRow(user.id))?.chatConnectionId).toBe(connection.id);

		expect((await api.remove(connection.id)).status).toBe(200);
		const row = await rolesRow(user.id);
		expect(row).toMatchObject({
			chatConnectionId: null,
			chatModel: null,
			decisionConnectionId: null,
			decisionModel: null,
			embeddingConnectionId: null,
			embeddingModel: null,
			embeddingVerifiedFor: null,
			embeddingVerifiedAt: null,
		});
		const listed = await api.list();
		expect(listed.json?.roles).toEqual({
			chat: null,
			ranking: null,
			search: null,
			searchCheck: null,
			searchCheckCurrent: false,
		});
	});

	it("does not hand a removed connection's check to the next connection added", async () => {
		const { user, connection } = await passedCheck();
		await api.remove(connection.id);
		const fresh = await addConnection(user.id, {
			label: "Fresh",
			baseUrl: server.origin,
		});
		await api.setRoles(
			body({ search: { connectionId: fresh.id, model: "embed" } })
		);
		// A new job on a new connection is checked afresh, never inherited.
		expect(embeddingHits().length).toBeGreaterThanOrEqual(2);
		expect((await rolesRow(user.id))?.embeddingVerifiedFor).toBe(
			checkIdFor(spec)
		);
	});
});

describe("quick setup with a key OpenRouter does not accept writes nothing", () => {
	async function rowCounts(userId: string) {
		return {
			connections: (await connectionRows(userId)).length,
			roles: await prisma.userModelRoles.count({ where: { userId } }),
		};
	}

	it.each([
		[
			"a refused key",
			(response: import("node:http").ServerResponse) =>
				json(response, { error: "no" }, 401),
		],
		[
			"a forbidden key",
			(response: import("node:http").ServerResponse) =>
				json(response, { error: "no" }, 403),
		],
		[
			"a server error",
			(response: import("node:http").ServerResponse) =>
				json(response, { error: "down" }, 503),
		],
		[
			"a dropped connection",
			(response: import("node:http").ServerResponse) => {
				response.socket?.destroy();
			},
		],
		[
			"a redirect",
			(response: import("node:http").ServerResponse) => {
				response.writeHead(302, { location: "http://169.254.169.254/" });
				response.end();
			},
		],
	])("after %s", async (_label, answer) => {
		const user = await makeUser();
		await signInAs(user);
		server.handler = (_hit, response) => answer(response);
		const outcome = await api.quickSetup({ openRouterKey: KEY });
		expect(outcome.status).toBe(422);
		expect(outcome.text).not.toContain(KEY);
		expect(outcome.text).not.toContain(String(server.port));
		expect(await rowCounts(user.id)).toEqual({ connections: 0, roles: 0 });
	});

	it("leaves an existing connection and jobs exactly as they were", async () => {
		const { user, connection } = await userWithConnection();
		await api.setRoles(
			body({
				chat: { connectionId: connection.id, model: "chat-m" },
				search: searchJob(connection.id),
			})
		);
		const before = await rolesRow(user.id);
		server.handler = (_hit, response) => json(response, {}, 401);
		const outcome = await api.quickSetup({ openRouterKey: KEY });
		expect(outcome.status).toBe(422);
		expect(await connectionRows(user.id)).toHaveLength(1);
		expect(await rolesRow(user.id)).toEqual(before);
	});

	it("also writes nothing when the key is refused after the limit of connections", async () => {
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

	it("with a good key adds one connection and points all three jobs at it with the recommended models, then checks search", async () => {
		const { user, connection } = await userWithConnection();
		await api.setRoles(
			body({
				chat: { connectionId: connection.id, model: "chat-m" },
				search: searchJob(connection.id),
			})
		);
		const outcome = await api.quickSetup({ openRouterKey: KEY });
		expect(outcome.status).toBe(201);
		expect(outcome.text).not.toContain(KEY);
		const created = outcome.json?.connection as { id: string };
		const roles = outcome.json?.roles as Record<string, unknown>;
		expect(roles.chat).toEqual({
			connectionId: created.id,
			model: "anthropic/claude-sonnet-5.5",
		});
		expect(roles.ranking).toEqual({
			connectionId: created.id,
			model: "cloudflare/clef-flash",
		});
		expect(roles.search).toEqual({
			connectionId: created.id,
			model: "qwen/qwen3-embedding-4b",
		});
		expect(roles.searchCheck).toMatchObject({
			verifiedFor: checkIdFor(spec),
		});
		expect(outcome.json?.unsetJobs).toEqual([]);
		expect(await connectionRows(user.id)).toHaveLength(2);
	});

	it("names the jobs it could not fill", async () => {
		const user = await makeUser();
		await signInAs(user);
		const outcome = await api.quickSetup({ openRouterKey: KEY });
		expect(outcome.status).toBe(201);
		const unset = outcome.json?.unsetJobs as string[];
		const roles = outcome.json?.roles as Record<string, unknown>;
		for (const job of ["chat", "ranking", "search"]) {
			expect(unset.includes(job)).toBe(roles[job] === null);
		}
	});

	it("is atomic: a job the database refuses leaves no connection behind", async () => {
		const user = await makeUser();
		const existing = await addConnection(user.id, { baseUrl: server.origin });
		await setRoles(
			user.id,
			body({ chat: { connectionId: existing.id, model: "keep" } })
		);
		const before = await rolesRow(user.id);
		// The database itself refuses this model name, so the job write fails
		// after the connection has been inserted.
		await prisma.$executeRawUnsafe(
			"ALTER TABLE user_model_roles ADD CONSTRAINT refuse_probe CHECK (chat_model IS DISTINCT FROM 'refused-model')"
		);
		try {
			const outcome = await createConnectionWithJobs(
				user.id,
				{ label: "New", type: "OPENROUTER", apiKey: KEY },
				{ chat: "refused-model", ranking: "fine" }
			);
			expect("error" in outcome).toBe(true);
			expect(JSON.stringify(outcome)).not.toContain(KEY);
			expect(await connectionRows(user.id)).toHaveLength(1);
			expect(await rolesRow(user.id)).toEqual(before);
		} finally {
			await prisma.$executeRawUnsafe(
				"ALTER TABLE user_model_roles DROP CONSTRAINT refuse_probe"
			);
		}
	});
});
