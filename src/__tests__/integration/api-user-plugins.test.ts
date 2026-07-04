import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	createTestPluginState,
	createTestUser,
} from "../utils/prisma-factories";

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

const KNOWN_PLUGIN_ID = "tea.health";
const UNKNOWN_PLUGIN_ID = "tea.does-not-exist";

function patchRequest(body: unknown): NextRequest {
	return new NextRequest("http://localhost:3000/api/user/plugins", {
		method: "PATCH",
		body: JSON.stringify(body),
	});
}

beforeEach(async () => {
	await mockNoAuth();
});

afterEach(() => {
	vi.unstubAllEnvs();
});

// ============================================
// GET /api/user/plugins
// ============================================

describe("GET /api/user/plugins", () => {
	it("returns 401 when the request is not authenticated", async () => {
		const { GET } = await import("@/app/api/user/plugins/route");
		const response = await GET();
		expect(response.status).toBe(401);
	});

	it("returns the manifest plugin with its effective state for the session user", async () => {
		const user = await createTestUser();
		await mockAuth(user.id, user.username, user.email);

		const { GET } = await import("@/app/api/user/plugins/route");
		const response = await GET();
		expect(response.status).toBe(200);

		const body = await response.json();
		expect(body.plugins).toHaveLength(1);
		expect(body.plugins[0]).toMatchObject({
			pluginId: KNOWN_PLUGIN_ID,
			name: "Claim/Evidence Health",
			version: "0.1.0",
			available: true,
			enabled: true,
			pinnedAt: null,
			settings: null,
		});
	});

	it("reports available: false and pinnedAt: DEPLOYMENT when withheld via TEA_PLUGINS_DISABLED", async () => {
		const user = await createTestUser();
		await mockAuth(user.id, user.username, user.email);
		vi.stubEnv("TEA_PLUGINS_DISABLED", KNOWN_PLUGIN_ID);

		const { GET } = await import("@/app/api/user/plugins/route");
		const response = await GET();
		const body = await response.json();

		expect(body.plugins[0]).toMatchObject({
			available: false,
			enabled: false,
			pinnedAt: "DEPLOYMENT",
		});
	});

	it("reports pinnedAt: USER and the persisted settings after the user has toggled the plugin off", async () => {
		const user = await createTestUser();
		await createTestPluginState(user.id, {
			pluginId: KNOWN_PLUGIN_ID,
			scopeType: "USER",
			enabled: false,
			settings: { threshold: 0.8 },
		});
		await mockAuth(user.id, user.username, user.email);

		const { GET } = await import("@/app/api/user/plugins/route");
		const response = await GET();
		const body = await response.json();

		expect(body.plugins[0]).toMatchObject({
			enabled: false,
			pinnedAt: "USER",
			settings: { threshold: 0.8 },
		});
	});
});

// ============================================
// PATCH /api/user/plugins — auth & identity
// ============================================

describe("PATCH /api/user/plugins — auth and session-derived identity", () => {
	it("returns 401 when the request is not authenticated", async () => {
		const { PATCH } = await import("@/app/api/user/plugins/route");
		const response = await PATCH(
			patchRequest({ pluginId: KNOWN_PLUGIN_ID, enabled: false })
		);
		expect(response.status).toBe(401);
	});

	it("ignores a body-supplied userId — the row is written for the session user, never the body's userId", async () => {
		const actingUser = await createTestUser();
		const otherUser = await createTestUser();
		await mockAuth(actingUser.id, actingUser.username, actingUser.email);

		const { PATCH } = await import("@/app/api/user/plugins/route");
		const response = await PATCH(
			patchRequest({
				pluginId: KNOWN_PLUGIN_ID,
				enabled: false,
				userId: otherUser.id,
			})
		);

		expect(response.status).toBe(200);

		const actingUserRow = await prisma.pluginState.findUnique({
			where: {
				pluginId_scopeType_scopeId: {
					pluginId: KNOWN_PLUGIN_ID,
					scopeType: "USER",
					scopeId: actingUser.id,
				},
			},
		});
		const otherUserRow = await prisma.pluginState.findUnique({
			where: {
				pluginId_scopeType_scopeId: {
					pluginId: KNOWN_PLUGIN_ID,
					scopeType: "USER",
					scopeId: otherUser.id,
				},
			},
		});

		expect(actingUserRow).not.toBeNull();
		expect(actingUserRow?.enabled).toBe(false);
		expect(otherUserRow).toBeNull();
	});
});

// ============================================
// PATCH /api/user/plugins — validation
// ============================================

