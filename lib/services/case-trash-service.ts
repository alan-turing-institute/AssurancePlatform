import { timingSafeEqual } from "node:crypto";
import { calculateDaysRemaining, TRASH_RETENTION_DAYS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

// ============================================
// OUTPUT INTERFACES
// ============================================

export type TrashedCaseResponse = {
	id: string;
	name: string;
	description: string | null;
	createdAt: string;
	deletedAt: string;
	daysRemaining: number;
};

export type TrashListResponse = {
	cases: TrashedCaseResponse[];
};

export type PurgeResult = {
	purgedCount: number;
	cutoffDate: string;
};

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
		return { valid: false, error: "Case not found" };
	}

	if (existingCase.createdById !== userId) {
		return { valid: false, error: "Permission denied" };
	}

	return { valid: true, deletedAt: existingCase.deletedAt };
}

/**
 * Performs timing-safe comparison of two strings.
 * Prevents timing attacks on secret comparison.
 */
function timingSafeCompare(a: string, b: string): boolean {
	try {
		const bufA = Buffer.from(a);
		const bufB = Buffer.from(b);
		if (bufA.length !== bufB.length) {
			return false;
		}
		return timingSafeEqual(bufA, bufB);
	} catch {
		return false;
	}
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
): Promise<{ data?: TrashListResponse; error?: string }> {
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
		console.error("Failed to list trashed cases:", error);
		return { error: "Failed to fetch trash" };
	}
}

/**
 * Soft-deletes a case (moves to trash).
 * Requires ADMIN permission on the case.
 */
export async function softDeleteCase(
	userId: string,
	caseId: string
): Promise<{ error?: string }> {
	const { canAccessCase } = await import("@/lib/permissions");

	// Check permission - only ADMIN can delete
	const hasAccess = await canAccessCase({ userId, caseId }, "ADMIN");
	if (!hasAccess) {
		return { error: "Permission denied" };
	}

	try {
		// Check if case exists and is not already deleted
		const existingCase = await prisma.assuranceCase.findUnique({
			where: { id: caseId },
			select: { deletedAt: true },
		});

		if (!existingCase) {
			return { error: "Case not found" };
		}

		if (existingCase.deletedAt) {
			return { error: "Case is already in trash" };
		}

		// Soft-delete: set deletedAt and deletedById
		await prisma.assuranceCase.update({
			where: { id: caseId },
			data: {
				deletedAt: new Date(),
				deletedById: userId,
			},
		});

		return {};
	} catch (error) {
		console.error("Failed to soft-delete case:", error);
		return { error: "Failed to delete case" };
	}
}

/**
 * Restores a case from trash.
 * Only the case owner can restore.
 */
export async function restoreCase(
	userId: string,
	caseId: string
): Promise<{ error?: string }> {
	const validation = await validateCaseOwner(userId, caseId);

	if (!validation.valid) {
		return { error: validation.error };
	}

	if (!validation.deletedAt) {
		return { error: "Case is not in trash" };
	}

	try {
		await prisma.assuranceCase.update({
			where: { id: caseId },
			data: {
				deletedAt: null,
				deletedById: null,
			},
		});

		return {};
	} catch (error) {
		console.error("Failed to restore case:", error);
		return { error: "Failed to restore case" };
	}
}

/**
 * Permanently deletes a case from trash.
 * Only the case owner can purge. Case must be in trash.
 */
export async function purgeCase(
	userId: string,
	caseId: string
): Promise<{ error?: string }> {
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

		return {};
	} catch (error) {
		console.error("Failed to purge case:", error);
		return { error: "Failed to purge case" };
	}
}

/**
 * Purges all expired cases from trash (cases older than retention period).
 * Protected by CRON_SECRET - for use by scheduled jobs only.
 */
export async function purgeExpiredCases(
	authToken: string | null
): Promise<{ data?: PurgeResult; error?: string }> {
	const cronSecret = process.env.CRON_SECRET;

	if (!cronSecret) {
		console.error("CRON_SECRET environment variable not set");
		return { error: "Server configuration error" };
	}

	if (!(authToken && timingSafeCompare(authToken, cronSecret))) {
		return { error: "Unauthorised" };
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

		console.log(`Purged ${result.count} expired cases from trash`);

		return {
			data: {
				purgedCount: result.count,
				cutoffDate: cutoffDate.toISOString(),
			},
		};
	} catch (error) {
		console.error("Failed to purge expired cases:", error);
		return { error: "Failed to purge trash" };
	}
}
