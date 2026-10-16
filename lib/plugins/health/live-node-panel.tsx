"use client";

import { FileText } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import type { ElementSlotContext } from "@/lib/plugins/slots";
import {
	formatDateTime,
	LIVE_NODE_WORDS,
	liveNodeStateOf,
} from "./health-format";
import { useLiveEvidenceNodes } from "./use-live-evidence-nodes";
import { useRerenderAtExpiry } from "./use-rerender-at-expiry";

/** A sentence about the age of the result, or null when it is current or there is none. */
function ageLine(
	expiresAt: string | null,
	kind: ReturnType<typeof liveNodeStateOf>["kind"],
	stale: boolean
): string | null {
	if (kind === "withdrawn") {
		return "Every result for the claim has been withdrawn.";
	}
	if (kind === "none") {
		return "No result has arrived for the claim yet.";
	}
	if (stale) {
		return expiresAt
			? `The result went out of date on ${formatDateTime(expiresAt)}.`
			: "The result is out of date.";
	}
	return expiresAt
		? `The result counts until ${formatDateTime(expiresAt)}.`
		: null;
}

/**
 * The Evidence tab of an evidence element. For a live node it names the claim
 * the node reports on and the claim's current result, in the same words the
 * node's badge uses. Any other evidence has nothing to show here.
 */
export function LiveNodePanel({ caseId, elementId }: ElementSlotContext) {
	const index = useLiveEvidenceNodes(caseId, true);
	const node = index.byNodeId.get(elementId);
	useRerenderAtExpiry(node?.status?.expires_at ?? null);

	if (!node) {
		return (
			<EmptyState
				icon={FileText}
				message="Evidence tracking applies to property claims, and to the evidence node a claim's settings add."
				title="Not applicable"
			/>
		);
	}
	const state = liveNodeStateOf(node.status, Date.now());
	const age = ageLine(node.status?.expires_at ?? null, state.kind, state.stale);

	return (
		<div className="space-y-3" data-testid="health-live-node-panel">
			<p className="wrap-anywhere text-sm">
				This evidence node shows the live results for claim{" "}
				<span className="font-medium">{node.claim_name ?? "its claim"}</span>.
				Its text describes the check and never the result.
			</p>
			<dl className="space-y-2 rounded-md border bg-muted/30 p-3 text-sm">
				<div className="space-y-0.5">
					<dt className="text-muted-foreground text-xs">Claim</dt>
					<dd className="wrap-anywhere" data-testid="health-live-node-claim">
						{node.claim_name ?? "Unnamed claim"}
					</dd>
				</div>
				<div className="space-y-0.5">
					<dt className="text-muted-foreground text-xs">Current result</dt>
					<dd className="wrap-anywhere" data-testid="health-live-node-result">
						{LIVE_NODE_WORDS[state.kind]}
						{state.stale && state.kind !== "withdrawn" ? ", out of date" : ""}
						{node.status?.mismatch ? ", judged with different settings" : ""}
					</dd>
					{age && <dd className="text-muted-foreground text-xs">{age}</dd>}
				</div>
			</dl>
			<p className="wrap-anywhere text-muted-foreground text-sm">
				The results, and the settings that judge them, are on the claim's
				Evidence tab.
			</p>
		</div>
	);
}
