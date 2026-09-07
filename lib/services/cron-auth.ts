import { timingSafeCompare } from "@/lib/auth/timing-safe";
import { logger } from "@/lib/logger";

export type CronAuthResult =
	| { authorised: true }
	| { authorised: false; error: string };

/**
 * Shared CRON_SECRET guard for every cron-triggered service
 * (`purgeExpiredCases`, `sweepHealthStaleness`, `runRetentionSweep`). Fails
 * closed if `CRON_SECRET` isn't configured, and compares with
 * `timingSafeCompare` so response timing can't be used to guess the secret.
 *
 * Extracted from three near-identical copies (vincent, review round 1) —
 * behaviour is unchanged from each call site's inline version, including
 * the exact error strings ("Server configuration error" / "Unauthorised")
 * existing tests assert on.
 */
export function requireCronSecret(token: string | null): CronAuthResult {
	const cronSecret = process.env.CRON_SECRET;

	if (!cronSecret) {
		logger.error("CRON_SECRET environment variable not set");
		return { authorised: false, error: "Server configuration error" };
	}

	if (!(token && timingSafeCompare(token, cronSecret))) {
		return { authorised: false, error: "Unauthorised" };
	}

	return { authorised: true };
}
