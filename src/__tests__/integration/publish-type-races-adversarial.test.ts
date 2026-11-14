import { mkdir, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UPLOADS_DIR } from "@/lib/services/blob-storage-service";
import { convertCaseKind } from "@/lib/services/case-kind-service";
import {
	archivePublishedCopies,
	publishAssuranceCase,
	removePublishedCopies,
	unpublishAssuranceCase,
	updatePublishedCase,
} from "@/lib/services/publish-service";
import { expectSuccess } from "../utils/assertion-helpers";
import { mockNoAuth } from "../utils/auth-helpers";
import { createTestCaseInformation } from "../utils/prisma-factories";
import {
	holdCaseRow,
	inconsistencies,
	KINDS,
	openCase,
	otherKind,
	publishedRows,
	rowIdentity,
	storedState,
	TYPE_FOR_KIND,
} from "../utils/publish-type-kit";
import { holdRowLock, waitForLockWait } from "../utils/row-lock-test-utils";

/**
 * Publishing and republishing racing a conversion, an unpublish or a move to
 * Trash. Each race is made real by holding the case row's lock in an open
 * transaction, so the racing call's write waits behind it and sees whatever
 * that transaction commits: the outcome does not depend on scheduling. After
 * every refusal the stored case and its published rows agree: the case's kind,
 * its published flag, the row's type and which row is current.
 */

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

beforeEach(async () => {
	await mockNoAuth();
});

const CHANGED = {
	error: "The case changed while it was being published. Try again.",
};

/** Writes the stored feature image a case's information points at, and returns its key. */
async function seedLiveFeatureImage(caseId: string): Promise<string> {
	const key = `cases/${caseId}/case-information/original.png`;
	const filePath = join(UPLOADS_DIR, key);
	await mkdir(join(filePath, ".."), { recursive: true });
	await writeFile(filePath, Buffer.from("fake-png-bytes"));
	return key;
}

/** Every publish-time image copy on disk, as `<folder>/<file>`, sorted. */
async function listPublishedFiles(): Promise<string[]> {
	const publishedDir = join(UPLOADS_DIR, "published");
	const folders = await readdir(publishedDir).catch(() => []);
	const files = await Promise.all(
		folders.map(async (folder) =>
			(await readdir(join(publishedDir, folder)).catch(() => [])).map(
				(file) => `${folder}/${file}`
			)
		)
	);
	return files.flat().sort();
}

