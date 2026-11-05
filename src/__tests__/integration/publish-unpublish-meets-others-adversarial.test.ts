import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
	removeArchivedCopy,
	restoreCase,
	softDeleteCase,
} from "@/lib/services/case-trash-service";
import { readMedia } from "@/lib/services/file-storage-service";
import {
	publishAssuranceCase,
	unpublishAssuranceCase,
	updatePublishedCase,
} from "@/lib/services/publish-service";
import { deleteAccountForRetention } from "@/lib/services/user-management-service";
import { expectSuccess } from "../utils/assertion-helpers";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	createTestPermission,
	createTestUser,
} from "../utils/prisma-factories";
import {
	archivedScene,
	disagreements,
	discoverProblems,
	imageCopyProblems,
	newScene,
	observe,
	type PublishedScene,
	publishedFileKeys,
	publishedScene,
	runQueued,
} from "../utils/publish-race-kit";
import { publishedRows } from "../utils/publish-type-kit";
import { holdRowLock, waitForLockWait } from "../utils/row-lock-test-utils";
import { publishCase, setStatus } from "../utils/variables-kit";

/**
 * An unpublish that meets another writer of the same case. Where a republish
 * is already part-way through, the unpublish takes the new version down too;
 * where the case has gone to Trash, it changes nothing. A removal of an
 * archived copy that loses to a restore leaves the restored case as it was.
 * With nobody else acting, publishing, republishing and unpublishing do what
 * they did before.
 */

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/services/sse-connection-manager", async (importOriginal) => ({
	...(await importOriginal<
		typeof import("@/lib/services/sse-connection-manager")
	>()),
	emitSSEEvent: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.setConfig({ testTimeout: 90_000 });

beforeEach(async () => {
	await mockNoAuth();
});

const WAIT_MS = 20_000;
const CHANGED = {
	error: "The case changed while it was being published. Try again.",
};
const UNPUBLISHED = { data: { success: true } };

async function signInAsOwner(scene: PublishedScene) {
	const user = await prisma.user.findUniqueOrThrow({
		where: { id: scene.ownerId },
	});
	await mockAuth(user.id, user.username, user.email);
}

async function unpublishRoute(caseId: string) {
	const { DELETE } = await import("@/app/api/cases/[id]/publish/route");
	return await DELETE(
		new NextRequest(`http://localhost:3000/api/cases/${caseId}/publish`, {
			method: "DELETE",
		}),
		{ params: Promise.resolve({ id: caseId }) }
	);
}

/** A transaction holding the lock on the case's only published row, rolled back to let the queue go in order. */
async function holdPublishedRow(caseId: string) {
	const [row] = await publishedRows(caseId);
	if (!row) {
		throw new Error("no published row to hold");
	}
	return await holdRowLock(async (tx) => {
		await tx.publishedAssuranceCase.update({
			where: { id: row.id },
			data: { title: row.title },
		});
	});
}

describe("an unpublish that meets a republish that is part-way through", () => {
	it("takes the new version down as well, when the republish is waiting on the old row", async () => {
		const before = await publishedFileKeys();
		const scene = await publishedScene();
		const holder = await holdPublishedRow(scene.caseId);

		const republishing = updatePublishedCase(scene.ownerId, scene.caseId);
		await waitForLockWait(WAIT_MS, 1);
		const unpublishing = unpublishAssuranceCase(scene.ownerId, scene.caseId);
		await waitForLockWait(WAIT_MS, 2);
		await holder.rollback();
		const [republished, unpublished] = await Promise.all([
			republishing,
			unpublishing,
		]);

		expect(republished).toHaveProperty("data");
		expect(unpublished).toEqual(UNPUBLISHED);
		const state = await observe(scene.caseId);
		expect(state).toMatchObject({ published: false, rows: [] });
		expect(disagreements(state)).toEqual([]);
		expect(await discoverProblems(scene.caseId)).toEqual([]);
		expect(await imageCopyProblems(before)).toEqual([]);
		expect(await publishedFileKeys()).toEqual(before);
	});

	it("goes first and leaves the case unpublished, and the republish is refused as changed, when the unpublish is waiting on the old row", async () => {
		const before = await publishedFileKeys();
		const scene = await publishedScene();
		const holder = await holdPublishedRow(scene.caseId);

		const unpublishing = unpublishAssuranceCase(scene.ownerId, scene.caseId);
		await waitForLockWait(WAIT_MS, 1);
		const republishing = updatePublishedCase(scene.ownerId, scene.caseId);
		await waitForLockWait(WAIT_MS, 2);
		await holder.rollback();
		const [unpublished, republished] = await Promise.all([
			unpublishing,
			republishing,
		]);

		expect(unpublished).toEqual(UNPUBLISHED);
		expect(republished).toEqual(CHANGED);
		const state = await observe(scene.caseId);
		expect(state).toMatchObject({ published: false, rows: [] });
		expect(await discoverProblems(scene.caseId)).toEqual([]);
		expect(await publishedFileKeys()).toEqual(before);
	});

	it("leaves the case unpublished whichever of a republish and an unpublish reaches the row first", async () => {
		for (const unpublishFirst of [false, true]) {
			const before = await publishedFileKeys();
			const scene = await publishedScene();
			const operations = [
				() => updatePublishedCase(scene.ownerId, scene.caseId),
				() => unpublishAssuranceCase(scene.ownerId, scene.caseId),
			];
			if (unpublishFirst) {
				operations.reverse();
			}

			await runQueued(scene.caseId, scene, operations);

			const state = await observe(scene.caseId);
			expect(state).toMatchObject({ published: false, rows: [] });
			expect(await discoverProblems(scene.caseId)).toEqual([]);
			expect(await publishedFileKeys()).toEqual(before);
		}
	});
});

