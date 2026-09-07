import { timingSafeCompare } from "@/lib/auth/timing-safe";
import {
	RETENTION_DELETE_MIN_GAP_DAYS,
	RETENTION_INACTIVITY_YEARS,
	RETENTION_WARNING_7_DAYS_BEFORE,
	RETENTION_WARNING_7_MIN_GAP_DAYS,
	RETENTION_WARNING_30_DAYS_BEFORE,
} from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import {
	sendRetentionFinalReminderEmail,
	sendRetentionWarningEmail,
} from "@/lib/services/email-service";
import { deleteAccountForRetention } from "@/lib/services/user-management-service";
import type { ServiceResult } from "@/types/service";

// ============================================
// OUTPUT INTERFACES
// ============================================

export interface RetentionSweepResult {
	deleted: number;
	skipped: number;
	warned7: number;
	warned30: number;
}

// ============================================
// DATE HELPERS
// ============================================

function addDays(date: Date, days: number): Date {
	const result = new Date(date);
	result.setUTCDate(result.getUTCDate() + days);
	return result;
}

function addYears(date: Date, years: number): Date {
	const result = new Date(date);
	result.setUTCFullYear(result.getUTCFullYear() + years);
	return result;
}

/** Whole and fractional days elapsed from `earlier` to `later`. */
function daysBetween(earlier: Date, later: Date): number {
	return (later.getTime() - earlier.getTime()) / (1000 * 60 * 60 * 24);
}

// ============================================
// ELIGIBILITY
// ============================================

interface RetentionCandidate {
	authProvider: string;
	createdAt: Date;
	email: string;
	id: string;
	lastLoginAt: Date | null;
	retentionWarning7SentAt: Date | null;
	retentionWarning30SentAt: Date | null;
	username: string;
}

type RetentionAction =
	| { type: "delete" }
	| { type: "none" }
	| { type: "warn30" }
	| { type: "warn7" };

/**
 * Decides what, if anything, happens to a candidate this run.
 *
 * The "sent >= N days ago" gates are the safety property this whole sweep
 * depends on: they guarantee an account that is already years overdue the
 * first time this ever runs can only be warned, never deleted, because
 * `warn7` requires the 30-day warning to already be at least 23 days old,
 * and `delete` requires the 7-day reminder to already be at least 7 days
 * old. Neither can be true on a first run, however overdue the account is.
 */
function decideAction(
	candidate: Pick<
		RetentionCandidate,
		| "createdAt"
		| "lastLoginAt"
		| "retentionWarning30SentAt"
		| "retentionWarning7SentAt"
	>,
	now: Date
): RetentionAction {
	const lastActivity = candidate.lastLoginAt ?? candidate.createdAt;
	const deleteAt = addYears(lastActivity, RETENTION_INACTIVITY_YEARS);
	const warn30At = addDays(deleteAt, -RETENTION_WARNING_30_DAYS_BEFORE);
	const warn7At = addDays(deleteAt, -RETENTION_WARNING_7_DAYS_BEFORE);

	const {
		retentionWarning30SentAt: warn30SentAt,
		retentionWarning7SentAt: warn7SentAt,
	} = candidate;

	if (
		now >= deleteAt &&
		warn7SentAt !== null &&
		daysBetween(warn7SentAt, now) >= RETENTION_DELETE_MIN_GAP_DAYS
	) {
		return { type: "delete" };
	}

	if (
		now >= warn7At &&
		warn7SentAt === null &&
		warn30SentAt !== null &&
		daysBetween(warn30SentAt, now) >= RETENTION_WARNING_7_MIN_GAP_DAYS
	) {
		return { type: "warn7" };
	}

	if (now >= warn30At && warn30SentAt === null) {
		return { type: "warn30" };
	}

	return { type: "none" };
}

/**
 * Coarse pre-filter cutoff for the DB query: any user whose last activity
 * is old enough that they *could* be due at least the 30-day warning.
 * `decideAction` re-derives the exact thresholds per user afterwards — this
 * is only here so the sweep doesn't load every user in the platform.
 */
function candidateCutoff(now: Date): Date {
	return addDays(
		addYears(now, -RETENTION_INACTIVITY_YEARS),
		RETENTION_WARNING_30_DAYS_BEFORE
	);
}

