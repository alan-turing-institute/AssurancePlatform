import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
	type PluginDataLocation,
	readPluginData,
	writePluginData,
} from "@/lib/services/plugin-data-service";
import {
	assertPluginEnabledForUser,
	getUserPluginSettings,
} from "@/lib/services/plugin-enablement-service";
import type {
	ElementType,
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

/** Validates a `PluginData.data` blob shapes up as a `HealthState` before handing it to a UI caller — defensive against a future settings/shape change leaving old rows on disk. */
const healthStateSchema = z.object({
	lastEvaluatedAt: z.string().nullable(),
	score: z.number(),
	validityWindowSeconds: z.number(),
});

/**
 * A single generic message for every reason this read can fail to resolve a
 * claim — doesn't exist, is soft-deleted, isn't a `PROPERTY_CLAIM`, or the
 * caller lacks case access — mirroring `health-evidence-service.ts`'s
 * `CLAIM_NOT_FOUND` precedent. Distinguishing any of these would let a
 * caller learn, from which message came back, something about an element it
 * has no business knowing about — the same enumeration oracle that
 * precedent (and `plugin-data-service.ts`'s own "same error for not-found
 * and no-permission" convention) exists to close.
 * `readPluginData`'s OWN generic message for a permission failure is
 * `"Case not found"` (a different string, since it's shared by non-claim
 * callers too) — remapped to this one below so both failure modes are
 * byte-identical from this function's callers' point of view.
 */
const CLAIM_NOT_FOUND = "Claim not found";
const PLUGIN_DATA_CASE_NOT_FOUND = "Case not found";

/**
 * Reads the current `{ score, lastEvaluatedAt, validityWindowSeconds }` for
 * one claim — the human-facing read path the `element-badge`/`element-panel`
 * UI slots use (ADR 0002 v2 §3: "state dot via element-badge"). Delegates to
 * `readPluginData` (`plugin-data-service.ts`) for the actual row access,
 * which is what enforces case permission + namespace isolation; this
 * function's only job is resolving `claimId` to the `caseId` that
 * `PluginData`'s location key needs — the route layer
 * (`app/api/elements/[id]/health/route.ts`) only has the element id,
 * mirroring every other route in the `app/api/elements/[id]/*` family.
 *
 * Enablement is checked FIRST, before the element lookup even runs (vincent
 * review, BLOCKER, 2026-07-04): the element lookup below queries
 * `assuranceElement` directly, with no case-permission check of its own, so
 * running it before enablement made this function a platform-wide
 * element-existence oracle for any user who had self-disabled `tea.health` —
 * every REAL element id (any case, no access required) resolved past this
 * lookup into `readPluginData`'s enablement check and came back
 * `"Plugin 'tea.health' is not enabled"` (403), while a nonexistent id never
 * got that far and came back `CLAIM_NOT_FOUND` (404). Checking enablement
 * first closes that: a disabled plugin now refuses every id — real,
 * soft-deleted, wrong-typed, or fabricated — with the exact same error
 * before a single row is even queried.
 *
 * The element lookup also selects `elementType` and refuses anything that
 * isn't a `PROPERTY_CLAIM` with the SAME `CLAIM_NOT_FOUND` message (not a
 * distinct one) — evidence-format-v0.1 only ever bears on claims, so a
 * goal/strategy/evidence id has no health state to read, but saying so in a
 * different message would itself be a (smaller) oracle: "exists but wrong
 * type" vs "doesn't exist" leaks whether an id resolves to *something* on
 * the platform. Mirrors `health-evidence-service.ts`'s `resolveClaim`.
 *
 * Returns `{ data: null }` (NOT an error) when no `tea.health` row exists yet
 * for this claim — "never evaluated" is a valid, expected state a claim with
 * no evidence is in, not a failure — or when a row exists but its `data`
 * doesn't parse as a `HealthState` (defensive: a future change to what this
 * plugin stores should degrade old rows to "nothing to show" on this read
 * path, never a 500).
 */
export async function readHealthState(
	actingUserId: string,
	claimId: string
): ServiceResult<HealthState | null> {
	const enablement = await assertPluginEnabledForUser(PLUGIN_ID, actingUserId);
	if ("error" in enablement) {
		return { error: enablement.error };
	}

	let element: {
		caseId: string;
		deletedAt: Date | null;
		elementType: ElementType;
	} | null;
	try {
		element = await prisma.assuranceElement.findUnique({
			where: { id: claimId },
			select: { caseId: true, deletedAt: true, elementType: true },
		});
	} catch (error) {
		console.error("Failed to resolve claim for health state read:", error);
		return { error: "Failed to read health state" };
	}
	if (
		!element ||
		element.deletedAt ||
		element.elementType !== "PROPERTY_CLAIM"
	) {
		return { error: CLAIM_NOT_FOUND };
	}

	const result = await readPluginData(PLUGIN_ID, actingUserId, {
		caseId: element.caseId,
		elementId: claimId,
	});
	if ("error" in result) {
		const error =
			result.error === PLUGIN_DATA_CASE_NOT_FOUND
				? CLAIM_NOT_FOUND
				: result.error;
		return { error };
	}
	if (!result.data) {
		return { data: null };
	}

	const parsed = healthStateSchema.safeParse(result.data.data);
	return { data: parsed.success ? parsed.data : null };
}