describe("an unpublish and a republish through the routes", () => {
	const REPUBLISH = (caseId: string) => setStatus(caseId, "PUBLISHED");
	const UNPUBLISH_BY_STATUS = (caseId: string) => setStatus(caseId, "DRAFT");

	it.each([
		[
			"a republish by status, then an unpublish by status",
			REPUBLISH,
			UNPUBLISH_BY_STATUS,
			true,
		],
		[
			"an unpublish by status, then a republish by status",
			UNPUBLISH_BY_STATUS,
			REPUBLISH,
			false,
		],
		[
			"a republish by status, then an unpublish by delete",
			REPUBLISH,
			unpublishRoute,
			true,
		],
		[
			"an unpublish by delete, then a republish by status",
			unpublishRoute,
			REPUBLISH,
			false,
		],
		[
			"a second publish, then an unpublish by delete",
			publishCase,
			unpublishRoute,
			true,
		],
		[
			"an unpublish by delete, then a second publish",
			unpublishRoute,
			publishCase,
			false,
		],
	])("%s leaves the case and its copies in agreement and answers neither with a server error", async (_label, first, second, endsUnpublished) => {
		const before = await publishedFileKeys();
		const scene = await publishedScene();
		await signInAsOwner(scene);

		const responses = (await runQueued(scene.caseId, scene, [
			() => first(scene.caseId),
			() => second(scene.caseId),
		])) as Response[];

		expect(responses.map((response) => response.status)).not.toContain(500);
		const state = await observe(scene.caseId);
		expect(disagreements(state)).toEqual([]);
		expect(await discoverProblems(scene.caseId)).toEqual([]);
		expect(await imageCopyProblems(before)).toEqual([]);
		if (endsUnpublished) {
			expect(state).toMatchObject({ published: false, rows: [] });
		}
	});
});

describe("two unpublishes of the same case queued together", () => {
	it("both succeed, the second finding nothing left to remove, and no image copy is left", async () => {
		const before = await publishedFileKeys();
		const scene = await publishedScene();
		const unpublish = (s: PublishedScene) =>
			unpublishAssuranceCase(s.ownerId, s.caseId);

		const results = await runQueued(scene.caseId, scene, [
			unpublish,
			unpublish,
		]);

		expect(results).toEqual([UNPUBLISHED, UNPUBLISHED]);
		expect(await observe(scene.caseId)).toMatchObject({
			published: false,
			rows: [],
		});
		expect(await publishedFileKeys()).toEqual(before);
	});
});

