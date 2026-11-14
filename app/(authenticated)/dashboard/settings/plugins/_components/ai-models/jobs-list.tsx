"use client";

import type {
	ActionResult,
	ModelConnection,
	ModelSettings,
	RecordedSearchCheck,
	RolesInput,
	SaveJobsOptions,
	TestOutcome,
} from "@/hooks/use-model-settings";
import { MODEL_JOBS, type ModelJob } from "@/lib/models/connection-types";
import { JobRow } from "./job-row";
import type { SearchStatus } from "./job-status";

export interface JobsListProps {
	connections: readonly ModelConnection[];
	connectionTypes: ModelSettings["connectionTypes"];
	/** The last search check seen this session, if any. */
	lastSearchCheck: RecordedSearchCheck | null;
	/** Fetches a connection's models unless they are known; null when there was nothing to fetch. */
	onLoadModels: (
		connectionId: string
	) => Promise<ActionResult<TestOutcome> | null>;
	onSave: (
		roles: RolesInput,
		options?: SaveJobsOptions
	) => Promise<ActionResult>;
	recommended: ModelSettings["recommended"];
	roles: ModelSettings["roles"];
	testing: readonly string[];
	tests: Readonly<Record<string, TestOutcome>>;
}

/**
 * What to say about the search job. A recorded pass stands only while it is
 * for the catalogue's current model and test sentences. With no pass, a
 * failure shows what this session's last check found for the same connection
 * and model; a passed or absent outcome there says only that no check has
 * passed, as does a page opened after the failure.
 */
function searchStatusOf(
	roles: ModelSettings["roles"],
	last: RecordedSearchCheck | null
): SearchStatus {
	if (!roles.search) {
		return { kind: "unset" };
	}
	if (roles.searchCheck) {
		return roles.searchCheckCurrent
			? { kind: "passed" }
			: { kind: "failed", reason: "stale" };
	}
	const outcome =
		last &&
		last.job.connectionId === roles.search.connectionId &&
		last.job.model === roles.search.model
			? last.outcome
			: null;
	if (outcome === null) {
		return { kind: "failed", reason: "unknown" };
	}
	if ("unavailable" in outcome) {
		return { kind: "failed", reason: "unavailable" };
	}
	if (outcome.ok) {
		return { kind: "failed", reason: "unknown" };
	}
	return outcome.lowestCosine === null
		? { kind: "failed", reason: "not-compared" }
		: {
				kind: "failed",
				reason: "similarity",
				lowestCosine: outcome.lowestCosine,
			};
}

/** The three jobs, each with the connections whose type can do it. */
export function JobsList({
	connections,
	connectionTypes,
	lastSearchCheck,
	onLoadModels,
	onSave,
	recommended,
	roles,
	testing,
	tests,
}: JobsListProps) {
	const saved: RolesInput = {
		chat: roles.chat,
		ranking: roles.ranking,
		search: roles.search,
	};
	const connectionsFor = (job: ModelJob) =>
		connections.filter((connection) =>
			connectionTypes.some(
				(spec) => spec.type === connection.type && spec.jobs.includes(job)
			)
		);

	return (
		<div className="space-y-3">
			<h3 className="font-medium text-foreground text-sm">Jobs</h3>
			{MODEL_JOBS.map((job) => (
				<JobRow
					connections={connectionsFor(job)}
					job={job}
					key={job}
					onLoadModels={onLoadModels}
					onSave={onSave}
					recommendedFor={(connection) =>
						recommended[connection.type]?.[job] ?? null
					}
					saved={saved}
					searchStatus={
						job === "search"
							? searchStatusOf(roles, lastSearchCheck)
							: undefined
					}
					testing={testing}
					tests={tests}
				/>
			))}
		</div>
	);
}
