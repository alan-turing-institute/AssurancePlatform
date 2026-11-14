"use client";

import { Portal as TooltipPortal } from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";
import { badgeVariants } from "@/components/ui/badge";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** The words on the badge. */
const BADGE_WORDS = "To fill in";

/** What the hover says when the author gave no hint. */
const NO_HINT = "This element is still to be filled in.";

interface PlaceholderBadgeProps {
	/** The author's guidance for whoever fills the element in. */
	hint?: string;
}

/**
 * The small badge an element carries while it is a placeholder: the person
 * using the case or pattern writes it. The word is visible text, so the badge
 * is never colour-only, and the dashed outline matches the card's own. The
 * badge is a button, so the hint opens on keyboard focus as well as on hover;
 * its accessible name is the visible words followed by the hint. The hint is
 * drawn outside the canvas so zooming the diagram does not scale it; the edit
 * dialog shows the same hint in full.
 */
function PlaceholderBadge({ hint }: PlaceholderBadgeProps) {
	return (
		<TooltipProvider>
			<Tooltip delayDuration={200}>
				<TooltipTrigger asChild>
					<button
						aria-label={hint ? `${BADGE_WORDS}: ${hint}` : undefined}
						className={cn(
							badgeVariants({ variant: "outline" }),
							"rounded-full border-warning/60 border-dashed bg-warning/10 px-2 py-px font-medium text-[10px] text-foreground"
						)}
						onMouseDown={(event) => event.stopPropagation()}
						type="button"
					>
						{BADGE_WORDS}
					</button>
				</TooltipTrigger>
				<TooltipPortal>
					<TooltipContent className="max-w-xs">
						{hint || NO_HINT}
					</TooltipContent>
				</TooltipPortal>
			</Tooltip>
		</TooltipProvider>
	);
}

/**
 * Derives the `topRightActions` badge for a node's raw placeholder data.
 * Returns `null`, not a component that renders null, for an element that is
 * not a placeholder, so a card with nothing to show draws no wrapper at all
 * (see `useElementBadgeSlot` for why that distinction matters).
 */
export function getPlaceholderIndicator(
	data: Record<string, unknown>
): ReactNode | null {
	if (data.isPlaceholder !== true) {
		return null;
	}
	const hint =
		typeof data.placeholderHint === "string" ? data.placeholderHint : undefined;
	return <PlaceholderBadge hint={hint} />;
}

/**
 * A card's other top-right badges with the placeholder badge in front of
 * them, for the cards that have no `useNodeTopRightActions` of their own.
 * Still `null` when there is nothing to show.
 */
export function withPlaceholderIndicator(
	data: Record<string, unknown>,
	others: ReactNode | null
): ReactNode | null {
	const badge = getPlaceholderIndicator(data);
	if (!badge) {
		return others;
	}
	return others ? (
		<div className="flex items-center gap-1.5">
			{badge}
			{others}
		</div>
	) : (
		badge
	);
}
