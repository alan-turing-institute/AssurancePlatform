import { randomUUID } from "node:crypto";
import { basename } from "node:path";
import { logger } from "@/lib/logger";
import {
	isCaseFeatureImageKey,
	isExternalMediaUrl,
	toMediaKey,
} from "@/lib/media-key";
import { canAccessCase } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { publishedSnapshotMetaSchema } from "@/lib/schemas/publishable-item";
import { exportCase } from "@/lib/services/case-export-service";
import { captureCaseInformationForSnapshot } from "@/lib/services/case-information-service";
import { detectChanges } from "@/lib/services/change-detection-service";
import { copyMedia, deleteMedia } from "@/lib/services/file-storage-service";
import { capturePluginDataForSnapshot } from "@/lib/services/plugin-data-service";
import type {
	FullPublishStatus,
	PrismaPublishStatus,
	PublishResult,
	PublishStatus,
	StatusTransitionResult,
	UnpublishResult,
} from "@/lib/services/publish-service.types";
import { generateUniqueSlug } from "@/lib/services/slug-service";
import type { Prisma } from "@/src/generated/prisma";

const log = logger.child({ component: "publish-service" });

// Derived from `prisma.$transaction`'s own callback parameter — same pattern
// as `slug-service.ts` (kept local rather than imported: `Prisma.
// TransactionClient` does not structurally match this project's
// `.$extends()`-wrapped client from `lib/prisma.ts`).
type TransactionCallback = Parameters<typeof prisma.$transaction>[0];
type TransactionClient = TransactionCallback extends (
	tx: infer T
) => Promise<unknown>
	? T
	: never;

/**
 * Thrown from inside a publish/republish transaction when the case-row
 * update matches zero rows — the case was moved to Trash after this
 * function's own permission check ran but before the transaction committed.
 * Caught by the caller and translated to the same "Case not found" error a
 * missing case already returns, so a case in Trash can never be published
 * or republished, even when the two actions overlap.
 */
class CaseTrashedDuringTransactionError extends Error {}

/** The five publish-state fields, reset to their draft values — shared by `removePublishedCopies` and `case-trash-service.ts`'s `removeArchivedCopy`. */
export const DRAFT_PUBLISH_FIELDS = {
	published: false,
	publishedAt: null,
	publishStatus: "DRAFT" as const,
	markedReadyAt: null,
	markedReadyById: null,
};

/** The key prefix under which every publish-time image copy lives — `published/<random id>/<filename>`. Only keys under this prefix are ever deleted by the clean-up helpers below; a row's raw, uncopied stored value never is. */
const PUBLISHED_MEDIA_PREFIX = "published";

/**
 * Reads a stored snapshot's `caseInformation.featureImageUrl`, and only when
 * it is one of THIS module's own publish-time copies (the `published/`
 * prefix) — never a live case's raw key, and never an older snapshot's
 * uncopied `/uploads/...`/blob value (from before this module started
 * copying images at publish time), both of which stay the live case's
 * concern, not a copy this module owns and may delete.
 */
export function extractPublishedImageKey(content: unknown): string | null {
	const parsed = publishedSnapshotMetaSchema.safeParse(content);
	if (!parsed.success) {
		return null;
	}
	const url = parsed.data.caseInformation?.featureImageUrl;
	if (!url?.startsWith(`${PUBLISHED_MEDIA_PREFIX}/`)) {
		return null;
	}
	return url;
}

/**
 * Deletes a batch of `published/` copy keys, best-effort — used after a
 * transaction that removed the database rows pointing at them has already
 * committed, since storage writes aren't transactional with Postgres. A
 * failed delete is logged, not thrown: the row is gone either way, and an
 * orphaned file is a known, accepted risk, not a caller-visible failure.
 */
export async function deleteMediaKeys(keys: string[]): Promise<void> {
	await Promise.all(
		keys.map(async (key) => {
			const deleted = await deleteMedia(key);
			if (!deleted) {
				log.warn("Failed to delete a published-copy file", { key });
			}
		})
	);
}

