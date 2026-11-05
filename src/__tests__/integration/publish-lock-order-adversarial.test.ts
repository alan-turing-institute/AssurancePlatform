import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
	purgeCase,
	removeArchivedCopy,
	restoreCase,
	softDeleteCase,
} from "@/lib/services/case-trash-service";
import {
	publishAssuranceCase,
	unpublishAssuranceCase,
} from "@/lib/services/publish-service";
import { expectSuccess } from "../utils/assertion-helpers";
import { mockNoAuth } from "../utils/auth-helpers";
import {
	holdCaseRow,
	inconsistencies,
	openCase,
	publishedRows,
	storedState,
} from "../utils/publish-type-kit";
import { holdRowLock, waitForLockWait } from "../utils/row-lock-test-utils";

/**
 * Unpublish, first publish, trash, restore, purge and the removal of an
 * archived copy all write both the case row and the case's published rows.
 * Each pair is made to meet by holding the case row's lock in an open
 * transaction, so the two calls queue behind it in a known order and neither
 * can have taken a published row before the case row. A pair that took the
 * two locks in opposite orders would deadlock when the holder lets go, and one
 * of the calls would fail.
 */

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

beforeEach(async () => {
	await mockNoAuth();
});

/** A published case. */
async function publishedCase() {
	const open = await openCase("CASE");
	expectSuccess(await publishAssuranceCase(open.ownerId, open.caseId));
	return open;
}

/** A published case in Trash whose Discover copy was archived, with the copy's id. */
async function archivedCase() {
	const open = await publishedCase();
	const [row] = await publishedRows(open.caseId);
	if (!row) {
		throw new Error("the published case has no row");
	}
	expectSuccess(
		await softDeleteCase(open.ownerId, open.caseId, {
			publishedCopy: "archive",
		})
	);
	return { ...open, publishedId: row.id };
}

describe("unpublishing while a republish is part-way through", () => {
	it("takes down the version the republish was still writing", async () => {
		const { caseId, ownerId } = await publishedCase();
		const [current] = await publishedRows(caseId);
		const holder = await holdRowLock(async (tx) => {
			await tx.assuranceCase.update({
				where: { id: caseId },
				data: { publishedAt: new Date() },
			});
			await tx.publishedAssuranceCase.updateMany({
				where: { assuranceCaseId: caseId, isCurrent: true },
				data: { isCurrent: false },
			});
			await tx.publishedAssuranceCase.create({
				data: {
					type: "ASSURANCE_CASE",
					title: current?.title ?? "",
					slug: current?.slug ?? "",
					content: {},
					assuranceCaseId: caseId,
				},
			});
		});

		const unpublishing = unpublishAssuranceCase(ownerId, caseId);
		await waitForLockWait();
		await holder.release();

		expect(await unpublishing).toHaveProperty("data");
		const state = await storedState(caseId);
		expect(state.stored.published).toBe(false);
		expect(state.rows).toHaveLength(0);
		expect(inconsistencies(state)).toEqual([]);
	});
});

describe.each([
	"remove",
	"archive",
] as const)("unpublishing against a trash that keeps or removes the copy: %s", (publishedCopy) => {
	it("is refused as not found, and leaves the trash's result alone, when the trash goes first", async () => {
		const { caseId, ownerId } = await publishedCase();
		const holder = await holdCaseRow(caseId);

		const trashing = softDeleteCase(ownerId, caseId, { publishedCopy });
		await waitForLockWait(5000, 1);
		const unpublishing = unpublishAssuranceCase(ownerId, caseId);
		await waitForLockWait(5000, 2);
		await holder.rollback();
		const [trashed, unpublished] = await Promise.all([trashing, unpublishing]);

		expect(trashed).toEqual({ data: true });
		expect(unpublished).toEqual({ error: "Case not found" });
		const state = await storedState(caseId);
		expect(state.stored.deletedAt).not.toBeNull();
		if (publishedCopy === "archive") {
			expect(state.stored.published).toBe(true);
			expect(state.rows).toHaveLength(1);
			expect(state.rows[0]).toMatchObject({ isCurrent: true });
			expect(state.rows[0]?.archivedAt).not.toBeNull();
		} else {
			expect(state.stored.published).toBe(false);
			expect(state.rows).toHaveLength(0);
		}
	});

	it("succeeds, and so does the trash, when the unpublish goes first", async () => {
		const { caseId, ownerId } = await publishedCase();
		const holder = await holdCaseRow(caseId);

		const unpublishing = unpublishAssuranceCase(ownerId, caseId);
		await waitForLockWait(5000, 1);
		const trashing = softDeleteCase(ownerId, caseId, { publishedCopy });
		await waitForLockWait(5000, 2);
		await holder.rollback();
		const [unpublished, trashed] = await Promise.all([unpublishing, trashing]);

		expect(unpublished).toHaveProperty("data");
		expect(trashed).toEqual({ data: true });
		const state = await storedState(caseId);
		expect(state.stored.deletedAt).not.toBeNull();
		expect(state.stored.published).toBe(false);
		expect(state.rows).toHaveLength(0);
	});
});

