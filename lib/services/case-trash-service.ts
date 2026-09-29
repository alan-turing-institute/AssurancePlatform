import { calculateDaysRemaining, TRASH_RETENTION_DAYS } from "@/lib/constants";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import type { DeleteCaseOptionsInput } from "@/lib/schemas/case-trash";
import { requireCronSecret } from "@/lib/services/cron-auth";
import {
	archivePublishedCopies,
	DRAFT_PUBLISH_FIELDS,
	deleteMediaKeys,
	extractPublishedImageKey,
	removePublishedCopies,
} from "@/lib/services/publish-service";
import type { ServiceResult } from "@/types/service";

const log = logger.child({ component: "case-trash-service" });

/** Thrown inside `softDeleteCase`'s transaction when the deletion-fields update matches zero rows — the case was already trashed by a concurrent call. */
class CaseAlreadyInTrashError extends Error {}

// ============================================
// OUTPUT INTERFACES
// ============================================

export interface TrashedCaseResponse {
	createdAt: string;
	daysRemaining: number;
	deletedAt: string;
	description: string | null;
	id: string;
	name: string;
}

export interface TrashListResponse {
	cases: TrashedCaseResponse[];
}

export interface PurgeResult {
	cutoffDate: string;
	purgedCount: number;
}

/** `softDeleteCase`'s options — the same shape `deleteCaseOptionsSchema` validates at the action layer, so the two never drift apart. */
export type SoftDeleteCaseOptions = DeleteCaseOptionsInput;

