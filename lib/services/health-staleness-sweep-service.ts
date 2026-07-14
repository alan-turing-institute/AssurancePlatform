import { z } from "zod";
import { timingSafeCompare } from "@/lib/auth/timing-safe";
import { prisma } from "@/lib/prisma";
import {
	type HealthState,
	isHealthStateStale,
} from "@/lib/services/health-scoring-service";
import { upsertCaseLevelPluginData } from "@/lib/services/plugin-data-service";
import { emitSSEEvent } from "@/lib/services/sse-connection-manager";
import type { Prisma } from "@/src/generated/prisma";
import type { ServiceResult } from "@/types/service";

/**
 * The health plugin's staleness sweeper (ADR 0002 v2 §3: "the existing
 * cron-route pattern, marking stale claims and emitting SSE"). Protected by
 * `CRON_SECRET`, mirroring `case-trash-service.ts`'s `purgeExpiredCases`
 * exactly (same env var, same timing-safe compare, same "unset secret is a
 * 500, not a silent open door" failure mode).
 *
 * Staleness itself is NEVER computed or stored here as a first-class fact —
 * it is re-derived on every sweep from `health-scoring-service.ts`'s
 * `isHealthStateStale`, the single source of truth every read path (this
 * sweeper, `readHealthState`, the `HealthBadge` client) agrees with. What
 * THIS module persists is bookkeeping ONLY: which claims this sweep has
 * already notified about, so a claim doesn't get re-broadcast on every
 * subsequent run just because it's still stale.
 */

const PLUGIN_ID = "tea.health";

const healthStateSchema = z.object({
	lastEvaluatedAt: z.string().nullable(),
	score: z.number(),
	validityWindowSeconds: z.number(),
});

/**
 * Case-level bookkeeping row (`elementId: null`, same `tea.health`
 * namespace, tier-1 `PluginData` — "plugin data, not core schema"): which
 * claims in this case have already been notified stale, keyed by claimId to
 * the ISO timestamp of the sweep that noticed the transition. An entry is
 * REMOVED the moment its claim's health becomes fresh again (e.g. new
 * evidence pushes `lastEvaluatedAt` forward past the window's start) — so a
 * LATER staleness on the same claim is treated as a fresh transition and
 * notified again, rather than being permanently suppressed by one stale
 * evidence run's marker.
 */
const sweepMarkerSchema = z.object({
	notifiedStaleClaimIds: z.record(z.string(), z.string()).default({}),
});
type SweepMarker = z.infer<typeof sweepMarkerSchema>;

function parseMarker(data: unknown): SweepMarker {
	const parsed = sweepMarkerSchema.safeParse(data ?? {});
	return parsed.success ? parsed.data : { notifiedStaleClaimIds: {} };
}

export interface HealthStalenessSweepResult {
	/** How many distinct cases had at least one claim newly notified this run. */
	casesNotified: number;
	/** How many claims were newly notified stale this run (0 on a re-run with no new transitions). */
	staleClaimsNotified: number;
}

interface ClaimHealthRow {
	elementId: string;
	health: HealthState;
}

/** Groups every parseable element-level `tea.health` row by its case. Rows whose `data` no longer parses as a `HealthState` are skipped (defensive — mirrors `readHealthState`'s own degrade-on-shape-mismatch). */
function groupHealthRowsByCase(
	rows: Array<{
		caseId: string;
		data: Prisma.JsonValue;
		elementId: string | null;
	}>
): Map<string, ClaimHealthRow[]> {
	const byCase = new Map<string, ClaimHealthRow[]>();
	for (const row of rows) {
		if (!row.elementId) {
			continue;
		}
		const parsed = healthStateSchema.safeParse(row.data);
		if (!parsed.success) {
			continue;
		}
		const claims = byCase.get(row.caseId) ?? [];
		claims.push({ elementId: row.elementId, health: parsed.data });
		byCase.set(row.caseId, claims);
	}
	return byCase;
}

interface CaseSweepOutcome {
	hadNewStale: boolean;
	staleNotified: number;
}

/**
 * Sweeps one case's claims against its sweep marker: emits SSE + records the
 * marker for every claim newly crossing into staleness, and clears the
 * marker for any claim that's fresh again. Persists the marker only when it
 * actually changed.
 */