describe("an unpublish that meets a bin or an account deletion", () => {
	const unpublish = (scene: PublishedScene) =>
		unpublishAssuranceCase(scene.ownerId, scene.caseId);
	const bin = (copy: "archive" | "remove") => (scene: PublishedScene) =>
		softDeleteCase(scene.ownerId, scene.caseId, { publishedCopy: copy });

	it("changes nothing and answers not found, and the archived copy survives, when a bin that archives comes first", async () => {
		const before = await publishedFileKeys();
		const scene = await publishedScene();

		const [binned, unpublished] = await runQueued(scene.caseId, scene, [
			bin("archive"),
			unpublish,
		]);

		expect(binned).toEqual({ data: true });
		expect(unpublished).toEqual({ error: "Case not found" });
		expect(await observe(scene.caseId)).toMatchObject({
			trashed: true,
			published: true,
			rows: [{ archived: true, isCurrent: true }],
		});
		expect(await imageCopyProblems(before)).toEqual([]);
	});

	it("changes nothing and answers not found when a bin that removes the copy comes first", async () => {
		const scene = await publishedScene();

		const [binned, unpublished] = await runQueued(scene.caseId, scene, [
			bin("remove"),
			unpublish,
		]);

		expect(binned).toEqual({ data: true });
		expect(unpublished).toEqual({ error: "Case not found" });
		expect(await observe(scene.caseId)).toMatchObject({
			trashed: true,
			published: false,
			rows: [],
		});
	});

	it("changes nothing and answers not found, and the archived copy survives, when an account deletion comes first", async () => {
		const scene = await publishedScene();

		const [deleted, unpublished] = await runQueued(scene.caseId, scene, [
			(s) => deleteAccountForRetention(s.ownerId),
			unpublish,
		]);

		expect(deleted).toEqual({ data: true });
		expect(unpublished).toEqual({ error: "Case not found" });
		expect(await observe(scene.caseId)).toMatchObject({
			trashed: true,
			published: true,
			rows: [{ archived: true, isCurrent: true }],
		});
	});

	it("succeeds, and the bin then finds nothing to archive, when the unpublish comes first", async () => {
		const scene = await publishedScene();

		const [unpublished, binned] = await runQueued(scene.caseId, scene, [
			unpublish,
			bin("archive"),
		]);

		expect(unpublished).toEqual(UNPUBLISHED);
		expect(binned).toEqual({ data: true });
		expect(await observe(scene.caseId)).toMatchObject({
			trashed: true,
			published: false,
			rows: [],
		});
	});
});

describe("removing an archived copy", () => {
	it("deletes the copy and its image, leaves the case in Trash as a draft, and a restore then gives a draft", async () => {
		const before = await publishedFileKeys();
		const scene = await archivedScene();

		expect(await removeArchivedCopy(scene.ownerId, scene.publishedId)).toEqual({
			data: true,
		});

		expect(await observe(scene.caseId)).toMatchObject({
			trashed: true,
			published: false,
			publishStatus: "DRAFT",
			rows: [],
		});
		expect(await publishedFileKeys()).toEqual(before);
		expectSuccess(await restoreCase(scene.ownerId, scene.caseId));
		expect(await observe(scene.caseId)).toMatchObject({
			trashed: false,
			published: false,
			rows: [],
		});
		expect(await readMedia(scene.liveKey)).not.toBeNull();
	});

	it("answers not found for a copy that does not exist, one that is not archived, and one archived for someone else", async () => {
		const archived = await archivedScene();
		const live = await publishedScene();
		const stranger = await createTestUser();

		expect(
			await removeArchivedCopy(
				archived.ownerId,
				"00000000-0000-0000-0000-000000000000"
			)
		).toEqual({ error: "Archived copy not found" });
		expect(await removeArchivedCopy(live.ownerId, live.publishedId)).toEqual({
			error: "Archived copy not found",
		});
		expect(await removeArchivedCopy(stranger.id, archived.publishedId)).toEqual(
			{ error: "Archived copy not found" }
		);

		expect(await observe(live.caseId)).toMatchObject({
			published: true,
			rows: [{ archived: false, isCurrent: true }],
		});
		expect(await observe(archived.caseId)).toMatchObject({
			trashed: true,
			published: true,
			rows: [{ archived: true, isCurrent: true }],
		});
	});

	it("leaves a case that was restored meanwhile published, with its copy live, and answers not found", async () => {
		const before = await publishedFileKeys();
		const scene = await archivedScene();
		const holder = await holdRowLock(async (tx) => {
			await tx.assuranceCase.update({
				where: { id: scene.caseId },
				data: { deletedAt: null, deletedById: null },
			});
			await tx.publishedAssuranceCase.updateMany({
				where: { assuranceCaseId: scene.caseId },
				data: { archivedAt: null, archivedOwnerId: null },
			});
		});

		const removing = removeArchivedCopy(scene.ownerId, scene.publishedId);
		await waitForLockWait(WAIT_MS, 1);
		await holder.release();

		expect(await removing).toEqual({ error: "Archived copy not found" });
		const state = await observe(scene.caseId);
		expect(state).toMatchObject({
			trashed: false,
			published: true,
			publishStatus: "PUBLISHED",
			rows: [{ archived: false, isCurrent: true }],
		});
		expect(await discoverProblems(scene.caseId)).toEqual([]);
		expect(await imageCopyProblems(before)).toEqual([]);
	});
});

