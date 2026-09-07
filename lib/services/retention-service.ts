import {
	RETENTION_DELETE_MIN_GAP_DAYS,
	RETENTION_INACTIVITY_YEARS,
	RETENTION_WARNING_7_DAYS_BEFORE,
	RETENTION_WARNING_7_MIN_GAP_DAYS,
	RETENTION_WARNING_30_DAYS_BEFORE,
} from "@/lib/constants";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { requireCronSecret } from "@/lib/services/cron-auth";
import {
	sendRetentionFinalReminderEmail,
	sendRetentionWarningEmail,
} from "@/lib/services/email-service";
import {
	checkDeletable,
	deleteAccountForRetention,
} from "@/lib/services/user-management-service";
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
 * Claims the 30-day-warning slot for this candidate and returns whether
 * THIS call won it. `updateMany` with a `retentionWarning30SentAt: null`
 * guard is the compare-and-swap (QA round 1 gap): if two sweeps overlap
 * (e.g. a slow run plus the next scheduled trigger), only the first
 * `updateMany` to reach Postgres matches the guard and returns `count: 1`;
 * the second sees the row already stamped, matches nothing, and must not
 * also send the email. Same shape for the 7-day reminder below.
 */
async function claimWarning30(
	candidateId: string,
	now: Date
): Promise<boolean> {
	const { count } = await prisma.user.updateMany({
		where: { id: candidateId, retentionWarning30SentAt: null },
		data: { retentionWarning30SentAt: now },
	});
	return count === 1;
}

async function claimWarning7(candidateId: string, now: Date): Promise<boolean> {
	const { count } = await prisma.user.updateMany({
		where: { id: candidateId, retentionWarning7SentAt: null },
		data: { retentionWarning7SentAt: now },
	});
	return count === 1;
}

/**
 * Reverses a claim made moments ago by THIS call (vincent, review round 2,
 * should-fix): if the send that followed the claim throws, the warning was
 * never actually delivered, so the stamp must not stand — otherwise the
 * user is "warned on record" but never warned, and (worse, on the 7-day
 * stage) one step closer to a deletion nothing ever told them about.
 * Guarded on the field still holding the exact timestamp this call wrote,
 * so it can only ever undo its own claim, never a different run's.
 */
async function resetWarning30(
	candidateId: string,
	claimedAt: Date
): Promise<void> {
	await prisma.user.updateMany({
		where: { id: candidateId, retentionWarning30SentAt: claimedAt },
		data: { retentionWarning30SentAt: null },
	});
}

async function resetWarning7(
	candidateId: string,
	claimedAt: Date
): Promise<void> {
	await prisma.user.updateMany({
		where: { id: candidateId, retentionWarning7SentAt: claimedAt },
		data: { retentionWarning7SentAt: null },
	});
}

async function handleDelete(
	candidateId: string,
	dryRun: boolean
): Promise<RetentionOutcome> {
	if (dryRun) {
		// Mirror the real path's pre-checks (QA round 1, D2) so dry-run and
		// real counts agree on exactly the accounts that would be skipped.
		const deletable = await checkDeletable(candidateId);
		return deletable.deletable ? "deleted" : "skipped";
	}
	const result = await deleteAccountForRetention(candidateId);
	if ("error" in result) {
		logger.error("Retention sweep: failed to delete user", {
			userId: candidateId,
			error: result.error,
		});
		return "skipped";
	}
	return "deleted";
}

/**
 * Claims, sends, and stamps the 7-day reminder — or, if the send throws
 * after the claim succeeded, undoes the claim and logs distinctly
 * (vincent, review round 2, should-fix) so the next sweep retries instead
 * of leaving the user "warned on record" but never actually warned.
 */
async function handleWarn7(
	candidate: RetentionCandidate,
	now: Date,
	dryRun: boolean
): Promise<RetentionOutcome> {
	if (dryRun) {
		return "warned7";
	}
	const won = await claimWarning7(candidate.id, now);
	if (!won) {
		return "skipped";
	}
	try {
		await sendRetentionFinalReminderEmail({
			to: candidate.email,
			username: candidate.username,
			deletionDate: addDays(now, RETENTION_DELETE_MIN_GAP_DAYS),
		});
	} catch (error) {
		await resetWarning7(candidate.id, now);
		logger.error("retention.warning_send_failed", {
			userId: candidate.id,
			stage: "warn7",
			error: error instanceof Error ? error.message : String(error),
		});
		return "skipped";
	}
	return "warned7";
}

/** Same shape as `handleWarn7`, for the 30-day warning. */
async function handleWarn30(
	candidate: RetentionCandidate,
	now: Date,
	dryRun: boolean
): Promise<RetentionOutcome> {
	if (dryRun) {
		return "warned30";
	}
	const won = await claimWarning30(candidate.id, now);
	if (!won) {
		return "skipped";
	}
	try {
		await sendRetentionWarningEmail({
			to: candidate.email,
			username: candidate.username,
			deletionDate: addDays(
				now,
				RETENTION_WARNING_7_MIN_GAP_DAYS + RETENTION_DELETE_MIN_GAP_DAYS
			),
		});
	} catch (error) {
		await resetWarning30(candidate.id, now);
		logger.error("retention.warning_send_failed", {
			userId: candidate.id,
			stage: "warn30",
			error: error instanceof Error ? error.message : String(error),
		});
		return "skipped";
	}
	return "warned30";
}

/**
 * Carries out `decideAction`'s verdict for one candidate and reports which
 * result bucket it landed in. Split out of `runRetentionSweep` (and split
 * further into `handleDelete`/`handleWarn7`/`handleWarn30`) purely to keep
 * cognitive complexity down — together they are the sweep's per-user logic.
 */
async function applyRetentionAction(
	candidate: RetentionCandidate,
	now: Date,
	dryRun: boolean
): Promise<RetentionOutcome> {
	const action = decideAction(candidate, now);

	switch (action.type) {
		case "delete":
			return await handleDelete(candidate.id, dryRun);
		case "warn7":
			return await handleWarn7(candidate, now, dryRun);
		case "warn30":
			return await handleWarn30(candidate, now, dryRun);
		default:
			return "skipped";
	}
}

// ============================================
// SERVICE FUNCTION
// ============================================

/**
 * Sweeps for accounts inactive for two years: sends the 30-day warning,
 * then (>=23 days later) the 7-day final reminder, then (>=7 days after
 * that) deletes the account via `deleteAccountForRetention`. Guarded by
 * CRON_SECRET exactly as `purgeExpiredCases` in `case-trash-service.ts` is
 * (both now share `requireCronSecret`, `lib/services/cron-auth.ts`).
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

	const auth = requireCronSecret(authToken);
	if (!auth.authorised) {
		return { error: auth.error };
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
				logger.error("Retention sweep: error processing user", {
					userId: candidate.id,
					error: error instanceof Error ? error.message : String(error),
				});
				counts.skipped++;
			}
		}

		return { data: counts };
	} catch (error) {
		logger.error("Failed to run retention sweep", {
			error: error instanceof Error ? error.message : String(error),
		});
		return { error: "Failed to run retention sweep" };
	}
}
