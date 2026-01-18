/**
 * Shared constants used across the application.
 */

// ============================================
// TRASH / SOFT DELETE
// ============================================

/** Number of days deleted cases are retained in trash before automatic purge */
export const TRASH_RETENTION_DAYS = 30;

/**
 * Calculates the number of days remaining before a trashed case is permanently purged.
 * @param deletedAt - The date the case was deleted
 * @returns Number of days remaining (minimum 0)
 */
export function calculateDaysRemaining(deletedAt: Date): number {
	const now = new Date();
	const daysSinceDeleted = Math.floor(
		(now.getTime() - deletedAt.getTime()) / (1000 * 60 * 60 * 24)
	);
	return Math.max(0, TRASH_RETENTION_DAYS - daysSinceDeleted);
}
