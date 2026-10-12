import { Badge } from "@/components/ui/badge";
import type { ModelJob } from "@/lib/models/connection-types";
import { JOB_COPY } from "./ai-models-copy";

/** Where the search job stands: not set, its check passed, or its check has not passed. */
export type SearchStatus =
	| { kind: "unset" }
	| { kind: "passed" }
	| { kind: "failed"; lowestCosine: number; reason: "similarity" }
	| { kind: "failed"; reason: "not-compared" | "unavailable" | "unknown" };

const FALLBACK = "Until a check passes, techniques are found by keyword only.";

function failureDetail(
	status: Extract<SearchStatus, { kind: "failed" }>
): string {
	switch (status.reason) {
		case "similarity":
			return `Lowest similarity ${status.lowestCosine.toFixed(2)}. ${FALLBACK}`;
		case "not-compared":
			return `The model's answers could not be compared with the catalogue's. ${FALLBACK}`;
		case "unavailable":
			return `The search service did not give its test sentences, so the check could not run. ${FALLBACK}`;
		default:
			return `No check has passed for this model yet. ${FALLBACK}`;
	}
}

export interface JobStatusProps {
	/** The label of the connection the saved job runs on. */
	connectionLabel?: string;
	job: ModelJob;
	/** The saved model, or null when the job is not set. */
	model: string | null;
	/** Only for the search job. */
	search?: SearchStatus;
}

/** The status line under a job: not set, set, or for search whether its check has passed. */
export function JobStatus({
	connectionLabel,
	job,
	model,
	search,
}: JobStatusProps) {
	if (model === null) {
		return (
			<div className="flex flex-wrap items-center gap-2">
				<Badge variant="outline">Not set</Badge>
				<span className="text-muted-foreground text-sm">
					{JOB_COPY[job].off ??
						"The assistant cannot answer until this is set."}
				</span>
			</div>
		);
	}
	const where = `${model} on ${connectionLabel ?? "its connection"}`;
	if (job !== "search" || !search || search.kind === "unset") {
		return (
			<div className="flex flex-wrap items-center gap-2">
				<Badge variant="secondary">Set</Badge>
				<span className="text-muted-foreground text-sm">{where}</span>
			</div>
		);
	}
	if (search.kind === "passed") {
		return (
			<div className="flex flex-wrap items-center gap-2">
				<Badge>Check passed</Badge>
				<span className="text-muted-foreground text-sm">{where}</span>
			</div>
		);
	}
	return (
		<div className="space-y-1">
			<div className="flex flex-wrap items-center gap-2">
				<Badge variant="destructive">Check not passed</Badge>
				<span className="text-muted-foreground text-sm">{where}</span>
			</div>
			<p className="text-muted-foreground text-sm">{failureDetail(search)}</p>
		</div>
	);
}