describe("PATCH /api/user/plugins — validation", () => {
	it("rejects an unknown pluginId with 400, and persists nothing", async () => {
		const user = await createTestUser();
		await mockAuth(user.id, user.username, user.email);

		const { PATCH } = await import("@/app/api/user/plugins/route");
		const response = await PATCH(
			patchRequest({ pluginId: UNKNOWN_PLUGIN_ID, enabled: false })
		);

		expect(response.status).toBe(400);

		const rows = await prisma.pluginState.findMany({
			where: { pluginId: UNKNOWN_PLUGIN_ID },
		});
		expect(rows).toHaveLength(0);
	});

	it("rejects settings exceeding the per-string-length cap, and persists nothing", async () => {
		const user = await createTestUser();
		await mockAuth(user.id, user.username, user.email);

		const { PATCH } = await import("@/app/api/user/plugins/route");
		const response = await PATCH(
			patchRequest({
				pluginId: KNOWN_PLUGIN_ID,
				enabled: true,
				settings: { note: "a".repeat(600) },
			})
		);

		expect(response.status).toBe(400);

		const row = await prisma.pluginState.findUnique({
			where: {
				pluginId_scopeType_scopeId: {
					pluginId: KNOWN_PLUGIN_ID,
					scopeType: "USER",
					scopeId: user.id,
				},
			},
		});
		expect(row).toBeNull();
	});

	it("rejects settings exceeding the top-level key-count cap", async () => {
		const user = await createTestUser();
		await mockAuth(user.id, user.username, user.email);

		const tooManyKeys = Object.fromEntries(
			Array.from({ length: 25 }, (_, i) => [`key${i}`, i])
		);

		const { PATCH } = await import("@/app/api/user/plugins/route");
		const response = await PATCH(
			patchRequest({
				pluginId: KNOWN_PLUGIN_ID,
				enabled: true,
				settings: tooManyKeys,
			})
		);

		expect(response.status).toBe(400);
	});

	it("rejects settings that satisfy every per-node cap but exceed the total serialized byte cap", async () => {
		const user = await createTestUser();
		await mockAuth(user.id, user.username, user.email);

		// 20 keys (at the key-count cap) x a 300-char string (under the
		// per-string cap) each — individually legal, ~6000 bytes together,
		// over the 4096-byte whole-payload cap.
		const nearCapKeys = Object.fromEntries(
			Array.from({ length: 20 }, (_, i) => [`key${i}`, "x".repeat(300)])
		);

		const { PATCH } = await import("@/app/api/user/plugins/route");
		const response = await PATCH(
			patchRequest({
				pluginId: KNOWN_PLUGIN_ID,
				enabled: true,
				settings: nearCapKeys,
			})
		);

		expect(response.status).toBe(400);
	});

	it("rejects a non-boolean enabled value", async () => {
		const user = await createTestUser();
		await mockAuth(user.id, user.username, user.email);

		const { PATCH } = await import("@/app/api/user/plugins/route");
		const response = await PATCH(
			patchRequest({ pluginId: KNOWN_PLUGIN_ID, enabled: "yes" })
		);

		expect(response.status).toBe(400);
	});
});

// ============================================
// PATCH /api/user/plugins — toggle round-trip
// ============================================

describe("PATCH /api/user/plugins — toggle round-trip", () => {
	it("persists a toggle and the change is visible through GET", async () => {
		const user = await createTestUser();
		await mockAuth(user.id, user.username, user.email);

		const { GET, PATCH } = await import("@/app/api/user/plugins/route");

		const offResponse = await PATCH(
			patchRequest({ pluginId: KNOWN_PLUGIN_ID, enabled: false })
		);
		expect(offResponse.status).toBe(200);

		const afterOff = await (await GET()).json();
		expect(afterOff.plugins[0]).toMatchObject({
			enabled: false,
			pinnedAt: "USER",
		});

		const onResponse = await PATCH(
			patchRequest({ pluginId: KNOWN_PLUGIN_ID, enabled: true })
		);
		expect(onResponse.status).toBe(200);

		const afterOn = await (await GET()).json();
		expect(afterOn.plugins[0]).toMatchObject({
			enabled: true,
			pinnedAt: null,
		});
	});

	it("does not lose settings JSON when a later toggle only changes enabled", async () => {
		const user = await createTestUser();
		await mockAuth(user.id, user.username, user.email);

		const { GET, PATCH } = await import("@/app/api/user/plugins/route");

		const withSettings = await PATCH(
			patchRequest({
				pluginId: KNOWN_PLUGIN_ID,
				enabled: true,
				settings: { threshold: 0.8 },
			})
		);
		expect(withSettings.status).toBe(200);

		const enabledOnlyToggle = await PATCH(
			patchRequest({ pluginId: KNOWN_PLUGIN_ID, enabled: false })
		);
		expect(enabledOnlyToggle.status).toBe(200);

		const body = await (await GET()).json();
		expect(body.plugins[0]).toMatchObject({
			enabled: false,
			settings: { threshold: 0.8 },
		});
	});
});