async function sweepCaseClaims(
	caseId: string,
	claims: ClaimHealthRow[],
	now: Date
): Promise<CaseSweepOutcome> {
	const markerRow = await prisma.pluginData.findFirst({
		where: { pluginId: PLUGIN_ID, caseId, elementId: null },
		select: { data: true },
	});
	const marker = parseMarker(markerRow?.data);
	const notified = { ...marker.notifiedStaleClaimIds };
	let markerChanged = false;
	let staleNotified = 0;

	for (const { elementId, health } of claims) {
		const stale = isHealthStateStale(health, now);
		const alreadyNotified = elementId in notified;

		if (stale && !alreadyNotified) {
			notified[elementId] = now.toISOString();
			markerChanged = true;
			staleNotified++;
			emitSSEEvent("tea.health/state-changed", caseId, {
				claimId: elementId,
				health,
				stale: true,
			});
		} else if (alreadyNotified && !stale) {
			// Fresh again (new evidence arrived since the last notification) —
			// clear the marker so a FUTURE staleness re-notifies rather than
			// being permanently suppressed by this one.
			delete notified[elementId];
			markerChanged = true;
		}
	}

	if (markerChanged) {
		const updatedMarker: SweepMarker = { notifiedStaleClaimIds: notified };
		await upsertCaseLevelPluginData(
			PLUGIN_ID,
			caseId,
			updatedMarker as unknown as Prisma.InputJsonValue
		);
	}

	return { hadNewStale: staleNotified > 0, staleNotified };
}

/**
 * Runs one sweep: scans every element-level `tea.health` `PluginData` row
 * across the WHOLE deployment (a system maintenance job, not a per-user
 * view — it reads only its own `tea.health` namespace directly, with no
 * enablement/permission guard, the same deliberate bypass
 * `capturePluginDataForSnapshot` uses for snapshot capture and for the same
 * reason: this isn't any one viewer's read). For every claim that has
 * newly crossed into staleness since the last sweep (`sweepCaseClaims`
 * above):
 *
 *  1. emits `tea.health/state-changed` to that claim's case (payload shape
 *     matches the evidence-append route's: `{ claimId, health }`, plus
 *     `stale: true` — the client's `useClaimScopedFetch` filters strictly
 *     on `payload.claimId === elementId`, so this is emitted per newly-stale
 *     CLAIM, not once per case, even though every emission is addressed to
 *     that claim's case);
 *  2. records the claimId in that case's sweep marker, so re-running the
 *     sweep is a no-op for claims already flagged (idempotent — a second
 *     immediate run notifies zero claims).
 *
 * Per-case error isolation: each case is swept inside its own try/catch, so
 * one case's failure (e.g. its marker-persist write rejecting) does not
 * abort the run for every case still queued — the sweep always processes
 * every case it found before returning. If any case failed, the overall
 * result is still an error (surfaced to the cron caller for alerting/retry),
 * but only after every other case has already had its shot; a failed case's
 * marker is simply not updated, so the next scheduled run naturally retries
 * it (re-notify-on-failure, never silent loss — mirrors the module's
 * existing re-arm behaviour for fresh-then-stale transitions).
 */
export async function sweepHealthStaleness(
	authToken: string | null
): ServiceResult<HealthStalenessSweepResult> {
	const cronSecret = process.env.CRON_SECRET;

	if (!cronSecret) {
		console.error("CRON_SECRET environment variable not set");
		return { error: "Server configuration error" };
	}

	if (!(authToken && timingSafeCompare(authToken, cronSecret))) {
		return { error: "Unauthorised" };
	}

	try {
		const rows = await prisma.pluginData.findMany({
			where: { pluginId: PLUGIN_ID, elementId: { not: null } },
			select: { caseId: true, elementId: true, data: true },
		});
		const byCase = groupHealthRowsByCase(rows);

		const now = new Date();
		let casesNotified = 0;
		let staleClaimsNotified = 0;
		let failedCaseCount = 0;

		for (const [caseId, claims] of byCase) {
			try {
				const outcome = await sweepCaseClaims(caseId, claims, now);
				if (outcome.hadNewStale) {
					casesNotified++;
				}
				staleClaimsNotified += outcome.staleNotified;
			} catch (error) {
				// Isolated per case: one case's marker-persist (or other) failure
				// must not abort the sweep for every other case still queued —
				// each case gets its own shot, in whatever order the Map iterates.
				failedCaseCount++;
				console.error(`Failed to sweep case ${caseId} staleness:`, error);
			}
		}

		if (failedCaseCount > 0) {
			return {
				error: `Failed to sweep staleness for ${failedCaseCount} of ${byCase.size} case(s)`,
			};
		}

		return { data: { casesNotified, staleClaimsNotified } };
	} catch (error) {
		console.error("Failed to sweep health staleness:", error);
		return { error: "Failed to sweep health staleness" };
	}
}
