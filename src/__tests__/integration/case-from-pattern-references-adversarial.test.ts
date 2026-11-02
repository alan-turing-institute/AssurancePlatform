import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { mockNoAuth } from "../utils/auth-helpers";
import { createStoredCase } from "../utils/case-kind-kit";
import {
	createPublishedRow,
	makePattern,
	referencesOf,
	snapshotWithComments,
	viewerOf,
} from "../utils/pattern-start-kit";
import { STARTERS, startOk } from "../utils/pattern-starters";
import {
	createTestPermission,
	createTestUser,
} from "../utils/prisma-factories";

/**
 * A case started from a pattern, through the service and through the server
 * action, keeps a reference to another case only when the user who starts it
 * can view that case. The rest are cleared, flagged and named in the
 * warnings, and the pattern itself is left alone.
 */

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

beforeEach(async () => {
	await mockNoAuth();
});

const CLEARED_AWAY_GOAL =
	"AG1: cited case not available in this environment; the reference has been cleared";
const CLEARED_MODULE =
	"M1: cited case not available in this environment; the reference has been cleared";

const trash = (caseId: string) =>
	prisma.assuranceCase.update({
		where: { id: caseId },
		data: { deletedAt: new Date() },
	});

describe.each(
	STARTERS
)("references in a case started from a pattern through %s", (_label, starter) => {
	it("keeps a reference to a case the new owner can view and clears one they cannot, naming each in the warnings", async () => {
		const owner = await createTestUser();
		const visibleCase = await createStoredCase(owner.id);
		const hiddenCase = await createStoredCase(owner.id);
		const pattern = await makePattern(owner, { citedCaseId: visibleCase.id });
		const module = await prisma.assuranceElement.findFirstOrThrow({
			where: { caseId: pattern.id, name: "M1" },
		});
		await prisma.assuranceElement.update({
			where: { id: module.id },
			data: { moduleReferenceId: hiddenCase.id },
		});
		const copier = await viewerOf(pattern.id, owner.id);
		await createTestPermission(visibleCase.id, copier.id, owner.id, "VIEW");

		const outcome = await startOk(starter, copier, {
			patternCaseId: pattern.id,
		});

		expect(await referencesOf(outcome.id, "AG1")).toMatchObject({
			moduleReferenceId: visibleCase.id,
			moduleReferenceDangling: false,
		});
		expect(await referencesOf(outcome.id, "M1")).toMatchObject({
			moduleReferenceId: null,
			moduleReferenceDangling: true,
		});
		expect(outcome.warnings).toEqual([CLEARED_MODULE]);
		expect(await referencesOf(pattern.id, "M1")).toMatchObject({
			moduleReferenceId: hiddenCase.id,
		});
	});

	it("clears every reference for a user who cannot view the cited case, and leaves the pattern's references alone", async () => {
		const owner = await createTestUser();
		const cited = await createStoredCase(owner.id);
		const pattern = await makePattern(owner, { citedCaseId: cited.id });
		const copier = await viewerOf(pattern.id, owner.id);

		const outcome = await startOk(starter, copier, {
			patternCaseId: pattern.id,
		});

		for (const name of ["AG1", "M1"]) {
			expect(await referencesOf(outcome.id, name)).toMatchObject({
				moduleReferenceId: null,
				moduleReferenceDangling: true,
			});
			expect(await referencesOf(pattern.id, name)).toMatchObject({
				moduleReferenceId: cited.id,
				moduleReferenceDangling: false,
			});
		}
		expect([...outcome.warnings].sort()).toEqual(
			[CLEARED_AWAY_GOAL, CLEARED_MODULE].sort()
		);
	});

	it("keeps every reference when the pattern's owner starts from it and can view the cited case", async () => {
		const owner = await createTestUser();
		const cited = await createStoredCase(owner.id);
		const pattern = await makePattern(owner, { citedCaseId: cited.id });

		const outcome = await startOk(starter, owner, {
			patternCaseId: pattern.id,
		});

		for (const name of ["AG1", "M1"]) {
			expect(await referencesOf(outcome.id, name)).toMatchObject({
				moduleReferenceId: cited.id,
				moduleReferenceDangling: false,
			});
		}
		expect(outcome.warnings).toEqual([]);
	});

	it("clears a reference to a case that has since gone to the trash, even for its owner", async () => {
		const owner = await createTestUser();
		const cited = await createStoredCase(owner.id);
		const pattern = await makePattern(owner, { citedCaseId: cited.id });
		await trash(cited.id);

		const outcome = await startOk(starter, owner, {
			patternCaseId: pattern.id,
		});

		expect(await referencesOf(outcome.id, "AG1")).toMatchObject({
			moduleReferenceId: null,
			moduleReferenceDangling: true,
		});
		expect(outcome.warnings).toHaveLength(2);
	});

	it("applies the same rule to a published pattern's references", async () => {
		const author = await createTestUser();
		const cited = await createStoredCase(author.id);
		const pattern = await makePattern(author, { citedCaseId: cited.id });
		await createPublishedRow({
			slug: "citing-pattern",
			assuranceCaseId: pattern.id,
			content: await snapshotWithComments(author, pattern.id),
		});
		const reader = await createTestUser();
		const readerWithAccess = await createTestUser();
		await createTestPermission(
			cited.id,
			readerWithAccess.id,
			author.id,
			"VIEW"
		);

		const hidden = await startOk(starter, reader, {
			publishedSlug: "citing-pattern",
		});
		const visible = await startOk(starter, readerWithAccess, {
			publishedSlug: "citing-pattern",
		});

		expect(await referencesOf(hidden.id, "AG1")).toMatchObject({
			moduleReferenceId: null,
			moduleReferenceDangling: true,
		});
		expect(hidden.warnings).toHaveLength(2);
		expect(await referencesOf(visible.id, "AG1")).toMatchObject({
			moduleReferenceId: cited.id,
			moduleReferenceDangling: false,
		});
		expect(visible.warnings).toEqual([]);
	});
});