describe("unpublishing against a direct first publish of a case that is already published", () => {
	it("leaves the case unpublished with no rows when the publish goes first", async () => {
		const { caseId, ownerId } = await publishedCase();
		const holder = await holdCaseRow(caseId);

		const publishing = publishAssuranceCase(ownerId, caseId);
		await waitForLockWait(5000, 1);
		const unpublishing = unpublishAssuranceCase(ownerId, caseId);
		await waitForLockWait(5000, 2);
		await holder.rollback();
		const [published, unpublished] = await Promise.all([
			publishing,
			unpublishing,
		]);

		expect(published).toHaveProperty("data");
		expect(unpublished).toHaveProperty("data");
		const state = await storedState(caseId);
		expect(state.stored.published).toBe(false);
		expect(state.rows).toHaveLength(0);
		expect(inconsistencies(state)).toEqual([]);
	});

	it("leaves the case published with one current row when the unpublish goes first", async () => {
		const { caseId, ownerId } = await publishedCase();
		const holder = await holdCaseRow(caseId);

		const unpublishing = unpublishAssuranceCase(ownerId, caseId);
		await waitForLockWait(5000, 1);
		const publishing = publishAssuranceCase(ownerId, caseId);
		await waitForLockWait(5000, 2);
		await holder.rollback();
		const [unpublished, published] = await Promise.all([
			unpublishing,
			publishing,
		]);

		expect(unpublished).toHaveProperty("data");
		expect(published).toHaveProperty("data");
		const state = await storedState(caseId);
		expect(state.stored.published).toBe(true);
		expect(state.rows).toHaveLength(1);
		expect(inconsistencies(state)).toEqual([]);
	});
});

describe("removing an archived copy against a restore", () => {
	it("keeps the copy live, and refuses the removal as not found, when the restore goes first", async () => {
		const { caseId, ownerId, publishedId } = await archivedCase();
		const holder = await holdCaseRow(caseId);

		const restoring = restoreCase(ownerId, caseId);
		await waitForLockWait(5000, 1);
		const removing = removeArchivedCopy(ownerId, publishedId);
		await waitForLockWait(5000, 2);
		await holder.rollback();
		const [restored, removed] = await Promise.all([restoring, removing]);

		expect(restored).toEqual({ data: true });
		expect(removed).toEqual({ error: "Archived copy not found" });
		const state = await storedState(caseId);
		expect(state.stored).toMatchObject({ deletedAt: null, published: true });
		expect(state.rows).toHaveLength(1);
		expect(state.rows[0]).toMatchObject({ id: publishedId, isCurrent: true });
		expect(state.rows[0]?.archivedAt).toBeNull();
		expect(inconsistencies(state)).toEqual([]);
	});

	it("restores a draft with no copy when the removal goes first", async () => {
		const { caseId, ownerId, publishedId } = await archivedCase();
		const holder = await holdCaseRow(caseId);

		const removing = removeArchivedCopy(ownerId, publishedId);
		await waitForLockWait(5000, 1);
		const restoring = restoreCase(ownerId, caseId);
		await waitForLockWait(5000, 2);
		await holder.rollback();
		const [removed, restored] = await Promise.all([removing, restoring]);

		expect(removed).toEqual({ data: true });
		expect(restored).toEqual({ data: true });
		const state = await storedState(caseId);
		expect(state.stored).toMatchObject({ deletedAt: null, published: false });
		expect(state.rows).toHaveLength(0);
		expect(inconsistencies(state)).toEqual([]);
	});
});

describe("removing an archived copy against a permanent delete of its case", () => {
	it("removes the copy after the case is gone", async () => {
		const { caseId, ownerId, publishedId } = await archivedCase();
		const holder = await holdCaseRow(caseId);

		const purging = purgeCase(ownerId, caseId);
		await waitForLockWait(5000, 1);
		const removing = removeArchivedCopy(ownerId, publishedId);
		await waitForLockWait(5000, 2);
		await holder.rollback();
		const [purged, removed] = await Promise.all([purging, removing]);

		expect(purged).toEqual({ data: true });
		expect(removed).toEqual({ data: true });
		expect(
			await prisma.assuranceCase.findUnique({ where: { id: caseId } })
		).toBeNull();
		expect(
			await prisma.publishedAssuranceCase.findUnique({
				where: { id: publishedId },
			})
		).toBeNull();
	});

	it("deletes the case with the copy gone when the removal goes first", async () => {
		const { caseId, ownerId, publishedId } = await archivedCase();
		const holder = await holdCaseRow(caseId);

		const removing = removeArchivedCopy(ownerId, publishedId);
		await waitForLockWait(5000, 1);
		const purging = purgeCase(ownerId, caseId);
		await waitForLockWait(5000, 2);
		await holder.rollback();
		const [removed, purged] = await Promise.all([removing, purging]);

		expect(removed).toEqual({ data: true });
		expect(purged).toEqual({ data: true });
		expect(
			await prisma.assuranceCase.findUnique({ where: { id: caseId } })
		).toBeNull();
		expect(
			await prisma.publishedAssuranceCase.findUnique({
				where: { id: publishedId },
			})
		).toBeNull();
	});
});
