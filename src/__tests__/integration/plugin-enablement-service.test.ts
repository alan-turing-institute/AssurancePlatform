import { afterEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
	assertPluginEnabledForUser,
	isPluginEnabledForUser,
	resolveEffectivePluginState,
	setPluginEnabledForUser,
} from "@/lib/services/plugin-enablement-service";
import { expectError, expectSuccess } from "../utils/assertion-helpers";
import {
	createTestPluginState,
	createTestUser,
} from "../utils/prisma-factories";

const KNOWN_PLUGIN_ID = "tea.health";
const UNKNOWN_PLUGIN_ID = "tea.does-not-exist";
const NOT_ENABLED_PATTERN = /is not enabled/;
const UNKNOWN_PLUGIN_PATTERN = /Unknown plugin/;

afterEach(() => {
	vi.unstubAllEnvs();
});

// ============================================
// Unknown plugin id — refuses before touching the DB at all
// ============================================

describe("resolveEffectivePluginState — unknown plugin id", () => {
	it("rejects a plugin id absent from the manifest", async () => {
		const user = await createTestUser();
		expectError(
			await resolveEffectivePluginState(UNKNOWN_PLUGIN_ID, { userId: user.id }),
			UNKNOWN_PLUGIN_PATTERN
		);
	});
});

// ============================================
// Deployment availability
// ============================================

describe("resolveEffectivePluginState — deployment availability", () => {
	it("is enabled by default with no TEA_PLUGINS_DISABLED configured", async () => {
		const user = await createTestUser();
		const state = expectSuccess(
			await resolveEffectivePluginState(KNOWN_PLUGIN_ID, { userId: user.id })
		);
		expect(state.enabled).toBe(true);
		expect(state.availableAtDeployment).toBe(true);
		expect(state.disabledAt).toBeNull();
	});

	it("is disabled when withheld via TEA_PLUGINS_DISABLED, regardless of any user-level row", async () => {
		const user = await createTestUser();
		await createTestPluginState(user.id, {
			pluginId: KNOWN_PLUGIN_ID,
			scopeType: "USER",
			enabled: true,
		});
		vi.stubEnv("TEA_PLUGINS_DISABLED", KNOWN_PLUGIN_ID);

		const state = expectSuccess(
			await resolveEffectivePluginState(KNOWN_PLUGIN_ID, { userId: user.id })
		);
		expect(state.enabled).toBe(false);
		expect(state.availableAtDeployment).toBe(false);
		expect(state.disabledAt).toBe("DEPLOYMENT");
	});

	it("ignores an unrelated plugin id in TEA_PLUGINS_DISABLED", async () => {
		const user = await createTestUser();
		vi.stubEnv("TEA_PLUGINS_DISABLED", "tea.techniques, tea.gsn-ui");

		const state = expectSuccess(
			await resolveEffectivePluginState(KNOWN_PLUGIN_ID, { userId: user.id })
		);
		expect(state.enabled).toBe(true);
	});
});

// ============================================
// Effective-state matrix — user tier
// ============================================

describe("resolveEffectivePluginState — user tier", () => {
	it("is ON with no PluginState row at all (available + no rows = enabled)", async () => {
		const user = await createTestUser();
		const state = expectSuccess(
			await resolveEffectivePluginState(KNOWN_PLUGIN_ID, { userId: user.id })
		);
		expect(state.enabled).toBe(true);
	});

	it("is OFF when the user has an explicit disabling row", async () => {
		const user = await createTestUser();
		await createTestPluginState(user.id, {
			pluginId: KNOWN_PLUGIN_ID,
			scopeType: "USER",
			enabled: false,
		});

		const state = expectSuccess(
			await resolveEffectivePluginState(KNOWN_PLUGIN_ID, { userId: user.id })
		);
		expect(state.enabled).toBe(false);
		expect(state.disabledAt).toBe("USER");
	});

	it("is ON when the user has an explicit enabling row", async () => {
		const user = await createTestUser();
		await createTestPluginState(user.id, {
			pluginId: KNOWN_PLUGIN_ID,
			scopeType: "USER",
			enabled: true,
		});

		const state = expectSuccess(
			await resolveEffectivePluginState(KNOWN_PLUGIN_ID, { userId: user.id })
		);
		expect(state.enabled).toBe(true);
	});

	it("does not let one user's disabling row affect another user", async () => {
		const disabledUser = await createTestUser();
		const otherUser = await createTestUser();
		await createTestPluginState(disabledUser.id, {
			pluginId: KNOWN_PLUGIN_ID,
			scopeType: "USER",
			enabled: false,
		});

		const state = expectSuccess(
			await resolveEffectivePluginState(KNOWN_PLUGIN_ID, {
				userId: otherUser.id,
			})
		);
		expect(state.enabled).toBe(true);
	});

	it("does not let a different plugin's disabling row affect this plugin", async () => {
		const user = await createTestUser();
		await createTestPluginState(user.id, {
			pluginId: "tea.other-namespace",
			scopeType: "USER",
			enabled: false,
		});

		const state = expectSuccess(
			await resolveEffectivePluginState(KNOWN_PLUGIN_ID, { userId: user.id })
		);
		expect(state.enabled).toBe(true);
	});
});

