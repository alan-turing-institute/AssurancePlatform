import { afterEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
	assertModelPluginEnabled,
	assertPluginEnabledForUser,
	resolveEffectivePluginState,
	setPluginEnabledForUser,
} from "@/lib/services/plugin-enablement-service";
import { deleteAccount } from "@/lib/services/user-management-service";
import { expectError, expectSuccess } from "../utils/assertion-helpers";
import {
	createTestCase,
	createTestIntegrationWithSystemUser,
	createTestPluginState,
	createTestUser,
} from "../utils/prisma-factories";

// The account that inherits a deleted person's cases; it is a system user
// but belongs to no integration.
const FALLBACK_ACCOUNT_EMAIL = "system@tea-platform.internal";
const HEALTH = "tea.health";
const ASSISTANT = "tea.assistant";
const ORGANISATION_ID = "00000000-0000-4000-8000-0000000000a1";
const TEAM_ID = "00000000-0000-4000-8000-0000000000a2";
const NOT_ENABLED_PATTERN = /is not enabled/;
const NO_MODEL_PLUGIN_PATTERN = /No plugin that uses models is enabled/;

afterEach(() => {
	vi.unstubAllEnvs();
});

async function stateFor(
	pluginId: string,
	userId: string,
	chain: { organisationId?: string; teamIds?: string[] } = {}
) {
	return expectSuccess(
		await resolveEffectivePluginState(pluginId, { userId, ...chain })
	);
}

/** An integration's machine account, whose owner has made no choice about Health. */
async function createMachineAccount() {
	const owner = await createTestUser();
	const { systemUser } = await createTestIntegrationWithSystemUser(owner.id);
	return { owner, machineId: systemUser.id };
}

/** The fallback account, made the way a real deletion makes it. */
async function createFallbackAccount() {
	const leaver = await createTestUser({ authProvider: "GITHUB" });
	await createTestCase(leaver.id);
	expectSuccess(await deleteAccount(leaver.id));
	return await prisma.user.findFirstOrThrow({
		where: { email: FALLBACK_ACCOUNT_EMAIL },
	});
}

describe("Claim/Evidence Health — a person starts with it off", () => {
	it("is off for a person who has never chosen", async () => {
		const person = await createTestUser();

		const state = await stateFor(HEALTH, person.id);

		expect(state.enabled).toBe(false);
		expect(state.availableAtDeployment).toBe(true);
		expect(state.disabledAt).toBe("USER");
		expectError(
			await assertPluginEnabledForUser(HEALTH, person.id),
			NOT_ENABLED_PATTERN
		);
	});

	it("is on for a person whose own row turns it on, and off again when they turn it off", async () => {
		const person = await createTestUser();
		expectSuccess(
			await setPluginEnabledForUser(HEALTH, person.id, { enabled: true })
		);
		expect((await stateFor(HEALTH, person.id)).enabled).toBe(true);

		expectSuccess(
			await setPluginEnabledForUser(HEALTH, person.id, { enabled: false })
		);
		const state = await stateFor(HEALTH, person.id);
		expect(state.enabled).toBe(false);
		expect(state.disabledAt).toBe("USER");
	});

	it("stays off for a person whose own row is off, even where the organisation and team rows are on", async () => {
		const person = await createTestUser();
		await createTestPluginState(ORGANISATION_ID, {
			pluginId: HEALTH,
			scopeType: "ORGANISATION",
			enabled: true,
		});
		await createTestPluginState(TEAM_ID, {
			pluginId: HEALTH,
			scopeType: "TEAM",
			enabled: true,
		});
		await createTestPluginState(person.id, {
			pluginId: HEALTH,
			scopeType: "USER",
			enabled: false,
		});

		const state = await stateFor(HEALTH, person.id, {
			organisationId: ORGANISATION_ID,
			teamIds: [TEAM_ID],
		});

		expect(state.enabled).toBe(false);
		expect(state.disabledAt).toBe("USER");
	});

	it("is not switched on by an organisation or team row that is on", async () => {
		const person = await createTestUser();
		await createTestPluginState(ORGANISATION_ID, {
			pluginId: HEALTH,
			scopeType: "ORGANISATION",
			enabled: true,
		});
		await createTestPluginState(TEAM_ID, {
			pluginId: HEALTH,
			scopeType: "TEAM",
			enabled: true,
		});

		const state = await stateFor(HEALTH, person.id, {
			organisationId: ORGANISATION_ID,
			teamIds: [TEAM_ID],
		});

		expect(state.enabled).toBe(false);
	});
});

