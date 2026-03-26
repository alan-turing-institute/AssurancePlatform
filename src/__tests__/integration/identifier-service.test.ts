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
				INSERT INTO assurance_elements (id, "caseId", "elementType", "parentId", name, description, "createdById", "createdAt", "updatedAt")
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