// ============================================
// Full chain — future tiers, proven ready even though 1.0 never supplies
// them from a real caller (no organisation model; team derivation deferred)
// ============================================

describe("resolveEffectivePluginState — full ORGANISATION -> TEAM -> USER chain", () => {
	it("is OFF when the organisation tier is off, even though the user tier is explicitly ON (off wins downward)", async () => {
		const user = await createTestUser();
		const organisationId = "00000000-0000-4000-8000-0000000000f1";
		await createTestPluginState(organisationId, {
			pluginId: KNOWN_PLUGIN_ID,
			scopeType: "ORGANISATION",
			enabled: false,
		});
		await createTestPluginState(user.id, {
			pluginId: KNOWN_PLUGIN_ID,
			scopeType: "USER",
			enabled: true,
		});

		const state = expectSuccess(
			await resolveEffectivePluginState(KNOWN_PLUGIN_ID, {
				organisationId,
				userId: user.id,
			})
		);
		expect(state.enabled).toBe(false);
		expect(state.disabledAt).toBe("ORGANISATION");
	});

	it("is OFF when any one of several team ids is off, even with the user tier ON", async () => {
		const user = await createTestUser();
		const teamIdOn = "00000000-0000-4000-8000-0000000000f2";
		const teamIdOff = "00000000-0000-4000-8000-0000000000f3";
		await createTestPluginState(teamIdOn, {
			pluginId: KNOWN_PLUGIN_ID,
			scopeType: "TEAM",
			enabled: true,
		});
		await createTestPluginState(teamIdOff, {
			pluginId: KNOWN_PLUGIN_ID,
			scopeType: "TEAM",
			enabled: false,
		});
		await createTestPluginState(user.id, {
			pluginId: KNOWN_PLUGIN_ID,
			scopeType: "USER",
			enabled: true,
		});

		const state = expectSuccess(
			await resolveEffectivePluginState(KNOWN_PLUGIN_ID, {
				teamIds: [teamIdOn, teamIdOff],
				userId: user.id,
			})
		);
		expect(state.enabled).toBe(false);
		expect(state.disabledAt).toBe("TEAM");
	});

	it("lets the user turn a plugin off for themselves even where the organisation/team have it on (never the reverse)", async () => {
		const user = await createTestUser();
		const organisationId = "00000000-0000-4000-8000-0000000000f4";
		const teamId = "00000000-0000-4000-8000-0000000000f5";
		await createTestPluginState(organisationId, {
			pluginId: KNOWN_PLUGIN_ID,
			scopeType: "ORGANISATION",
			enabled: true,
		});
		await createTestPluginState(teamId, {
			pluginId: KNOWN_PLUGIN_ID,
			scopeType: "TEAM",
			enabled: true,
		});
		await createTestPluginState(user.id, {
			pluginId: KNOWN_PLUGIN_ID,
			scopeType: "USER",
			enabled: false,
		});

		const state = expectSuccess(
			await resolveEffectivePluginState(KNOWN_PLUGIN_ID, {
				organisationId,
				teamIds: [teamId],
				userId: user.id,
			})
		);
		expect(state.enabled).toBe(false);
		expect(state.disabledAt).toBe("USER");
	});

	it("future-tier rows sit present-but-inactive when a 1.0 caller omits organisationId/teamIds", async () => {
		const user = await createTestUser();
		// A row exists at ORGANISATION scope for an id that would, in a
		// future organisation-aware caller, apply to this user — but no
		// 1.0 call site can derive an organisationId yet, so a caller that
		// (correctly, for 1.0) omits it never has this row applied.
		const organisationId = "00000000-0000-4000-8000-0000000000f6";
		await createTestPluginState(organisationId, {
			pluginId: KNOWN_PLUGIN_ID,
			scopeType: "ORGANISATION",
			enabled: false,
		});

		const state = expectSuccess(
			await resolveEffectivePluginState(KNOWN_PLUGIN_ID, { userId: user.id })
		);
		expect(state.enabled).toBe(true);
		expect(state.disabledAt).toBeNull();
	});

	it("a disabling TEAM row for a team outside the caller's teamIds sits present-but-inactive (ORGANISATION twin above)", async () => {
		const user = await createTestUser();
		// The caller belongs to `memberTeamId` only — `otherTeamId`'s
		// disabling row is for a team this caller isn't in, so it must have
		// no effect on the resolved state (mirrors the ORGANISATION
		// present-but-inactive test above at the TEAM tier).
		const memberTeamId = "00000000-0000-4000-8000-0000000000f7";
		const otherTeamId = "00000000-0000-4000-8000-0000000000f8";
		await createTestPluginState(otherTeamId, {
			pluginId: KNOWN_PLUGIN_ID,
			scopeType: "TEAM",
			enabled: false,
		});

		const state = expectSuccess(
			await resolveEffectivePluginState(KNOWN_PLUGIN_ID, {
				teamIds: [memberTeamId],
				userId: user.id,
			})
		);
		expect(state.enabled).toBe(true);
		expect(state.disabledAt).toBeNull();
	});
});

