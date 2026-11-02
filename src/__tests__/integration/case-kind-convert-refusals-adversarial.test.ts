import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { convertCaseKind } from "@/lib/services/case-kind-service";
import { restoreCase, softDeleteCase } from "@/lib/services/case-trash-service";
import {
	publishAssuranceCase,
	unpublishAssuranceCase,
} from "@/lib/services/publish-service";
import { mockNoAuth } from "../utils/auth-helpers";
import {
	createPublishedRow,
	createRichCase,
	otherKind,
	snapshotAroundKind,
	storedKind,
	tapCaseEvents,
} from "../utils/case-kind-convert-kit";
import {
	createTestCase,
	createTestElement,
	createTestUser,
} from "../utils/prisma-factories";

/**
 * When a conversion is refused, and what a conversion leaves alone: refused
 * while the case is published in any way, in Trash, or already the kind asked
 * for; and when it goes ahead it changes the kind and nothing else.
 */

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

beforeEach(async () => {
	await mockNoAuth();
});

const KINDS = ["CASE", "PATTERN"] as const;

/** Converts as the owner and checks that nothing changed and nothing was announced. */
async function expectRefusedUnchanged(
	rich: { caseId: string; ownerId: string },
	target: "CASE" | "PATTERN",
	message?: string | RegExp
) {
	const before = await snapshotAroundKind(rich.caseId);
	const kindBefore = await storedKind(rich.caseId);
	const tap = tapCaseEvents(rich.caseId);

	const result = await convertCaseKind(rich.ownerId, rich.caseId, target);
	tap.stop();

	// biome-ignore lint/suspicious/noMisplacedAssertion: Called from within test blocks
	expect(result).toHaveProperty("error");
	// biome-ignore lint/suspicious/noMisplacedAssertion: Called from within test blocks
	expect(result).not.toHaveProperty("data");
	if (typeof message === "string") {
		// biome-ignore lint/suspicious/noMisplacedAssertion: Called from within test blocks
		expect(result).toEqual({ error: message });
	} else if (message) {
		// biome-ignore lint/suspicious/noMisplacedAssertion: Called from within test blocks
		expect((result as { error: string }).error).toMatch(message);
	}
	// biome-ignore lint/suspicious/noMisplacedAssertion: Called from within test blocks
	expect(await storedKind(rich.caseId)).toEqual(kindBefore);
	// biome-ignore lint/suspicious/noMisplacedAssertion: Called from within test blocks
	expect(await snapshotAroundKind(rich.caseId)).toEqual(before);
	// biome-ignore lint/suspicious/noMisplacedAssertion: Called from within test blocks
	expect(tap.events()).toEqual([]);
}

describe.each(KINDS)("converting a published %s", (from) => {
	const to = otherKind(from);
	const noun = from === "PATTERN" ? "pattern" : "case";

	it("is refused when only the published flag is set, naming what to do", async () => {
		const rich = await createRichCase(from);
		await prisma.assuranceCase.update({
			where: { id: rich.caseId },
			data: { published: true },
		});

		await expectRefusedUnchanged(
			rich,
			to,
			`Unpublish this ${noun} before converting it`
		);
	});

	it("is refused when only the publish status says PUBLISHED", async () => {
		const rich = await createRichCase(from);
		await prisma.assuranceCase.update({
			where: { id: rich.caseId },
			data: { publishStatus: "PUBLISHED" },
		});

		await expectRefusedUnchanged(
			rich,
			to,
			`Unpublish this ${noun} before converting it`
		);
	});

	it("is refused after a real publish, and allowed again after unpublishing", async () => {
		const owner = await createTestUser();
		const rich = await createRichCase(from, owner);
		const published = await publishAssuranceCase(owner.id, rich.caseId);
		expect(published).toHaveProperty("data");

		await expectRefusedUnchanged(
			rich,
			to,
			`Unpublish this ${noun} before converting it`
		);

		expect(await unpublishAssuranceCase(owner.id, rich.caseId)).toHaveProperty(
			"data"
		);
		const result = await convertCaseKind(owner.id, rich.caseId, to);

		expect(result).toEqual({ data: { kind: to } });
		expect((await storedKind(rich.caseId)).kind).toBe(to);
	});
});

