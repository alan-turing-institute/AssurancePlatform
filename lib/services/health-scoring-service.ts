import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
	type PluginDataLocation,
	writePluginData,
} from "@/lib/services/plugin-data-service";
import { getUserPluginSettings } from "@/lib/services/plugin-enablement-service";
import type {
	PluginHealthEvidenceVerdict,
	Prisma,
} from "@/src/generated/prisma";
import type { ServiceResult } from "@/types/service";

/**
 * The health plugin's scoring rule (ADR 0002 v2 §3, ADR 0001 §4): v1 is
 * "worst verdict within the validity window", producing a continuous score
 * in 0.0-1.0 (a discrete set of points in v1 — 0, 0.5, 1 — but the *type* is
 * the continuous score every future vocabulary (traffic lights, whatever
 * else) derives from, never a stored enum). Writes land in tier-1
 * `PluginData` under the `tea.health` namespace, via the existing access
 * service — this module never touches `PluginData` rows directly, so
 * namespace isolation and enablement/permission enforcement are inherited,
 * not re-implemented.
 *
 * Touches ONLY the directly-evidenced claim (element-scoped `PluginData`
 * row) — no cascade through the claim DAG (ADR 0001 §4: defeat cascade is
 * out of scope for v1).
 */

const PLUGIN_ID = "tea.health";

/** v1 default: a day. Used whenever no per-user override is present in `PluginState.settings`. */
export const DEFAULT_VALIDITY_WINDOW_SECONDS = 24 * 60 * 60;

/** Score assigned when the WORST verdict present in the window is this verdict. */
const DEFAULT_VERDICT_SCORES: Record<PluginHealthEvidenceVerdict, number> = {
	FAIL: 0,
	DEGRADED: 0.5,
	PASS: 1,
};

/**
 * Severity order for "worst verdict" — lower score wins (is worse).
 * Kept separate from `DEFAULT_VERDICT_SCORES` so a settings override can
 * change the SCORE assigned to a verdict without changing which verdict
 * is considered worse than which.
 */
const VERDICT_SEVERITY: Record<PluginHealthEvidenceVerdict, number> = {
	FAIL: 0,
	DEGRADED: 1,
	PASS: 2,
};

/**
 * Optional per-user override shape for `tea.health`'s `PluginState.settings`
 * (ADR 0002 v2 §2.2: "thresholds/window in plugin settings"). 1.0 ships no
 * settings UI for this plugin's scoring knobs specifically (that's a later
 * work item), but the mechanism already exists — `PluginState.settings` is
 * a bounded, arbitrary JSON blob (`lib/schemas/plugin.ts`) any caller of
 * `PATCH /api/user/plugins` can already set. Reading it here means the
 * settings pane's eventual UI for these knobs needs no service change.
 * Malformed/partial settings never throw: each field falls back to its
 * default independently, and the read is wrapped in `safeParse` — invalid
 * settings degrade to "use the defaults", never a scoring failure.
 */
const scoringSettingsSchema = z.object({
	validityWindowSeconds: z.number().positive().optional(),
	verdictScores: z
		.object({
			PASS: z.number().min(0).max(1).optional(),
			DEGRADED: z.number().min(0).max(1).optional(),
			FAIL: z.number().min(0).max(1).optional(),
		})
		.optional(),
});

interface ScoringSettings {
	validityWindowSeconds: number;
	verdictScores: Record<PluginHealthEvidenceVerdict, number>;
}

/** Resolves the acting user's scoring settings, falling back to the v1 defaults field-by-field. */
async function resolveScoringSettings(
	userId: string
): Promise<ScoringSettings> {
	const result = await getUserPluginSettings(PLUGIN_ID, userId);
	const raw = "data" in result ? result.data : null;
	const parsed = scoringSettingsSchema.safeParse(raw ?? {});
	const settings = parsed.success ? parsed.data : {};

	return {
		validityWindowSeconds:
			settings.validityWindowSeconds ?? DEFAULT_VALIDITY_WINDOW_SECONDS,
		verdictScores: {
			PASS: settings.verdictScores?.PASS ?? DEFAULT_VERDICT_SCORES.PASS,
			DEGRADED:
				settings.verdictScores?.DEGRADED ?? DEFAULT_VERDICT_SCORES.DEGRADED,
			FAIL: settings.verdictScores?.FAIL ?? DEFAULT_VERDICT_SCORES.FAIL,
		},
	};
}

