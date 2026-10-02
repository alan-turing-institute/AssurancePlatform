"use client";

import { FileText } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ElementSlotContext } from "@/lib/plugins/slots";
import {
	describeDifferences,
	NO_ACCEPTED_SETTINGS,
} from "./echo-difference-words";
import { EvidenceLogEntry } from "./evidence-log-entry";
import { ChangeCheckDialog } from "./health-record-dialogs";
import type { HealthStatus } from "./health-types";
import { SettingsView } from "./settings-view";
import { useCriteria } from "./use-criteria";
import { useHealthEvidence } from "./use-health-evidence";

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

/** The line or lines saying the claim's current result was judged with other settings, or with none. */
function MismatchLines({ status }: { status: HealthStatus }) {
	const { mismatch } = status;
	if (!mismatch) {
		return null;
	}
	const lines =
		mismatch.state === "undeclared"
			? [NO_ACCEPTED_SETTINGS]
			: describeDifferences(mismatch.differences);
	return (
		<div className="space-y-0.5" data-testid="health-mismatch-lines">
			{lines.map((line) => (
				<p className="wrap-anywhere text-muted-foreground text-sm" key={line}>
					{line}
				</p>
			))}
		</div>
	);
}

interface PanelHeaderProps {
	canEdit: boolean;
	claimId: string;
	/** True when the claim's check is set by its accepted settings, so it is changed there. */
	hasAcceptedSettings: boolean;
	onChanged: () => void;
	onOpenSettings: () => void;
	status: HealthStatus;
}

function PanelHeader({
	canEdit,
	claimId,
	hasAcceptedSettings,
	onChanged,
	onOpenSettings,
	status,
}: PanelHeaderProps) {
	const [changing, setChanging] = useState(false);
	const changeButton = useRef<HTMLButtonElement>(null);

	return (
		<div className="space-y-1" data-testid="health-panel-header">
			<div className="flex items-center justify-between gap-2">
				<p className="wrap-anywhere min-w-0 text-sm">
					<span className="text-muted-foreground">Bound check: </span>
					<span className="font-medium">{status.bound_check}</span>
				</p>
				{canEdit && (
					<Button
						className="shrink-0"
						onClick={
							hasAcceptedSettings ? onOpenSettings : () => setChanging(true)
						}
						ref={changeButton}
						size="sm"
						type="button"
						variant="outline"
					>
						{hasAcceptedSettings ? "Set in Settings" : "Change"}
					</Button>
				)}
			</div>
			{status.rejected_since_last_accept > 0 && (
				<p className="text-muted-foreground text-sm">
					{refusedLine(status.rejected_since_last_accept)}
				</p>
			)}
			<MismatchLines status={status} />
			{canEdit && !hasAcceptedSettings && (
				<ChangeCheckDialog
					claimId={claimId}
					currentCheck={status.bound_check}
					onDone={onChanged}
					onOpenChange={setChanging}
					onRefused={onChanged}
					open={changing}
					returnFocusTo={changeButton}
				/>
			)}
		</div>
	);
}

interface ResultsViewProps {
	context: ElementSlotContext;
	hasAcceptedSettings: boolean;
	onOpenSettings: () => void;
	/** Called when the claim's state changes, from this view's live-update subscription, which the panel shares with the settings read. */
	onStateChanged: () => void;
}

/**
 * The Results view: the claim's bound check, then its evidence log newest
 * first, 50 at a time with "Load older". A person who can edit also gets
 * Change (or "Set in Settings" while the claim has accepted settings) on the
 * header and Revoke or Reinstate on each record; the server enforces
 * permission regardless.
 */
function ResultsView({
	context,
	hasAcceptedSettings,
	onOpenSettings,
	onStateChanged,
}: ResultsViewProps) {
	const { canEdit = false, elementId } = context;
	const evidence = useHealthEvidence(context, onStateChanged);

	if (evidence.status === "loading") {
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

	const { healthStatus } = evidence;
	const onChanged = () => {
		evidence.refetch();
	};
	const header = healthStatus ? (
		<PanelHeader
			canEdit={canEdit}
			claimId={elementId}
			hasAcceptedSettings={hasAcceptedSettings}
			onChanged={onChanged}
			onOpenSettings={onOpenSettings}
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
		<div
			className="max-h-[60vh] space-y-2 overflow-y-auto pr-1"
			data-testid="health-evidence-log"
		>
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

type PanelView = "results" | "settings";

const VIEW_TRIGGER_CLASSES =
	"rounded-none border-transparent border-b-2 px-1 pb-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none";

/**
 * The `element-panel` slot's Evidence tab, in two views: Results (the claim's
 * bound check and its evidence log) and Settings (how the claim's evidence is
 * produced and judged). Both stay mounted so unsaved settings survive a
 * switch to Results and back.
 *
 * The slot has no per-element-type filtering of its own, so this component
 * shows a "not applicable" state for anything but a property claim; no hook
 * makes a request for one. The panel is marked `nokey` as a whole: the
 * element dialog is part of the canvas node's React tree, and the canvas
 * would otherwise take arrow keys and Space typed in the form.
 */
export function HealthPanel({
	caseId,
	elementId,
	elementText,
	elementType,
	canEdit = false,
}: ElementSlotContext) {
	const context = { caseId, elementId, elementType, canEdit };
	const [view, setView] = useState<PanelView>("results");
	const criteria = useCriteria(context);

	if (elementType !== "property") {
		return (
			<EmptyState
				icon={FileText}
				message="Evidence tracking applies to property claims only."
				title="Not applicable"
			/>
		);
	}

	const hasAcceptedSettings = criteria.data?.criteria?.state === "accepted";

	return (
		<div className="nokey min-w-0">
			<Tabs
				onValueChange={(next) =>
					setView(next === "settings" ? "settings" : "results")
				}
				value={view}
			>
				<TabsList className="h-auto w-full justify-start gap-4 rounded-none border-b bg-transparent p-0">
					<TabsTrigger className={VIEW_TRIGGER_CLASSES} value="results">
						Results
					</TabsTrigger>
					<TabsTrigger className={VIEW_TRIGGER_CLASSES} value="settings">
						Settings
					</TabsTrigger>
				</TabsList>
				<TabsContent
					className="mt-3 data-[state=inactive]:hidden"
					forceMount
					value="results"
				>
					<ResultsView
						context={context}
						hasAcceptedSettings={hasAcceptedSettings}
						onOpenSettings={() => setView("settings")}
						onStateChanged={criteria.refetch}
					/>
				</TabsContent>
				<TabsContent
					className="mt-3 data-[state=inactive]:hidden"
					forceMount
					value="settings"
				>
					<SettingsView
						active={view === "settings"}
						canEdit={canEdit}
						caseId={caseId}
						claimId={elementId}
						claimText={elementText}
						criteria={criteria}
					/>
				</TabsContent>
			</Tabs>
		</div>
	);
}
