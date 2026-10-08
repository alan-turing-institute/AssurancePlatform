import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	createTestPluginState,
	createTestUser,
} from "../utils/prisma-factories";

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

const ENVELOPE = /^v\d+:/;
const SECRET = "sk-test-secret-value-123";
const URL_ = "http://localhost:3000/api/user/plugins/assistant/key";

function put(body: unknown): NextRequest {
	return new NextRequest(URL_, { method: "PUT", body: JSON.stringify(body) });
}

beforeEach(async () => {
	await mockNoAuth();
});

describe("assistant key store", () => {
	it("round-trips a key, stores ciphertext, and returns null when absent", async () => {
		const user = await createTestUser();
		const store = await import("@/lib/plugins/assistant/key-store");

		expect(await store.readUserApiKey(user.id)).toBeNull();

		await store.writeUserApiKey(user.id, SECRET);
		expect(await store.readUserApiKey(user.id)).toBe(SECRET);

		const row = await prisma.pluginAssistantKey.findUniqueOrThrow({
			where: { userId: user.id },
		});
		expect(row.apiKeyEncrypted).not.toContain(SECRET);
		expect(row.apiKeyEncrypted).toMatch(ENVELOPE);

		await store.writeUserApiKey(user.id, "replacement");
		expect(await store.readUserApiKey(user.id)).toBe("replacement");

		await store.deleteUserApiKey(user.id);
		expect(await store.readUserApiKey(user.id)).toBeNull();
	});
});

describe("/api/user/plugins/assistant/key", () => {
	it("refuses every method when unauthenticated", async () => {
		const route = await import("@/app/api/user/plugins/assistant/key/route");
		expect((await route.GET()).status).toBe(401);
		expect((await route.PUT(put({ key: SECRET }))).status).toBe(401);
		expect((await route.DELETE()).status).toBe(401);
	});

	it("lets the owner write, check and remove the key, and never returns it", async () => {
		const user = await createTestUser();
		await createTestPluginState(user.id, {
			pluginId: "tea.assistant",
			enabled: true,
		});
		await mockAuth(user.id, user.username, user.email);
		const route = await import("@/app/api/user/plugins/assistant/key/route");

		let res = await route.GET();
		expect(await res.json()).toEqual({ hasKey: false });

		res = await route.PUT(put({ key: SECRET }));
		expect(res.status).toBe(200);
		expect(JSON.stringify(await res.json())).not.toContain(SECRET);

		res = await route.GET();
		const text = JSON.stringify(await res.json());
		expect(text).toBe(JSON.stringify({ hasKey: true }));

		res = await route.DELETE();
		expect(res.status).toBe(200);
		expect(await (await route.GET()).json()).toEqual({ hasKey: false });
	});

	it("rejects an empty or malformed key body", async () => {
		const user = await createTestUser();
		await createTestPluginState(user.id, {
			pluginId: "tea.assistant",
			enabled: true,
		});
		await mockAuth(user.id, user.username, user.email);
		const route = await import("@/app/api/user/plugins/assistant/key/route");
		expect((await route.PUT(put({ key: "  " }))).status).toBe(400);
		expect((await route.PUT(put({ other: 1 }))).status).toBe(400);
	});

	it("refuses with 403 when the plugin is switched off for the user", async () => {
		const user = await createTestUser();
		await createTestPluginState(user.id, {
			pluginId: "tea.assistant",
			scopeType: "USER",
			enabled: false,
		});
		await mockAuth(user.id, user.username, user.email);
		const route = await import("@/app/api/user/plugins/assistant/key/route");
		expect((await route.GET()).status).toBe(403);
		expect((await route.PUT(put({ key: SECRET }))).status).toBe(403);
		expect((await route.DELETE()).status).toBe(200);
		expect(await prisma.pluginAssistantKey.count()).toBe(0);
	});

	it("refuses with 403 for a user who has never turned the assistant on", async () => {
		const user = await createTestUser();
		await mockAuth(user.id, user.username, user.email);
		const route = await import("@/app/api/user/plugins/assistant/key/route");
		expect((await route.GET()).status).toBe(403);
		expect((await route.PUT(put({ key: SECRET }))).status).toBe(403);
	});

	it("answers 503 with a clear message when token encryption is not configured", async () => {
		const user = await createTestUser();
		await createTestPluginState(user.id, {
			pluginId: "tea.assistant",
			enabled: true,
		});
		await mockAuth(user.id, user.username, user.email);
		vi.stubEnv("TOKEN_ENCRYPTION_KEY", "");
		const route = await import("@/app/api/user/plugins/assistant/key/route");
		const res = await route.PUT(put({ key: SECRET }));
		vi.unstubAllEnvs();
		expect(res.status).toBe(503);
		expect(await res.json()).toEqual({
			error:
				"This server cannot store keys: token encryption is not configured.",
			code: "SERVICE_UNAVAILABLE",
		});
	});

	it("lets a user who switched the plugin off remove a key they stored earlier", async () => {
		const user = await createTestUser();
		await createTestPluginState(user.id, {
			pluginId: "tea.assistant",
			enabled: false,
		});
		const store = await import("@/lib/plugins/assistant/key-store");
		await store.writeUserApiKey(user.id, SECRET);
		await mockAuth(user.id, user.username, user.email);
		const route = await import("@/app/api/user/plugins/assistant/key/route");
		expect((await route.DELETE()).status).toBe(200);
		expect(await store.readUserApiKey(user.id)).toBeNull();
	});

	it("does not appear in GET /api/user/plugins", async () => {
		const user = await createTestUser();
		await mockAuth(user.id, user.username, user.email);
		const key = await import("@/app/api/user/plugins/assistant/key/route");
		await key.PUT(put({ key: SECRET }));

		const list = await import("@/app/api/user/plugins/route");
		const body = JSON.stringify(await (await list.GET()).json());
		expect(body).not.toContain(SECRET);
		expect(body).not.toContain("apiKey");
	});
});