describe.each(KINDS)("converting a %s that has a published row", (from) => {
	const to = otherKind(from);

	it("is refused for a live row even when the case itself says draft", async () => {
		const rich = await createRichCase(from);
		await createPublishedRow(rich.caseId);

		await expectRefusedUnchanged(rich, to);
	});

	it("is refused for an archived row even when the case itself says draft", async () => {
		const rich = await createRichCase(from);
		await createPublishedRow(rich.caseId, { archivedAt: new Date() });

		await expectRefusedUnchanged(rich, to);
	});

	it("is refused for a superseded row even when the case itself says draft", async () => {
		const rich = await createRichCase(from);
		await createPublishedRow(rich.caseId, { isCurrent: false });

		await expectRefusedUnchanged(rich, to);
	});

	it("is refused for a case restored from Trash with its archived copy", async () => {
		const owner = await createTestUser();
		const rich = await createRichCase(from, owner);
		expect(await publishAssuranceCase(owner.id, rich.caseId)).toHaveProperty(
			"data"
		);
		expect(
			await softDeleteCase(owner.id, rich.caseId, { publishedCopy: "archive" })
		).toEqual({ data: true });
		expect(await restoreCase(owner.id, rich.caseId)).toEqual({ data: true });

		await expectRefusedUnchanged(rich, to);
	});

	it("is allowed when the row belongs to another case, or to no case", async () => {
		const owner = await createTestUser();
		const rich = await createRichCase(from, owner);
		const elsewhere = await createTestCase(owner.id);
		await createPublishedRow(elsewhere.id);
		await createPublishedRow(null, { archivedAt: new Date() });
		await createPublishedRow(null);

		const result = await convertCaseKind(owner.id, rich.caseId, to);

		expect(result).toEqual({ data: { kind: to } });
	});
});

describe.each(KINDS)("converting a %s that is in Trash", (from) => {
	const to = otherKind(from);

	it("is refused for the owner with the error a missing case gets", async () => {
		const owner = await createTestUser();
		const rich = await createRichCase(from, owner);
		expect(await softDeleteCase(owner.id, rich.caseId)).toEqual({ data: true });

		await expectRefusedUnchanged(rich, to, "Permission denied");

		const stranger = await createTestUser();
		expect(await convertCaseKind(stranger.id, rich.caseId, to)).toEqual(
			await convertCaseKind(
				stranger.id,
				"00000000-0000-4000-8000-00000000dead",
				to
			)
		);
	});

	it("is allowed again once it is restored", async () => {
		const owner = await createTestUser();
		const rich = await createRichCase(from, owner);
		await softDeleteCase(owner.id, rich.caseId);
		await restoreCase(owner.id, rich.caseId);

		const result = await convertCaseKind(owner.id, rich.caseId, to);

		expect(result).toEqual({ data: { kind: to } });
	});
});

describe.each(KINDS)("converting a %s to what it already is", (kind) => {
	it("is refused, says so and changes nothing", async () => {
		const rich = await createRichCase(kind);

		await expectRefusedUnchanged(
			rich,
			kind,
			kind === "PATTERN"
				? "This is already a pattern"
				: "This is already a case"
		);
	});
});

describe.each(KINDS)("converting a %s that goes ahead", (from) => {
	const to = otherKind(from);

	it("changes the kind and nothing else anywhere", async () => {
		const rich = await createRichCase(from);
		const before = await snapshotAroundKind(rich.caseId);

		const result = await convertCaseKind(rich.ownerId, rich.caseId, to);

		expect(result).toEqual({ data: { kind: to } });
		expect((await storedKind(rich.caseId)).kind).toBe(to);
		expect(await snapshotAroundKind(rich.caseId)).toEqual(before);
	});

	it("leaves the elements, their tree and their deleted state as they were", async () => {
		const rich = await createRichCase(from);
		const before = await prisma.assuranceElement.findMany({
			where: { caseId: rich.caseId },
			orderBy: { id: "asc" },
		});

		await convertCaseKind(rich.ownerId, rich.caseId, to);

		const after = await prisma.assuranceElement.findMany({
			where: { caseId: rich.caseId },
			orderBy: { id: "asc" },
		});
		expect(after).toEqual(before);
		expect(after.filter((element) => element.deletedAt)).toHaveLength(1);
	});

	it("leaves the people, teams, integration grants and invites it is shared with", async () => {
		const rich = await createRichCase(from);
		const grants = () =>
			Promise.all([
				prisma.casePermission.findMany({
					where: { caseId: rich.caseId },
					orderBy: { id: "asc" },
				}),
				prisma.caseTeamPermission.findMany({
					where: { caseId: rich.caseId },
					orderBy: { id: "asc" },
				}),
				prisma.caseInvite.findMany({
					where: { caseId: rich.caseId },
					orderBy: { id: "asc" },
				}),
			]);
		const before = await grants();

		await convertCaseKind(rich.ownerId, rich.caseId, to);

		const after = await grants();
		expect(after).toEqual(before);
		expect(after[0]).toHaveLength(4);
		expect(
			after[0].some((grant) => grant.userId === rich.integrationSystemUserId)
		).toBe(true);
	});

	it("leaves the plugin data and the comments", async () => {
		const rich = await createRichCase(from);
		const readBoth = () =>
			Promise.all([
				prisma.pluginData.findMany({
					where: { caseId: rich.caseId },
					orderBy: { id: "asc" },
				}),
				prisma.comment.findMany({ orderBy: { id: "asc" } }),
			]);
		const before = await readBoth();

		await convertCaseKind(rich.ownerId, rich.caseId, to);

		const after = await readBoth();
		expect(after).toEqual(before);
		expect(after[0]).toHaveLength(2);
		expect(after[1]).toHaveLength(2);
	});

	it("leaves every other case alone, including the ones that cite it or were started from it", async () => {
		const rich = await createRichCase(from);
		const others = () =>
			prisma.assuranceCase.findMany({
				where: { id: { not: rich.caseId } },
				orderBy: { id: "asc" },
			});
		const before = await others();

		await convertCaseKind(rich.ownerId, rich.caseId, to);

		expect(await others()).toEqual(before);
		const derived = await prisma.assuranceCase.findUniqueOrThrow({
			where: { id: rich.derivedCaseId },
		});
		expect(derived.sourcePatternId).toBe(rich.caseId);
	});

	it("leaves every published row alone", async () => {
		const rich = await createRichCase(from);
		const before = await prisma.publishedAssuranceCase.findMany({
			orderBy: { id: "asc" },
		});
		expect(before.length).toBeGreaterThan(0);

		await convertCaseKind(rich.ownerId, rich.caseId, to);

		expect(
			await prisma.publishedAssuranceCase.findMany({ orderBy: { id: "asc" } })
		).toEqual(before);
	});

	it("keeps the case's publish fields, owner, name and description", async () => {
		const rich = await createRichCase(from);
		const before = await prisma.assuranceCase.findUniqueOrThrow({
			where: { id: rich.caseId },
		});

		await convertCaseKind(rich.ownerId, rich.caseId, to);

		const after = await prisma.assuranceCase.findUniqueOrThrow({
			where: { id: rich.caseId },
		});
		expect({
			...after,
			kind: before.kind,
			updatedAt: before.updatedAt,
		}).toEqual(before);
	});

	it("converts only the case asked about, not another of the same owner", async () => {
		const rich = await createRichCase(from);
		const sibling = await createTestCase(rich.ownerId, { kind: from });
		await createTestElement(sibling.id, rich.ownerId, { name: "G" });

		await convertCaseKind(rich.ownerId, rich.caseId, to);

		expect((await storedKind(sibling.id)).kind).toBe(from);
	});
});

