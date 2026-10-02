"use client";

import { useEffect, useState } from "react";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ElementSlotContext } from "@/lib/plugins/slots";
import { cn } from "@/lib/utils";
import {
	describeBadge,
	isStatusStale,
	VERDICT_DOT_CLASSES,
} from "./health-format";
import { useHealthState } from "./use-health-state";

/**
 * Stale marker: health and freshness are separate, so staleness never
 * replaces the verdict colour, only annotates it. A ring keeps the dot's
 * fill and adds a second, concentric shape around it, a cue that reads
 * without colour vision. `ring-offset-background` keeps the gap visible in
 * either theme.
 */
const STALE_RING_CLASSES =
	"ring-2 ring-muted-foreground/70 ring-offset-1 ring-offset-background";

/** Largest delay `setTimeout` accepts; a longer wait is taken in steps. */
const MAX_TIMER_MS = 2_147_483_647;

/**
 * Re-renders the caller once `expiresAt` has passed on this device's clock,
 * so the dot gains its ring without waiting for the next server push.
 */
function useRerenderAtExpiry(expiresAt: string | null): void {
	const [tick, setTick] = useState(0);

	// biome-ignore lint/correctness/useExhaustiveDependencies: `tick` re-arms the timer after each step of a long wait.
	useEffect(() => {
		if (expiresAt === null) {
			return;
		}
		const remaining = Date.parse(expiresAt) - Date.now();
		if (Number.isNaN(remaining) || remaining <= 0) {
			return;
		}
		const timer = setTimeout(
			() => setTick((value) => value + 1),
			Math.min(remaining + 50, MAX_TIMER_MS)
		);
		return () => clearTimeout(timer);
	}, [expiresAt, tick]);
}

/**
 * The `element-badge` slot's health dot. The colour comes from the status's
 * verdict alone: green, amber, red or grey. A stale status keeps its colour
 * and gains a ring; a claim whose records have all been withdrawn shows an
 * unfilled dot with the ring. A claim with no status, or bound to a check
 * but without a record yet, shows nothing, as does a failed fetch.
 *
 * Colour is never the only signal: the dot is an `<output>` element (an
 * implicit live region, apt since the state updates over SSE) whose
 * `aria-label` says the verdict and any staleness in words.
 */
export function HealthBadge({
	caseId,
	elementId,
	elementType,
}: ElementSlotContext) {
	const { healthStatus, status } = useHealthState({
		caseId,
		elementId,
		elementType,
	});
	useRerenderAtExpiry(healthStatus?.expires_at ?? null);

	if (status !== "ready" || !healthStatus) {
		return null;
	}

	const { verdict } = healthStatus;
	if (verdict === null && healthStatus.stale_reason !== "all-revoked") {
		return null;
	}

	const stale = isStatusStale(healthStatus, Date.now());
	const label = describeBadge(healthStatus, stale);

	const dotClassName = cn(
		"inline-block size-2 rounded-full",
		verdict === null
			? "border border-muted-foreground bg-transparent"
			: VERDICT_DOT_CLASSES[verdict],
		stale && STALE_RING_CLASSES
	);

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
