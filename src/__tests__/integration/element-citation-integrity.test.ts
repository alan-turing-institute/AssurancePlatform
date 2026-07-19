import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { deleteElement, detachElement } from "@/lib/services/element-service";
import { expectSuccess } from "../utils/assertion-helpers";
import {
	createTestCase,
	createTestElement,
	createTestUser,
} from "../utils/prisma-factories";

/**
 * ADR 0004 D5 integrity rule (ruled by cid + Chris, 2026-07-19): when a
 * cited element is deleted or detached from its case, citing elements are
 * NOT left pointing at a dangling id — citedElementId is nullified and
 * citationDangling is set on the citing element, without blocking the
 * deletion/detach itself. Tested both directions.
 */
describe("element citation integrity (ADR 0004 D5)", () => {
	describe("deleting the cited element", () => {
		it("nullifies citedElementId and sets citationDangling on the citing AWAY_GOAL", async () => {
			const owner = await createTestUser();
			const homeCase = await createTestCase(owner.id);
			const awayCase = await createTestCase(owner.id);
			const citedGoal = await createTestElement(awayCase.id, owner.id, {
				elementType: "GOAL",
			});
			const awayGoal = await createTestElement(homeCase.id, owner.id, {
				elementType: "AWAY_GOAL",
				moduleReferenceId: awayCase.id,
				citedElementId: citedGoal.id,
			});

			expectSuccess(await deleteElement(owner.id, citedGoal.id));

			const inDb = await prisma.assuranceElement.findUnique({
				where: { id: awayGoal.id },
			});
			expect(inDb?.citedElementId).toBeNull();
			expect(inDb?.citationDangling).toBe(true);

			// The deletion itself was not blocked.
			const deletedGoal = await prisma.assuranceElement.findUnique({
				where: { id: citedGoal.id },
			});
			expect(deletedGoal?.deletedAt).not.toBeNull();
		});

		it("nullifies citations pointing at a descendant swept up by a parent delete", async () => {
			const owner = await createTestUser();
			const homeCase = await createTestCase(owner.id);
			const awayCase = await createTestCase(owner.id);
			const parentGoal = await createTestElement(awayCase.id, owner.id, {
				elementType: "GOAL",
			});
			const citedChild = await createTestElement(awayCase.id, owner.id, {
				elementType: "PROPERTY_CLAIM",
				parentId: parentGoal.id,
			});
			const awayGoal = await createTestElement(homeCase.id, owner.id, {
				elementType: "AWAY_GOAL",
				moduleReferenceId: awayCase.id,
				citedElementId: citedChild.id,
			});

			// Deleting the PARENT cascades soft-delete to citedChild too.
			expectSuccess(await deleteElement(owner.id, parentGoal.id));

			const inDb = await prisma.assuranceElement.findUnique({
				where: { id: awayGoal.id },
			});
			expect(inDb?.citedElementId).toBeNull();
			expect(inDb?.citationDangling).toBe(true);
		});

		it("does not affect citations pointing at an unrelated, still-active element", async () => {
			const owner = await createTestUser();
			const homeCase = await createTestCase(owner.id);
			const awayCase = await createTestCase(owner.id);
			const citedGoal = await createTestElement(awayCase.id, owner.id, {
				elementType: "GOAL",
			});
			const unrelatedGoal = await createTestElement(awayCase.id, owner.id, {
				elementType: "PROPERTY_CLAIM",
				parentId: citedGoal.id,
			});
			const awayGoal = await createTestElement(homeCase.id, owner.id, {
				elementType: "AWAY_GOAL",
				moduleReferenceId: awayCase.id,
				citedElementId: citedGoal.id,
			});

			expectSuccess(await deleteElement(owner.id, unrelatedGoal.id));

			const inDb = await prisma.assuranceElement.findUnique({
				where: { id: awayGoal.id },
			});
			expect(inDb?.citedElementId).toBe(citedGoal.id);
			expect(inDb?.citationDangling).toBe(false);
		});
	});

	describe("detaching the cited element", () => {
		it("nullifies citedElementId and sets citationDangling on the citing AWAY_GOAL", async () => {
			const owner = await createTestUser();
			const homeCase = await createTestCase(owner.id);
			const awayCase = await createTestCase(owner.id);
			const parentGoal = await createTestElement(awayCase.id, owner.id, {
				elementType: "GOAL",
			});
			const citedClaim = await createTestElement(awayCase.id, owner.id, {
				elementType: "PROPERTY_CLAIM",
				parentId: parentGoal.id,
			});
			const awayGoal = await createTestElement(homeCase.id, owner.id, {
				elementType: "AWAY_GOAL",
				moduleReferenceId: awayCase.id,
				citedElementId: citedClaim.id,
			});

			expectSuccess(await detachElement(owner.id, citedClaim.id));

			const inDb = await prisma.assuranceElement.findUnique({
				where: { id: awayGoal.id },
			});
			expect(inDb?.citedElementId).toBeNull();
			expect(inDb?.citationDangling).toBe(true);

			// The detach itself was not blocked.
			const detached = await prisma.assuranceElement.findUnique({
				where: { id: citedClaim.id },
			});
			expect(detached?.inSandbox).toBe(true);
			expect(detached?.parentId).toBeNull();
		});

		it("does not affect citations pointing at a different, still-attached element", async () => {
			const owner = await createTestUser();
			const homeCase = await createTestCase(owner.id);
			const awayCase = await createTestCase(owner.id);
			const parentGoal = await createTestElement(awayCase.id, owner.id, {
				elementType: "GOAL",
			});
			const citedClaim = await createTestElement(awayCase.id, owner.id, {
				elementType: "PROPERTY_CLAIM",
				parentId: parentGoal.id,
			});
			const otherClaim = await createTestElement(awayCase.id, owner.id, {
				elementType: "PROPERTY_CLAIM",
				parentId: parentGoal.id,
			});
			const awayGoal = await createTestElement(homeCase.id, owner.id, {
				elementType: "AWAY_GOAL",
				moduleReferenceId: awayCase.id,
				citedElementId: citedClaim.id,
			});

			expectSuccess(await detachElement(owner.id, otherClaim.id));

			const inDb = await prisma.assuranceElement.findUnique({
				where: { id: awayGoal.id },
			});
			expect(inDb?.citedElementId).toBe(citedClaim.id);
			expect(inDb?.citationDangling).toBe(false);
		});
	});
});