/**
 * Copies a case's current feature image into a publish-time, version-scoped
 * key before the snapshot is written, so later edits to the live image can
 * never affect — or break — a published or archived Discover page. A no-op,
 * returning `content` unchanged (and logging why), when the case has no
 * feature image, when its recorded value is a genuine external address
 * (nothing of ours to copy — not logged, this is the normal case), when the
 * recorded key doesn't belong to this case (`isCaseFeatureImageKey` — the
 * only way that can happen is a value written before the case-information
 * write path validated it, or a row edited directly), or when the copy
 * itself fails (the snapshot then carries whatever `composeSnapshotContent`
 * already captured, exactly as it did before this copy step existed — no
 * regression, just no protection for that one publish). `copiedKey` is
 * `null` unless a copy actually happened, so the caller only ever cleans up
 * a copy it truly made.
 */
async function copyFeatureImageForSnapshot(
	caseId: string,
	content: Record<string, unknown>
): Promise<{ content: Record<string, unknown>; copiedKey: string | null }> {
	const stored = extractStoredFeatureImageUrl(content);
	if (!stored || isExternalMediaUrl(stored)) {
		return { content, copiedKey: null };
	}

	const sourceKey = toMediaKey(stored);
	if (!isCaseFeatureImageKey(caseId, sourceKey)) {
		log.warn(
			"Skipped publish-time image copy: key does not belong to this case",
			{
				caseId,
			}
		);
		return { content, copiedKey: null };
	}

	const newKey = `${PUBLISHED_MEDIA_PREFIX}/${randomUUID()}/${basename(sourceKey)}`;
	const copied = await copyMedia(sourceKey, newKey);
	if (!copied) {
		log.warn("Failed to copy feature image for publish snapshot", { caseId });
		return { content, copiedKey: null };
	}

	// `publishedSnapshotMetaSchema`'s successful parse above (inside
	// `extractStoredFeatureImageUrl`) is what makes this narrowing safe: a
	// `stored` value only exists when `content.caseInformation` genuinely has
	// that shape.
	const existingCaseInformation = content.caseInformation as Record<
		string,
		unknown
	>;
	return {
		content: {
			...content,
			caseInformation: { ...existingCaseInformation, featureImageUrl: newKey },
		},
		copiedKey: newKey,
	};
}

/** The live, uncopied value `composeSnapshotContent` just captured — read via the same defensive schema `extractPublishedImageKey` uses, so a malformed snapshot degrades to "no image" rather than throwing. */
function extractStoredFeatureImageUrl(content: unknown): string | null {
	const parsed = publishedSnapshotMetaSchema.safeParse(content);
	if (!parsed.success) {
		return null;
	}
	return parsed.data.caseInformation?.featureImageUrl ?? null;
}

/**
 * Removes every published row for the given cases and resets each case's
 * publish fields to draft — the "remove" half of the published-copy choice,
 * and the default when no choice is given. Runs inside the caller's
 * transaction; a no-op for an empty list. Storage isn't transactional, so
 * this returns the `published/` copy keys the deleted rows held — the
 * caller deletes those files once its transaction has committed.
 */
export async function removePublishedCopies(
	tx: TransactionClient,
	caseIds: string[]
): Promise<string[]> {
	if (caseIds.length === 0) {
		return [];
	}
	const rows = await tx.publishedAssuranceCase.findMany({
		where: { assuranceCaseId: { in: caseIds } },
		select: { content: true },
	});
	const keys = rows
		.map((row) => extractPublishedImageKey(row.content))
		.filter((key): key is string => key !== null);

	await tx.publishedAssuranceCase.deleteMany({
		where: { assuranceCaseId: { in: caseIds } },
	});
	await tx.assuranceCase.updateMany({
		where: { id: { in: caseIds } },
		data: DRAFT_PUBLISH_FIELDS,
	});
	return keys;
}

