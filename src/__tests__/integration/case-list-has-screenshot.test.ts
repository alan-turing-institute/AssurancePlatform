import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import {
	listSharedCases,
	listUserCases,
} from "@/lib/services/case-fetch-service";
import { listUserPatterns } from "@/lib/services/case-kind-service";
import { expectSuccess } from "../utils/assertion-helpers";
import { mockNoAuth } from "../utils/auth-helpers";
import { createStoredCase, createStoredPattern } from "../utils/case-kind-kit";
import {
	createTestPermission,
	createTestUser,
} from "../utils/prisma-factories";

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

/**
 * The case lists say whether each case has a stored screenshot, so a card
 * only asks for an image when there is one.
 */

beforeEach(async () => {
	await mockNoAuth();
});

async function addScreenshot(caseId: string, userId: string) {
	await prisma.caseImage.create({
		data: {
			caseId,
			imageUrl: `cases/${caseId}/screenshot.png`,
			uploadedAt: new Date(),
			uploadedById: userId,
		},
	});
}

function flagOf(
	cases: { id: string; hasScreenshot: boolean }[],
	caseId: string
): boolean | undefined {
	return cases.find((c) => c.id === caseId)?.hasScreenshot;
}

describe("hasScreenshot on the case lists", () => {
	it("is true for an owned case with a screenshot and false for one without", async () => {
		const owner = await createTestUser();
		const withShot = await createStoredCase(owner.id);
		const without = await createStoredCase(owner.id);
		await addScreenshot(withShot.id, owner.id);

		const cases = expectSuccess(await listUserCases(owner.id));

		expect(flagOf(cases, withShot.id)).toBe(true);
		expect(flagOf(cases, without.id)).toBe(false);
	});

	it("is reported in the shared list too", async () => {
		const owner = await createTestUser();
		const reader = await createTestUser();
		const withShot = await createStoredCase(owner.id);
		const without = await createStoredCase(owner.id);
		await createTestPermission(withShot.id, reader.id, owner.id, "VIEW");
		await createTestPermission(without.id, reader.id, owner.id, "VIEW");
		await addScreenshot(withShot.id, owner.id);

		const cases = expectSuccess(await listSharedCases(reader.id));

		expect(flagOf(cases, withShot.id)).toBe(true);
		expect(flagOf(cases, without.id)).toBe(false);
	});

	it("is reported in the patterns list", async () => {
		const owner = await createTestUser();
		const pattern = await createStoredPattern(owner.id);

		const patterns = expectSuccess(await listUserPatterns(owner.id));

		expect(flagOf(patterns, pattern.id)).toBe(false);
	});
});
