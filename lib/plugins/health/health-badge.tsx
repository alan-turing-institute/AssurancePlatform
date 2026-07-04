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

const STALE_DOT_CLASS = "bg-muted-foreground";

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

	if (status !== "ready" || !health) {
		return null;
	}

	const stale = isHealthStale(health);
	const band = deriveHealthBand(health.score);
	const dotClassName = stale ? STALE_DOT_CLASS : BAND_DOT_CLASSES[band];
	const label = stale
		? `Health: stale (last evaluated ${formatRelativeToNow(health.lastEvaluatedAt)})`
		: BAND_LABELS[band];

	return (
		<TooltipProvider>
			<Tooltip delayDuration={200}>
				<TooltipTrigger asChild>
					<output
						aria-label={label}
						className={cn("inline-block size-2 rounded-full", dotClassName)}
						data-testid="health-badge-dot"
					/>
				</TooltipTrigger>
				<TooltipContent>{label}</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}
