import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
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

const KEY = "sk-limits-SECRET-2468";
const LIMIT = 20;
const MINUTE = 60_000;
const LIMIT_HINT = /\b20\b|\b10\b|minute/i;

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
		} else if (hit.url === "/api/tags") {
			json(response, { models: [{ name: "m" }] });
		} else if (hit.url === "/api/v1/key") {
			json(response, { data: {} });
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

async function signedInWithConnection() {
	const user = await makeUser();
	const connection = await addConnection(user.id, { baseUrl: server.origin });
	await signInAs(user);
	return { user, connection };
}

const tagHits = () => server.hits.filter((hit) => hit.url === "/api/tags");

/** A search change that has not been tried before, so that it asks for a check. */
function newSearchJob(connectionId: string, n: number) {
	return {
		chat: null,
		ranking: null,
		search: { connectionId, model: `embed-${n}` },
	};
}

describe("calls that reach out answer 429 past 20 in 10 minutes", () => {
	it("lets 20 connection tests through and stops the 21st before anything is sent", async () => {
		const { connection } = await signedInWithConnection();
		for (let index = 0; index < LIMIT; index += 1) {
			expect((await api.test(connection.id)).status).toBe(200);
		}
		expect(tagHits()).toHaveLength(LIMIT);
		const over = await api.test(connection.id);
		expect(over.status).toBe(429);
		expect(tagHits()).toHaveLength(LIMIT);
		expect(over.text).not.toContain(KEY);
		expect(over.text).not.toMatch(LIMIT_HINT);
	});

	it("counts search changes, rechecks of an unchecked search job, and quick setup in the same 20", async () => {
		const { connection } = await signedInWithConnection();
		for (let index = 0; index < 6; index += 1) {
			expect((await api.test(connection.id)).status).toBe(200);
		}
		for (let index = 0; index < 7; index += 1) {
			expect(
				(await api.setRoles(newSearchJob(connection.id, index))).status
			).toBe(200);
		}
		for (let index = 0; index < 7; index += 1) {
			expect((await api.quickSetup({ openRouterKey: KEY })).status).toBe(201);
		}
		expect((await api.test(connection.id)).status).toBe(429);
		expect((await api.setRoles(newSearchJob(connection.id, 99))).status).toBe(
			429
		);
		expect((await api.quickSetup({ openRouterKey: KEY })).status).toBe(429);
	});

	it("saves nothing, and sends nothing, when a search change is over the limit", async () => {
		const { user, connection } = await signedInWithConnection();
		for (let index = 0; index < LIMIT; index += 1) {
			await api.test(connection.id);
		}
		const embeddingBefore = server.hits.filter(
			(hit) => hit.url === "/v1/embeddings"
		).length;
		const over = await api.setRoles({
			chat: { connectionId: connection.id, model: "chat-m" },
			ranking: null,
			search: { connectionId: connection.id, model: "embed" },
		});
		expect(over.status).toBe(429);
		expect(await rolesRow(user.id)).toBeNull();
		expect(
			server.hits.filter((hit) => hit.url === "/v1/embeddings")
		).toHaveLength(embeddingBefore);
	});

	it("writes nothing and sends nothing when quick setup is over the limit", async () => {
		const { user, connection } = await signedInWithConnection();
		for (let index = 0; index < LIMIT; index += 1) {
			await api.test(connection.id);
		}
		const before = server.hits.length;
		const over = await api.quickSetup({ openRouterKey: KEY });
		expect(over.status).toBe(429);
		expect(over.text).not.toContain(KEY);
		expect(server.hits).toHaveLength(before);
		expect(await connectionRows(user.id)).toHaveLength(1);
		expect(await rolesRow(user.id)).toBeNull();
	});

	it("does not count jobs saved without a new search check", async () => {
		const { connection } = await signedInWithConnection();
		for (let index = 0; index < LIMIT + 5; index += 1) {
			const outcome = await api.setRoles({
				chat: { connectionId: connection.id, model: `chat-${index}` },
				ranking: null,
				search: null,
			});
			expect(outcome.status).toBe(200);
		}
	});

	it("does not count a search job that already has a current check", async () => {
		const { connection } = await signedInWithConnection();
		const job = {
			chat: null,
			ranking: null,
			search: { connectionId: connection.id, model: "embed" },
		};
		expect((await api.setRoles(job)).status).toBe(200);
		for (let index = 0; index < LIMIT + 5; index += 1) {
			expect((await api.setRoles(job)).status).toBe(200);
		}
	});

	it("is a limit for each user", async () => {
		const first = await signedInWithConnection();
		for (let index = 0; index < LIMIT; index += 1) {
			await api.test(first.connection.id);
		}
		expect((await api.test(first.connection.id)).status).toBe(429);

		const second = await signedInWithConnection();
		expect((await api.test(second.connection.id)).status).toBe(200);
	});

	it("forgets attempts after 10 minutes, and no sooner", async () => {
		const { user, connection } = await signedInWithConnection();
		for (let index = 0; index < LIMIT; index += 1) {
			await api.test(connection.id);
		}
		expect((await api.test(connection.id)).status).toBe(429);

		await prisma.rateLimitAttempt.updateMany({
			where: { identifier: user.id },
			data: { attemptedAt: new Date(Date.now() - 9 * MINUTE) },
		});
		expect((await api.test(connection.id)).status).toBe(429);

		await prisma.rateLimitAttempt.updateMany({
			where: { identifier: user.id },
			data: { attemptedAt: new Date(Date.now() - 11 * MINUTE) },
		});
		expect((await api.test(connection.id)).status).toBe(200);
	});

	it("holds when many requests arrive at once", async () => {
		const { connection } = await signedInWithConnection();
		const outcomes = await Promise.all(
			Array.from({ length: 60 }, () => api.test(connection.id))
		);
		const allowed = outcomes.filter((outcome) => outcome.status === 200);
		const refused = outcomes.filter((outcome) => outcome.status === 429);
		expect(allowed.length).toBeLessThanOrEqual(LIMIT);
		expect(tagHits().length).toBeLessThanOrEqual(LIMIT);
		expect(allowed.length + refused.length).toBe(60);
	});

	it("holds for search changes that arrive at once", async () => {
		const { connection } = await signedInWithConnection();
		const outcomes = await Promise.all(
			Array.from({ length: 40 }, (_, index) =>
				api.setRoles(newSearchJob(connection.id, index))
			)
		);
		const checked = server.hits.filter(
			(hit) => hit.url === "/v1/embeddings"
		).length;
		expect(checked).toBeLessThanOrEqual(LIMIT);
		expect(outcomes.some((outcome) => outcome.status === 429)).toBe(true);
	});
});