/**
 * Archives the current published copy of each of the given cases: keeps
 * each case's `isCurrent` row (stamping `archivedAt`/`archivedOwnerId` on
 * it) and deletes that case's other, superseded rows — so an archived copy
 * is always exactly one record. The case's own publish fields are left
 * untouched, so a later restore finds the case still `PUBLISHED`. `ownerId`
 * is who may later remove the archived copy (`removeArchivedCopy` in
 * `case-trash-service.ts`); `null` when nobody can — used for account
 * deletion, where the deleted owner's account is gone. Runs inside the
 * caller's transaction; a no-op for an empty list or for cases with no
 * current published row. Returns the `published/` copy keys the deleted
 * (superseded) rows held — never the surviving, archived row's own copy —
 * so the caller can delete those files once its transaction has committed.
 */
export async function archivePublishedCopies(
	tx: TransactionClient,
	caseIds: string[],
	ownerId: string | null
): Promise<string[]> {
	if (caseIds.length === 0) {
		return [];
	}

	const currentRows = await tx.publishedAssuranceCase.findMany({
		where: { assuranceCaseId: { in: caseIds }, isCurrent: true },
		select: { id: true },
	});
	const currentIds = currentRows.map((row) => row.id);
	if (currentIds.length === 0) {
		return [];
	}

	const supersededRows = await tx.publishedAssuranceCase.findMany({
		where: { assuranceCaseId: { in: caseIds }, id: { notIn: currentIds } },
		select: { content: true },
	});
	const keys = supersededRows
		.map((row) => extractPublishedImageKey(row.content))
		.filter((key): key is string => key !== null);

	await tx.publishedAssuranceCase.deleteMany({
		where: { assuranceCaseId: { in: caseIds }, id: { notIn: currentIds } },
	});
	// `archivedAt: null` in the where clause: a row already archived keeps its
	// original archive date and owner rather than being re-stamped by a later
	// call (e.g. an account-deletion sweep that re-runs over cases already in
	// Trash).
	await tx.publishedAssuranceCase.updateMany({
		where: { id: { in: currentIds }, archivedAt: null },
		data: { archivedAt: new Date(), archivedOwnerId: ownerId },
	});
	return keys;
}

// ============================================
// Shared helpers — publish / republish
// ============================================

/**
 * Composes the JSON snapshot content shared by every publish flow: the
 * exported case tree plus captured plugin data (ADR 0002 v2 §3) and case
 * information (ADR 0003 §3), each included only when present — `undefined`,
 * not an empty object, when there is none — so a snapshot never gains a key
 * for data the case doesn't hold.
 *
 * Comments are excluded (`includeComments: false`) — ADR 0003 §3 scopes a
 * snapshot to structure/arguments/evidence/plugin-data; comments (and their
 * commenter identities, including email) are internal collaboration on the
 * live case, never part of the published record (privacy fix, Chris's
 * ruling 2026-08-11 — the public Discover surface was serving them
 * unfiltered). `exportCase`'s `includeComments` option itself is untouched
 * for authenticated export use elsewhere (e.g. `actions/export-document.ts`,
 * `app/api/cases/export/route.ts`) — only this publish-time call opts out.
 *
 * Shared verbatim between `publishAssuranceCase` (first publish) and
 * `updatePublishedCase` (republish) — both must freeze identical content
 * shapes, so this is the single place that composition happens.
 */
async function composeSnapshotContent(
	userId: string,
	caseId: string
): Promise<{ data: Record<string, unknown> } | { error: string }> {
	const exportResult = await exportCase(userId, caseId, {
		includeComments: false,
	});
	if ("error" in exportResult) {
		return { error: exportResult.error };
	}

	// Every plugin namespace holding data on this case, captured verbatim
	// (ADR 0002 v2 §3) — follows data present, not this (or any) viewer's
	// plugin toggles. `undefined` when the case holds no plugin data at all,
	// so the snapshot gains no `pluginData` key rather than an empty one.
	const pluginData = await capturePluginDataForSnapshot(caseId);
	// Case information (ADR 0003 §3 — "the snapshot freezes metadata as well
	// as content"), composed the same way: `undefined`, not an empty object,
	// when the case has no case information at all.
	const caseInformation = await captureCaseInformationForSnapshot(caseId);

	return {
		data: {
			...exportResult.data,
			...(pluginData && { pluginData }),
			...(caseInformation && { caseInformation }),
		},
	};
}