describe.each(
	KINDS
)("publishing a %s while something else commits first", (kind) => {
	const to = otherKind(kind);

	it("is refused when a conversion commits first, publishes nothing, and the next publish takes the new kind's type", async () => {
		const { caseId, ownerId } = await openCase(kind);
		const holder = await holdCaseRow(caseId);

		const converting = convertCaseKind(ownerId, caseId, to);
		await waitForLockWait(5000, 1);
		const publishing = publishAssuranceCase(ownerId, caseId);
		await waitForLockWait(5000, 2);
		await holder.rollback();
		const [converted, published] = await Promise.all([converting, publishing]);

		expect(converted).toEqual({ data: { kind: to } });
		expect(published).toEqual(CHANGED);
		const state = await storedState(caseId);
		expect(state.stored).toMatchObject({
			kind: to,
			published: false,
			publishStatus: "DRAFT",
			publishedAt: null,
		});
		expect(state.rows).toHaveLength(0);
		expect(inconsistencies(state)).toEqual([]);

		expectSuccess(await publishAssuranceCase(ownerId, caseId));
		expect((await publishedRows(caseId)).map((row) => row.type)).toEqual([
			TYPE_FOR_KIND[to],
		]);
	});

	it("keeps its kind, refuses the conversion and writes the row of its kind when the publish commits first", async () => {
		const { caseId, ownerId } = await openCase(kind);
		const holder = await holdCaseRow(caseId);

		const publishing = publishAssuranceCase(ownerId, caseId);
		await waitForLockWait(5000, 1);
		const converting = convertCaseKind(ownerId, caseId, to);
		await waitForLockWait(5000, 2);
		await holder.rollback();
		const [published, converted] = await Promise.all([publishing, converting]);

		expect(published).toHaveProperty("data");
		expect(converted).toHaveProperty("error");
		const state = await storedState(caseId);
		expect(state.stored.kind).toBe(kind);
		expect(state.rows.map((row) => row.type)).toEqual([TYPE_FOR_KIND[kind]]);
		expect(inconsistencies(state)).toEqual([]);
	});

	it("ignores a conversion that was rolled back, and writes the row of its own kind", async () => {
		const { caseId, ownerId } = await openCase(kind);
		const holder = await holdRowLock(async (tx) => {
			await tx.assuranceCase.update({
				where: { id: caseId },
				data: { kind: to },
			});
		});

		const publishing = publishAssuranceCase(ownerId, caseId);
		await waitForLockWait();
		await holder.rollback();
		const published = await publishing;

		expect(published).toHaveProperty("data");
		const state = await storedState(caseId);
		expect(state.stored.kind).toBe(kind);
		expect(state.rows.map((row) => row.type)).toEqual([TYPE_FOR_KIND[kind]]);
		expect(inconsistencies(state)).toEqual([]);
	});

	it("is refused as not found, with nothing written, when the case reaches Trash first", async () => {
		const { caseId, ownerId } = await openCase(kind);
		const holder = await holdRowLock(async (tx) => {
			await tx.assuranceCase.update({
				where: { id: caseId },
				data: { deletedAt: new Date(), deletedById: ownerId },
			});
		});

		const publishing = publishAssuranceCase(ownerId, caseId);
		await waitForLockWait();
		await holder.release();

		expect(await publishing).toEqual({ error: "Case not found" });
		const state = await storedState(caseId);
		expect(state.stored.published).toBe(false);
		expect(state.rows).toHaveLength(0);
	});

	it("ends published with one current row of its type when an unpublish commits first, since a first publish does not need the case to be published", async () => {
		const { caseId, ownerId } = await openCase(kind);
		expectSuccess(await publishAssuranceCase(ownerId, caseId));
		const holder = await holdRowLock(async (tx) => {
			await removePublishedCopies(tx, [caseId]);
		});

		const publishing = publishAssuranceCase(ownerId, caseId);
		await waitForLockWait();
		await holder.release();

		expect(await publishing).toHaveProperty("data");
		const state = await storedState(caseId);
		expect(state.rows.map((row) => row.type)).toEqual([TYPE_FOR_KIND[kind]]);
		expect(inconsistencies(state)).toEqual([]);
	});

	it("leaves one current row, all of the same type, when two publishes of the same case run together", async () => {
		const { caseId, ownerId } = await openCase(kind);
		const holder = await holdCaseRow(caseId);

		const first = publishAssuranceCase(ownerId, caseId);
		await waitForLockWait(5000, 1);
		const second = publishAssuranceCase(ownerId, caseId);
		await waitForLockWait(5000, 2);
		await holder.rollback();
		const results = await Promise.all([first, second]);

		expect(results.every((result) => "data" in result)).toBe(true);
		const state = await storedState(caseId);
		expect(state.rows).toHaveLength(2);
		expect(state.rows.map((row) => row.type)).toEqual([
			TYPE_FOR_KIND[kind],
			TYPE_FOR_KIND[kind],
		]);
		expect(inconsistencies(state)).toEqual([]);
	});
});

