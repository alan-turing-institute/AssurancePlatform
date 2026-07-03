import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { Prisma } from "@/src/generated/prisma";
import {
	createTestApiToken,
	createTestCase,
	createTestElement,
	createTestIntegration,
	createTestIntegrationWithSystemUser,
	createTestPluginData,
	createTestPluginState,
	createTestUser,
} from "../utils/prisma-factories";

/**
 * Asserts that a promise rejects with a Prisma constraint violation carrying
 * the given error code (P2002 = unique constraint, P2003 = foreign key
 * constraint). This is the repo's first raw-constraint test suite — copy
 * this helper's call pattern for future constraint tests rather than a bare
 * `.rejects.toThrow()`, which also passes for unrelated errors.
 */
async function expectPrismaErrorCode(
	promise: Promise<unknown>,
	code: "P2002" | "P2003"
): Promise<void> {
	const error = await promise.catch((caught: unknown) => caught);
	// biome-ignore lint/suspicious/noMisplacedAssertion: helper called from within it() blocks
	expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
	// biome-ignore lint/suspicious/noMisplacedAssertion: helper called from within it() blocks
	expect((error as Prisma.PrismaClientKnownRequestError).code).toBe(code);
}

// ============================================
// PluginData
// ============================================

describe("PluginData", () => {
	it("creates case-level plugin data (elementId null)", async () => {
		const user = await createTestUser();
		const testCase = await createTestCase(user.id);

		const record = await createTestPluginData(testCase.id, {
			pluginId: "tea.health",
			data: { score: 0.9 },
		});

		expect(record.caseId).toBe(testCase.id);
		expect(record.elementId).toBeNull();
		expect(record.data).toEqual({ score: 0.9 });
	});

	it("creates element-level plugin data", async () => {
		const user = await createTestUser();
		const testCase = await createTestCase(user.id);
		const element = await createTestElement(testCase.id, user.id);

		const record = await createTestPluginData(testCase.id, {
			pluginId: "tea.health",
			elementId: element.id,
		});

		expect(record.elementId).toBe(element.id);
	});

	it("rejects a duplicate (pluginId, caseId, elementId) combination", async () => {
		const user = await createTestUser();
		const testCase = await createTestCase(user.id);
		const element = await createTestElement(testCase.id, user.id);

		await createTestPluginData(testCase.id, {
			pluginId: "tea.health",
			elementId: element.id,
		});

		await expectPrismaErrorCode(
			createTestPluginData(testCase.id, {
				pluginId: "tea.health",
				elementId: element.id,
			}),
			"P2002"
		);
	});

	it("allows different pluginIds on the same case/element", async () => {
		const user = await createTestUser();
		const testCase = await createTestCase(user.id);
		const element = await createTestElement(testCase.id, user.id);

		await createTestPluginData(testCase.id, {
			pluginId: "tea.health",
			elementId: element.id,
		});

		await expect(
			createTestPluginData(testCase.id, {
				pluginId: "tea.techniques",
				elementId: element.id,
			})
		).resolves.toBeDefined();
	});

	it("rejects a duplicate case-level (pluginId, caseId) row with elementId null", async () => {
		const user = await createTestUser();
		const testCase = await createTestCase(user.id);

		await createTestPluginData(testCase.id, {
			pluginId: "tea.health",
		});

		await expectPrismaErrorCode(
			createTestPluginData(testCase.id, {
				pluginId: "tea.health",
			}),
			"P2002"
		);
	});

	it("allows one case-level row alongside element-level rows for the same (pluginId, caseId)", async () => {
		const user = await createTestUser();
		const testCase = await createTestCase(user.id);
		const elementA = await createTestElement(testCase.id, user.id);
		const elementB = await createTestElement(testCase.id, user.id);

		const caseLevel = await createTestPluginData(testCase.id, {
			pluginId: "tea.health",
		});
		const elementLevelA = await createTestPluginData(testCase.id, {
			pluginId: "tea.health",
			elementId: elementA.id,
		});
		const elementLevelB = await createTestPluginData(testCase.id, {
			pluginId: "tea.health",
			elementId: elementB.id,
		});

		expect(caseLevel.elementId).toBeNull();
		expect(elementLevelA.elementId).toBe(elementA.id);
		expect(elementLevelB.elementId).toBe(elementB.id);
	});

	it("cascades delete when the parent case is deleted", async () => {
		const user = await createTestUser();
		const testCase = await createTestCase(user.id);
		const record = await createTestPluginData(testCase.id, {
			pluginId: "tea.health",
		});

		await prisma.assuranceCase.delete({ where: { id: testCase.id } });

		const found = await prisma.pluginData.findUnique({
			where: { id: record.id },
		});
		expect(found).toBeNull();
	});

	it("cascades delete when the parent element is deleted", async () => {
		const user = await createTestUser();
		const testCase = await createTestCase(user.id);
		const element = await createTestElement(testCase.id, user.id);
		const record = await createTestPluginData(testCase.id, {
			pluginId: "tea.health",
			elementId: element.id,
		});

		await prisma.assuranceElement.delete({ where: { id: element.id } });

		const found = await prisma.pluginData.findUnique({
			where: { id: record.id },
		});
		expect(found).toBeNull();
	});
});

// ============================================
// PluginState
// ============================================