describe("converting back and forth", () => {
	it("returns a case to exactly the state it started in", async () => {
		const rich = await createRichCase("CASE");
		const before = await snapshotAroundKind(rich.caseId);

		expect(await convertCaseKind(rich.ownerId, rich.caseId, "PATTERN")).toEqual(
			{
				data: { kind: "PATTERN" },
			}
		);
		expect(await convertCaseKind(rich.ownerId, rich.caseId, "CASE")).toEqual({
			data: { kind: "CASE" },
		});

		expect((await storedKind(rich.caseId)).kind).toBe("CASE");
		expect(await snapshotAroundKind(rich.caseId)).toEqual(before);
	});

	it("refuses the same conversion twice in a row", async () => {
		const rich = await createRichCase("CASE");

		expect(await convertCaseKind(rich.ownerId, rich.caseId, "PATTERN")).toEqual(
			{
				data: { kind: "PATTERN" },
			}
		);
		const again = await convertCaseKind(rich.ownerId, rich.caseId, "PATTERN");

		expect(again).toEqual({ error: "This is already a pattern" });
	});
});

describe("telling people why", () => {
	it("tells a person who cannot see a published case nothing about it", async () => {
		const rich = await createRichCase("CASE");
		await prisma.assuranceCase.update({
			where: { id: rich.caseId },
			data: { published: true, publishStatus: "PUBLISHED" },
		});
		const stranger = await createTestUser();
		const viewer = await createTestUser();
		await prisma.casePermission.create({
			data: {
				caseId: rich.caseId,
				userId: viewer.id,
				grantedById: rich.ownerId,
				permission: "VIEW",
			},
		});

		const forStranger = await convertCaseKind(
			stranger.id,
			rich.caseId,
			"PATTERN"
		);
		const forViewer = await convertCaseKind(viewer.id, rich.caseId, "PATTERN");
		const forMissing = await convertCaseKind(
			stranger.id,
			"00000000-0000-4000-8000-00000000dead",
			"PATTERN"
		);

		expect(forStranger).toEqual({ error: "Permission denied" });
		expect(forViewer).toEqual(forStranger);
		expect(forMissing).toEqual(forStranger);
	});

	it("tells an admin of a published case to unpublish it first", async () => {
		const rich = await createRichCase("CASE");
		await prisma.assuranceCase.update({
			where: { id: rich.caseId },
			data: { published: true, publishStatus: "PUBLISHED" },
		});
		const admin = await createTestUser();
		await prisma.casePermission.create({
			data: {
				caseId: rich.caseId,
				userId: admin.id,
				grantedById: rich.ownerId,
				permission: "ADMIN",
			},
		});

		const result = await convertCaseKind(admin.id, rich.caseId, "PATTERN");

		expect(result).toEqual({
			error: "Unpublish this case before converting it",
		});
	});
});
