import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { createElement, updateElement } from "@/lib/services/element-service";
import { expectError, expectSuccess } from "../utils/assertion-helpers";
import {
	createTestCase,
	createTestElement,
	createTestUser,
} from "../utils/prisma-factories";

/**
 * defeatsElementId (dialogical reasoning / defeaters) — must stay inside the
 * case it is written from, unlike citedElementId which is deliberately
 * cross-case (ADR 0004 D5). Parity with the batch endpoint's ownership check
 * (case-batch-update-service.ts's validateElementOwnership), per Chris's
 * ruling 2026-08-27 on TEA — Element-service reference integrity: persist
 * the field with a same-case/exists/not-deleted/not-self check, rather than
 * merely reject it.
 */

const NOT_FOUND_PATTERN =
	/defeatsElementId must reference an existing element in this case/;
const SELF_REFERENCE_PATTERN =
	/defeatsElementId cannot reference the element itself/;
const PARENT_NOT_FOUND_PATTERN = /Parent element not found/;

describe("defeatsElementId scoping (element-service)", () => {
	describe("createElement", () => {
		it("persists a valid same-case defeatsElementId and returns it in the response", async () => {
			const owner = await createTestUser();
			const testCase = await createTestCase(owner.id);
			const target = await createTestElement(testCase.id, owner.id, {
				elementType: "PROPERTY_CLAIM",
			});

			const data = expectSuccess(
				await createElement(owner.id, {
					caseId: testCase.id,
					elementType: "property_claim",
					isDefeater: true,
					defeatsElementId: target.id,
				})
			);
			expect(data.defeatsElementId).toBe(target.id);
			expect(data.isDefeater).toBe(true);

			const inDb = await prisma.assuranceElement.findUnique({
				where: { id: data.id },
			});
			expect(inDb?.defeatsElementId).toBe(target.id);
			expect(inDb?.isDefeater).toBe(true);
		});

		it("rejects a defeatsElementId belonging to a different case", async () => {
			const owner = await createTestUser();
			const testCase = await createTestCase(owner.id);
			const otherCase = await createTestCase(owner.id);
			const foreignTarget = await createTestElement(otherCase.id, owner.id, {
				elementType: "PROPERTY_CLAIM",
			});

			const result = await createElement(owner.id, {
				caseId: testCase.id,
				elementType: "property_claim",
				defeatsElementId: foreignTarget.id,
			});
			expectError(result, NOT_FOUND_PATTERN);

			const elements = await prisma.assuranceElement.findMany({
				where: { caseId: testCase.id },
			});
			expect(elements).toHaveLength(0);
		});

		it("rejects a nonexistent defeatsElementId", async () => {
			const owner = await createTestUser();
			const testCase = await createTestCase(owner.id);

			const result = await createElement(owner.id, {
				caseId: testCase.id,
				elementType: "property_claim",
				defeatsElementId: "00000000-0000-0000-0000-000000000000",
			});
			expectError(result, NOT_FOUND_PATTERN);
		});

		it("rejects a soft-deleted defeatsElementId target in the same case", async () => {
			const owner = await createTestUser();
			const testCase = await createTestCase(owner.id);
			const target = await createTestElement(testCase.id, owner.id, {
				elementType: "PROPERTY_CLAIM",
			});
			await prisma.assuranceElement.update({
				where: { id: target.id },
				data: { deletedAt: new Date(), deletedById: owner.id },
			});

			const result = await createElement(owner.id, {
				caseId: testCase.id,
				elementType: "property_claim",
				defeatsElementId: target.id,
			});
			expectError(result, NOT_FOUND_PATTERN);
		});
	});

	describe("updateElement", () => {
		it("persists a valid same-case defeatsElementId and returns it in the response", async () => {
			const owner = await createTestUser();
			const testCase = await createTestCase(owner.id);
			const target = await createTestElement(testCase.id, owner.id, {
				elementType: "PROPERTY_CLAIM",
			});
			const element = await createTestElement(testCase.id, owner.id, {
				elementType: "PROPERTY_CLAIM",
			});

			const data = expectSuccess(
				await updateElement(owner.id, element.id, {
					isDefeater: true,
					defeatsElementId: target.id,
				})
			);
			expect(data.defeatsElementId).toBe(target.id);
			expect(data.isDefeater).toBe(true);

			const inDb = await prisma.assuranceElement.findUnique({
				where: { id: element.id },
			});
			expect(inDb?.defeatsElementId).toBe(target.id);
			expect(inDb?.isDefeater).toBe(true);
		});

		it("rejects a defeatsElementId belonging to a different case", async () => {
			const owner = await createTestUser();
			const testCase = await createTestCase(owner.id);
			const otherCase = await createTestCase(owner.id);
			const foreignTarget = await createTestElement(otherCase.id, owner.id, {
				elementType: "PROPERTY_CLAIM",
			});
			const element = await createTestElement(testCase.id, owner.id, {
				elementType: "PROPERTY_CLAIM",
			});

			const result = await updateElement(owner.id, element.id, {
				defeatsElementId: foreignTarget.id,
			});
			expectError(result, NOT_FOUND_PATTERN);

			const inDb = await prisma.assuranceElement.findUnique({
				where: { id: element.id },
			});
			expect(inDb?.defeatsElementId).toBeNull();
		});

		it("rejects a nonexistent defeatsElementId", async () => {
			const owner = await createTestUser();
			const testCase = await createTestCase(owner.id);
			const element = await createTestElement(testCase.id, owner.id, {
				elementType: "PROPERTY_CLAIM",
			});

			const result = await updateElement(owner.id, element.id, {
				defeatsElementId: "00000000-0000-0000-0000-000000000000",
			});
			expectError(result, NOT_FOUND_PATTERN);
		});

		it("rejects self-reference", async () => {
			const owner = await createTestUser();
			const testCase = await createTestCase(owner.id);
			const element = await createTestElement(testCase.id, owner.id, {
				elementType: "PROPERTY_CLAIM",
			});

			const result = await updateElement(owner.id, element.id, {
				defeatsElementId: element.id,
			});
			expectError(result, SELF_REFERENCE_PATTERN);

			const inDb = await prisma.assuranceElement.findUnique({
				where: { id: element.id },
			});
			expect(inDb?.defeatsElementId).toBeNull();
		});

		it("clears defeatsElementId when explicitly set to null", async () => {
			const owner = await createTestUser();
			const testCase = await createTestCase(owner.id);
			const target = await createTestElement(testCase.id, owner.id, {
				elementType: "PROPERTY_CLAIM",
			});
			const element = await createTestElement(testCase.id, owner.id, {
				elementType: "PROPERTY_CLAIM",
				defeatsElementId: target.id,
			});

			const data = expectSuccess(
				await updateElement(owner.id, element.id, {
					defeatsElementId: null,
				})
			);
			expect(data.defeatsElementId).toBeUndefined();

			const inDb = await prisma.assuranceElement.findUnique({
				where: { id: element.id },
			});
			expect(inDb?.defeatsElementId).toBeNull();
		});
	});

	describe("createElement — parentId same-case scoping (audit finding)", () => {
		it("rejects a parentId belonging to a different case", async () => {
			const owner = await createTestUser();
			const testCase = await createTestCase(owner.id);
			const otherCase = await createTestCase(owner.id);
			const foreignParent = await createTestElement(otherCase.id, owner.id, {
				elementType: "GOAL",
			});

			const result = await createElement(owner.id, {
				caseId: testCase.id,
				elementType: "strategy",
				parentId: foreignParent.id,
			});
			expectError(result, PARENT_NOT_FOUND_PATTERN);

			const elements = await prisma.assuranceElement.findMany({
				where: { caseId: testCase.id },
			});
			expect(elements).toHaveLength(0);
		});

		it("rejects a nonexistent parentId", async () => {
			const owner = await createTestUser();
			const testCase = await createTestCase(owner.id);

			const result = await createElement(owner.id, {
				caseId: testCase.id,
				elementType: "strategy",
				parentId: "00000000-0000-0000-0000-000000000000",
			});
			expectError(result, PARENT_NOT_FOUND_PATTERN);
		});

		it("accepts a same-case parentId", async () => {
			const owner = await createTestUser();
			const testCase = await createTestCase(owner.id);
			const goal = await createTestElement(testCase.id, owner.id, {
				elementType: "GOAL",
			});

			const data = expectSuccess(
				await createElement(owner.id, {
					caseId: testCase.id,
					elementType: "strategy",
					parentId: goal.id,
				})
			);

			const inDb = await prisma.assuranceElement.findUnique({
				where: { id: data.id },
			});
			expect(inDb?.parentId).toBe(goal.id);
		});
	});
});