describe("PluginState", () => {
	it("creates a user-scoped enablement row", async () => {
		const user = await createTestUser();

		const state = await createTestPluginState(user.id, {
			pluginId: "tea.health",
			scopeType: "USER",
			enabled: false,
		});

		expect(state.scopeType).toBe("USER");
		expect(state.scopeId).toBe(user.id);
		expect(state.enabled).toBe(false);
		expect(state.settings).toBeNull();
	});

	it("rejects a duplicate (pluginId, scopeType, scopeId) combination", async () => {
		const user = await createTestUser();

		await createTestPluginState(user.id, { pluginId: "tea.health" });

		await expectPrismaErrorCode(
			createTestPluginState(user.id, { pluginId: "tea.health" }),
			"P2002"
		);
	});

	it("allows the same pluginId across different scope tiers for the same id", async () => {
		const user = await createTestUser();

		await createTestPluginState(user.id, {
			pluginId: "tea.health",
			scopeType: "USER",
		});

		await expect(
			createTestPluginState(user.id, {
				pluginId: "tea.health",
				scopeType: "TEAM",
			})
		).resolves.toBeDefined();
	});

	it("has no foreign key on scopeId — an arbitrary id is accepted", async () => {
		await expect(
			createTestPluginState("00000000-0000-4000-8000-000000000099", {
				pluginId: "tea.health",
				scopeType: "ORGANISATION",
			})
		).resolves.toBeDefined();
	});
});

// ============================================
// Integration
// ============================================

describe("Integration", () => {
	it("creates an integration owned by a human and acting through a system user", async () => {
		const owner = await createTestUser();

		const { integration, systemUser } =
			await createTestIntegrationWithSystemUser(owner.id, {
				name: "darter-evidence-pipeline",
				scopes: ["case:read", "evidence:write"],
			});

		expect(integration.ownerId).toBe(owner.id);
		expect(integration.systemUserId).toBe(systemUser.id);
		expect(integration.status).toBe("ACTIVE");
		expect(systemUser.isSystemUser).toBe(true);
	});

	it("creates an integration with a non-ACTIVE status", async () => {
		const owner = await createTestUser();
		const systemUser = await createTestUser();

		const integration = await createTestIntegration(owner.id, systemUser.id, {
			status: "SUSPENDED",
		});

		expect(integration.status).toBe("SUSPENDED");
	});

	it("defaults scopes to an empty array when omitted", async () => {
		const owner = await createTestUser();
		const systemUser = await createTestUser();

		// Bypasses createTestIntegration: the factory always supplies a
		// `scopes` default (`overrides.scopes ?? ["case:read"]`), which would
		// mask the DB-level `@default([])` this test exists to verify.
		const integration = await prisma.integration.create({
			data: {
				name: "scopes-default-integration",
				ownerId: owner.id,
				systemUserId: systemUser.id,
			},
		});

		expect(integration.scopes).toEqual([]);
	});

	it("rejects a duplicate integration name", async () => {
		const owner = await createTestUser();
		const systemUserA = await createTestUser();
		const systemUserB = await createTestUser();

		await createTestIntegration(owner.id, systemUserA.id, {
			name: "duplicate-name",
		});

		await expectPrismaErrorCode(
			createTestIntegration(owner.id, systemUserB.id, {
				name: "duplicate-name",
			}),
			"P2002"
		);
	});

	it("rejects reusing a systemUserId across two integrations", async () => {
		const owner = await createTestUser();
		const systemUser = await createTestUser();

		await createTestIntegration(owner.id, systemUser.id, {
			name: "integration-one",
		});

		await expectPrismaErrorCode(
			createTestIntegration(owner.id, systemUser.id, {
				name: "integration-two",
			}),
			"P2002"
		);
	});

	it("does not cascade when the owner User is deleted (no cascade by design)", async () => {
		const owner = await createTestUser();
		const systemUser = await createTestUser();
		await createTestIntegration(owner.id, systemUser.id);

		await expectPrismaErrorCode(
			prisma.user.delete({ where: { id: owner.id } }),
			"P2003"
		);
	});

	it("does not cascade when the system user is deleted (no cascade by design)", async () => {
		const owner = await createTestUser();
		const systemUser = await createTestUser();
		await createTestIntegration(owner.id, systemUser.id);

		await expectPrismaErrorCode(
			prisma.user.delete({ where: { id: systemUser.id } }),
			"P2003"
		);
	});
});

// ============================================
// ApiToken
// ============================================

describe("ApiToken", () => {
	it("creates a token for an integration", async () => {
		const owner = await createTestUser();
		const systemUser = await createTestUser();
		const integration = await createTestIntegration(owner.id, systemUser.id);

		const token = await createTestApiToken(integration.id, {
			tokenPrefix: "teap_abcd",
		});

		expect(token.integrationId).toBe(integration.id);
		expect(token.tokenPrefix).toBe("teap_abcd");
		expect(token.revokedAt).toBeNull();
	});

	it("rejects a duplicate tokenHash", async () => {
		const owner = await createTestUser();
		const systemUser = await createTestUser();
		const integration = await createTestIntegration(owner.id, systemUser.id);

		await createTestApiToken(integration.id, {
			tokenHash: "duplicate-hash",
		});

		await expectPrismaErrorCode(
			createTestApiToken(integration.id, { tokenHash: "duplicate-hash" }),
			"P2002"
		);
	});

	it("cascades delete when the parent integration is deleted", async () => {
		const owner = await createTestUser();
		const systemUser = await createTestUser();
		const integration = await createTestIntegration(owner.id, systemUser.id);
		const token = await createTestApiToken(integration.id);

		await prisma.integration.delete({ where: { id: integration.id } });

		const found = await prisma.apiToken.findUnique({
			where: { id: token.id },
		});
		expect(found).toBeNull();
	});
});