/**
 * Retires whichever row is currently `isCurrent: true` for `caseId` and
 * inserts its replacement, inside the caller's transaction. Retirement must
 * run BEFORE the insert — the partial unique index on (slug) WHERE
 * is_current would otherwise reject the new row for reusing the same slug
 * while the old row is still marked current.
 *
 * `updateMany` (not `update` on one known id) so this is correct whether
 * zero or one row is currently marked: first-publish has none (this call is
 * then a defensive no-op guarding the "at most one current row per case"
 * invariant against being called twice on an already-published case — e.g.
 * directly via `POST /api/cases/[id]/publish`, outside `transitionStatus`'s
 * DRAFT-only gate); republish has exactly one.
 *
 * Shared verbatim between `publishAssuranceCase` and `updatePublishedCase`;
 * each layers its own extra side effects (case status flip vs case-study
 * link migration) around this call.
 */
async function swapCurrentPublishedVersion(
	tx: TransactionClient,
	input: {
		caseId: string;
		title: string;
		slug: string;
		content: Prisma.InputJsonValue;
		description: string | null;
		createdAt: Date;
	}
) {
	await tx.publishedAssuranceCase.updateMany({
		where: { assuranceCaseId: input.caseId, isCurrent: true },
		data: { isCurrent: false },
	});

	return tx.publishedAssuranceCase.create({
		data: {
			title: input.title,
			slug: input.slug,
			content: input.content,
			description: input.description,
			assuranceCaseId: input.caseId,
			createdAt: input.createdAt,
		},
	});
}

/**
 * Shared body for `publishAssuranceCase` and `updatePublishedCase`: copies
 * the case's current feature image into its own publish-time key before
 * anything is written to the database (so a republish or a live edit
 * afterwards can never touch this snapshot's picture), runs the caller's own
 * transaction, and on any failure deletes the copy it just made — the copy
 * happens outside the transaction, so a failure after it but before commit
 * would otherwise leave it orphaned. Translates a case trashed
 * mid-transaction into "Case not found"; anything else into `failureMessage`.
 */
async function publishSnapshot(
	caseId: string,
	contentResult: { data: Record<string, unknown> } | { error: string },
	runTransaction: (
		content: Prisma.InputJsonValue,
		now: Date
	) => Promise<{ id: string }>,
	failureMessage: string
): Promise<PublishResult> {
	if ("error" in contentResult) {
		return { error: contentResult.error };
	}
	const { content: preparedContent, copiedKey } =
		await copyFeatureImageForSnapshot(caseId, contentResult.data);
	// The composed snapshot is plain JSON but, as a plain object built from
	// named interfaces (`CaseInformationSnapshot` etc.) with no index
	// signature of their own, doesn't structurally satisfy `InputJsonObject`
	// even though every value it can hold is a valid `InputJsonValue`.
	// Routing through `unknown` is TS's own prescribed escape hatch for
	// exactly this "no sufficient overlap" case (same pattern as
	// `health-evidence-service.ts`) — not a blind `any`.
	const content = preparedContent as unknown as Prisma.InputJsonValue;
	const now = new Date();

	try {
		const row = await runTransaction(content, now);
		return { data: { publishedId: row.id, publishedAt: now } };
	} catch (error) {
		if (copiedKey) {
			await deleteMediaKeys([copiedKey]);
		}
		if (error instanceof CaseTrashedDuringTransactionError) {
			return { error: "Case not found" };
		}
		log.error(failureMessage, { error });
		return { error: failureMessage };
	}
}

// ============================================
// Service Functions
// ============================================

/**
 * Gets the publish status of an assurance case.
 */
