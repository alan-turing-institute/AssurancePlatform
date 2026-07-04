/**
 * Score -> band derivation for the health plugin's UI (ADR 0002 v2 §3, work
 * item 4 — the `element-badge`/`element-panel` slots). Bands are a UI-only,
 * runtime-derived concept — never a stored enum ("bands NOT hardcoded in
 * schema", per the delegation brief) — so a future settings UI for
 * `tea.health`'s `verdictScores` (already a live mechanism server-side, see
 * `lib/services/health-scoring-service.ts`) changes what a score MEANS here
 * for free, with no migration.
 */

export type HealthBand = "degraded" | "fail" | "pass";

/**
 * What the `element-badge`/`element-panel` slots need per claim — the same
 * shape `health-scoring-service.ts`'s `HealthState` writes into `PluginData`
 * (and `readHealthState` reads back).
 */
export interface HealthState {
	lastEvaluatedAt: string | null;
	score: number;
	validityWindowSeconds: number;
}

/**
 * Mirrors `health-scoring-service.ts`'s `DEFAULT_VERDICT_SCORES` exactly (v1
 * default: FAIL 0, DEGRADED 0.5, PASS 1). Kept as an independent constant
 * rather than imported from there: that module imports `@/lib/prisma` and is
 * server-only, so pulling it into a "use client" badge would drag a Prisma
 * client into the browser bundle. Duplicating three numbers is cheaper than
 * making a shared module carry the weight of staying prisma-free forever —
 * `health-bands.test.ts`'s default-boundary assertions are the tripwire if
 * the two ever drift.
 */
export const DEFAULT_BAND_SCORES: Record<HealthBand, number> = {
	fail: 0,
	degraded: 0.5,
	pass: 1,
};

/** Worse-wins tie-break order — lower is worse. */
const BAND_SEVERITY: Record<HealthBand, number> = {
	fail: 0,
	degraded: 1,
	pass: 2,
};

const ALL_BANDS: readonly HealthBand[] = ["fail", "degraded", "pass"];

/**
 * Maps a continuous score to the band whose configured score it sits closest
 * to — not a fixed range check — so a custom `verdictScores` setting (a live
 * mechanism today via `PATCH /api/user/plugins`, ADR §2.2) keeps the badge's
 * bands consistent with whatever a score of, say, 0.7 is now supposed to
 * mean, with no code change here. Ties (equidistant from two bands) resolve
 * to the WORSE one — an assurance tool's badge should never round an
 * ambiguous score up (mirrors `recomputeHealthScore`'s "silence is never
 * read as health" conservatism).
 */
export function deriveHealthBand(
	score: number,
	bandScores: Record<HealthBand, number> = DEFAULT_BAND_SCORES
): HealthBand {
	let best: HealthBand = "fail";
	let bestDistance = Number.POSITIVE_INFINITY;

	for (const band of ALL_BANDS) {
		const distance = Math.abs(score - bandScores[band]);
		const isCloser = distance < bestDistance;
		const isTieButWorse =
			distance === bestDistance && BAND_SEVERITY[band] < BAND_SEVERITY[best];
		if (isCloser || isTieButWorse) {
			best = band;
			bestDistance = distance;
		}
	}

	return best;
}

/**
 * Health ⊥ freshness (ADR 0002 v2 §3): a claim can be green-but-stale.
 * `lastEvaluatedAt: null` (no evidence ever recorded) counts as stale —
 * defensive only, since `readHealthState` never returns a `HealthState` at
 * all until at least one evidence item has been scored, so this branch is
 * currently unreachable in practice, not a designed state.
 */
export function isHealthStale(health: HealthState): boolean {
	if (!health.lastEvaluatedAt) {
		return true;
	}
	const evaluatedAtMs = new Date(health.lastEvaluatedAt).getTime();
	return Date.now() - evaluatedAtMs > health.validityWindowSeconds * 1000;
}