export interface ArchivedCopyResponse {
	archivedAt: string;
	id: string;
	slug: string;
	title: string;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Validates that user owns the case.
 */
async function validateCaseOwner(
	userId: string,
	caseId: string
): Promise<
	{ valid: true; deletedAt: Date | null } | { valid: false; error: string }
> {
	const existingCase = await prisma.assuranceCase.findUnique({
		where: { id: caseId },
		select: {
			createdById: true,
			deletedAt: true,
		},
	});

	if (!existingCase) {
		return { valid: false, error: "Permission denied" };
	}

	if (existingCase.createdById !== userId) {
		return { valid: false, error: "Permission denied" };
	}

	return { valid: true, deletedAt: existingCase.deletedAt };
}

// ============================================
// SERVICE FUNCTIONS
// ============================================

/**
 * Lists all trashed cases for a user.
 * Only returns cases owned by the user (not shared cases).
 */
export async function listTrashedCases(
	userId: string
): ServiceResult<TrashListResponse> {
	try {
		const trashedCases = await prisma.assuranceCase.findMany({
			where: {
				createdById: userId,
				deletedAt: { not: null },
			},
			select: {
				id: true,
				name: true,
				description: true,
				createdAt: true,
				deletedAt: true,
			},
			orderBy: {
				deletedAt: "desc",
			},
		});

		const cases = trashedCases.map((caseItem) => {
			const deletedAt = caseItem.deletedAt as Date;
			return {
				id: caseItem.id,
				name: caseItem.name,
				description: caseItem.description,
				createdAt: caseItem.createdAt.toISOString(),
				deletedAt: deletedAt.toISOString(),
				daysRemaining: calculateDaysRemaining(deletedAt),
			};
		});

		return { data: { cases } };
	} catch (error) {
		log.error("Failed to list trashed cases", { error });
		return { error: "Failed to fetch trash" };
	}
}

/**
 * Soft-deletes a case (moves to trash). Requires ADMIN permission on the
 * case.
 *
 * When the case has a current published copy, `options.publishedCopy`
 * chooses what happens to it: `"remove"` (the default, and the pre-existing
 * behaviour) deletes the Discover copy; `"archive"` keeps it, marked
 * archived, owned by the case's creator — never the caller, so an Admin
 * collaborator who trashes someone else's case cannot make themselves the
 * copy's future remover.
 */
export async function softDeleteCase(
	userId: string,
	caseId: string,
	options?: SoftDeleteCaseOptions
): ServiceResult {
	const { canAccessCase } = await import("@/lib/permissions");
	const publishedCopy = options?.publishedCopy ?? "remove";

	// Check permission - only ADMIN can delete. `includeTrashed: true` so an
	// already-trashed case still reaches the ADMIN check below, instead of
	// being hidden by the default trash-invisibility gate: that lets this
	// function report its own distinct "Case is already in trash" error.
	const hasAccess = await canAccessCase({ userId, caseId }, "ADMIN", {
		includeTrashed: true,
	});
	if (!hasAccess) {
		return { error: "Permission denied" };
	}

	try {
		// Check if case exists and is not already deleted
		const existingCase = await prisma.assuranceCase.findUnique({
			where: { id: caseId },
			select: { createdById: true, deletedAt: true },
		});

		if (!existingCase) {
			return { error: "Case not found" };
		}

		if (existingCase.deletedAt) {
			return { error: "Case is already in trash" };
		}

		let removedKeys: string[] = [];
		await prisma.$transaction(async (tx) => {
			// Matches only a case not already in Trash — closes the race against
			// a concurrent trash of the same case between the check above and
			// this transaction committing.
			const updateResult = await tx.assuranceCase.updateMany({
				where: { id: caseId, deletedAt: null },
				data: { deletedAt: new Date(), deletedById: userId },
			});
			if (updateResult.count === 0) {
				throw new CaseAlreadyInTrashError();
			}

			const currentPublished = await tx.publishedAssuranceCase.findFirst({
				where: { assuranceCaseId: caseId, isCurrent: true },
				select: { id: true },
			});
			if (currentPublished) {
				removedKeys =
					publishedCopy === "archive"
						? await archivePublishedCopies(
								tx,
								[caseId],
								existingCase.createdById
							)
						: await removePublishedCopies(tx, [caseId]);
			}
		});
		await deleteMediaKeys(removedKeys);

		return { data: true };
	} catch (error) {
		if (error instanceof CaseAlreadyInTrashError) {
			return { error: "Case is already in trash" };
		}
		log.error("Failed to soft-delete case", { error });
		return { error: "Failed to delete case" };
	}
}

/**
 * Restores a case from trash. Only the case owner can restore.
 *
 * If the case's published copy was archived (rather than removed) when it
 * was trashed, restoring it also un-archives that copy: it goes live again
 * at the same address, and the next "Update published version" refreshes
 * it as normal. A no-op when there is no archived copy (removed already,
 * or never published).
 */
export async function restoreCase(
	userId: string,
	caseId: string
): ServiceResult {
	const validation = await validateCaseOwner(userId, caseId);

	if (!validation.valid) {
		return { error: validation.error };
	}

	if (!validation.deletedAt) {
		return { error: "Case is not in trash" };
	}

	try {
		await prisma.$transaction(async (tx) => {
			await tx.assuranceCase.update({
				where: { id: caseId },
				data: {
					deletedAt: null,
					deletedById: null,
				},
			});
			await tx.publishedAssuranceCase.updateMany({
				where: { assuranceCaseId: caseId, archivedAt: { not: null } },
				data: { archivedAt: null, archivedOwnerId: null },
			});
		});

		return { data: true };
	} catch (error) {
		log.error("Failed to restore case", { error });
		return { error: "Failed to restore case" };
	}
}

/**
 * Permanently deletes a case from trash.
 * Only the case owner can purge. Case must be in trash.
 */
export async function purgeCase(userId: string, caseId: string): ServiceResult {
	const validation = await validateCaseOwner(userId, caseId);

	if (!validation.valid) {
		return { error: validation.error };
	}

	if (!validation.deletedAt) {
		return {
			error: "Case must be in trash before it can be permanently deleted",
		};
	}

	try {
		await prisma.assuranceCase.delete({
			where: { id: caseId },
		});

		return { data: true };
	} catch (error) {
		log.error("Failed to purge case", { error });
		return { error: "Failed to purge case" };
	}
}

/**
 * Purges all expired cases from trash (cases older than retention period).
 * Protected by CRON_SECRET - for use by scheduled jobs only.
 */
export async function purgeExpiredCases(
	authToken: string | null
): ServiceResult<PurgeResult> {
	const auth = requireCronSecret(authToken);
	if (!auth.authorised) {
		return { error: auth.error };
	}

	try {
		const cutoffDate = new Date();
		cutoffDate.setDate(cutoffDate.getDate() - TRASH_RETENTION_DAYS);

		const result = await prisma.assuranceCase.deleteMany({
			where: {
				deletedAt: {
					not: null,
					lt: cutoffDate,
				},
			},
		});

		log.info("Purged expired cases from trash", { count: result.count });

		return {
			data: {
				purgedCount: result.count,
				cutoffDate: cutoffDate.toISOString(),
			},
		};
	} catch (error) {
		log.error("Failed to purge expired cases", { error });
		return { error: "Failed to purge trash" };
	}
}

/**
 * Lists the caller's own archived Discover copies — the "Archived on
 * Discover" section on the Trash page. Includes copies whose case is still
 * in Trash and copies whose case has since been permanently deleted
 * (`assuranceCaseId` cleared by the relaxed FK); both are handled
 * identically here, since `archivedOwnerId` alone determines who may
 * remove one. `archivedAt: { not: null }` is redundant with `archivedOwnerId`
 * ever being set — every archived row has both — but keeping it in the
 * `where` clause is what lets `archivedAt` come back non-null without a
 * cast.
 */
export async function listArchivedCopies(
	userId: string
): ServiceResult<ArchivedCopyResponse[]> {
	try {
		const rows = await prisma.publishedAssuranceCase.findMany({
			where: { archivedOwnerId: userId, archivedAt: { not: null } },
			select: { id: true, title: true, slug: true, archivedAt: true },
			orderBy: { archivedAt: "desc" },
		});

		return {
			data: rows.map((row) => {
				// The `where` clause guarantees this at the database level; Prisma's
				// generated type doesn't carry that guarantee through to `select`,
				// so this is a runtime narrowing check, not a cast.
				if (!row.archivedAt) {
					throw new Error(
						`listArchivedCopies: row ${row.id} matched archivedAt: { not: null } but came back null`
					);
				}
				return {
					id: row.id,
					title: row.title,
					slug: row.slug,
					archivedAt: row.archivedAt.toISOString(),
				};
			}),
		};
	} catch (error) {
		log.error("Failed to list archived copies", { error });
		return { error: "Failed to fetch archived copies" };
	}
}

/**
 * Removes one of the caller's own archived Discover copies — the author
 * can take an archived copy down at any time, including after the case
 * itself is permanently deleted. Deletes the row only when
 * `archivedOwnerId` matches the caller — a missing id and someone else's
 * copy return the identical error, so the response cannot be used to
 * enumerate other users' archived copies. When the source case still
 * exists (still in Trash), its publish fields are reset to draft, matching
 * what removing the copy at trash time would have done — so restoring it
 * afterwards gives a draft.
 */
export async function removeArchivedCopy(
	userId: string,
	publishedId: string
): ServiceResult {
	try {
		// `undefined` (never found / lost the race) is distinct from `null`
		// (found and removed, but held no image) — only the latter still needs
		// `deleteMediaKeys` called on it.
		const removedKey = await prisma.$transaction(async (tx) => {
			const row = await tx.publishedAssuranceCase.findFirst({
				where: {
					id: publishedId,
					archivedOwnerId: userId,
					archivedAt: { not: null },
				},
				select: { assuranceCaseId: true, content: true },
			});
			if (!row) {
				return;
			}

			// Re-checks the same guard at delete time, closing the race against a
			// concurrent restore: if the copy was un-archived between the read
			// above and this delete, `count` comes back 0 and the (now live)
			// copy is left untouched.
			const deleted = await tx.publishedAssuranceCase.deleteMany({
				where: {
					id: publishedId,
					archivedOwnerId: userId,
					archivedAt: { not: null },
				},
			});
			if (deleted.count === 0) {
				return;
			}

			if (row.assuranceCaseId) {
				await tx.assuranceCase.updateMany({
					where: { id: row.assuranceCaseId },
					data: DRAFT_PUBLISH_FIELDS,
				});
			}
			return extractPublishedImageKey(row.content);
		});

		if (removedKey === undefined) {
			return { error: "Archived copy not found" };
		}
		if (removedKey) {
			await deleteMediaKeys([removedKey]);
		}

		return { data: true };
	} catch (error) {
		log.error("Failed to remove archived copy", { error });
		return { error: "Failed to remove archived copy" };
	}
}