export async function getPublishStatus(
	userId: string,
	caseId: string
): Promise<{ data: PublishStatus } | { error: string }> {
	// Check user has at least VIEW permission
	const hasAccess = await canAccessCase({ userId, caseId }, "VIEW");
	if (!hasAccess) {
		return { error: "Permission denied" };
	}

	// Get the case with its published status
	const assuranceCase = await prisma.assuranceCase.findUnique({
		where: { id: caseId },
		select: {
			published: true,
			publishedAt: true,
			publishedVersions: {
				select: {
					id: true,
				},
				orderBy: {
					createdAt: "desc",
				},
				take: 1,
			},
		},
	});

	if (!assuranceCase) {
		return { error: "Permission denied" };
	}

	// Get the most recent published version
	const latestPublished = assuranceCase.publishedVersions[0];

	return {
		data: {
			isPublished: assuranceCase.published,
			publishedId: latestPublished?.id ?? null,
			publishedAt: assuranceCase.publishedAt,
		},
	};
}

/**
 * Publishes an assurance case.
 * Creates a snapshot of the current case content and marks it as published.
 *
 * Requires EDIT permission or higher.
 */
export async function publishAssuranceCase(
	userId: string,
	caseId: string,
	description?: string
): Promise<PublishResult> {
	// Check user has EDIT permission
	const hasAccess = await canAccessCase({ userId, caseId }, "EDIT");
	if (!hasAccess) {
		return { error: "Permission denied" };
	}

	// Get the case to check if it exists
	const assuranceCase = await prisma.assuranceCase.findUnique({
		where: { id: caseId },
		select: {
			id: true,
			name: true,
			published: true,
		},
	});

	if (!assuranceCase) {
		return { error: "Case not found" };
	}

	// Compose the JSON snapshot content (export + plugin data + case
	// information) — shared with `updatePublishedCase`, see
	// `composeSnapshotContent` above.
	const contentResult = await composeSnapshotContent(userId, caseId);

	return publishSnapshot(
		caseId,
		contentResult,
		(content, now) =>
			// The case-row update runs FIRST, before any published-row write, so
			// every transaction that can both trash and publish/republish a case
			// locks the case row in the same order — `softDeleteCase` locks the
			// case row first too, so the two can never deadlock waiting on each
			// other's locks in reverse. Matches only a case still OUT of Trash —
			// closes the race against a concurrent trash of this case between the
			// permission check above and this transaction committing. Zero rows
			// means the case was trashed in between; `publishSnapshot` maps that
			// to "Case not found", and nothing about the published row is written.
			//
			// Generating the slug and creating the row must share this same
			// transaction — otherwise a concurrent first-publish of a same-named
			// case could observe the same "no collision yet" result and both try
			// to claim the identical slug (the table's unique index would then
			// reject the second, surfacing as an opaque 500 rather than the
			// numeric-suffix behaviour ADR 0003 §6 promises).
			prisma.$transaction(async (tx) => {
				const updateResult = await tx.assuranceCase.updateMany({
					where: { id: caseId, deletedAt: null },
					data: {
						published: true,
						publishedAt: now,
						publishStatus: "PUBLISHED",
					},
				});
				if (updateResult.count === 0) {
					throw new CaseTrashedDuringTransactionError();
				}
				const slug = await generateUniqueSlug(assuranceCase.name, tx);
				return await swapCurrentPublishedVersion(tx, {
					caseId,
					title: assuranceCase.name,
					slug,
					content,
					description: description ?? null,
					createdAt: now,
				});
			}),
		"Failed to publish case"
	);
}

/**
 * Unpublishes an assurance case: removes every published version and
 * returns the case to DRAFT.
 *
 * Requires EDIT permission or higher.
 */
export async function unpublishAssuranceCase(
	userId: string,
	caseId: string
): Promise<UnpublishResult> {
	// Check user has EDIT permission
	const hasAccess = await canAccessCase({ userId, caseId }, "EDIT");
	if (!hasAccess) {
		return { error: "Permission denied" };
	}

	// Get the case to check it exists and is published
	const assuranceCase = await prisma.assuranceCase.findUnique({
		where: { id: caseId },
		select: { id: true, published: true },
	});

	if (!assuranceCase) {
		return { error: "Case not found" };
	}

	if (!assuranceCase.published) {
		return { error: "Case is not published" };
	}

	try {
		const removedKeys = await prisma.$transaction((tx) =>
			removePublishedCopies(tx, [caseId])
		);
		await deleteMediaKeys(removedKeys);

		return { data: { success: true as const } };
	} catch (error) {
		log.error("Failed to unpublish case", { error });
		return { error: "Failed to unpublish case" };
	}
}

