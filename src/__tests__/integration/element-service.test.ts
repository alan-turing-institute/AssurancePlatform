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

			expect("error" in result).toBe(false);
			if ("error" in result) {
				return;
			}
			expect(result.data.type).toBe("goal");
			expect(result.data.assuranceCaseId).toBe(testCase.id);
			expect(result.data.name).toMatch(GOAL_NAME_PATTERN);

			// Verify the record exists in the database
			const inDb = await prisma.assuranceElement.findUnique({
				where: { id: result.data.id },
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
			if ("error" in goal) {
				throw new Error("Goal creation failed");
			}

			const strategy = await createElement(user.id, {
				caseId: testCase.id,
				elementType: "strategy",
				parentId: goal.data.id,
			});

			expect("error" in strategy).toBe(false);
			if ("error" in strategy) {
				return;
			}
			expect(strategy.data.type).toBe("strategy");
			expect(strategy.data.goalId).toBe(goal.data.id);
			expect(strategy.data.name).toMatch(STRATEGY_NAME_PATTERN);
		});

		it("creates a PROPERTY_CLAIM under a STRATEGY", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);

			const goal = await createElement(user.id, {
				caseId: testCase.id,
				elementType: "goal",
			});
			if ("error" in goal) {
				throw new Error("Goal creation failed");
			}
			const strategy = await createElement(user.id, {
				caseId: testCase.id,
				elementType: "strategy",
				parentId: goal.data.id,
			});
			if ("error" in strategy) {
				throw new Error("Strategy creation failed");
			}
			const claim = await createElement(user.id, {
				caseId: testCase.id,
				elementType: "property_claim",
				parentId: strategy.data.id,
			});

			expect("error" in claim).toBe(false);
			if ("error" in claim) {
				return;
			}
			expect(claim.data.type).toBe("property_claim");
			expect(claim.data.strategyId).toBe(strategy.data.id);
		});

		it("creates EVIDENCE under a PROPERTY_CLAIM (via evidence link)", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);

			const goal = await createElement(user.id, {
				caseId: testCase.id,
				elementType: "goal",
			});
			if ("error" in goal) {
				throw new Error("Goal creation failed");
			}
			const strategy = await createElement(user.id, {
				caseId: testCase.id,
				elementType: "strategy",
				parentId: goal.data.id,
			});
			if ("error" in strategy) {
				throw new Error("Strategy creation failed");
			}
			const claim = await createElement(user.id, {
				caseId: testCase.id,
				elementType: "property_claim",
				parentId: strategy.data.id,
			});
			if ("error" in claim) {
				throw new Error("Claim creation failed");
			}
			const evidence = await createElement(user.id, {
				caseId: testCase.id,
				elementType: "evidence",
				parentId: claim.data.id,
			});

			expect("error" in evidence).toBe(false);
			if ("error" in evidence) {
				return;
			}
			expect(evidence.data.type).toBe("evidence");
			expect(evidence.data.propertyClaimId).toContain(claim.data.id);
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

			expect("error" in second).toBe(true);
			if (!("error" in second)) {
				return;
			}
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

			expect("error" in result).toBe(true);
			if (!("error" in result)) {
				return;
			}
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
			if ("error" in created) {
				throw new Error("Element creation failed");
			}

			const result = await getElement(user.id, created.data.id);

			expect("error" in result).toBe(false);
			if ("error" in result) {
				return;
			}
			expect(result.data.id).toBe(created.data.id);
		});

		it("returns 'Permission denied' for a non-member", async () => {
			const owner = await createTestUser();
			const outsider = await createTestUser();
			const testCase = await createTestCase(owner.id);
			const created = await createElement(owner.id, {
				caseId: testCase.id,
				elementType: "goal",
			});
			if ("error" in created) {
				throw new Error("Element creation failed");
			}

			const result = await getElement(outsider.id, created.data.id);

			expect("error" in result).toBe(true);
			if (!("error" in result)) {
				return;
			}
			expect(result.error).toBe("Permission denied");
		});

		it("returns 'Element not found' for a deleted element", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);
			const created = await createElement(user.id, {
				caseId: testCase.id,
				elementType: "goal",
			});
			if ("error" in created) {
				throw new Error("Element creation failed");
			}

			await deleteElement(user.id, created.data.id);

			const result = await getElement(user.id, created.data.id);

			expect("error" in result).toBe(true);
			if (!("error" in result)) {
				return;
			}
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
			if ("error" in created) {
				throw new Error("Element creation failed");
			}

			const result = await updateElement(user.id, created.data.id, {
				description: "Updated description",
			});

			expect("error" in result).toBe(false);
			if ("error" in result) {
				return;
			}
			expect(result.data.description).toBe("Updated description");
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
			if ("error" in created) {
				throw new Error("Element creation failed");
			}

			const result = await updateElement(viewer.id, created.data.id, {
				description: "Should fail",
			});

			expect("error" in result).toBe(true);
			if (!("error" in result)) {
				return;
			}
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
			if ("error" in created) {
				throw new Error("Element creation failed");
			}

			const result = await deleteElement(user.id, created.data.id);

			expect("error" in result).toBe(false);

			const inDb = await prisma.assuranceElement.findUnique({
				where: { id: created.data.id },
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
			if ("error" in goal) {
				throw new Error("Goal creation failed");
			}
			const strategy = await createElement(user.id, {
				caseId: testCase.id,
				elementType: "strategy",
				parentId: goal.data.id,
			});
			if ("error" in strategy) {
				throw new Error("Strategy creation failed");
			}
			const claim = await createElement(user.id, {
				caseId: testCase.id,
				elementType: "property_claim",
				parentId: strategy.data.id,
			});
			if ("error" in claim) {
				throw new Error("Claim creation failed");
			}

			// Deleting the root goal should cascade to strategy and claim
			await deleteElement(user.id, goal.data.id);

			const deletedStrategy = await prisma.assuranceElement.findUnique({
				where: { id: strategy.data.id },
			});
			expect(deletedStrategy?.deletedAt).not.toBeNull();

			const deletedClaim = await prisma.assuranceElement.findUnique({
				where: { id: claim.data.id },
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
			if ("error" in created) {
				throw new Error("Element creation failed");
			}

			const result = await deleteElement(viewer.id, created.data.id);

			expect("error" in result).toBe(true);
			if (!("error" in result)) {
				return;
			}
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
			if ("error" in goal) {
				throw new Error("Goal creation failed");
			}
			const strategy = await createElement(user.id, {
				caseId: testCase.id,
				elementType: "strategy",
				parentId: goal.data.id,
			});
			if ("error" in strategy) {
				throw new Error("Strategy creation failed");
			}

			const result = await detachElement(user.id, strategy.data.id);

			expect("error" in result).toBe(false);

			const inDb = await prisma.assuranceElement.findUnique({
				where: { id: strategy.data.id },
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
			if ("error" in created) {
				throw new Error("Element creation failed");
			}

			const result = await detachElement(viewer.id, created.data.id);

			expect("error" in result).toBe(true);
			if (!("error" in result)) {
				return;
			}
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
			if ("error" in goal) {
				throw new Error("Goal creation failed");
			}
			const strategy = await createElement(user.id, {
				caseId: testCase.id,
				elementType: "strategy",
				parentId: goal.data.id,
			});
			if ("error" in strategy) {
				throw new Error("Strategy creation failed");
			}

			await detachElement(user.id, strategy.data.id);

			const attachResult = await attachElement(
				user.id,
				strategy.data.id,
				goal.data.id
			);

			expect("error" in attachResult).toBe(false);

			const inDb = await prisma.assuranceElement.findUnique({
				where: { id: strategy.data.id },
			});
			expect(inDb?.parentId).toBe(goal.data.id);
			expect(inDb?.inSandbox).toBe(false);
		});

		it("returns an error when trying to set an element as its own parent", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);

			const goal = await createElement(user.id, {
				caseId: testCase.id,
				elementType: "goal",
			});
			if ("error" in goal) {
				throw new Error("Goal creation failed");
			}

			const result = await attachElement(user.id, goal.data.id, goal.data.id);

			expect("error" in result).toBe(true);
			if (!("error" in result)) {
				return;
			}
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
			if ("error" in created) {
				throw new Error("Element creation failed");
			}
			await deleteElement(user.id, created.data.id);

			const result = await restoreElement(user.id, created.data.id);

			expect("error" in result).toBe(false);

			const inDb = await prisma.assuranceElement.findUnique({
				where: { id: created.data.id },
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
			if ("error" in goal) {
				throw new Error("Goal creation failed");
			}
			const strategy = await createElement(user.id, {
				caseId: testCase.id,
				elementType: "strategy",
				parentId: goal.data.id,
			});
			if ("error" in strategy) {
				throw new Error("Strategy creation failed");
			}

			// Delete parent — cascades to child
			await deleteElement(user.id, goal.data.id);

			// Attempt to restore only the child (parent still deleted)
			const result = await restoreElement(user.id, strategy.data.id);

			expect("error" in result).toBe(true);
			if (!("error" in result)) {
				return;
			}
			expect(result.error).toContain("parent element is deleted");
		});

		it("returns an error when the element is not deleted", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);

			const created = await createElement(user.id, {
				caseId: testCase.id,
				elementType: "goal",
			});
			if ("error" in created) {
				throw new Error("Element creation failed");
			}

			const result = await restoreElement(user.id, created.data.id);

			expect("error" in result).toBe(true);
			if (!("error" in result)) {
				return;
			}
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
			if ("error" in goal) {
				throw new Error("Goal creation failed");
			}
			const strategy = await createElement(user.id, {
				caseId: testCase.id,
				elementType: "strategy",
				parentId: goal.data.id,
			});
			if ("error" in strategy) {
				throw new Error("Strategy creation failed");
			}

			await detachElement(user.id, strategy.data.id);

			const result = await getSandboxElements(user.id, testCase.id);

			expect("error" in result).toBe(false);
			if ("error" in result) {
				return;
			}
			expect(result.data).toHaveLength(1);
			expect(result.data[0]!.id).toBe(strategy.data.id);
			expect(result.data[0]!.inSandbox).toBe(true);
		});

		it("returns an empty array when no elements are in the sandbox", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);

			const result = await getSandboxElements(user.id, testCase.id);

			expect("error" in result).toBe(false);
			if ("error" in result) {
				return;
			}
			expect(result.data).toEqual([]);
		});

		it("returns 'Permission denied' for a non-member", async () => {
			const owner = await createTestUser();
			const outsider = await createTestUser();
			const testCase = await createTestCase(owner.id);

			const result = await getSandboxElements(outsider.id, testCase.id);

			expect("error" in result).toBe(true);
			if (!("error" in result)) {
				return;
			}
			expect(result.error).toBe("Permission denied");
		});
	});
});
