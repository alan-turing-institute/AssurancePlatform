import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { createElement, updateElement } from "@/lib/services/element-service";
import { expectError, expectSuccess } from "../utils/assertion-helpers";
import {
	createTestCase,
	createTestIntegrationWithSystemUser,
	createTestPermission,
	createTestUser,
} from "../utils/prisma-factories";

const PERMISSION_DENIED_PATTERN = /Permission denied/;

/**
 * ADR 0004 D3 write rule: assertionStatus is author-declared, machine-
 * derivable/proposable, never machine-overwritten. The permission matrix
 * here proves the rule at the SERVICE layer (element-service.ts), not just
 * at the route layer — case-level EDIT access alone is not a sufficient
 * gate, because an integration's system user can legitimately hold an EDIT
 * grant on a case (`grantIntegrationCaseAccess`) and would otherwise pass
 * `validateCaseAccess` identically to a human author.
 */
describe("assertionStatus write-rule permission matrix", () => {
	describe("author (human session) write path", () => {
		it("lets a case owner set assertionStatus via createElement", async () => {
			const owner = await createTestUser();
			const testCase = await createTestCase(owner.id);

			const data = expectSuccess(
				await createElement(owner.id, {
					caseId: testCase.id,
					elementType: "goal",
					assertionStatus: "NEEDS_SUPPORT",
				})
			);

			const inDb = await prisma.assuranceElement.findUnique({
				where: { id: data.id },
			});
			expect(inDb?.assertionStatus).toBe("NEEDS_SUPPORT");
		});

		it("lets a case owner set assertionStatus via updateElement", async () => {
			const owner = await createTestUser();
			const testCase = await createTestCase(owner.id);
			const created = expectSuccess(
				await createElement(owner.id, {
					caseId: testCase.id,
					elementType: "goal",
				})
			);

			const data = expectSuccess(
				await updateElement(owner.id, created.id, {
					assertionStatus: "DEFEATED",
				})
			);
			expect(data.assertionStatus).toBe("DEFEATED");

			const inDb = await prisma.assuranceElement.findUnique({
				where: { id: created.id },
			});
			expect(inDb?.assertionStatus).toBe("DEFEATED");
		});

		it("lets an EDIT-permission collaborator (not just the owner) set assertionStatus", async () => {
			const owner = await createTestUser();
			const collaborator = await createTestUser();
			const testCase = await createTestCase(owner.id);
			await createTestPermission(
				testCase.id,
				collaborator.id,
				owner.id,
				"EDIT"
			);
			const created = expectSuccess(
				await createElement(owner.id, {
					caseId: testCase.id,
					elementType: "goal",
				})
			);

			expectSuccess(
				await updateElement(collaborator.id, created.id, {
					assertionStatus: "ASSUMED",
				})
			);

			const inDb = await prisma.assuranceElement.findUnique({
				where: { id: created.id },
			});
			expect(inDb?.assertionStatus).toBe("ASSUMED");
		});

		it("returns 'Element not found' for a VIEW-only user attempting to set assertionStatus (anti-enumeration)", async () => {
			const owner = await createTestUser();
			const viewer = await createTestUser();
			const testCase = await createTestCase(owner.id);
			await createTestPermission(testCase.id, viewer.id, owner.id, "VIEW");
			const created = expectSuccess(
				await createElement(owner.id, {
					caseId: testCase.id,
					elementType: "goal",
				})
			);

			expectError(
				await updateElement(viewer.id, created.id, {
					assertionStatus: "DEFEATED",
				}),
				"Element not found"
			);

			const inDb = await prisma.assuranceElement.findUnique({
				where: { id: created.id },
			});
			expect(inDb?.assertionStatus).toBeNull();
		});
	});

	describe("machine/integration (system user) write path", () => {
		it("rejects a system user with case EDIT access setting assertionStatus via updateElement", async () => {
			const owner = await createTestUser();
			const { systemUser } = await createTestIntegrationWithSystemUser(
				owner.id
			);
			const testCase = await createTestCase(owner.id);
			// Simulates a real, sanctioned grant (grantIntegrationCaseAccess) —
			// the system user's case access is genuine EDIT, not a test artifact.
			await createTestPermission(testCase.id, systemUser.id, owner.id, "EDIT");
			const created = expectSuccess(
				await createElement(owner.id, {
					caseId: testCase.id,
					elementType: "goal",
				})
			);

			expectError(
				await updateElement(systemUser.id, created.id, {
					assertionStatus: "DEFEATED",
				}),
				PERMISSION_DENIED_PATTERN
			);

			const inDb = await prisma.assuranceElement.findUnique({
				where: { id: created.id },
			});
			expect(inDb?.assertionStatus).toBeNull();
		});

		it("rejects a system user with case EDIT access setting assertionStatus via createElement", async () => {
			const owner = await createTestUser();
			const { systemUser } = await createTestIntegrationWithSystemUser(
				owner.id
			);
			const testCase = await createTestCase(owner.id);
			await createTestPermission(testCase.id, systemUser.id, owner.id, "EDIT");
			// A GOAL already exists (created by the owner) so this exercises a
			// STRATEGY create rather than colliding with the one-goal-per-case rule.
			const goal = expectSuccess(
				await createElement(owner.id, {
					caseId: testCase.id,
					elementType: "goal",
				})
			);

			expectError(
				await createElement(systemUser.id, {
					caseId: testCase.id,
					elementType: "strategy",
					parentId: goal.id,
					assertionStatus: "ASSUMED",
				}),
				PERMISSION_DENIED_PATTERN
			);
		});

		it("still lets a system user with case EDIT access update OTHER fields (the guard is scoped to assertionStatus only)", async () => {
			const owner = await createTestUser();
			const { systemUser } = await createTestIntegrationWithSystemUser(
				owner.id
			);
			const testCase = await createTestCase(owner.id);
			await createTestPermission(testCase.id, systemUser.id, owner.id, "EDIT");
			const created = expectSuccess(
				await createElement(owner.id, {
					caseId: testCase.id,
					elementType: "goal",
				})
			);

			const data = expectSuccess(
				await updateElement(systemUser.id, created.id, {
					description: "Updated by the integration's system user",
				})
			);
			expect(data.description).toBe("Updated by the integration's system user");
		});

		it("rejects a system user with case EDIT access even when no other field is being changed", async () => {
			const owner = await createTestUser();
			const { systemUser } = await createTestIntegrationWithSystemUser(
				owner.id
			);
			const testCase = await createTestCase(owner.id);
			await createTestPermission(testCase.id, systemUser.id, owner.id, "EDIT");
			const created = expectSuccess(
				await createElement(owner.id, {
					caseId: testCase.id,
					elementType: "goal",
				})
			);

			expectError(
				await updateElement(systemUser.id, created.id, {
					assertionStatus: "AXIOMATIC",
				}),
				PERMISSION_DENIED_PATTERN
			);
		});
	});
});