/**
 * Gets the list of published assurance cases for a user.
 * Returns cases that the user has published.
 */
export async function getPublishedCasesByUser(
	userId: string
): Promise<
	{ id: string; title: string; description: string | null; createdAt: Date }[]
> {
	const publishedCases = await prisma.publishedAssuranceCase.findMany({
		where: {
			assuranceCase: {
				createdById: userId,
			},
		},
		select: {
			id: true,
			title: true,
			description: true,
			createdAt: true,
		},
		orderBy: {
			createdAt: "desc",
		},
	});

	return publishedCases;
}

// ============================================
// Publishing Workflow Functions
// ============================================

/**
 * Gets the full publish status (DRAFT / PUBLISHED — the "Ready to Publish"
 * intermediate step was retired, ADR 0003 §2) plus change detection.
 *
 * Note: The publishedVersions relation uses a legacy Django table that may have
 * type mismatches with UUID-based case IDs. We handle this gracefully by
 * separating the queries and catching potential errors.
 */
export async function getFullPublishStatus(
	userId: string,
	caseId: string
): Promise<{ data?: FullPublishStatus; error?: string }> {
	// Check user has at least VIEW permission
	const hasAccess = await canAccessCase({ userId, caseId }, "VIEW");
	if (!hasAccess) {
		return { error: "Permission denied" };
	}

	// Get the case with its publish status (excluding publishedVersions to avoid legacy table issues)
	const assuranceCase = await prisma.assuranceCase.findUnique({
		where: { id: caseId },
		select: {
			published: true,
			publishedAt: true,
			publishStatus: true,
			markedReadyAt: true,
		},
	});

	if (!assuranceCase) {
		return { error: "Case not found" };
	}

	// Try to get the latest published version separately to handle legacy
	// table issues gracefully.
	let latestPublished: { id: string } | null = null;

	try {
		const publishedVersions = await prisma.publishedAssuranceCase.findMany({
			where: { assuranceCaseId: caseId },
			select: {
				id: true,
			},
			orderBy: {
				createdAt: "desc",
			},
			take: 1,
		});

		latestPublished = publishedVersions[0] ?? null;
	} catch (error) {
		// Log but don't fail - legacy table may have issues
		log.warn("Failed to fetch published versions (legacy table issue)", {
			error,
		});
	}

	// Detect changes using content-based comparison
	let hasChanges = false;
	if (assuranceCase.published && latestPublished) {
		try {
			const changeResult = await detectChanges(userId, caseId, false);
			hasChanges =
				"data" in changeResult ? changeResult.data.hasChanges : false;
		} catch (error) {
			log.warn("Failed to detect changes", { error });
		}
	}

	return {
		data: {
			publishStatus: assuranceCase.publishStatus,
			isPublished: assuranceCase.published,
			publishedId: latestPublished?.id ?? null,
			publishedAt: assuranceCase.publishedAt,
			markedReadyAt: assuranceCase.markedReadyAt,
			hasChanges,
		},
	};
}

/**
 * Updates an existing published assurance case with current content.
 * Creates a new PublishedAssuranceCase record and migrates case study links.
 *
 * Requires EDIT permission or higher.
 */
