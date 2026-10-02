"use client";

import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { CaseSlotContext } from "@/lib/plugins/slots";
import {
	type HygieneFigure,
	type HygieneFigures,
	useHygiene,
} from "./use-hygiene";

interface FigureProps {
	/** Shown instead of the sentence when the figure counts nothing. */
	emptyText: string;
	figure: HygieneFigure;
	note?: string;
	sentence: string;
	testId: string;
}

function Figure({ emptyText, figure, note, sentence, testId }: FigureProps) {
	return (
		<section className="space-y-1 rounded-md border p-3" data-testid={testId}>
			{figure.of === 0 ? (
				<p className="wrap-anywhere text-muted-foreground text-sm">
					{emptyText}
				</p>
			) : (
				<>
					<p className="font-medium text-2xl tabular-nums">
						{figure.count} of {figure.of}
					</p>
					<p className="wrap-anywhere text-sm">{sentence}</p>
					{note && (
						<p className="wrap-anywhere text-muted-foreground text-sm">
							{note}
						</p>
					)}
				</>
			)}
		</section>
	);
}

const NO_RESULTS = "No claims with a result yet.";
const NO_SETTINGS = "No accepted settings yet.";

function Figures({ figures }: { figures: HygieneFigures }) {
	const claims = figures.claims_without_time_limit;
	const checks = figures.checks_without_time_limit;
	const settings = figures.settings_as_recommended;
	return (
		<div className="space-y-3">
			<Figure
				emptyText={NO_RESULTS}
				figure={claims}
				note="A result with no time limit counts until someone withdraws it."
				sentence="claims with a current result have no time limit on that result."
				testId="hygiene-claims"
			/>
			<Figure
				emptyText={NO_RESULTS}
				figure={checks}
				sentence="checks in use have at least one such claim."
				testId="hygiene-checks"
			/>
			<Figure
				emptyText={NO_SETTINGS}
				figure={settings}
				note="Settings accepted without a change deserve a second look: the numbers came from the pipeline."
				sentence="accepted settings were accepted exactly as the pipeline recommended."
				testId="hygiene-settings"
			/>
		</div>
	);
}

/**
 * The case panel: three figures about how the case's evidence settings are
 * being used. Read-only; the figures are fetched when the panel opens and
 * again on "Refresh".
 */
export function EvidenceHealthPanel({ caseId }: CaseSlotContext) {
	const { figures, refresh, status } = useHygiene(caseId);

	let body = <Skeleton className="h-40 w-full rounded-md" />;
	if (status === "error") {
		body = (
			<EmptyState
				icon={FileText}
				message="Could not load the evidence health figures. Try again."
				title="Evidence health unavailable"
			/>
		);
	} else if (figures) {
		body = <Figures figures={figures} />;
	}

	return (
		<div className="space-y-3" data-testid="evidence-health-panel">
			<Button
				disabled={status === "loading"}
				onClick={refresh}
				size="sm"
				type="button"
				variant="outline"
			>
				Refresh
			</Button>
			{body}
		</div>
	);
}
