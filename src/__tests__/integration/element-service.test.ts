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
import {
	createTestCase,
	createTestPermission,
	createTestUser,
} from "../utils/prisma-factories";

const GOAL_NAME_PATTERN = /^G\d+$/;
const STRATEGY_NAME_PATTERN = /^S\d+$/;

describe("element-service", () => {
	describe("createElement", () => {
		it("creates a GOAL element (top-level) for the case owner", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);

			const result = await createElement(user.id, {
				caseId: testCase.id,
				elementType: "goal",
			});

			expect(result.error).toBeUndefined();
			expect(result.data).toBeDefined();
			expect(result.data?.type).toBe("TopLevelNormativeGoal");
			expect(result.data?.assurance_case_id).toBe(testCase.id);
			expect(result.data?.name).toMatch(GOAL_NAME_PATTERN);

			// Verify the record exists in the database
			const inDb = await prisma.assuranceElement.findUnique({
				where: { id: result.data!.id },
			});
			expect(inDb).not.toBeNull();
			expect(inDb?.caseId).toBe(testCase.id);
			expect(inDb?.elementType).toBe("GOAL");
		});

		it("creates a STRATEGY under a GOAL", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);

			const goal = await createElement(user.id, {
				caseId: testCase.id,
				elementType: "goal",
			});

			const strategy = await createElement(user.id, {
				caseId: testCase.id,
				elementType: "strategy",
				parentId: goal.data!.id,
			});

			expect(strategy.error).toBeUndefined();
			expect(strategy.data?.type).toBe("Strategy");
			expect(strategy.data?.goal_id).toBe(goal.data!.id);
			expect(strategy.data?.name).toMatch(STRATEGY_NAME_PATTERN);
		});

		it("creates a PROPERTY_CLAIM under a STRATEGY", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);

			const goal = await createElement(user.id, {
				caseId: testCase.id,
				elementType: "goal",
			});
			const strategy = await createElement(user.id, {
				caseId: testCase.id,
				elementType: "strategy",
				parentId: goal.data!.id,
			});
			const claim = await createElement(user.id, {
				caseId: testCase.id,
				elementType: "property_claim",
				parentId: strategy.data!.id,
			});

			expect(claim.error).toBeUndefined();
			expect(claim.data?.type).toBe("PropertyClaim");
			expect(claim.data?.strategy_id).toBe(strategy.data!.id);
		});

		it("creates EVIDENCE under a PROPERTY_CLAIM (via evidence link)", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);

			const goal = await createElement(user.id, {
				caseId: testCase.id,
				elementType: "goal",
			});
			const strategy = await createElement(user.id, {
				caseId: testCase.id,
				elementType: "strategy",
				parentId: goal.data!.id,
			});
			const claim = await createElement(user.id, {
				caseId: testCase.id,
				elementType: "property_claim",
				parentId: strategy.data!.id,
			});
			const evidence = await createElement(user.id, {
				caseId: testCase.id,
				elementType: "evidence",
				property_claim_id: claim.data!.id,
			});

			expect(evidence.error).toBeUndefined();
			expect(evidence.data?.type).toBe("Evidence");
			expect(evidence.data?.property_claim_id).toContain(claim.data!.id);
		});

		it("returns an error when a case already has a GOAL", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);

			await createElement(user.id, {
				caseId: testCase.id,
				elementType: "goal",
			});

			const second = await createElement(user.id, {
				caseId: testCase.id,
				elementType: "goal",
			});

			expect(second.error).toBe("A case can only have one goal claim");
		});

		it("returns 'Permission denied' when user lacks EDIT permission", async () => {
			const owner = await createTestUser();
			const viewer = await createTestUser();
			const testCase = await createTestCase(owner.id);
			await createTestPermission(testCase.id, viewer.id, owner.id, "VIEW");

			const result = await createElement(viewer.id, {
				caseId: testCase.id,
				elementType: "goal",
			});

			expect(result.error).toBe("Permission denied");
		});
	});

	describe("getElement", () => {
		it("returns element data for the case owner", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);
			const created = await createElement(user.id, {
				caseId: testCase.id,
				elementType: "goal",
			});

			const result = await getElement(user.id, created.data!.id);

			expect(result.error).toBeUndefined();
			expect(result.data!.id).toBe(created.data!.id);
		});

		it("returns 'Permission denied' for a non-member", async () => {
			const owner = await createTestUser();
			const outsider = await createTestUser();
			const testCase = await createTestCase(owner.id);
			const created = await createElement(owner.id, {
				caseId: testCase.id,
				elementType: "goal",
			});

			const result = await getElement(outsider.id, created.data!.id);

			expect(result.error).toBe("Permission denied");
		});

		it("returns 'Element not found' for a deleted element", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);
			const created = await createElement(user.id, {
				caseId: testCase.id,
				elementType: "goal",
			});

			await deleteElement(user.id, created.data!.id);

			const result = await getElement(user.id, created.data!.id);

			expect(result.error).toBe("Element not found");
		});
	});

	describe("updateElement", () => {
		it("updates the element description as owner", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);
			const created = await createElement(user.id, {
				caseId: testCase.id,
				elementType: "goal",
			});

			const result = await updateElement(user.id, created.data!.id, {
				description: "Updated description",
			});

			expect(result.error).toBeUndefined();
			expect(result.data?.short_description).toBe("Updated description");
		});

		it("returns 'Permission denied' for a VIEW-only user", async () => {
			const owner = await createTestUser();
			const viewer = await createTestUser();
			const testCase = await createTestCase(owner.id);
			await createTestPermission(testCase.id, viewer.id, owner.id, "VIEW");

			const created = await createElement(owner.id, {
				caseId: testCase.id,
				elementType: "goal",
			});

			const result = await updateElement(viewer.id, created.data!.id, {
				description: "Should fail",
			});

			expect(result.error).toBe("Permission denied");
		});
	});

	describe("deleteElement", () => {
		it("soft-deletes the element (sets deletedAt)", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);
			const created = await createElement(user.id, {
				caseId: testCase.id,
				elementType: "goal",
			});

			const result = await deleteElement(user.id, created.data!.id);

			expect(result.error).toBeUndefined();
			expect(result.success).toBe(true);

			const inDb = await prisma.assuranceElement.findUnique({
				where: { id: created.data!.id },
			});
			expect(inDb?.deletedAt).not.toBeNull();
		});

		it("cascades soft-deletion to children across three levels (goal → strategy → claim)", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);

			const goal = await createElement(user.id, {
				caseId: testCase.id,
				elementType: "goal",
			});
			const strategy = await createElement(user.id, {
				caseId: testCase.id,
				elementType: "strategy",
				parentId: goal.data!.id,
			});
			const claim = await createElement(user.id, {
				caseId: testCase.id,
				elementType: "property_claim",
				parentId: strategy.data!.id,
			});

			// Deleting the root goal should cascade to strategy and claim
			await deleteElement(user.id, goal.data!.id);

			const deletedStrategy = await prisma.assuranceElement.findUnique({
				where: { id: strategy.data!.id },
			});
			expect(deletedStrategy?.deletedAt).not.toBeNull();

			const deletedClaim = await prisma.assuranceElement.findUnique({
				where: { id: claim.data!.id },
			});
			expect(deletedClaim?.deletedAt).not.toBeNull();
		});

		it("returns 'Permission denied' for a VIEW-only user", async () => {
			const owner = await createTestUser();
			const viewer = await createTestUser();
			const testCase = await createTestCase(owner.id);
			await createTestPermission(testCase.id, viewer.id, owner.id, "VIEW");

			const created = await createElement(owner.id, {
				caseId: testCase.id,
				elementType: "goal",
			});

			const result = await deleteElement(viewer.id, created.data!.id);

			expect(result.error).toBe("Permission denied");
		});
	});

	describe("detachElement", () => {
		it("moves an element to the sandbox (clears parentId, sets inSandbox)", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);

			const goal = await createElement(user.id, {
				caseId: testCase.id,
				elementType: "goal",
			});
			const strategy = await createElement(user.id, {
				caseId: testCase.id,
				elementType: "strategy",
				parentId: goal.data!.id,
			});

			const result = await detachElement(user.id, strategy.data!.id);

			expect(result.error).toBeUndefined();
			expect(result.success).toBe(true);

			const inDb = await prisma.assuranceElement.findUnique({
				where: { id: strategy.data!.id },
			});
			expect(inDb?.parentId).toBeNull();
			expect(inDb?.inSandbox).toBe(true);
		});

		it("returns 'Permission denied' for a VIEW-only user", async () => {
			const owner = await createTestUser();
			const viewer = await createTestUser();
			const testCase = await createTestCase(owner.id);
			await createTestPermission(testCase.id, viewer.id, owner.id, "VIEW");

			const created = await createElement(owner.id, {
				caseId: testCase.id,
				elementType: "goal",
			});

			const result = await detachElement(viewer.id, created.data!.id);

			expect(result.error).toBe("Permission denied");
		});
	});

	describe("attachElement", () => {
		it("restores parent and clears inSandbox for a sandboxed element", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);

			const goal = await createElement(user.id, {
				caseId: testCase.id,
				elementType: "goal",
			});
			const strategy = await createElement(user.id, {
				caseId: testCase.id,
				elementType: "strategy",
				parentId: goal.data!.id,
			});

			await detachElement(user.id, strategy.data!.id);

			const attachResult = await attachElement(
				user.id,
				strategy.data!.id,
				goal.data!.id
			);

			expect(attachResult.error).toBeUndefined();
			expect(attachResult.success).toBe(true);

			const inDb = await prisma.assuranceElement.findUnique({
				where: { id: strategy.data!.id },
			});
			expect(inDb?.parentId).toBe(goal.data!.id);
			expect(inDb?.inSandbox).toBe(false);
		});

		it("returns an error when trying to set an element as its own parent", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);

			const goal = await createElement(user.id, {
				caseId: testCase.id,
				elementType: "goal",
			});

			const result = await attachElement(user.id, goal.data!.id, goal.data!.id);

			expect(result.error).toBe("Cannot set element as its own parent");
		});
	});

	describe("restoreElement", () => {
		it("clears deletedAt on a soft-deleted element", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);

			const created = await createElement(user.id, {
				caseId: testCase.id,
				elementType: "goal",
			});
			await deleteElement(user.id, created.data!.id);

			const result = await restoreElement(user.id, created.data!.id);

			expect(result.error).toBeUndefined();
			expect(result.success).toBe(true);

			const inDb = await prisma.assuranceElement.findUnique({
				where: { id: created.data!.id },
			});
			expect(inDb?.deletedAt).toBeNull();
		});

		it("returns an error when the parent is also deleted", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);

			const goal = await createElement(user.id, {
				caseId: testCase.id,
				elementType: "goal",
			});
			const strategy = await createElement(user.id, {
				caseId: testCase.id,
				elementType: "strategy",
				parentId: goal.data!.id,
			});

			// Delete parent — cascades to child
			await deleteElement(user.id, goal.data!.id);

			// Attempt to restore only the child (parent still deleted)
			const result = await restoreElement(user.id, strategy.data!.id);

			expect(result.error).toContain("parent element is deleted");
		});

		it("returns an error when the element is not deleted", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);

			const created = await createElement(user.id, {
				caseId: testCase.id,
				elementType: "goal",
			});

			const result = await restoreElement(user.id, created.data!.id);

			expect(result.error).toBe("Element is not deleted");
		});
	});

	describe("getSandboxElements", () => {
		it("returns only detached (inSandbox) elements for the case", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);

			const goal = await createElement(user.id, {
				caseId: testCase.id,
				elementType: "goal",
			});
			const strategy = await createElement(user.id, {
				caseId: testCase.id,
				elementType: "strategy",
				parentId: goal.data!.id,
			});

			await detachElement(user.id, strategy.data!.id);

			const result = await getSandboxElements(user.id, testCase.id);

			expect(result.error).toBeUndefined();
			expect(result.data).toHaveLength(1);
			expect(result.data?.[0].id).toBe(strategy.data!.id);
			expect(result.data?.[0].in_sandbox).toBe(true);
		});

		it("returns an empty array when no elements are in the sandbox", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);

			const result = await getSandboxElements(user.id, testCase.id);

			expect(result.error).toBeUndefined();
			expect(result.data).toEqual([]);
		});

		it("returns 'Permission denied' for a non-member", async () => {
			const owner = await createTestUser();
			const outsider = await createTestUser();
			const testCase = await createTestCase(owner.id);

			const result = await getSandboxElements(outsider.id, testCase.id);

			expect(result.error).toBe("Permission denied");
		});
	});
});