export async function updatePublishedCase(
	userId: string,
	caseId: string,
	description?: string
): Promise<PublishResult> {
	// Check user has EDIT permission
	const hasAccess = await canAccessCase({ userId, caseId }, "EDIT");
	if (!hasAccess) {
		return { error: "Permission denied" };
	}

	// Get the case and current published version
	const assuranceCase = await prisma.assuranceCase.findUnique({
		where: { id: caseId },
		select: {
			id: true,
			name: true,
			published: true,
			publishStatus: true,
			publishedVersions: {
				where: { isCurrent: true },
				select: {
					id: true,
					slug: true,
				},
				orderBy: {
					createdAt: "desc",
				},
				take: 1,
			},
		},
	});

	if (!assuranceCase) {
		return { error: "Case not found" };
	}

	if (!assuranceCase.published || assuranceCase.publishStatus !== "PUBLISHED") {
		return { error: "Case is not published" };
	}

	const currentPublished = assuranceCase.publishedVersions[0];
	if (!currentPublished) {
		return { error: "No published version found" };
	}

	// Compose the JSON snapshot content — shared with `publishAssuranceCase`,
	// see `composeSnapshotContent` above.
	const contentResult = await composeSnapshotContent(userId, caseId);

	return publishSnapshot(
		caseId,
		contentResult,
		(content, now) =>
			// Create the new version in a transaction. The case-row update runs
			// FIRST — see `publishAssuranceCase` above for why: every transaction
			// that can both trash and publish/republish a case must lock the case
			// row before touching the published row, matching the order
			// `softDeleteCase` locks them in.
			prisma.$transaction(async (tx) => {
				const updateResult = await tx.assuranceCase.updateMany({
					where: { id: caseId, deletedAt: null },
					data: { publishedAt: now },
				});
				if (updateResult.count === 0) {
					throw new CaseTrashedDuringTransactionError();
				}

				// Carrying the EXISTING slug forward verbatim (ADR 0003 §6: stable
				// across renames) — never regenerated here, even if
				// `assuranceCase.name` has changed since first publish.
				return await swapCurrentPublishedVersion(tx, {
					caseId,
					title: assuranceCase.name,
					slug: currentPublished.slug,
					content,
					description: description ?? null,
					createdAt: now,
				});
			}),
		"Failed to update published case"
	);
}

/**
 * Transitions an assurance case to a new publish status.
 * Handles all valid status transitions with appropriate side effects.
 */
export async function transitionStatus(
	userId: string,
	caseId: string,
	targetStatus: PrismaPublishStatus,
	description?: string
): Promise<StatusTransitionResult> {
	// Get current status first
	const statusResult = await getFullPublishStatus(userId, caseId);
	if (statusResult.error || !statusResult.data) {
		return {
			error: statusResult.error ?? "Failed to get status",
		};
	}

	const currentStatus = statusResult.data.publishStatus;
	const transitionKey = `${currentStatus}->${targetStatus}`;

	return executeStatusTransition(transitionKey, userId, caseId, description);
}

/**
 * Executes the appropriate status transition based on the transition key.
 */
function executeStatusTransition(
	transitionKey: string,
	userId: string,
	caseId: string,
	description?: string
): Promise<StatusTransitionResult> {
	switch (transitionKey) {
		case "DRAFT->PUBLISHED":
			return handlePublish(userId, caseId, description);

		case "PUBLISHED->DRAFT":
			return handleUnpublish(userId, caseId);

		case "PUBLISHED->PUBLISHED":
			// Update published case (create new snapshot)
			return handleUpdatePublished(userId, caseId, description);

		default:
			return Promise.resolve({
				error: `Invalid status transition: ${transitionKey.replace("->", " to ")}`,
			});
	}
}

async function handlePublish(
	userId: string,
	caseId: string,
	description?: string
): Promise<StatusTransitionResult> {
	const result = await publishAssuranceCase(userId, caseId, description);
	if ("error" in result) {
		return { error: result.error };
	}
	return {
		data: {
			newStatus: "PUBLISHED",
			publishedId: result.data.publishedId,
			publishedAt: result.data.publishedAt,
		},
	};
}

async function handleUnpublish(
	userId: string,
	caseId: string
): Promise<StatusTransitionResult> {
	const result = await unpublishAssuranceCase(userId, caseId);
	if ("error" in result) {
		return { error: result.error };
	}
	return { data: { newStatus: "DRAFT" } };
}

async function handleUpdatePublished(
	userId: string,
	caseId: string,
	description?: string
): Promise<StatusTransitionResult> {
	const result = await updatePublishedCase(userId, caseId, description);
	if ("error" in result) {
		return { error: result.error };
	}
	return {
		data: {
			newStatus: "PUBLISHED",
			publishedId: result.data.publishedId,
			publishedAt: result.data.publishedAt,
		},
	};
}
