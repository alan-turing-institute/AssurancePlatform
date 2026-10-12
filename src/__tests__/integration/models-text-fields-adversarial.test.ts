import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

let server: CountingServer;
let api: Routes;

beforeEach(async () => {
	resetHarness();
	server = await startServer((_hit, response) =>
		json(response, { models: [] })
	);
	vi.stubEnv("TEA_MODELS_LOCAL_ADDRESSES", server.origin);
	vi.stubEnv("TECHNIQUES_MCP_URL", "");
	harness.providerOrigin = server.origin;
	api = await routes();
});

afterEach(async () => {
	vi.unstubAllEnvs();
	await server.close();
	assertNoLeaks();
});

/** Text the database cannot store, or that would make a stored name unreadable. */
const UNSTORABLE = [["a NUL byte", "bad\u0000name"]] as const;

describe("a label or model name the database cannot store is refused as a bad request", () => {
	it.each(
		UNSTORABLE
	)("refuses a label with %s with a 400, and stores nothing", async (_name, label) => {
		const user = await makeUser();
		await signInAs(user);
		const added = await api.create({
			label,
			type: "OLLAMA",
			baseUrl: server.origin,
		});
		expect(added.status).toBe(400);
		expect(await connectionRows(user.id)).toHaveLength(0);
	});

	it.each(
		UNSTORABLE
	)("refuses a changed label with %s with a 400, and keeps the old one", async (_name, label) => {
		const user = await makeUser();
		const connection = await addConnection(user.id, { baseUrl: server.origin });
		await signInAs(user);
		const changed = await api.patch(connection.id, { label });
		expect(changed.status).toBe(400);
		expect((await connectionRows(user.id))[0]?.label).toBe("Local");
	});

	it.each(
		UNSTORABLE
	)("refuses a model name with %s with a 400, and saves no job", async (_name, model) => {
		const user = await makeUser();
		const connection = await addConnection(user.id, { baseUrl: server.origin });
		await signInAs(user);
		for (const job of ["chat", "ranking", "search"] as const) {
			const saved = await api.setRoles({
				chat: null,
				ranking: null,
				search: null,
				[job]: { connectionId: connection.id, model },
			});
			expect(saved.status).toBe(400);
		}
		expect(await rolesRow(user.id)).toBeNull();
	});
});