describe.each(
	KINDS
)("updating the published copy of a %s while something else commits first", (kind) => {
	const to = otherKind(kind);

	async function publishedCase() {
		const open = await openCase(kind);
		expectSuccess(await publishAssuranceCase(open.ownerId, open.caseId));
		return open;
	}

	it("is refused when an unpublish commits first, writes no row, and the case stays a draft", async () => {
		const { caseId, ownerId } = await publishedCase();
		const holder = await holdRowLock(async (tx) => {
			await removePublishedCopies(tx, [caseId]);
		});

		const updating = updatePublishedCase(ownerId, caseId);
		await waitForLockWait();
		await holder.release();

		expect(await updating).toEqual(CHANGED);
		const state = await storedState(caseId);
		expect(state.stored).toMatchObject({
			kind,
			published: false,
			publishStatus: "DRAFT",
			publishedAt: null,
		});
		expect(state.rows).toHaveLength(0);
		expect(inconsistencies(state)).toEqual([]);
	});

	it("is refused when an unpublish and a conversion both commit first, and the next publish takes the new kind's type", async () => {
		const { caseId, ownerId } = await publishedCase();
		const holder = await holdRowLock(async (tx) => {
			await removePublishedCopies(tx, [caseId]);
			await tx.assuranceCase.update({
				where: { id: caseId },
				data: { kind: to },
			});
		});

		const updating = updatePublishedCase(ownerId, caseId);
		await waitForLockWait();
		await holder.release();

		expect(await updating).toEqual(CHANGED);
		const state = await storedState(caseId);
		expect(state.stored).toMatchObject({ kind: to, published: false });
		expect(state.rows).toHaveLength(0);
		expect(inconsistencies(state)).toEqual([]);

		expectSuccess(await publishAssuranceCase(ownerId, caseId));
		expect((await publishedRows(caseId)).map((row) => row.type)).toEqual([
			TYPE_FOR_KIND[to],
		]);
	});

	it("is refused on the kind alone, when the case is still published but is no longer of the kind it was composed from", async () => {
		const { caseId, ownerId } = await publishedCase();
		const before = await publishedRows(caseId);
		const holder = await holdRowLock(async (tx) => {
			await tx.assuranceCase.update({
				where: { id: caseId },
				data: { kind: to },
			});
		});

		const updating = updatePublishedCase(ownerId, caseId);
		await waitForLockWait();
		await holder.release();

		expect(await updating).toEqual(CHANGED);
		const after = await publishedRows(caseId);
		expect(after.map(rowIdentity)).toEqual(before.map(rowIdentity));
		expect(after.map((row) => row.type)).toEqual([TYPE_FOR_KIND[kind]]);
	});

	it("ignores a conversion that rolled back, and writes a row of its own kind", async () => {
		const { caseId, ownerId } = await publishedCase();
		const holder = await holdRowLock(async (tx) => {
			await tx.assuranceCase.update({
				where: { id: caseId },
				data: { kind: to },
			});
		});

		const updating = updatePublishedCase(ownerId, caseId);
		await waitForLockWait();
		await holder.rollback();

		expect(await updating).toHaveProperty("data");
		const state = await storedState(caseId);
		expect(state.stored.kind).toBe(kind);
		expect(state.rows.map((row) => row.type)).toEqual([
			TYPE_FOR_KIND[kind],
			TYPE_FOR_KIND[kind],
		]);
		expect(inconsistencies(state)).toEqual([]);
	});

	it("is refused as not found, and the archived row is kept as it was, when the case reaches Trash with its copy archived first", async () => {
		const { caseId, ownerId } = await publishedCase();
		const holder = await holdRowLock(async (tx) => {
			await tx.assuranceCase.update({
				where: { id: caseId },
				data: { deletedAt: new Date(), deletedById: ownerId },
			});
			await archivePublishedCopies(tx, [caseId], ownerId);
		});

		const updating = updatePublishedCase(ownerId, caseId);
		await waitForLockWait();
		await holder.release();

		expect(await updating).toEqual({ error: "Case not found" });
		const rows = await publishedRows(caseId);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			type: TYPE_FOR_KIND[kind],
			isCurrent: true,
		});
		expect(rows[0]?.archivedAt).not.toBeNull();
	});

	it("is refused when a real unpublish is queued ahead of it, and nothing is left published", async () => {
		const { caseId, ownerId } = await publishedCase();
		const holder = await holdCaseRow(caseId);

		const unpublishing = unpublishAssuranceCase(ownerId, caseId);
		await waitForLockWait(5000, 1);
		const updating = updatePublishedCase(ownerId, caseId);
		await waitForLockWait(5000, 2);
		await holder.rollback();
		const [unpublished, updated] = await Promise.all([unpublishing, updating]);

		expect(unpublished).toHaveProperty("data");
		expect(updated).toEqual(CHANGED);
		const state = await storedState(caseId);
		expect(state.stored.published).toBe(false);
		expect(state.rows).toHaveLength(0);
		expect(inconsistencies(state)).toEqual([]);
	});

	it("takes down both versions, and deletes the new image copy, when a real unpublish queues behind a real update", async () => {
		const open = await openCase(kind);
		const { caseId, ownerId } = open;
		const liveKey = await seedLiveFeatureImage(caseId);
		await createTestCaseInformation(caseId, { featureImageUrl: liveKey });
		const filesBefore = await listPublishedFiles();
		expectSuccess(await publishAssuranceCase(ownerId, caseId));
		const holder = await holdCaseRow(caseId);

		const updating = updatePublishedCase(ownerId, caseId);
		await waitForLockWait(5000, 1);
		const unpublishing = unpublishAssuranceCase(ownerId, caseId);
		await waitForLockWait(5000, 2);
		await holder.rollback();
		const [updated, unpublished] = await Promise.all([updating, unpublishing]);

		expect(updated).toHaveProperty("data");
		expect(unpublished).toHaveProperty("data");
		const state = await storedState(caseId);
		expect(state.stored).toMatchObject({
			published: false,
			publishStatus: "DRAFT",
			publishedAt: null,
		});
		expect(state.rows).toHaveLength(0);
		expect(inconsistencies(state)).toEqual([]);
		expect(await listPublishedFiles()).toEqual(filesBefore);
	});

	it("leaves one current row, all of the same type, when two updates run together", async () => {
		const { caseId, ownerId } = await publishedCase();
		const holder = await holdCaseRow(caseId);

		const first = updatePublishedCase(ownerId, caseId);
		await waitForLockWait(5000, 1);
		const second = updatePublishedCase(ownerId, caseId);
		await waitForLockWait(5000, 2);
		await holder.rollback();
		const results = await Promise.all([first, second]);

		expect(results.every((result) => "data" in result)).toBe(true);
		const state = await storedState(caseId);
		expect(state.rows).toHaveLength(3);
		expect(state.rows.map((row) => row.type)).toEqual([
			TYPE_FOR_KIND[kind],
			TYPE_FOR_KIND[kind],
			TYPE_FOR_KIND[kind],
		]);
		expect(inconsistencies(state)).toEqual([]);
	});
});
