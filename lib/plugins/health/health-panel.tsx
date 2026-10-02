"use client";

import { FileText } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { ElementSlotContext } from "@/lib/plugins/slots";
import { EvidenceLogEntry } from "./evidence-log-entry";
import { ChangeCheckDialog } from "./health-record-dialogs";
import type { HealthStatus } from "./health-types";
import { useHealthEvidence } from "./use-health-evidence";
import { useHealthState } from "./use-health-state";

function EvidenceSkeleton() {
	return (
		<div className="space-y-2" data-testid="health-panel-loading">
			<Skeleton className="h-20 w-full rounded-md" />
			<Skeleton className="h-20 w-full rounded-md" />
		</div>
	);
}

function refusedLine(count: number): string {
	return count === 1
		? "1 result was refused since the last accepted one. It named a different check."
		: `${count} results were refused since the last accepted one. They named a different check.`;
}

interface PanelHeaderProps {
	canEdit: boolean;
	claimId: string;
	onChanged: () => void;
	status: HealthStatus;
}

function PanelHeader({
	canEdit,
	claimId,
	onChanged,
	status,
}: PanelHeaderProps) {
	const [changing, setChanging] = useState(false);

	return (
		<div className="space-y-1" data-testid="health-panel-header">
			<div className="flex items-center justify-between gap-2">
				<p className="text-sm">
					<span className="text-muted-foreground">Bound check: </span>
					<span className="font-medium">{status.bound_check}</span>
				</p>
				{canEdit && (
					<Button
						onClick={() => setChanging(true)}
						size="sm"
						type="button"
						variant="outline"
					>
						Change
					</Button>
				)}
			</div>
			{status.rejected_since_last_accept > 0 && (
				<p className="text-muted-foreground text-sm">
					{refusedLine(status.rejected_since_last_accept)}
				</p>
			)}
			{canEdit && (
				<ChangeCheckDialog
					claimId={claimId}
					currentCheck={status.bound_check}
					onDone={onChanged}
					onOpenChange={setChanging}
					open={changing}
				/>
			)}
		</div>
	);
}

/**
 * The `element-panel` slot's Evidence tab: the claim's bound check, then its
 * evidence log newest first, 50 at a time with "Load older". A person who
 * can edit (`canEdit`) also gets Change on the header and Revoke or
 * Reinstate on each record; the server enforces permission regardless.
 *
 * The slot has no per-element-type filtering of its own, so this component
 * shows a "not applicable" state for anything but a property claim;
 * neither hook makes a request for one.
 */
export function HealthPanel({
	caseId,
	elementId,
	elementType,
	canEdit = false,
}: ElementSlotContext) {
	const context = { caseId, elementId, elementType };
	const evidence = useHealthEvidence(context);
	const state = useHealthState(context);

	if (elementType !== "property") {
		return (
			<EmptyState
				icon={FileText}
				message="Evidence tracking applies to property claims only."
				title="Not applicable"
			/>
		);
	}

	if (evidence.status === "loading" || state.status === "loading") {
		return <EvidenceSkeleton />;
	}

	if (evidence.status === "error" || !evidence.evidence) {
		return (
			<EmptyState
				icon={FileText}
				message="Could not load the evidence log. Try reopening this element."
				title="Evidence unavailable"
			/>
		);
	}

	const { healthStatus } = state;
	const onChanged = () => {
		evidence.refetch();
		state.refetch();
	};
	const header = healthStatus ? (
		<PanelHeader
			canEdit={canEdit}
			claimId={elementId}
			onChanged={onChanged}
			status={healthStatus}
		/>
	) : null;

	if (evidence.evidence.length === 0) {
		return (
			<div className="space-y-3">
				{header}
				<EmptyState
					icon={FileText}
					message="No evidence has been recorded against this claim yet."
					title="No evidence yet"
				/>
			</div>
		);
	}

	return (
		<div className="space-y-2" data-testid="health-evidence-log">
			{header}
			{evidence.evidence.map((item) => (
				<EvidenceLogEntry
					canEdit={canEdit}
					claimId={elementId}
					item={item}
					key={item.id}
					onChanged={onChanged}
				/>
			))}
			{evidence.olderFailed && (
				<p className="text-destructive text-sm" role="alert">
					Could not load older records. Try again.
				</p>
			)}
			{evidence.hasMore && (
				<Button
					disabled={evidence.loadingOlder}
					onClick={() => evidence.loadOlder()}
					type="button"
					variant="outline"
				>
					Load older
				</Button>
			)}
		</div>
	);
}
