import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import {
	attachElement,
	createElement,
	deleteElement,
	detachElement,
	getElement,
	getSandboxElements,
	restoreElement,
	updateElement,
} from "@/lib/services/element-service";
import { expectError, expectSuccess } from "../utils/assertion-helpers";
import {
	createTestCase,
	createTestPermission,
	createTestUser,
} from "../utils/prisma-factories";

const GOAL_NAME_PATTERN = /^G\d+$/;
const STRATEGY_NAME_PATTERN = /^S\d+$/;
const PARENT_DELETED_PATTERN = /parent element is deleted/;

describe("element-service", () => {
	describe("createElement", () => {
		it("creates a GOAL element (top-level) for the case owner", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);

			const data = expectSuccess(
				await createElement(user.id, {
					caseId: testCase.id,
					elementType: "goal",
				})
			);
			expect(data.type).toBe("goal");
			expect(data.assuranceCaseId).toBe(testCase.id);
			expect(data.name).toMatch(GOAL_NAME_PATTERN);

			// Verify the record exists in the database
			const inDb = await prisma.assuranceElement.findUnique({
				where: { id: data.id },
			});
			expect(inDb).not.toBeNull();
			expect(inDb?.caseId).toBe(testCase.id);
			expect(inDb?.elementType).toBe("GOAL");
		});

		it("creates a STRATEGY under a GOAL", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);

			const goal = expectSuccess(
				await createElement(user.id, {
					caseId: testCase.id,
					elementType: "goal",
				})
			);

			const data = expectSuccess(
				await createElement(user.id, {
					caseId: testCase.id,
					elementType: "strategy",
					parentId: goal.id,
				})
			);
			expect(data.type).toBe("strategy");
			expect(data.goalId).toBe(goal.id);
			expect(data.name).toMatch(STRATEGY_NAME_PATTERN);
		});

		it("creates a PROPERTY_CLAIM under a STRATEGY", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);

			const goal = expectSuccess(
				await createElement(user.id, {
					caseId: testCase.id,
					elementType: "goal",
				})
			);
			const strategy = expectSuccess(
				await createElement(user.id, {
					caseId: testCase.id,
					elementType: "strategy",
					parentId: goal.id,
				})
			);
			const data = expectSuccess(
				await createElement(user.id, {
					caseId: testCase.id,
					elementType: "property_claim",
					parentId: strategy.id,
				})
			);

			expect(data.type).toBe("property_claim");
			expect(data.strategyId).toBe(strategy.id);
		});

		it("creates EVIDENCE under a PROPERTY_CLAIM (via evidence link)", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);

			const goal = expectSuccess(
				await createElement(user.id, {
					caseId: testCase.id,
					elementType: "goal",
				})
			);
			const strategy = expectSuccess(
				await createElement(user.id, {
					caseId: testCase.id,
					elementType: "strategy",
					parentId: goal.id,
				})
			);
			const claim = expectSuccess(
				await createElement(user.id, {
					caseId: testCase.id,
					elementType: "property_claim",
					parentId: strategy.id,
				})
			);
			const data = expectSuccess(
				await createElement(user.id, {
					caseId: testCase.id,
					elementType: "evidence",
					parentId: claim.id,
				})
			);

			expect(data.type).toBe("evidence");
			expect(data.propertyClaimId).toContain(claim.id);
		});

		it("returns an error when a case already has a GOAL", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);

			await createElement(user.id, {
				caseId: testCase.id,
				elementType: "goal",
			});

			expectError(
				await createElement(user.id, {
					caseId: testCase.id,
					elementType: "goal",
				}),
				"A case can only have one goal claim"
			);
		});

		it("returns 'Permission denied' when user lacks EDIT permission", async () => {
			const owner = await createTestUser();
			const viewer = await createTestUser();
			const testCase = await createTestCase(owner.id);
			await createTestPermission(testCase.id, viewer.id, owner.id, "VIEW");

			expectError(
				await createElement(viewer.id, {
					caseId: testCase.id,
					elementType: "goal",
				}),
				"Permission denied"
			);
		});
	});

	describe("getElement", () => {
		it("returns element data for the case owner", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);
			const created = expectSuccess(
				await createElement(user.id, {
					caseId: testCase.id,
					elementType: "goal",
				})
			);

			const data = expectSuccess(await getElement(user.id, created.id));
			expect(data.id).toBe(created.id);
		});

		it("returns 'Element not found' for a non-member (anti-enumeration)", async () => {
			const owner = await createTestUser();
			const outsider = await createTestUser();
			const testCase = await createTestCase(owner.id);
			const created = expectSuccess(
				await createElement(owner.id, {
					caseId: testCase.id,
					elementType: "goal",
				})
			);

			expectError(
				await getElement(outsider.id, created.id),
				"Element not found"
			);
		});

		it("returns 'Element not found' for a deleted element", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);
			const created = expectSuccess(
				await createElement(user.id, {
					caseId: testCase.id,
					elementType: "goal",
				})
			);

			await deleteElement(user.id, created.id);

			expectError(await getElement(user.id, created.id), "Element not found");
		});
	});

	describe("updateElement", () => {
		it("updates the element description as owner", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);
			const created = expectSuccess(
				await createElement(user.id, {
					caseId: testCase.id,
					elementType: "goal",
				})
			);

			const data = expectSuccess(
				await updateElement(user.id, created.id, {
					description: "Updated description",
				})
			);
			expect(data.description).toBe("Updated description");
		});

		it("returns 'Element not found' for a VIEW-only user (anti-enumeration)", async () => {
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
					description: "Should fail",
				}),
				"Element not found"
			);
		});
	});

	describe("deleteElement", () => {
		it("soft-deletes the element (sets deletedAt)", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);
			const created = expectSuccess(
				await createElement(user.id, {
					caseId: testCase.id,
					elementType: "goal",
				})
			);

			expectSuccess(await deleteElement(user.id, created.id));

			const inDb = await prisma.assuranceElement.findUnique({
				where: { id: created.id },
			});
			expect(inDb?.deletedAt).not.toBeNull();
		});

		it("cascades soft-deletion to children across three levels (goal → strategy → claim)", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);

			const goal = expectSuccess(
				await createElement(user.id, {
					caseId: testCase.id,
					elementType: "goal",
				})
			);
			const strategy = expectSuccess(
				await createElement(user.id, {
					caseId: testCase.id,
					elementType: "strategy",
					parentId: goal.id,
				})
			);
			const claim = expectSuccess(
				await createElement(user.id, {
					caseId: testCase.id,
					elementType: "property_claim",
					parentId: strategy.id,
				})
			);

			// Deleting the root goal should cascade to strategy and claim
			await deleteElement(user.id, goal.id);

			const deletedStrategy = await prisma.assuranceElement.findUnique({
				where: { id: strategy.id },
			});
			expect(deletedStrategy?.deletedAt).not.toBeNull();

			const deletedClaim = await prisma.assuranceElement.findUnique({
				where: { id: claim.id },
			});
			expect(deletedClaim?.deletedAt).not.toBeNull();
		});

		it("returns 'Element not found' for a VIEW-only user (anti-enumeration)", async () => {
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
				await deleteElement(viewer.id, created.id),
				"Element not found"
			);
		});
	});

	describe("detachElement", () => {
		it("moves an element to the sandbox (clears parentId, sets inSandbox)", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);

			const goal = expectSuccess(
				await createElement(user.id, {
					caseId: testCase.id,
					elementType: "goal",
				})
			);
			const strategy = expectSuccess(
				await createElement(user.id, {
					caseId: testCase.id,
					elementType: "strategy",
					parentId: goal.id,
				})
			);

			expectSuccess(await detachElement(user.id, strategy.id));

			const inDb = await prisma.assuranceElement.findUnique({
				where: { id: strategy.id },
			});
			expect(inDb?.parentId).toBeNull();
			expect(inDb?.inSandbox).toBe(true);
		});

		it("returns 'Element not found' for a VIEW-only user (anti-enumeration)", async () => {
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
				await detachElement(viewer.id, created.id),
				"Element not found"
			);
		});
	});

	describe("attachElement", () => {
		it("restores parent and clears inSandbox for a sandboxed element", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);

			const goal = expectSuccess(
				await createElement(user.id, {
					caseId: testCase.id,
					elementType: "goal",
				})
			);
			const strategy = expectSuccess(
				await createElement(user.id, {
					caseId: testCase.id,
					elementType: "strategy",
					parentId: goal.id,
				})
			);

			await detachElement(user.id, strategy.id);

			expectSuccess(await attachElement(user.id, strategy.id, goal.id));

			const inDb = await prisma.assuranceElement.findUnique({
				where: { id: strategy.id },
			});
			expect(inDb?.parentId).toBe(goal.id);
			expect(inDb?.inSandbox).toBe(false);
		});

		it("returns an error when trying to set an element as its own parent", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);

			const goal = expectSuccess(
				await createElement(user.id, {
					caseId: testCase.id,
					elementType: "goal",
				})
			);

			expectError(
				await attachElement(user.id, goal.id, goal.id),
				"Cannot set element as its own parent"
			);
		});
	});

	describe("restoreElement", () => {
		it("clears deletedAt on a soft-deleted element", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);

			const created = expectSuccess(
				await createElement(user.id, {
					caseId: testCase.id,
					elementType: "goal",
				})
			);
			await deleteElement(user.id, created.id);

			expectSuccess(await restoreElement(user.id, created.id));

			const inDb = await prisma.assuranceElement.findUnique({
				where: { id: created.id },
			});
			expect(inDb?.deletedAt).toBeNull();
		});

		it("returns an error when the parent is also deleted", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);

			const goal = expectSuccess(
				await createElement(user.id, {
					caseId: testCase.id,
					elementType: "goal",
				})
			);
			const strategy = expectSuccess(
				await createElement(user.id, {
					caseId: testCase.id,
					elementType: "strategy",
					parentId: goal.id,
				})
			);

			// Delete parent — cascades to child
			await deleteElement(user.id, goal.id);

			// Attempt to restore only the child (parent still deleted)
			const result = await restoreElement(user.id, strategy.id);
			expectError(result, PARENT_DELETED_PATTERN);
		});

		it("returns an error when the element is not deleted", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);

			const created = expectSuccess(
				await createElement(user.id, {
					caseId: testCase.id,
					elementType: "goal",
				})
			);

			expectError(
				await restoreElement(user.id, created.id),
				"Element is not deleted"
			);
		});
	});

	describe("getSandboxElements", () => {
		it("returns only detached (inSandbox) elements for the case", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);

			const goal = expectSuccess(
				await createElement(user.id, {
					caseId: testCase.id,
					elementType: "goal",
				})
			);
			const strategy = expectSuccess(
				await createElement(user.id, {
					caseId: testCase.id,
					elementType: "strategy",
					parentId: goal.id,
				})
			);

			await detachElement(user.id, strategy.id);

			const data = expectSuccess(
				await getSandboxElements(user.id, testCase.id)
			);
			expect(data).toHaveLength(1);
			expect(data[0]!.id).toBe(strategy.id);
			expect(data[0]!.inSandbox).toBe(true);
		});

		it("returns an empty array when no elements are in the sandbox", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);

			const data = expectSuccess(
				await getSandboxElements(user.id, testCase.id)
			);
			expect(data).toEqual([]);
		});

		it("returns 'Permission denied' for a non-member", async () => {
			const owner = await createTestUser();
			const outsider = await createTestUser();
			const testCase = await createTestCase(owner.id);

			expectError(
				await getSandboxElements(outsider.id, testCase.id),
				"Permission denied"
			);
		});
	});
});
