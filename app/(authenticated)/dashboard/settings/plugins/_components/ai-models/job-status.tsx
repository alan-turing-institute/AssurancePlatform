import { Badge } from "@/components/ui/badge";
import type { ModelJob } from "@/lib/models/connection-types";
import { JOB_COPY } from "./ai-models-copy";

/** Where the search job stands: not set, its check passed, or its check has not passed. */
export type SearchStatus =
	| { kind: "unset" }
	| { kind: "passed" }
	| { kind: "failed"; lowestCosine: number; reason: "similarity" }
	| {
			kind: "failed";
			reason: "not-compared" | "stale" | "unavailable" | "unknown";
	  };

/** Long model names and labels wrap inside the card; the whole value is in the tooltip. */
const WRAPPING_TEXT = "min-w-0 break-all text-muted-foreground text-sm";

const FALLBACK = "Until a check passes, techniques are found by keyword only.";

/** The similarity to three decimals, cut rather than rounded, so a value just under the threshold never reads as the threshold. */
function similarity(value: number): string {
	return value.toFixed(6).slice(0, -3);
}

function failureDetail(
	status: Extract<SearchStatus, { kind: "failed" }>
): string {
	switch (status.reason) {
		case "similarity":
			return `Lowest similarity ${similarity(status.lowestCosine)}. ${FALLBACK}`;
		case "not-compared":
			return `The model's answers could not be compared with the catalogue's. ${FALLBACK}`;
		case "stale":
			return `The catalogue has changed since the check passed, so it no longer counts. ${FALLBACK}`;
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
				<span className={WRAPPING_TEXT} title={where}>
					{where}
				</span>
			</div>
		);
	}
	if (search.kind === "passed") {
		return (
			<div className="flex flex-wrap items-center gap-2">
				<Badge>Check passed</Badge>
				<span className={WRAPPING_TEXT} title={where}>
					{where}
				</span>
			</div>
		);
	}
	return (
		<div className="space-y-1">
			<div className="flex flex-wrap items-center gap-2">
				<Badge variant="destructive">Check not passed</Badge>
				<span className={WRAPPING_TEXT} title={where}>
					{where}
				</span>
			</div>
			<p className="text-muted-foreground text-sm">{failureDetail(search)}</p>
		</div>
	);
}