export interface HealthState {
	lastEvaluatedAt: string | null;
	score: number;
	validityWindowSeconds: number;
}

/**
 * Recomputes `claimId`'s health score from its full evidence log and writes
 * `{ score, lastEvaluatedAt, validityWindowSeconds }` into element-scoped
 * `PluginData` under `tea.health`, via `writePluginData` (inherits its
 * enablement + case-permission + namespace enforcement — this function
 * never calls `prisma.pluginData.*` directly).
 *
 * v1 rule: within `[now - validityWindowSeconds, now]`, find the WORST
 * verdict (FAIL worse than DEGRADED worse than PASS) among this claim's
 * evidence and score = that verdict's configured score. No qualifying
 * evidence in the window scores 0.0 — the conservative "no confirming
 * evidence" default for an assurance tool: silence is never read as health.
 *
 * `lastEvaluatedAt` is the MAX `evaluatedAt` across the ENTIRE log, not just
 * the item that triggered this recompute — evidence is append-only but
 * `evaluatedAt` is client-supplied and can arrive out of temporal order
 * (evidence-format-v0.1: "when the check ran... not when we stored it"), so
 * a backfilled older item must never regress `lastEvaluatedAt` forward of
 * an already-known more recent one, nor should a fresh item's own
 * timestamp be assumed to be the newest just because it was appended last.
 */
export async function recomputeHealthScore(
	actingUserId: string,
	claimId: string,
	caseId: string
): ServiceResult<HealthState> {
	const settings = await resolveScoringSettings(actingUserId);
	const windowStart = new Date(
		Date.now() - settings.validityWindowSeconds * 1000
	);

	let evidence: Array<{
		verdict: PluginHealthEvidenceVerdict;
		evaluatedAt: Date;
	}>;
	try {
		evidence = await prisma.pluginHealthEvidence.findMany({
			where: { claimId },
			select: { verdict: true, evaluatedAt: true },
		});
	} catch (error) {
		console.error("Failed to read evidence for scoring:", error);
		return { error: "Failed to compute health score" };
	}

	const lastEvaluatedAt = evidence.reduce<Date | null>((latest, item) => {
		if (!latest || item.evaluatedAt > latest) {
			return item.evaluatedAt;
		}
		return latest;
	}, null);

	const inWindow = evidence.filter((item) => item.evaluatedAt >= windowStart);
	const worst = inWindow.reduce<PluginHealthEvidenceVerdict | null>(
		(worstSoFar, item) => {
			if (!worstSoFar) {
				return item.verdict;
			}
			return VERDICT_SEVERITY[item.verdict] < VERDICT_SEVERITY[worstSoFar]
				? item.verdict
				: worstSoFar;
		},
		null
	);
	const score = worst ? settings.verdictScores[worst] : 0;

	const healthState: HealthState = {
		score,
		lastEvaluatedAt: lastEvaluatedAt?.toISOString() ?? null,
		validityWindowSeconds: settings.validityWindowSeconds,
	};

	const location: PluginDataLocation = { caseId, elementId: claimId };
	const writeResult = await writePluginData(
		PLUGIN_ID,
		actingUserId,
		location,
		// `HealthState` is plain JSON (string | number | null fields) but, as a
		// named interface, has no index signature of its own, so it doesn't
		// structurally satisfy `InputJsonObject` even though every value it can
		// hold is a valid `InputJsonValue`. Routing through `unknown` is TS's
		// own prescribed escape hatch for exactly this "no sufficient overlap"
		// case — not a blind `any`.
		healthState as unknown as Prisma.InputJsonValue
	);
	if ("error" in writeResult) {
		return { error: writeResult.error };
	}

	return { data: healthState };
}
