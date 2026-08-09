"use client";

import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatRelativeToNow } from "@/lib/date";
import type { ElementSlotContext } from "@/lib/plugins/slots";
import { cn } from "@/lib/utils";
import type { HealthBand } from "./health-bands";
import { deriveHealthBand, isHealthStale } from "./health-bands";
import { useHealthBandScores } from "./use-health-band-scores";
import { useHealthState } from "./use-health-state";

const BAND_DOT_CLASSES: Record<HealthBand, string> = {
	pass: "bg-success",
	degraded: "bg-warning",
	fail: "bg-destructive",
};

const BAND_LABELS: Record<HealthBand, string> = {
	pass: "Health: passing",
	degraded: "Health: degraded",
	fail: "Health: failing",
};

/** The band word alone, for composing into the stale label below. */
const BAND_WORDS: Record<HealthBand, string> = {
	pass: "passing",
	degraded: "degraded",
	fail: "failing",
};

/**
 * Stale marker (ADR 0002 v2 §3 — "green-but-stale is preserved"): health and
 * freshness are orthogonal, so staleness must never REPLACE the band colour,
 * only annotate it. A ring keeps the dot's fill on its band colour and adds
 * a second, concentric shape around it — a geometry cue, not a colour one,
 * so it reads even without colour vision. `ring-offset-background` keeps the
 * gap between dot and ring visible against either theme.
 */
const STALE_RING_CLASSES =
	"ring-2 ring-muted-foreground/70 ring-offset-1 ring-offset-background";

/**
 * The `element-badge` slot's health state dot (ADR 0002 v2 §3 — "the state
 * dot"). Renders nothing for anything `useHealthState` can't turn into a
 * confident answer: not a claim, no health data yet, or a fetch error —
 * fail-closed rather than guess (delegation brief, item 2). Plugin-disabled
 * is already handled one layer up: `useElementBadgeSlot` filters this
 * registration out of the list entirely before it would ever mount.
 *
 * Colour is never the only signal: the dot is an `<output>` element (an
 * implicit `status` live region — apt, since this genuinely updates live
 * over SSE) with an `aria-label` naming the band/staleness in words, so the
 * state reaches assistive tech independent of the tooltip, which repeats it
 * for sighted hover users.
 */
export function HealthBadge({
	caseId,
	elementId,
	elementType,
}: ElementSlotContext) {
	const { health, status } = useHealthState({ caseId, elementId, elementType });
	const bandScores = useHealthBandScores();

	if (status !== "ready" || !health) {
		return null;
	}

	const stale = isHealthStale(health);
	const band = deriveHealthBand(health.score, bandScores);
	const dotClassName = cn(
		"inline-block size-2 rounded-full",
		BAND_DOT_CLASSES[band],
		stale && STALE_RING_CLASSES
	);
	const label = stale
		? `Health: ${BAND_WORDS[band]} — stale (last evaluated ${formatRelativeToNow(health.lastEvaluatedAt)})`
		: BAND_LABELS[band];

	return (
		<TooltipProvider>
			<Tooltip delayDuration={200}>
				<TooltipTrigger asChild>
					<output
						aria-label={label}
						className={dotClassName}
						data-testid="health-badge-dot"
					/>
				</TooltipTrigger>
				<TooltipContent>{label}</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}
