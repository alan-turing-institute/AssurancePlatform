import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
	deleteConnection,
	getConnectionForUse,
	getRoles,
	recordEmbeddingCheck,
	setRoles,
	updateConnection,
} from "@/lib/services/model-connection-service";
import { runSearchCheck } from "@/lib/services/model-search-check-service";
import {
	assertNoLeaks,
	type CountingServer,
	harness,
	json,
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

const OWNER_KEY = "sk-owner-SECRET-1234";
const NOBODY = "00000000-0000-4000-8000-000000000000";

let server: CountingServer;
let api: Routes;

beforeEach(async () => {
	resetHarness();
	server = await startServer((_hit, response) =>
		json(response, { models: [{ name: "m" }] })
	);
	vi.stubEnv("TEA_MODELS_LOCAL_ADDRESSES", server.origin);
	harness.providerOrigin = server.origin;
	api = await routes();
});

afterEach(async () => {
	vi.unstubAllEnvs();
	await server.close();
	assertNoLeaks();
});

async function twoUsers() {
	const owner = await makeUser();
	const intruder = await makeUser();
	const ownersConnection = await addConnection(owner.id, {
		label: "Owner's Ollama",
		baseUrl: server.origin,
		apiKey: OWNER_KEY,
	});
	return { owner, intruder, ownersConnection };
}

describe("a user cannot reach another user's connection through the routes", () => {
	it("does not list it", async () => {
		const { intruder, ownersConnection } = await twoUsers();
		await signInAs(intruder);
		const listed = await api.list();
		expect(listed.status).toBe(200);
		expect(listed.json?.connections).toEqual([]);
		expect(listed.text).not.toContain(ownersConnection.id);
		expect(listed.text).not.toContain("Owner's Ollama");
		expect(listed.text).not.toContain(OWNER_KEY);
	});

	it("answers a foreign id exactly as it answers an id that does not exist, for change, test and remove", async () => {
		const { intruder, ownersConnection } = await twoUsers();
		await signInAs(intruder);
		const missing = [NOBODY, "not-an-id", ""];
		for (const missingId of missing) {
			const foreignPatch = await api.patch(ownersConnection.id, {
				label: "stolen",
			});
			const absentPatch = await api.patch(missingId || NOBODY, {
				label: "stolen",
			});
			expect(foreignPatch.status).toBe(404);
			expect(foreignPatch.status).toBe(absentPatch.status);
			expect(foreignPatch.text).toBe(absentPatch.text);

			const foreignTest = await api.test(ownersConnection.id);
			const absentTest = await api.test(missingId || NOBODY);
			expect(foreignTest.status).toBe(404);
			expect(foreignTest.text).toBe(absentTest.text);

			const foreignRemove = await api.remove(ownersConnection.id);
			const absentRemove = await api.remove(missingId || NOBODY);
			expect(foreignRemove.status).toBe(404);
			expect(foreignRemove.text).toBe(absentRemove.text);
		}
	});

	it("leaves the owner's connection and key untouched after every attempt", async () => {
		const { owner, intruder, ownersConnection } = await twoUsers();
		await signInAs(intruder);
		await api.patch(ownersConnection.id, {
			label: "stolen",
			apiKey: "attacker-key",
			baseUrl: "http://attacker.example",
		});
		await api.remove(ownersConnection.id);
		await api.test(ownersConnection.id);

		const stored = await getConnectionForUse(owner.id, ownersConnection.id);
		expect("data" in stored && stored.data.label).toBe("Owner's Ollama");
		expect("data" in stored && stored.data.apiKey).toBe(OWNER_KEY);
		expect("data" in stored && stored.data.baseUrl).toBe(server.origin);
	});

	it("never sends the owner's key anywhere when someone else tests the connection", async () => {
		const { intruder, ownersConnection } = await twoUsers();
		await signInAs(intruder);
		await api.test(ownersConnection.id);
		expect(server.hits).toHaveLength(0);
		expect(server.connections).toBe(0);
	});

	it.each([
		"chat",
		"ranking",
		"search",
	] as const)("refuses to give the %s job a connection of another user, as if it did not exist", async (job) => {
		const { intruder, ownersConnection } = await twoUsers();
		await signInAs(intruder);
		const body = (connectionId: string) => ({
			chat: null,
			ranking: null,
			search: null,
			[job]: { connectionId, model: "m" },
		});
		const foreign = await api.setRoles(body(ownersConnection.id));
		const absent = await api.setRoles(body(NOBODY));
		expect(foreign.status).toBe(404);
		expect(foreign.text).toBe(absent.text);
		expect(await rolesRow(intruder.id)).toBeNull();
		expect(server.hits).toHaveLength(0);
	});

	it("saves nothing at all when one job of three names a foreign connection", async () => {
		const { intruder, ownersConnection } = await twoUsers();
		const own = await addConnection(intruder.id, {
			label: "Mine",
			baseUrl: server.origin,
		});
		await signInAs(intruder);
		const refused = await api.setRoles({
			chat: { connectionId: own.id, model: "my-chat" },
			ranking: { connectionId: ownersConnection.id, model: "clef-flash" },
			search: null,
		});
		expect(refused.status).toBe(404);
		expect(await rolesRow(intruder.id)).toBeNull();

		const ok = await api.setRoles({
			chat: { connectionId: own.id, model: "my-chat" },
			ranking: null,
			search: null,
		});
		expect(ok.status).toBe(200);
		const row = await rolesRow(intruder.id);
		expect(row?.chatConnectionId).toBe(own.id);
		expect(row?.decisionConnectionId).toBeNull();
	});

	it("answers 404 and never a server error for ids with odd shapes", async () => {
		const { intruder } = await twoUsers();
		await signInAs(intruder);
		const odd = [
			"' OR '1'='1",
			"1; DELETE FROM user_model_connections",
			"../../etc/passwd",
			"%00",
			"a".repeat(5000),
			"‮",
			"null",
			"undefined",
			"[object Object]",
		];
		for (const id of odd) {
			for (const outcome of [
				await api.patch(id, { label: "x" }),
				await api.test(id),
				await api.remove(id),
			]) {
				expect(outcome.status).toBe(404);
			}
		}
		expect(await connectionRows()).toHaveLength(1);
	});

	it("lets a user whose plugins are off remove only their own connection", async () => {
		const owner = await makeUser();
		const stranger = await makeUser({ enabled: false });
		const mine = await addConnection(stranger.id, { baseUrl: server.origin });
		const theirs = await addConnection(owner.id, { baseUrl: server.origin });
		await signInAs(stranger);
		expect((await api.remove(theirs.id)).status).toBe(404);
		expect((await api.remove(mine.id)).status).toBe(200);
		expect(await connectionRows(owner.id)).toHaveLength(1);
		expect(await connectionRows(stranger.id)).toHaveLength(0);
	});
});

describe("a user cannot reach another user's connection through the services", () => {
	it("gives the same answer for a foreign id and a missing id", async () => {
		const { intruder, ownersConnection } = await twoUsers();
		const foreign = await getConnectionForUse(intruder.id, ownersConnection.id);
		const absent = await getConnectionForUse(intruder.id, NOBODY);
		expect(foreign).toEqual(absent);
		expect("error" in foreign && foreign.code).toBe("NOT_FOUND");
		expect(JSON.stringify(foreign)).not.toContain(OWNER_KEY);

		for (const call of [
			(id: string) => updateConnection(intruder.id, id, { label: "x" }),
			(id: string) => deleteConnection(intruder.id, id),
			(id: string) =>
				setRoles(intruder.id, {
					chat: { connectionId: id, model: "m" },
					ranking: null,
					search: null,
				}),
		]) {
			expect(await call(ownersConnection.id)).toEqual(await call(NOBODY));
		}
	});

	it("reads a job that points at another user's connection as not set", async () => {
		const { intruder, ownersConnection } = await twoUsers();
		// A row no route could write: the job names a connection of someone else.
		await prisma.userModelRoles.create({
			data: {
				userId: intruder.id,
				chatConnectionId: ownersConnection.id,
				chatModel: "m",
				decisionConnectionId: ownersConnection.id,
				decisionModel: "m",
				embeddingConnectionId: ownersConnection.id,
				embeddingModel: "m",
				embeddingVerifiedFor: "x#y",
				embeddingVerifiedAt: new Date(),
			},
		});
		const roles = await getRoles(intruder.id);
		expect("data" in roles && roles.data).toEqual({
			chat: null,
			ranking: null,
			search: null,
			searchCheck: null,
		});
		await signInAs(intruder);
		const listed = await api.list();
		expect(listed.json?.roles).toEqual({
			chat: null,
			ranking: null,
			search: null,
			searchCheck: null,
			searchCheckCurrent: false,
		});
		expect(listed.text).not.toContain(ownersConnection.id);
	});

	it("does not record a search check for a job on another user's connection", async () => {
		const { owner, intruder, ownersConnection } = await twoUsers();
		await setRoles(owner.id, {
			chat: null,
			ranking: null,
			search: { connectionId: ownersConnection.id, model: "embed" },
		});
		await prisma.userModelRoles.create({
			data: {
				userId: intruder.id,
				embeddingConnectionId: ownersConnection.id,
				embeddingModel: "embed",
			},
		});
		const recorded = await recordEmbeddingCheck(intruder.id, "x#y", {
			connectionId: ownersConnection.id,
			model: "embed",
		});
		expect(recorded).toEqual({ data: false });
		expect((await rolesRow(intruder.id))?.embeddingVerifiedFor).toBeNull();
		expect((await rolesRow(owner.id))?.embeddingVerifiedFor).toBeNull();
	});

	it("runs no search check against a connection that is not the user's", async () => {
		vi.stubEnv("TECHNIQUES_MCP_URL", `${server.origin}/mcp`);
		const { intruder, ownersConnection } = await twoUsers();
		const outcome = await runSearchCheck(intruder.id, {
			connectionId: ownersConnection.id,
			model: "embed",
		});
		expect("unavailable" in outcome || outcome.ok === false).toBe(true);
		expect(
			server.hits.filter((hit) => hit.url.includes("embeddings"))
		).toHaveLength(0);
		expect(JSON.stringify(server.hits)).not.toContain(OWNER_KEY);
	});
});
