import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { createElement } from "@/lib/services/element-service";
import { resetIdentifiers } from "@/lib/services/identifier-service";
import { expectError, expectSuccess } from "../utils/assertion-helpers";
import {
	createTestCase,
	createTestPermission,
	createTestUser,
} from "../utils/prisma-factories";

const P1_CHILD_PATTERN = /^P1\.\d+$/;

describe("identifier-service", () => {
	describe("resetIdentifiers with strategies under property claims", () => {
		it("renumbers property claims under strategies as children of the ancestor claim", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);

			// Build: G1 → S1 → P1 → { P1.1 (direct), S2 → P1.2 (transparent) }
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
			expectSuccess(
				await createElement(user.id, {
					caseId: testCase.id,
					elementType: "property_claim",
					parentId: p1.id,
				})
			);
			const s2 = expectSuccess(
				await createElement(user.id, {
					caseId: testCase.id,
					elementType: "strategy",
					parentId: p1.id,
				})
			);
			const claimUnderS2 = expectSuccess(
				await createElement(user.id, {
					caseId: testCase.id,
					elementType: "property_claim",
					parentId: s2.id,
				})
			);

			// Reset identifiers
			const result = await resetIdentifiers(testCase.id, user.id);
			expect("data" in result).toBe(true);

			// Verify names after reset
			const elements = await prisma.assuranceElement.findMany({
				where: { caseId: testCase.id, deletedAt: null },
				select: { id: true, name: true, elementType: true },
			});

			const byId = new Map(elements.map((e) => [e.id, e.name]));

			expect(byId.get(goal.id)).toBe("G1");
			expect(byId.get(s1.id)).toBe("S1");
			expect(byId.get(p1.id)).toBe("P1");
			expect(byId.get(s2.id)).toBe("S2");
			// The claim under S2 should be numbered as a child of P1
			expect(byId.get(claimUnderS2.id)).toMatch(P1_CHILD_PATTERN);
		});

		it("assigns correct CONTEXT prefix during reset", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);

			const goal = expectSuccess(
				await createElement(user.id, {
					caseId: testCase.id,
					elementType: "goal",
				})
			);

			// Create a context element bypassing element validation middleware
			await prisma.$executeRaw`
				INSERT INTO assurance_elements (id, case_id, element_type, parent_id, name, description, created_by_id, created_at, updated_at)
				VALUES (gen_random_uuid(), ${testCase.id}, 'CONTEXT', ${goal.id}, 'X1', 'Test context', ${user.id}, NOW(), NOW())
			`;

			await resetIdentifiers(testCase.id, user.id);

			const contextElements = await prisma.assuranceElement.findMany({
				where: {
					caseId: testCase.id,
					elementType: "CONTEXT",
					deletedAt: null,
				},
				select: { name: true },
			});

			expect(contextElements[0]?.name).toBe("C1");
		});

		/**
		 * Round-2 regression (vincent, ruled by cid, 2026-09-15): confirms
		 * the renumber action already agreed with the correct rule even
		 * when `createElement`'s flat count didn't yet — the shape that
		 * exposed the create-path bug.
		 */
		it("agrees with createElement's corrected flat count for a strategy-transparent claim", async () => {
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
			const s2 = expectSuccess(
				await createElement(user.id, {
					caseId: testCase.id,
					elementType: "strategy",
					parentId: p1.id,
				})
			);
			const p1_1 = expectSuccess(
				await createElement(user.id, {
					caseId: testCase.id,
					elementType: "property_claim",
					parentId: s2.id,
				})
			);
			const p2 = expectSuccess(
				await createElement(user.id, {
					caseId: testCase.id,
					elementType: "property_claim",
					parentId: s1.id,
				})
			);
			expect(p1.name).toBe("P1");
			expect(p1_1.name).toBe("P1.1");
			expect(p2.name).toBe("P2");

			const result = await resetIdentifiers(testCase.id, user.id);
			expect("data" in result).toBe(true);

			const elements = await prisma.assuranceElement.findMany({
				where: { caseId: testCase.id, deletedAt: null },
				select: { id: true, name: true },
			});
			const byId = new Map(elements.map((e) => [e.id, e.name]));

			expect(byId.get(p1.id)).toBe("P1");
			expect(byId.get(p1_1.id)).toBe("P1.1");
			expect(byId.get(p2.id)).toBe("P2");
		});
	});

	/**
	 * Defeater identifiers (Chris's ruling, 2026-09-15 — D8 of ADR 0005,
	 * "TEA — Defeater identifiers follow GSN (CP1, CG1, CE1)"): the renumber
	 * action numbers each (elementType, isDefeater) class in its own
	 * independent, tree-order sequence.
	 */
	describe("resetIdentifiers with defeaters", () => {
		it("keeps the C-sequence independent of the plain sequence on renumber", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);

			const goal = expectSuccess(
				await createElement(user.id, {
					caseId: testCase.id,
					elementType: "goal",
				})
			);
			const p1 = expectSuccess(
				await createElement(user.id, {
					caseId: testCase.id,
					elementType: "property_claim",
					parentId: goal.id,
				})
			);
			const defeater = expectSuccess(
				await createElement(user.id, {
					caseId: testCase.id,
					elementType: "property_claim",
					parentId: goal.id,
					isDefeater: true,
					defeatsElementId: goal.id,
				})
			);
			expect(p1.name).toBe("P1");
			expect(defeater.name).toBe("CP1");

			const result = await resetIdentifiers(testCase.id, user.id);
			expect("data" in result).toBe(true);

			const elements = await prisma.assuranceElement.findMany({
				where: { caseId: testCase.id, deletedAt: null },
				select: { id: true, name: true },
			});
			const byId = new Map(elements.map((e) => [e.id, e.name]));

			// Renumbering keeps P1 a P-number and CP1 a C-number — adding a
			// defeater never renumbers the plain sequence, and vice versa.
			expect(byId.get(p1.id)).toBe("P1");
			expect(byId.get(defeater.id)).toBe("CP1");
		});

		it("renumbers multiple defeaters as their own flat sequence (CP1, CP2), independent of tree depth", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);

			const goal = expectSuccess(
				await createElement(user.id, {
					caseId: testCase.id,
					elementType: "goal",
				})
			);
			const p1 = expectSuccess(
				await createElement(user.id, {
					caseId: testCase.id,
					elementType: "property_claim",
					parentId: goal.id,
				})
			);
			const defeaterOfGoal = expectSuccess(
				await createElement(user.id, {
					caseId: testCase.id,
					elementType: "property_claim",
					parentId: goal.id,
					isDefeater: true,
					defeatsElementId: goal.id,
				})
			);
			const defeaterOfClaim = expectSuccess(
				await createElement(user.id, {
					caseId: testCase.id,
					elementType: "property_claim",
					parentId: p1.id,
					isDefeater: true,
					defeatsElementId: p1.id,
				})
			);

			const result = await resetIdentifiers(testCase.id, user.id);
			expect("data" in result).toBe(true);

			const elements = await prisma.assuranceElement.findMany({
				where: { caseId: testCase.id, deletedAt: null },
				select: { id: true, name: true },
			});
			const byId = new Map(elements.map((e) => [e.id, e.name]));
			const defeaterNames = [
				byId.get(defeaterOfGoal.id),
				byId.get(defeaterOfClaim.id),
			].sort();

			expect(defeaterNames).toEqual(["CP1", "CP2"]);
		});

		it("keeps a counter-to-a-counter hierarchical (CP1.1) on renumber", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);

			const goal = expectSuccess(
				await createElement(user.id, {
					caseId: testCase.id,
					elementType: "goal",
				})
			);
			const defeater = expectSuccess(
				await createElement(user.id, {
					caseId: testCase.id,
					elementType: "property_claim",
					parentId: goal.id,
					isDefeater: true,
					defeatsElementId: goal.id,
				})
			);
			const counterCounter = expectSuccess(
				await createElement(user.id, {
					caseId: testCase.id,
					elementType: "property_claim",
					parentId: defeater.id,
					isDefeater: true,
					defeatsElementId: defeater.id,
				})
			);

			const result = await resetIdentifiers(testCase.id, user.id);
			expect("data" in result).toBe(true);

			const elements = await prisma.assuranceElement.findMany({
				where: { caseId: testCase.id, deletedAt: null },
				select: { id: true, name: true },
			});
			const byId = new Map(elements.map((e) => [e.id, e.name]));

			expect(byId.get(defeater.id)).toBe("CP1");
			expect(byId.get(counterCounter.id)).toBe("CP1.1");
		});

		it("assigns the CG1 prefix to a defeater goal during reset", async () => {
			// A fresh case with only a defeater GOAL (no plain goal) —
			// `caseHasGoal`'s single-goal rule counts any GOAL row, defeater
			// or not, and blocking a second GOAL is a separate, pre-existing
			// business rule this issue does not change.
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);
			const defeaterGoal = expectSuccess(
				await createElement(user.id, {
					caseId: testCase.id,
					elementType: "goal",
					isDefeater: true,
				})
			);

			const result = await resetIdentifiers(testCase.id, user.id);
			expect("data" in result).toBe(true);

			const inDb = await prisma.assuranceElement.findUnique({
				where: { id: defeaterGoal.id },
			});
			expect(inDb?.name).toBe("CG1");
		});

		/**
		 * Fix round 1 (vincent finding 1, ruled by cid, 2026-09-15): the
		 * renumber action must agree with `createElement` — an ordinary
		 * child of a defeater takes the next flat plain number (P<next>),
		 * never a dot-continuation of the defeater's C-prefixed name.
		 */
		it("renumbers an ordinary child of a defeater to the next flat plain number, not a dot-continuation", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id);

			const goal = expectSuccess(
				await createElement(user.id, {
					caseId: testCase.id,
					elementType: "goal",
				})
			);
			const defeater = expectSuccess(
				await createElement(user.id, {
					caseId: testCase.id,
					elementType: "property_claim",
					parentId: goal.id,
					isDefeater: true,
					defeatsElementId: goal.id,
				})
			);
			const plainChild = expectSuccess(
				await createElement(user.id, {
					caseId: testCase.id,
					elementType: "property_claim",
					parentId: defeater.id,
				})
			);
			expect(plainChild.name).toBe("P1");

			const result = await resetIdentifiers(testCase.id, user.id);
			expect("data" in result).toBe(true);

			const elements = await prisma.assuranceElement.findMany({
				where: { caseId: testCase.id, deletedAt: null },
				select: { id: true, name: true },
			});
			const byId = new Map(elements.map((e) => [e.id, e.name]));

			expect(byId.get(defeater.id)).toBe("CP1");
			expect(byId.get(plainChild.id)).toBe("P1");
		});
	});

	describe("resetIdentifiers permissions", () => {
		it("rejects reset from a VIEW-only user", async () => {
			const owner = await createTestUser();
			const viewer = await createTestUser();
			const testCase = await createTestCase(owner.id);

			// Grant VIEW permission to viewer
			await createTestPermission(testCase.id, viewer.id, owner.id, "VIEW");

			expectError(
				await resetIdentifiers(testCase.id, viewer.id),
				"Permission denied"
			);
		});

		it("rejects reset from an outsider with no access", async () => {
			const owner = await createTestUser();
			const outsider = await createTestUser();
			const testCase = await createTestCase(owner.id);

			expectError(
				await resetIdentifiers(testCase.id, outsider.id),
				"Permission denied"
			);
		});
	});
});