// ============================================
// assertPluginEnabledForUser / isPluginEnabledForUser — the guard future
// plugin routes call directly (work item 4)
// ============================================

describe("assertPluginEnabledForUser", () => {
	it("succeeds when the plugin is enabled", async () => {
		const user = await createTestUser();
		expectSuccess(await assertPluginEnabledForUser(KNOWN_PLUGIN_ID, user.id));
	});

	it("fails with a clear message when the plugin is off for the user", async () => {
		const user = await createTestUser();
		await createTestPluginState(user.id, {
			pluginId: KNOWN_PLUGIN_ID,
			scopeType: "USER",
			enabled: false,
		});

		expectError(
			await assertPluginEnabledForUser(KNOWN_PLUGIN_ID, user.id),
			NOT_ENABLED_PATTERN
		);
	});

	it("passes through the unknown-plugin error unchanged", async () => {
		const user = await createTestUser();
		expectError(
			await assertPluginEnabledForUser(UNKNOWN_PLUGIN_ID, user.id),
			UNKNOWN_PLUGIN_PATTERN
		);
	});
});

describe("isPluginEnabledForUser", () => {
	it("returns true when enabled, false when disabled — no throw either way", async () => {
		const user = await createTestUser();
		expect(await isPluginEnabledForUser(KNOWN_PLUGIN_ID, user.id)).toBe(true);

		await createTestPluginState(user.id, {
			pluginId: KNOWN_PLUGIN_ID,
			scopeType: "USER",
			enabled: false,
		});
		expect(await isPluginEnabledForUser(KNOWN_PLUGIN_ID, user.id)).toBe(false);
	});

	it("returns false for an unknown plugin id rather than throwing", async () => {
		const user = await createTestUser();
		expect(await isPluginEnabledForUser(UNKNOWN_PLUGIN_ID, user.id)).toBe(
			false
		);
	});
});

// ============================================
// setPluginEnabledForUser — the only writable tier in 1.0
// ============================================

describe("setPluginEnabledForUser", () => {
	it("creates a USER-scope row on first call", async () => {
		const user = await createTestUser();
		const state = expectSuccess(
			await setPluginEnabledForUser(KNOWN_PLUGIN_ID, user.id, {
				enabled: false,
			})
		);
		expect(state.scopeType).toBe("USER");
		expect(state.scopeId).toBe(user.id);
		expect(state.enabled).toBe(false);
	});

	it("upserts (toggling) rather than creating a duplicate row", async () => {
		const user = await createTestUser();
		await setPluginEnabledForUser(KNOWN_PLUGIN_ID, user.id, { enabled: false });
		await setPluginEnabledForUser(KNOWN_PLUGIN_ID, user.id, { enabled: true });

		const rows = await prisma.pluginState.findMany({
			where: { pluginId: KNOWN_PLUGIN_ID, scopeType: "USER", scopeId: user.id },
		});
		expect(rows).toHaveLength(1);
		expect(rows[0]!.enabled).toBe(true);
	});

	it("persists settings JSON alongside the toggle", async () => {
		const user = await createTestUser();
		const state = expectSuccess(
			await setPluginEnabledForUser(KNOWN_PLUGIN_ID, user.id, {
				enabled: true,
				settings: { threshold: 0.8 },
			})
		);
		expect(state.settings).toEqual({ threshold: 0.8 });
	});

	it("does not wipe settings when a later call only toggles enabled (guards against a future `?? null` regression)", async () => {
		const user = await createTestUser();
		await setPluginEnabledForUser(KNOWN_PLUGIN_ID, user.id, {
			enabled: true,
			settings: { threshold: 0.8 },
		});

		const state = expectSuccess(
			await setPluginEnabledForUser(KNOWN_PLUGIN_ID, user.id, {
				enabled: false,
			})
		);
		expect(state.enabled).toBe(false);
		expect(state.settings).toEqual({ threshold: 0.8 });
	});

	it("rejects an unknown plugin id — nothing persisted", async () => {
		const user = await createTestUser();
		expectError(
			await setPluginEnabledForUser(UNKNOWN_PLUGIN_ID, user.id, {
				enabled: false,
			}),
			UNKNOWN_PLUGIN_PATTERN
		);

		const rows = await prisma.pluginState.findMany({
			where: { pluginId: UNKNOWN_PLUGIN_ID },
		});
		expect(rows).toHaveLength(0);
	});

	it("takes effect immediately through resolveEffectivePluginState", async () => {
		const user = await createTestUser();
		expectSuccess(
			await setPluginEnabledForUser(KNOWN_PLUGIN_ID, user.id, {
				enabled: false,
			})
		);

		const state = expectSuccess(
			await resolveEffectivePluginState(KNOWN_PLUGIN_ID, { userId: user.id })
		);
		expect(state.enabled).toBe(false);
	});
});