describe("Claim/Evidence Health — an integration's machine account", () => {
	it("is on without any row, whatever its owner has chosen", async () => {
		const { owner, machineId } = await createMachineAccount();
		await createTestPluginState(owner.id, {
			pluginId: HEALTH,
			scopeType: "USER",
			enabled: false,
		});

		const state = await stateFor(HEALTH, machineId);

		expect(state).toEqual({
			enabled: true,
			availableAtDeployment: true,
			disabledAt: null,
		});
		expectSuccess(await assertPluginEnabledForUser(HEALTH, machineId));
	});

	it("is found through the transaction client it is given", async () => {
		const owner = await createTestUser();

		const state = await prisma.$transaction(async (tx) => {
			const machine = await tx.user.create({
				data: {
					email: `machine-${owner.id}@tea-platform.internal`,
					username: `machine-${owner.id}`,
					isSystemUser: true,
					authProvider: "SYSTEM",
				},
			});
			await tx.integration.create({
				data: {
					name: `in-transaction-${owner.id}`,
					ownerId: owner.id,
					systemUserId: machine.id,
					scopes: ["case:read"],
				},
			});
			return expectSuccess(
				await resolveEffectivePluginState(HEALTH, { userId: machine.id }, tx)
			);
		});

		expect(state.enabled).toBe(true);
	});

	it("does not make the integration's owner count as opted in", async () => {
		const { owner } = await createMachineAccount();

		expect((await stateFor(HEALTH, owner.id)).enabled).toBe(false);
	});

	it("is off when its own row turns Health off", async () => {
		const { machineId } = await createMachineAccount();
		await createTestPluginState(machineId, {
			pluginId: HEALTH,
			scopeType: "USER",
			enabled: false,
		});

		const state = await stateFor(HEALTH, machineId);

		expect(state.enabled).toBe(false);
		expect(state.disabledAt).toBe("USER");
	});

	it("is off when an organisation row turns Health off", async () => {
		const { machineId } = await createMachineAccount();
		await createTestPluginState(ORGANISATION_ID, {
			pluginId: HEALTH,
			scopeType: "ORGANISATION",
			enabled: false,
		});

		const state = await stateFor(HEALTH, machineId, {
			organisationId: ORGANISATION_ID,
		});

		expect(state.enabled).toBe(false);
		expect(state.disabledAt).toBe("ORGANISATION");
	});

	it("is off when a team row turns Health off", async () => {
		const { machineId } = await createMachineAccount();
		await createTestPluginState(TEAM_ID, {
			pluginId: HEALTH,
			scopeType: "TEAM",
			enabled: false,
		});

		const state = await stateFor(HEALTH, machineId, { teamIds: [TEAM_ID] });

		expect(state.enabled).toBe(false);
		expect(state.disabledAt).toBe("TEAM");
	});

	it("is off when the deployment withholds Health, even with a row that turns it on", async () => {
		const { machineId } = await createMachineAccount();
		await createTestPluginState(machineId, {
			pluginId: HEALTH,
			scopeType: "USER",
			enabled: true,
		});
		vi.stubEnv("TEA_PLUGINS_DISABLED", HEALTH);

		const state = await stateFor(HEALTH, machineId);

		expect(state.enabled).toBe(false);
		expect(state.availableAtDeployment).toBe(false);
		expect(state.disabledAt).toBe("DEPLOYMENT");
	});

	it("is off when the deployment withholds Health and the account has no row", async () => {
		const { machineId } = await createMachineAccount();
		vi.stubEnv("TEA_PLUGINS_DISABLED", HEALTH);

		expectError(
			await assertPluginEnabledForUser(HEALTH, machineId),
			NOT_ENABLED_PATTERN
		);
	});
});

describe("Claim/Evidence Health — the fallback account for deleted people's cases", () => {
	it("is a system user with no integration, and is off", async () => {
		const fallback = await createFallbackAccount();
		expect(fallback.isSystemUser).toBe(true);
		expect(
			await prisma.integration.count({ where: { systemUserId: fallback.id } })
		).toBe(0);

		const state = await stateFor(HEALTH, fallback.id);

		expect(state.enabled).toBe(false);
		expect(state.disabledAt).toBe("USER");
	});

	it("stays off while an integration's machine account is on", async () => {
		const { machineId } = await createMachineAccount();
		const fallback = await createFallbackAccount();

		expect((await stateFor(HEALTH, machineId)).enabled).toBe(true);
		expect((await stateFor(HEALTH, fallback.id)).enabled).toBe(false);
	});
});

describe("Case Assistant — stays off until chosen", () => {
	it("is off for a person who has never chosen, and Health being on does not change that", async () => {
		const person = await createTestUser();
		await createTestPluginState(person.id, {
			pluginId: HEALTH,
			scopeType: "USER",
			enabled: true,
		});

		const state = await stateFor(ASSISTANT, person.id);

		expect(state.enabled).toBe(false);
		expect(state.disabledAt).toBe("USER");
		expectError(
			await assertModelPluginEnabled(person.id),
			NO_MODEL_PLUGIN_PATTERN
		);
	});

	it("is on for a person whose own row turns it on", async () => {
		const person = await createTestUser();
		await createTestPluginState(person.id, {
			pluginId: ASSISTANT,
			scopeType: "USER",
			enabled: true,
		});

		expect((await stateFor(ASSISTANT, person.id)).enabled).toBe(true);
	});

	it("is not switched on for an integration's machine account", async () => {
		const { machineId } = await createMachineAccount();

		const state = await stateFor(ASSISTANT, machineId);

		expect(state.enabled).toBe(false);
		expectError(
			await assertModelPluginEnabled(machineId),
			NO_MODEL_PLUGIN_PATTERN
		);
	});
});