describe("with nobody else acting", () => {
	it("publishes, republishes and unpublishes a case with a feature image as before", async () => {
		const before = await publishedFileKeys();
		const scene = await newScene();

		const published = expectSuccess(
			await publishAssuranceCase(scene.ownerId, scene.caseId)
		);
		expect(published.publishedAt).toBeInstanceOf(Date);
		expect(await observe(scene.caseId)).toMatchObject({
			published: true,
			publishStatus: "PUBLISHED",
			hasPublishedAt: true,
			rows: [{ archived: false, isCurrent: true, type: "ASSURANCE_CASE" }],
		});
		const [first] = await publishedRows(scene.caseId);

		const republished = expectSuccess(
			await updatePublishedCase(scene.ownerId, scene.caseId)
		);
		const rows = await publishedRows(scene.caseId);
		expect(rows).toHaveLength(2);
		expect(rows.filter((row) => row.isCurrent).map((row) => row.id)).toEqual([
			republished.publishedId,
		]);
		expect(rows.every((row) => row.slug === first?.slug)).toBe(true);
		expect(await imageCopyProblems(before)).toEqual([]);

		expect(await unpublishAssuranceCase(scene.ownerId, scene.caseId)).toEqual(
			UNPUBLISHED
		);
		expect(await observe(scene.caseId)).toMatchObject({
			published: false,
			publishStatus: "DRAFT",
			hasPublishedAt: false,
			rows: [],
		});
		expect(await publishedFileKeys()).toEqual(before);
		expect(await readMedia(scene.liveKey)).not.toBeNull();
		expect(await discoverProblems(scene.caseId)).toEqual([]);
		expect(published.publishedId).toBeDefined();
	});

	it("answers an unpublish of a draft, of a case that is not there and of a viewer as before", async () => {
		const draft = await newScene();
		const published = await publishedScene();
		const viewer = await createTestUser();
		await createTestPermission(
			published.caseId,
			viewer.id,
			published.ownerId,
			"VIEW"
		);

		expect(await unpublishAssuranceCase(draft.ownerId, draft.caseId)).toEqual({
			error: "Case is not published",
		});
		expect(
			await unpublishAssuranceCase(
				draft.ownerId,
				"00000000-0000-0000-0000-000000000000"
			)
		).toEqual({ error: "Permission denied" });
		expect(await unpublishAssuranceCase(viewer.id, published.caseId)).toEqual({
			error: "Permission denied",
		});
		expect(await observe(published.caseId)).toMatchObject({ published: true });
	});

	it("answers a second unpublish, after the first has finished, as not published", async () => {
		const scene = await publishedScene();

		expect(await unpublishAssuranceCase(scene.ownerId, scene.caseId)).toEqual(
			UNPUBLISHED
		);
		expect(await unpublishAssuranceCase(scene.ownerId, scene.caseId)).toEqual({
			error: "Case is not published",
		});
	});

	it("bins a published case removing or archiving its copy, and restores it, as before", async () => {
		const removed = await publishedScene();
		const archived = await publishedScene();

		expect(
			await softDeleteCase(removed.ownerId, removed.caseId, {
				publishedCopy: "remove",
			})
		).toEqual({ data: true });
		expect(
			await softDeleteCase(archived.ownerId, archived.caseId, {
				publishedCopy: "archive",
			})
		).toEqual({ data: true });

		expect(await observe(removed.caseId)).toMatchObject({
			trashed: true,
			published: false,
			rows: [],
		});
		expect(await observe(archived.caseId)).toMatchObject({
			trashed: true,
			published: true,
			rows: [{ archived: true, isCurrent: true }],
		});
		expect(await restoreCase(archived.ownerId, archived.caseId)).toEqual({
			data: true,
		});
		expect(await observe(archived.caseId)).toMatchObject({
			trashed: false,
			published: true,
			rows: [{ archived: false, isCurrent: true }],
		});
		expect(await discoverProblems(archived.caseId)).toEqual([]);
	});
});
