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

// ============================================
// ACCOUNT RETENTION (inactive-account deletion)
// ============================================

/** Years of inactivity since last login (or account creation, if never logged in) before an account becomes eligible for deletion. */
export const RETENTION_INACTIVITY_YEARS = 2;

/** Days before the computed deletion date that the first warning email is sent. */
export const RETENTION_WARNING_30_DAYS_BEFORE = 30;

/** Days before the computed deletion date that the final reminder email is sent. */
export const RETENTION_WARNING_7_DAYS_BEFORE = 7;

/**
 * Minimum days that must have elapsed since the 30-day warning was sent
 * before the 7-day reminder can be sent. Combined with
 * `RETENTION_DELETE_MIN_GAP_DAYS`, this guarantees every account gets its
 * full 30 days of notice even if it is already years overdue the first
 * time the sweep runs — the first run can only warn, never delete.
 */
export const RETENTION_WARNING_7_MIN_GAP_DAYS = 23;

/** Minimum days that must have elapsed since the 7-day reminder was sent before deletion proceeds. */
export const RETENTION_DELETE_MIN_GAP_DAYS = 7;
