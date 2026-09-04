import { afterEach, describe, expect, it } from "vitest";
import {
	registerPluginNamePatterns,
	resetPluginNamePatternsForTests,
} from "@/lib/element-names/prefix-registry";
import prisma from "@/lib/prisma";
import {
	attachElement,
	createElement,
	deleteElement,
	detachElement,
	getElement,
	getSandboxElements,
	moveElement,
	restoreElement,
	updateElement,
} from "@/lib/services/element-service";
import { setPluginEnabledForUser } from "@/lib/services/plugin-enablement-service";
import { expectError, expectSuccess } from "../utils/assertion-helpers";
import {
	createTestCase,
	createTestPermission,
	createTestUser,
} from "../utils/prisma-factories";

const GOAL_NAME_PATTERN = /^G\d+$/;
const STRATEGY_NAME_PATTERN = /^S\d+$/;
const EVIDENCE_NAME_PATTERN = /^E\d+$/;
const GSN_PATTERN = /^GSN\d+$/;
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

		describe("parent change", () => {
			it("detaches the element when parentId is set to null", async () => {
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

				expectSuccess(
					await updateElement(user.id, strategy.id, { parentId: null })
				);

				const inDb = await prisma.assuranceElement.findUnique({
					where: { id: strategy.id },
				});
				expect(inDb?.parentId).toBeNull();
			});

			it("returns 'Element not found' when the new parent doesn't exist or is in a different case, leaving the parent unchanged", async () => {
				const user = await createTestUser();
				const testCase = await createTestCase(user.id);
				const otherCase = await createTestCase(user.id);

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
				const otherGoal = expectSuccess(
					await createElement(user.id, {
						caseId: otherCase.id,
						elementType: "goal",
					})
				);

				// Non-existent parent id
				expectError(
					await updateElement(user.id, strategy.id, {
						parentId: "00000000-0000-0000-0000-000000000000",
					}),
					"Element not found"
				);

				// Parent id from a different case
				expectError(
					await updateElement(user.id, strategy.id, {
						parentId: otherGoal.id,
					}),
					"Element not found"
				);

				const inDb = await prisma.assuranceElement.findUnique({
					where: { id: strategy.id },
				});
				expect(inDb?.parentId).toBe(goal.id);
			});

			it("rejects moving an element under its own descendant", async () => {
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

				expectError(
					await updateElement(user.id, strategy.id, { parentId: claim.id }),
					"Cannot move element to one of its descendants"
				);

				const inDb = await prisma.assuranceElement.findUnique({
					where: { id: strategy.id },
				});
				expect(inDb?.parentId).toBe(goal.id);
			});

			it("moves a PROPERTY_CLAIM to a new PROPERTY_CLAIM parent and recalculates its level", async () => {
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
				// Top-level claim (parent is a strategy-under-goal) — level 1
				const movingClaim = expectSuccess(
					await createElement(user.id, {
						caseId: testCase.id,
						elementType: "property_claim",
						parentId: strategy.id,
					})
				);
				// Another top-level claim, to become the new parent — level 1
				const newParentClaim = expectSuccess(
					await createElement(user.id, {
						caseId: testCase.id,
						elementType: "property_claim",
						parentId: strategy.id,
					})
				);

				expectSuccess(
					await updateElement(user.id, movingClaim.id, {
						parentId: newParentClaim.id,
					})
				);

				const inDb = await prisma.assuranceElement.findUnique({
					where: { id: movingClaim.id },
				});
				expect(inDb?.parentId).toBe(newParentClaim.id);
				// calculateNewLevel: PROPERTY_CLAIM parent -> parent.level + 1
				expect(inDb?.level).toBe(2);
			});
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

	describe("strategy under property claim (transparent numbering)", () => {
		it("creates a STRATEGY under a PROPERTY_CLAIM", async () => {
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

			// Create a strategy under the property claim
			const nestedStrategy = expectSuccess(
				await createElement(user.id, {
					caseId: testCase.id,
					elementType: "strategy",
					parentId: claim.id,
				})
			);

			expect(nestedStrategy.type).toBe("strategy");
			expect(nestedStrategy.name).toMatch(STRATEGY_NAME_PATTERN);

			// Verify parentId in database
			const inDb = await prisma.assuranceElement.findUnique({
				where: { id: nestedStrategy.id },
			});
			expect(inDb?.parentId).toBe(claim.id);
		});

		it("numbers property claims under a strategy-under-property-claim as children of the ancestor claim", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);

			const goal = expectSuccess(
				await createElement(user.id, {
					caseId: testCase.id,
					elementType: "goal",
				})
			);
			const s1 = expectSuccess(
				await createElement(user.id, {
					caseId: testCase.id,
					elementType: "strategy",
					parentId: goal.id,
				})
			);
			const p1 = expectSuccess(
				await createElement(user.id, {
					caseId: testCase.id,
					elementType: "property_claim",
					parentId: s1.id,
				})
			);
			expect(p1.name).toBe("P1");

			// Create direct sub-claim P1.1
			const p1_1 = expectSuccess(
				await createElement(user.id, {
					caseId: testCase.id,
					elementType: "property_claim",
					parentId: p1.id,
				})
			);
			expect(p1_1.name).toBe("P1.1");

			// Create strategy S2 under P1
			const s2 = expectSuccess(
				await createElement(user.id, {
					caseId: testCase.id,
					elementType: "strategy",
					parentId: p1.id,
				})
			);
			expect(s2.name).toMatch(STRATEGY_NAME_PATTERN);

			// Create property claim under S2 — should be numbered as P1.2 (transparent)
			const p1_2 = expectSuccess(
				await createElement(user.id, {
					caseId: testCase.id,
					elementType: "property_claim",
					parentId: s2.id,
				})
			);
			expect(p1_2.name).toBe("P1.2");

			// Verify level is correct (same as direct sub-claims of P1)
			const inDb = await prisma.assuranceElement.findUnique({
				where: { id: p1_2.id },
			});
			expect(inDb?.level).toBe(2);
		});

		it("allows moving a strategy to a property claim parent", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);

			const goal = expectSuccess(
				await createElement(user.id, {
					caseId: testCase.id,
					elementType: "goal",
				})
			);
			// Create strategy under goal
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

			// Create a second strategy under goal
			const s2 = expectSuccess(
				await createElement(user.id, {
					caseId: testCase.id,
					elementType: "strategy",
					parentId: goal.id,
				})
			);

			// Move s2 to be under claim — should succeed
			const result = await moveElement(user.id, s2.id, claim.id);
			expect("data" in result).toBe(true);

			// Verify the parentId was updated
			const inDb = await prisma.assuranceElement.findUnique({
				where: { id: s2.id },
			});
			expect(inDb?.parentId).toBe(claim.id);
		});

		it("numbers claims under strategy-under-goal as top-level (no transparency)", async () => {
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

			// Property claims under strategy-under-goal should be top-level (P1, P2)
			const p1 = expectSuccess(
				await createElement(user.id, {
					caseId: testCase.id,
					elementType: "property_claim",
					parentId: strategy.id,
				})
			);
			expect(p1.name).toBe("P1");

			const p2 = expectSuccess(
				await createElement(user.id, {
					caseId: testCase.id,
					elementType: "property_claim",
					parentId: strategy.id,
				})
			);
			expect(p2.name).toBe("P2");
		});

		it("rejects moving a strategy under an evidence element", async () => {
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
			const evidence = expectSuccess(
				await createElement(user.id, {
					caseId: testCase.id,
					elementType: "evidence",
					parentId: claim.id,
				})
			);

			// Moving a strategy under evidence should fail
			expectError(
				await moveElement(user.id, strategy.id, evidence.id),
				"strategy cannot be a child of evidence"
			);
		});
	});

	/**
	 * Review send-back (TEA — Element Name Prefix Validation): the batch
	 * path's name-format enforcement was pinned
	 * (case-batch-update-service.test.ts), but `enforceElementNameFormat`'s
	 * two call sites here — `createElement` and `updateElement` — had zero
	 * coverage of their own. These pin the single-element route's service
	 * layer directly: rejection with the expected-format message, a
	 * left-unchanged rename, the plugin override seam honoured only when
	 * enabled, optionality (null/empty pass), and case-sensitivity.
	 */
	describe("name-format validation (TEA-syntax prefix)", () => {
		it("createElement rejects a non-conforming name with the type's expected-format message", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);

			expectError(
				await createElement(user.id, {
					caseId: testCase.id,
					elementType: "goal",
					name: "Not A Conforming Name",
				}),
				"Goal names must look like G1 or G1.1"
			);

			const elements = await prisma.assuranceElement.findMany({
				where: { caseId: testCase.id },
			});
			expect(elements).toHaveLength(0);
		});

		it("updateElement rejects a non-conforming rename, leaving the stored name unchanged", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);
			const claim = expectSuccess(
				await createElement(user.id, {
					caseId: testCase.id,
					elementType: "property_claim",
					name: "P1",
				})
			);

			expectError(
				await updateElement(user.id, claim.id, { name: "Renamed Freely" }),
				"Property Claim names must look like P1 or P1.1"
			);

			const unchanged = await prisma.assuranceElement.findUnique({
				where: { id: claim.id },
			});
			expect(unchanged?.name).toBe("P1");
		});

		it("rejects a lowercase name even when the letters and digits otherwise match (case-sensitive)", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);

			expectError(
				await createElement(user.id, {
					caseId: testCase.id,
					elementType: "goal",
					name: "g1",
				}),
				"Goal names must look like G1 or G1.1"
			);
		});

		it("treats an explicit null name the same as omitting it — falls back to auto-generation", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);

			// `name: null` bypasses createElementSchema's optionalString
			// transform (which collapses null to `undefined` before the
			// service ever sees it) — cast to simulate a hand-built payload
			// that skips schema validation, so this proves the SERVICE layer
			// itself (not just the schema) treats null as "no name given".
			const data = expectSuccess(
				await createElement(user.id, {
					caseId: testCase.id,
					elementType: "evidence",
					name: null,
				} as unknown as Parameters<typeof createElement>[1])
			);
			expect(data.name).toMatch(EVIDENCE_NAME_PATTERN);
		});

		it("treats an explicit empty-string name the same as omitting it — falls back to auto-generation", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);

			const data = expectSuccess(
				await createElement(user.id, {
					caseId: testCase.id,
					elementType: "evidence",
					name: "",
				})
			);
			expect(data.name).toMatch(EVIDENCE_NAME_PATTERN);
		});

		it("updateElement leaves the stored name untouched when the input omits name entirely", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);
			const goal = expectSuccess(
				await createElement(user.id, {
					caseId: testCase.id,
					elementType: "goal",
					name: "G1",
				})
			);

			const data = expectSuccess(
				await updateElement(user.id, goal.id, {
					description: "Only the description changes",
				})
			);
			expect(data.name).toBe("G1");
		});

		/**
		 * The plugin override seam (lib/element-names/prefix-registry.ts):
		 * an additional pattern is only honoured for a user with that plugin
		 * enabled. No shipped plugin registers a pattern yet, so this
		 * registers a throwaway one under the one real manifest entry
		 * (`tea.health`) rather than inventing an unregistered plugin id —
		 * `getEnabledPluginIdsForUser` only ever resolves ids the manifest
		 * knows, so a made-up id could never appear "enabled" no matter what
		 * `PluginState` said.
		 */
		describe("plugin override seam", () => {
			afterEach(() => {
				resetPluginNamePatternsForTests();
			});

			it("honours a plugin-registered pattern for a user with the plugin enabled (the default)", async () => {
				registerPluginNamePatterns("tea.health", "GOAL", GSN_PATTERN);
				const user = await createTestUser();
				const testCase = await createTestCase(user.id);

				const data = expectSuccess(
					await createElement(user.id, {
						caseId: testCase.id,
						elementType: "goal",
						name: "GSN1",
					})
				);
				expect(data.name).toBe("GSN1");
			});

			it("rejects the same plugin-format name once the plugin is disabled for that user", async () => {
				registerPluginNamePatterns("tea.health", "GOAL", GSN_PATTERN);
				const user = await createTestUser();
				const testCase = await createTestCase(user.id);
				const disableResult = await setPluginEnabledForUser(
					"tea.health",
					user.id,
					{ enabled: false }
				);
				expect("data" in disableResult).toBe(true);

				expectError(
					await createElement(user.id, {
						caseId: testCase.id,
						elementType: "goal",
						name: "GSN1",
					}),
					"Goal names must look like G1 or G1.1"
				);
			});

			it("honours the plugin pattern through updateElement too, when enabled", async () => {
				registerPluginNamePatterns("tea.health", "GOAL", GSN_PATTERN);
				const user = await createTestUser();
				const testCase = await createTestCase(user.id);
				const goal = expectSuccess(
					await createElement(user.id, {
						caseId: testCase.id,
						elementType: "goal",
						name: "G1",
					})
				);

				const data = expectSuccess(
					await updateElement(user.id, goal.id, { name: "GSN2" })
				);
				expect(data.name).toBe("GSN2");
			});
		});
	});
});
