"use client";

import { Portal as TooltipPortal } from "@radix-ui/react-tooltip";
import { Badge } from "@/components/ui/badge";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";

/** What the hover says: why the card is marked, and the ways to clear the marker. */
const EXPLANATION =
	"Nothing supports this yet. Add a strategy, claim or evidence beneath it, or set its status (for example to Needs support or Assumed).";

/**
 * The small badge a goal, strategy or claim carries when nothing is beneath
 * it. The diagram works the marker out each time it is drawn, so the badge
 * has a dashed outline instead of the filled look of an assertion status:
 * it is a hint, not something the author set.
 *
 * The badge is as tall as an assertion status badge, so marking a card does
 * not move it; the dashed border takes the place of that badge's padding.
 *
 * Its word is visible text, so the badge's accessible name is that text and
 * it needs no `aria-label`. The explanation is a hover for mouse users and
 * adds no tab stop to every empty card; the documentation carries the same
 * explanation. The `data-derived-display` attribute keeps the badge out of
 * images of the case, because a picture of the diagram shows what the author
 * wrote, not what the diagram worked out for one viewer.
 */
export function UnsupportedMarkerBadge() {
	return (
		<TooltipProvider>
			<Tooltip delayDuration={200}>
				<TooltipTrigger asChild>
					<Badge
						className="rounded-full border-muted-foreground/50 border-dashed bg-transparent px-2 py-px font-medium text-[10px] text-foreground"
						data-derived-display=""
						variant="outline"
					>
						Unsupported
					</Badge>
				</TooltipTrigger>
				{/* Drawn outside the canvas, so zooming the diagram does not scale it, and wrapped so a narrow screen shows all of it. */}
				<TooltipPortal>
					<TooltipContent className="max-w-xs">{EXPLANATION}</TooltipContent>
				</TooltipPortal>
			</Tooltip>
		</TooltipProvider>
	);
}
