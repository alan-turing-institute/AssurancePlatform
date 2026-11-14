import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { guardedFetch } from "@/lib/models/guarded-fetch";
import prisma from "@/lib/prisma";
import { mockNoAuth } from "../utils/auth-helpers";
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

const KEY = "sk-access-SECRET-6060";

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

describe("every model route needs a session", () => {
	it("answers 401 to every route and every method without one, and touches nothing", async () => {
		await mockNoAuth();
		const owner = await makeUser();
		const connection = await addConnection(owner.id, {
			baseUrl: server.origin,
			apiKey: KEY,
		});
		const answers = [
			await api.list(),
			await api.create({ label: "x", type: "OLLAMA", baseUrl: server.origin }),
			await api.patch(connection.id, { label: "x" }),
			await api.remove(connection.id),
			await api.test(connection.id),
			await api.setRoles({ chat: null, ranking: null, search: null }),
			await api.quickSetup({ openRouterKey: KEY }),
		];
		for (const answer of answers) {
			expect(answer.status).toBe(401);
			expect(answer.text).not.toContain(KEY);
		}
		expect(await connectionRows()).toHaveLength(1);
		expect(server.hits).toHaveLength(0);
	});
});

describe("every model route but removal needs a plugin that uses models", () => {
	it.each([
		["never turned on", async () => await makeUser({ enabled: false })],
		[
			"turned off",
			async () => {
				const user = await makeUser({ enabled: false });
				await prisma.pluginState.create({
					data: {
						pluginId: "tea.assistant",
						scopeType: "USER",
						scopeId: user.id,
						enabled: false,
					},
				});
				return user;
			},
		],
	])("refuses with 403 when the assistant is %s, sends nothing and writes nothing", async (_label, make) => {
		const user = await make();
		const connection = await addConnection(user.id, {
			baseUrl: server.origin,
			apiKey: KEY,
		});
		await signInAs(user);
		const refused = [
			await api.list(),
			await api.create({ label: "x", type: "OLLAMA", baseUrl: server.origin }),
			await api.patch(connection.id, { label: "changed" }),
			await api.test(connection.id),
			await api.setRoles({
				chat: { connectionId: connection.id, model: "m" },
				ranking: null,
				search: null,
			}),
			await api.quickSetup({ openRouterKey: KEY }),
		];
		for (const answer of refused) {
			expect(answer.status).toBe(403);
			expect(answer.text).not.toContain(KEY);
		}
		expect(server.hits).toHaveLength(0);
		const rows = await connectionRows(user.id);
		expect(rows).toHaveLength(1);
		expect(rows[0]?.label).toBe("Local");
		expect(await prisma.userModelRoles.count()).toBe(0);
	});

	it("still lets the user remove a connection, and its key, with the plugins off", async () => {
		const user = await makeUser({ enabled: false });
		const connection = await addConnection(user.id, {
			baseUrl: server.origin,
			apiKey: KEY,
		});
		await signInAs(user);
		const removed = await api.remove(connection.id);
		expect(removed.status).toBe(200);
		expect(removed.json).toEqual({ success: true });
		expect(await connectionRows()).toHaveLength(0);
	});

	it("works as soon as the assistant is turned on", async () => {
		const user = await makeUser({ enabled: false });
		await signInAs(user);
		expect((await api.list()).status).toBe(403);
		await prisma.pluginState.create({
			data: {
				pluginId: "tea.assistant",
				scopeType: "USER",
				scopeId: user.id,
				enabled: true,
			},
		});
		expect((await api.list()).status).toBe(200);
	});
});

describe("the old operator setting opens nothing", () => {
	it("does not let a listed base address on the old variable reach a plain http server", async () => {
		vi.stubEnv("TEA_MODELS_LOCAL_ADDRESSES", "");
		vi.stubEnv("ASSISTANT_ALLOWED_BASE_URLS", `${server.origin}/v1`);
		await expect(
			guardedFetch(`${server.origin}/v1/models`)
		).rejects.toMatchObject({
			name: "GuardedFetchError",
			code: "insecure-url",
		});
		expect(server.connections).toBe(0);
	});

	it("does not let a connection test reach it either", async () => {
		vi.stubEnv("TEA_MODELS_LOCAL_ADDRESSES", "");
		vi.stubEnv("ASSISTANT_ALLOWED_BASE_URLS", `${server.origin}/v1`);
		const user = await makeUser();
		const connection = await addConnection(user.id, {
			baseUrl: server.origin,
			apiKey: KEY,
		});
		await signInAs(user);
		const tested = await api.test(connection.id);
		expect(tested.json?.ok).toBe(false);
		expect(server.connections).toBe(0);
	});
});
