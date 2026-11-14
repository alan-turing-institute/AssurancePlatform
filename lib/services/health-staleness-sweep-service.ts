import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { requireCronSecret } from "@/lib/services/cron-auth";
import { computeHealthStatus } from "@/lib/services/health-status-service";
import { emitSSEEvent } from "@/lib/services/sse-connection-manager";
import type { ServiceResult } from "@/types/service";

const log = logger.child({ component: "health-staleness-sweep-service" });

/**
 * The health plugin's staleness sweeper: the existing cron-route pattern,
 * telling open browsers when a claim has newly become stale. Protected by
 * `CRON_SECRET`, mirroring `case-trash-service.ts`'s `purgeExpiredCases`
 * (same env var, same timing-safe compare, same "unset secret is a 500, not
 * a silent open door" failure mode).
 *
 * Staleness itself is never stored as a fact here — each sweep recomputes
 * it from the evidence with `computeHealthStatus`, the same computation
 * every read path uses. What the sweep persists is bookkeeping only:
 * `staleNotifiedAt` on the claim's state row, so a claim is announced once
 * when it becomes stale rather than on every run while it stays stale. The
 * marker is cleared when the claim is fresh again, so a later staleness is
 * announced afresh.
 */

export interface HealthStalenessSweepResult {
	/** How many distinct cases had at least one claim newly notified this run. */
	casesNotified: number;
	/** How many claims were newly notified stale this run (0 on a re-run with no new transitions). */
	staleClaimsNotified: number;
}

interface ClaimToSweep {
	claimId: string;
	notified: boolean;
}

/** Every claim with a state row, grouped by case. Claims whose element is soft-deleted are skipped. */
async function claimsByCase(): Promise<Map<string, ClaimToSweep[]>> {
	const states = await prisma.pluginHealthClaimState.findMany({
		where: { claim: { deletedAt: null } },
		select: {
			claimId: true,
			staleNotifiedAt: true,
			claim: { select: { caseId: true } },
		},
	});
	const byCase = new Map<string, ClaimToSweep[]>();
	for (const state of states) {
		const claims = byCase.get(state.claim.caseId) ?? [];
		claims.push({
			claimId: state.claimId,
			notified: state.staleNotifiedAt !== null,
		});
		byCase.set(state.claim.caseId, claims);
	}
	return byCase;
}

/**
 * Sweeps one case's claims: emits the SSE event and sets the marker for
 * every claim newly crossing into staleness, and clears the marker for any
 * claim that is fresh (or has no status) again.
 */
async function sweepCaseClaims(
	caseId: string,
	claims: ClaimToSweep[],
	now: Date
): Promise<number> {
	let newlyNotified = 0;
	for (const { claimId, notified } of claims) {
		const status = await computeHealthStatus(claimId, caseId, now);
		const stale = status?.stale === true;

		if (stale && !notified) {
			// Announced before the marker is stored: if storing it fails, the next
			// run announces the claim again rather than never.
			emitSSEEvent("tea.health/state-changed", caseId, {
				claimId,
				status,
				stale: true,
			});
			await prisma.pluginHealthClaimState.update({
				where: { claimId },
				data: { staleNotifiedAt: now },
			});
			newlyNotified++;
		} else if (!stale && notified) {
			await prisma.pluginHealthClaimState.update({
				where: { claimId },
				data: { staleNotifiedAt: null },
			});
		}
	}
	return newlyNotified;
}

/**
 * Runs one sweep across the WHOLE deployment (a system maintenance job, not
 * a per-user view, so it reads the health tables directly with no
 * enablement or permission guard). For every claim that has newly crossed
 * into staleness since the last sweep it emits `tea.health/state-changed`
 * to that claim's case with `{ claimId, status, stale: true }` and records
 * the marker, so re-running the sweep is a no-op for claims already
 * flagged. Events are emitted per claim: the client filters on
 * `payload.claimId`.
 *
 * Per-case error isolation: each case is swept inside its own try/catch, so
 * one case's failure does not abort the run for every case still queued. If
 * any case failed, the overall result is still an error (surfaced to the
 * cron caller for alerting and retry), but only after every other case has
 * had its turn; a failed claim's marker is simply not updated, so the next
 * scheduled run retries it.
 */
export async function sweepHealthStaleness(
	authToken: string | null
): ServiceResult<HealthStalenessSweepResult> {
	const auth = requireCronSecret(authToken);
	if (!auth.authorised) {
		return { error: auth.error };
	}

	try {
		const byCase = await claimsByCase();
		const now = new Date();
		let casesNotified = 0;
		let staleClaimsNotified = 0;
		let failedCaseCount = 0;

		for (const [caseId, claims] of byCase) {
			try {
				const newlyNotified = await sweepCaseClaims(caseId, claims, now);
				if (newlyNotified > 0) {
					casesNotified++;
				}
				staleClaimsNotified += newlyNotified;
			} catch (error) {
				failedCaseCount++;
				log.error("Failed to sweep case staleness", { caseId, error });
			}
		}

		if (failedCaseCount > 0) {
			return {
				error: `Failed to sweep staleness for ${failedCaseCount} of ${byCase.size} case(s)`,
			};
		}

		return { data: { casesNotified, staleClaimsNotified } };
	} catch (error) {
		log.error("Failed to sweep health staleness", { error });
		return { error: "Failed to sweep health staleness" };
	}
}
