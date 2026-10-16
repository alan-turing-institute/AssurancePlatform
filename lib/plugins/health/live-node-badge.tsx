"use client";

import {
	Activity,
	Check,
	CircleHelp,
	Clock,
	type LucideIcon,
	TriangleAlert,
	X,
} from "lucide-react";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ElementSlotContext } from "@/lib/plugins/slots";
import { cn } from "@/lib/utils";
import {
	describeLiveNode,
	LIVE_NODE_WORDS,
	type LiveNodeKind,
	liveNodeStateOf,
} from "./health-format";
import type { HealthLiveEvidenceNode } from "./health-types";
import { useLiveEvidenceNodes } from "./use-live-evidence-nodes";
import { useRerenderAtExpiry } from "./use-rerender-at-expiry";

/** The icon beside the word for each state, so the verdict reads without colour. A claim with no result yet has none. */
const KIND_ICONS: Record<LiveNodeKind, LucideIcon | null> = {
	none: null,
	pass: Check,
	marginal: TriangleAlert,
	fail: X,
	indeterminate: CircleHelp,
	withdrawn: Clock,
};

const KIND_ICON_CLASSES: Record<LiveNodeKind, string> = {
	none: "",
	pass: "text-success",
	marginal: "text-warning",
	fail: "text-destructive",
	indeterminate: "text-muted-foreground",
	withdrawn: "text-muted-foreground",
};

/**
 * The badge on a live evidence node: a small "live" icon, the state's own
 * icon and word, a clock and "Out of date" once the result has expired, and
 * the "≠" the claim's dot shows when the result was judged with other
 * settings. The icons and words carry the state, so it reads in greyscale; the
 * element is an `<output>` (an implicit live region) whose label says the same
 * in words, prefixed with the claim it reports on.
 */
function LiveNodeBadgeView({ node }: { node: HealthLiveEvidenceNode }) {
	const { status } = node;
	useRerenderAtExpiry(status?.expires_at ?? null);
	const state = liveNodeStateOf(status, Date.now());
	const label = describeLiveNode(status, state, node.claim_name);
	const KindIcon = KIND_ICONS[state.kind];
	const showsAge = state.stale && state.kind !== "withdrawn";

	return (
		<TooltipProvider>
			<Tooltip delayDuration={200}>
				<TooltipTrigger asChild>
					<output
						aria-label={label}
						className="inline-flex flex-wrap items-center justify-end gap-1 rounded-xl border bg-card px-2 py-0.5 font-medium text-foreground text-xs leading-none"
						data-kind={state.kind}
						data-stale={state.stale ? "" : undefined}
						data-testid="live-node-badge"
					>
						<Activity
							aria-hidden="true"
							className="size-3 shrink-0 text-muted-foreground"
							data-testid="live-node-icon"
						/>
						{KindIcon && (
							<KindIcon
								aria-hidden="true"
								className={cn("size-3 shrink-0", KIND_ICON_CLASSES[state.kind])}
							/>
						)}
						<span>{LIVE_NODE_WORDS[state.kind]}</span>
						{showsAge && (
							<>
								<Clock
									aria-hidden="true"
									className="size-3 shrink-0 text-muted-foreground"
								/>
								<span>Out of date</span>
							</>
						)}
						{status?.mismatch && (
							<span
								aria-hidden="true"
								className="font-semibold text-muted-foreground"
								data-testid="live-node-mismatch-mark"
							>
								{"≠"}
							</span>
						)}
					</output>
				</TooltipTrigger>
				<TooltipContent>{label}</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

/**
 * The badge for an evidence element: shown only while the element is a live
 * node. A comma on either side, hidden from sight, keeps the badge's spoken
 * label a phrase of its own in the name of the node's button, which joins the
 * node's name, the badge's label and the node's text.
 */
export function LiveNodeBadge({ caseId, elementId }: ElementSlotContext) {
	const index = useLiveEvidenceNodes(caseId, true);
	const node = index.byNodeId.get(elementId);
	if (!node) {
		return null;
	}
	return (
		<>
			<span className="sr-only">,</span>
			<LiveNodeBadgeView node={node} />
			<span className="sr-only">,</span>
		</>
	);
}
