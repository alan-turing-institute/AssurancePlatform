"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	ASSERTION_STATUS_DESCRIPTIONS,
	ASSERTION_STATUS_LABELS,
	type AssertionStatusValue,
	isAssertionStatusValue,
} from "@/lib/assertion-status";
import { cn } from "@/lib/utils";

interface AssertionStatusBadgeProps {
	className?: string;
	/** The element's per-assertion status (ADR 0004 D3). */
	status: AssertionStatusValue;
}

/**
 * Tailwind classes per status, following the same
 * `bg-<token>/10 text-<token> ring-<token>/20` convention as
 * `components/publishing/status-badge.tsx` and `components/cases/trash-list.tsx`
 * — semantic tokens only, no hardcoded colours.
 *
 * `AS_CITED` (derived) and the default `ASSERTED` share the neutral
 * muted-foreground treatment: neither is an author call to action, unlike
 * the other four.
 */
const STATUS_CLASSES: Record<AssertionStatusValue, string> = {
	ASSERTED:
		"bg-muted-foreground/10 text-muted-foreground ring-muted-foreground/20",
	NEEDS_SUPPORT: "bg-warning/10 text-warning ring-warning/20",
	ASSUMED: "bg-info/10 text-info ring-info/20",
	AXIOMATIC: "bg-secondary text-secondary-foreground ring-secondary/40",
	DEFEATED: "bg-destructive/10 text-destructive ring-destructive/20",
	AS_CITED:
		"bg-muted-foreground/10 text-muted-foreground ring-muted-foreground/20",
};

/**
 * A small badge showing an element's per-assertion status (ADR 0004 D3) —
 * the author's declared stance on the claim, or `AS_CITED` when the server
 * has derived it from a cited element (ADR 0004 D5). Status is never
 * colour-only: the label text is always visible on the badge itself, so the
 * signal survives greyscale rendering and colour-vision differences; the
 * tooltip repeats it in fuller words for hover users.
 *
 * Callers should not render this for the default `ASSERTED` status — see
 * `getAssertionStatusIndicator` below, which callers use instead of this
 * component directly so the "nothing to show" case produces no element at
 * all (see `useElementBadgeSlot`'s docstring for why that distinction
 * matters to `BaseNode`'s `topRightActions` guard).
 */
function AssertionStatusBadge({
	status,
	className,
}: AssertionStatusBadgeProps) {
	const label = ASSERTION_STATUS_LABELS[status];
	const description = ASSERTION_STATUS_DESCRIPTIONS[status];

	return (
		<TooltipProvider>
			<Tooltip delayDuration={200}>
				<TooltipTrigger asChild>
					<Badge
						aria-label={`Assertion status: ${label}`}
						className={cn(
							"rounded-full border-none px-2 py-0.5 font-medium text-[10px] ring-1 ring-inset",
							STATUS_CLASSES[status],
							className
						)}
						variant="outline"
					>
						{label}
					</Badge>
				</TooltipTrigger>
				<TooltipContent>{description}</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

/**
 * Derives the `topRightActions` badge for a node's raw `assertionStatus`
 * data field. Returns `null` — not a component that renders null — for
 * `undefined`/`null`/an invalid value, and for the default `ASSERTED`:
 * ASSERTED is the unremarkable default, so only the other five statuses are
 * worth a badge (confirmed against the acceptance criteria: "a non-default
 * assertionStatus shows as a badge").
 */
export function getAssertionStatusIndicator(status: unknown): ReactNode | null {
	if (!isAssertionStatusValue(status) || status === "ASSERTED") {
		return null;
	}
	return <AssertionStatusBadge status={status} />;
}
