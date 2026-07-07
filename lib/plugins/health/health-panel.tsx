"use client";

import { FileText } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { ElementSlotContext } from "@/lib/plugins/slots";
import { EvidenceLogEntry } from "./evidence-log-entry";
import { useHealthEvidence } from "./use-health-evidence";

function EvidenceSkeleton() {
	return (
		<div className="space-y-2" data-testid="health-panel-loading">
			<Skeleton className="h-20 w-full rounded-md" />
			<Skeleton className="h-20 w-full rounded-md" />
		</div>
	);
}

/**
 * The `element-panel` slot's evidence-trace tab (ADR 0002 v2 §3): the
 * claim's append-only `tea.health` log, newest first. `useHealthEvidence`
 * returns the log in append (oldest-first, hash-chain) order — the reversal
 * here is display-only, never re-persisted.
 *
 * The `element-panel` slot has no per-element-type filtering of its own
 * (`node-edit-dialog.tsx` shows one registered tab strip for every element
 * type), so this component handles the "not a claim" case itself rather
 * than showing a misleading fetch error on every goal/strategy/evidence
 * node's dialog — `useHealthEvidence` never makes a request for a non-claim
 * element, and this renders a distinct "not applicable" state instead.
 */
export function HealthPanel({
	caseId,
	elementId,
	elementType,
}: ElementSlotContext) {
	const { evidence, status } = useHealthEvidence({
		caseId,
		elementId,
		elementType,
	});

	if (elementType !== "property") {
		return (
			<EmptyState
				icon={FileText}
				message="Evidence tracking applies to property claims only."
				title="Not applicable"
			/>
		);
	}

	if (status === "loading") {
		return <EvidenceSkeleton />;
	}

	if (status === "error" || !evidence) {
		return (
			<EmptyState
				icon={FileText}
				message="Could not load the evidence log. Try reopening this element."
				title="Evidence unavailable"
			/>
		);
	}

	if (evidence.length === 0) {
		return (
			<EmptyState
				icon={FileText}
				message="No evidence has been recorded against this claim yet."
				title="No evidence yet"
			/>
		);
	}

	const newestFirst = [...evidence].reverse();

	return (
		<div className="space-y-2" data-testid="health-evidence-log">
			{newestFirst.map((item) => (
				<EvidenceLogEntry item={item} key={item.id} />
			))}
		</div>
	);
}