type RetentionOutcome = "deleted" | "skipped" | "warned30" | "warned7";

/**
 * Carries out `decideAction`'s verdict for one candidate and reports which
 * result bucket it landed in. Split out of `runRetentionSweep` purely to
 * keep that function's cognitive complexity down — the two functions
 * together are the sweep's per-user logic.
 */
async function applyRetentionAction(
	candidate: RetentionCandidate,
	now: Date,
	dryRun: boolean
): Promise<RetentionOutcome> {
	const action = decideAction(candidate, now);

	if (action.type === "delete") {
		if (dryRun) {
			return "deleted";
		}
		const result = await deleteAccountForRetention(candidate.id);
		if ("error" in result) {
			console.error(
				`Retention sweep: failed to delete user ${candidate.id}: ${result.error}`
			);
			return "skipped";
		}
		return "deleted";
	}

	if (action.type === "warn7") {
		if (!dryRun) {
			await sendRetentionFinalReminderEmail({
				to: candidate.email,
				username: candidate.username,
				deletionDate: addDays(now, RETENTION_DELETE_MIN_GAP_DAYS),
			});
			await prisma.user.update({
				where: { id: candidate.id },
				data: { retentionWarning7SentAt: now },
			});
		}
		return "warned7";
	}

	if (action.type === "warn30") {
		if (!dryRun) {
			await sendRetentionWarningEmail({
				to: candidate.email,
				username: candidate.username,
				deletionDate: addDays(
					now,
					RETENTION_WARNING_7_MIN_GAP_DAYS + RETENTION_DELETE_MIN_GAP_DAYS
				),
			});
			await prisma.user.update({
				where: { id: candidate.id },
				data: { retentionWarning30SentAt: now },
			});
		}
		return "warned30";
	}

	return "skipped";
}

// ============================================
// SERVICE FUNCTION
// ============================================

/**
 * Sweeps for accounts inactive for two years: sends the 30-day warning,
 * then (>=23 days later) the 7-day final reminder, then (>=7 days after
 * that) deletes the account via `deleteAccountForRetention`. Guarded by
 * CRON_SECRET exactly as `purgeExpiredCases` in `case-trash-service.ts` is.
 *
 * Excludes `authProvider: SYSTEM` (integration system users never log in
 * and must never be swept). There is no `deletedAt`/soft-delete concept on
 * `User` — deletion here is a hard delete of the row — so "already deleted"
 * users are excluded simply by not existing to be queried.
 *
 * `dryRun: true` computes and returns the same counts without sending any
 * email, writing any warning timestamp, or deleting any account.
 */
export async function runRetentionSweep(
	authToken: string | null,
	options: { dryRun?: boolean } = {}
): ServiceResult<RetentionSweepResult> {
	const { dryRun = false } = options;
	const cronSecret = process.env.CRON_SECRET;

	if (!cronSecret) {
		console.error("CRON_SECRET environment variable not set");
		return { error: "Server configuration error" };
	}

	if (!(authToken && timingSafeCompare(authToken, cronSecret))) {
		return { error: "Unauthorised" };
	}

	try {
		const now = new Date();
		const cutoff = candidateCutoff(now);

		const candidates: RetentionCandidate[] = await prisma.user.findMany({
			where: {
				authProvider: { not: "SYSTEM" },
				OR: [
					{ lastLoginAt: { lte: cutoff } },
					{ lastLoginAt: null, createdAt: { lte: cutoff } },
				],
			},
			select: {
				id: true,
				email: true,
				username: true,
				authProvider: true,
				createdAt: true,
				lastLoginAt: true,
				retentionWarning30SentAt: true,
				retentionWarning7SentAt: true,
			},
		});

		const counts: RetentionSweepResult = {
			warned30: 0,
			warned7: 0,
			deleted: 0,
			skipped: 0,
		};

		for (const candidate of candidates) {
			try {
				counts[await applyRetentionAction(candidate, now, dryRun)]++;
			} catch (error) {
				console.error(
					`Retention sweep: error processing user ${candidate.id}:`,
					error
				);
				counts.skipped++;
			}
		}

		return { data: counts };
	} catch (error) {
		console.error("Failed to run retention sweep:", error);
		return { error: "Failed to run retention sweep" };
	}
}
