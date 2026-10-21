import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import {
	createElement,
	regenerateNameForIsDefeaterChange,
} from "@/lib/services/element-service";
import type { AssuranceCase, User } from "@/src/generated/prisma";
import { expectSuccess } from "../utils/assertion-helpers";
import {
	createTestCase,
	createTestElement,
	createTestUser,
} from "../utils/prisma-factories";

const FLAT_PLAIN_NAME = /^P\d+$/;
const FLAT_DEFEATER_NAME = /^CP\d+$/;

/** A case whose only element is the goal G1. */
async function setupCase() {
	const user = await createTestUser();
	const testCase = await createTestCase(user.id);
	const goal = await createTestElement(testCase.id, user.id, {
		elementType: "GOAL",
		name: "G1",
	});
	return { user, testCase, goal };
}

/** Stores a claim directly, so its name need not pass the name-format check. */
function storeClaim(
	testCase: AssuranceCase,
	user: User,
	name: string,
	parentId: string,
	isDefeater = false
) {
	return createTestElement(testCase.id, user.id, {
		elementType: "PROPERTY_CLAIM",
		name,
		parentId,
		isDefeater,
		defeatsElementId: isDefeater ? parentId : undefined,
	});
}

async function addClaim(
	user: User,
	testCase: AssuranceCase,
	parentId: string,
	elementType = "property_claim"
) {
	const created = expectSuccess(
		await createElement(user.id, {
			caseId: testCase.id,
			elementType,
			parentId,
		})
	);
	return created;
}

async function addDefeater(
	user: User,
	testCase: AssuranceCase,
	parentId: string,
	defeatsElementId: string
) {
	return expectSuccess(
		await createElement(user.id, {
			caseId: testCase.id,
			elementType: "property_claim",
			parentId,
			isDefeater: true,
			defeatsElementId,
		})
	);
}

async function liveNames(caseId: string) {
	const rows = await prisma.assuranceElement.findMany({
		where: { caseId, deletedAt: null },
		select: { name: true },
	});
	return rows.map((row) => row.name);
}

describe("element auto-naming under a malformed parent identifier", () => {
	describe("plain claims", () => {
		it.each([
			"Property claim",
			"PNaN",
		])("names a claim under a parent called %s with the next flat number", async (parentName) => {
			const { user, testCase, goal } = await setupCase();
			const parent = await storeClaim(testCase, user, parentName, goal.id);

			const child = await addClaim(user, testCase, parent.id);

			expect(child.name).toBe("P2");
			const stored = await prisma.assuranceElement.findUnique({
				where: { id: child.id },
			});
			expect(stored?.name).toBe("P2");
		});

		it("gives repeated children of a malformed parent and a new top-level claim distinct names", async () => {
			const { user, testCase, goal } = await setupCase();
			const parent = await storeClaim(
				testCase,
				user,
				"Property claim",
				goal.id
			);

			const first = await addClaim(user, testCase, parent.id);
			const second = await addClaim(user, testCase, parent.id);
			const topLevel = await addClaim(user, testCase, goal.id);

			expect([first.name, second.name, topLevel.name]).toEqual([
				"P2",
				"P3",
				"P4",
			]);
			const names = await liveNames(testCase.id);
			expect(new Set(names).size).toBe(names.length);
		});

		it("keeps names distinct when the case also holds a well-formed claim", async () => {
			const { user, testCase, goal } = await setupCase();
			await storeClaim(testCase, user, "P1", goal.id);
			const malformed = await storeClaim(testCase, user, "PNaN", goal.id);

			const first = await addClaim(user, testCase, malformed.id);
			const second = await addClaim(user, testCase, malformed.id);
			const topLevel = await addClaim(user, testCase, goal.id);

			expect([first.name, second.name, topLevel.name]).toEqual([
				"P3",
				"P4",
				"P5",
			]);
			const names = await liveNames(testCase.id);
			expect(new Set(names).size).toBe(names.length);
		});

		it("names claims under a strategy below a malformed claim with distinct flat names", async () => {
			const { user, testCase, goal } = await setupCase();
			const parent = await storeClaim(
				testCase,
				user,
				"Property claim",
				goal.id
			);
			const strategy = await addClaim(user, testCase, parent.id, "strategy");

			const first = await addClaim(user, testCase, strategy.id);
			const second = await addClaim(user, testCase, strategy.id);

			expect(first.name).toMatch(FLAT_PLAIN_NAME);
			expect(second.name).toMatch(FLAT_PLAIN_NAME);
			const names = await liveNames(testCase.id);
			expect(new Set(names).size).toBe(names.length);
		});

		it("does not reuse a name that regenerating under a malformed parent has to avoid", async () => {
			const { user, testCase, goal } = await setupCase();
			const parent = await storeClaim(
				testCase,
				user,
				"Property claim",
				goal.id
			);
			const child = await addClaim(user, testCase, parent.id);
			expect(child.name).toBe("P2");

			const regenerated = await regenerateNameForIsDefeaterChange(
				"PROPERTY_CLAIM",
				testCase.id,
				parent.id,
				false
			);

			expect(regenerated).toBe("P3");
		});

		it("still continues a well-formed parent's name", async () => {
			const { user, testCase, goal } = await setupCase();
			const parent = await storeClaim(testCase, user, "P1", goal.id);

			const first = await addClaim(user, testCase, parent.id);
			const second = await addClaim(user, testCase, parent.id);
			const topLevel = await addClaim(user, testCase, goal.id);

			expect([first.name, second.name, topLevel.name]).toEqual([
				"P1.1",
				"P1.2",
				"P2",
			]);
		});
	});

	describe("defeater claims", () => {
		it("still continues a well-formed defeater parent's name", async () => {
			const { user, testCase, goal } = await setupCase();
			const parent = await storeClaim(testCase, user, "CP1", goal.id, true);

			const child = await addDefeater(user, testCase, parent.id, parent.id);

			expect(child.name).toBe("CP1.1");
		});

		it.each([
			"Property claim",
			"CPNaN",
		])("gives defeaters under a defeater called %s distinct flat names", async (parentName) => {
			const { user, testCase, goal } = await setupCase();
			const parent = await storeClaim(
				testCase,
				user,
				parentName,
				goal.id,
				true
			);

			const first = await addDefeater(user, testCase, parent.id, parent.id);
			const second = await addDefeater(user, testCase, parent.id, parent.id);
			const topLevel = await addDefeater(user, testCase, goal.id, goal.id);

			expect([first.name, second.name, topLevel.name]).toEqual([
				"CP2",
				"CP3",
				"CP4",
			]);
			for (const claim of [first, second, topLevel]) {
				expect(claim.name).toMatch(FLAT_DEFEATER_NAME);
			}
			const names = await liveNames(testCase.id);
			expect(new Set(names).size).toBe(names.length);
		});
	});
});
