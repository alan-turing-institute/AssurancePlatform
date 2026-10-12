"use client";

import { useId, useState } from "react";
import type {
	ActionResult,
	JobAssignment,
	ModelConnection,
	RolesInput,
	TestOutcome,
} from "@/hooks/use-model-settings";
import type { ModelJob } from "@/lib/models/connection-types";
import { JOB_COPY } from "./ai-models-copy";
import { ConnectionPicker, JobActions, ModelField, OFF } from "./job-fields";
import { JobStatus, type SearchStatus } from "./job-status";

export interface JobRowProps {
	/** The connections whose type can do this job. */
	connections: readonly ModelConnection[];
	job: ModelJob;
	/** Fetches the connection's models unless they are known; null when there was nothing to fetch. */
	onLoadModels: (
		connectionId: string
	) => Promise<ActionResult<TestOutcome> | null>;
	/** Saves all three jobs; this row's draft is already in `roles`. */
	onSave: (roles: RolesInput) => Promise<ActionResult>;
	/** The recommended model for this job on a connection of the given type. */
	recommendedFor: (connection: ModelConnection) => string | null;
	/** The jobs as saved, from which a save is built. */
	saved: RolesInput;
	/** Only for the search job. */
	searchStatus?: SearchStatus;
	/** Connection ids with a test in flight. */
	testing: readonly string[];
	tests: Readonly<Record<string, TestOutcome>>;
}

interface Choice {
	connectionId: string;
	model: string;
}

function choiceFrom(job: ModelJob, saved: JobAssignment | null): Choice {
	if (saved) {
		return { connectionId: saved.connectionId, model: saved.model };
	}
	return { connectionId: job === "chat" ? "" : OFF, model: "" };
}

function assignmentOf(choice: Choice): JobAssignment | null {
	if (choice.connectionId === "" || choice.connectionId === OFF) {
		return null;
	}
	return { connectionId: choice.connectionId, model: choice.model.trim() };
}

function sameAssignment(a: JobAssignment | null, b: JobAssignment | null) {
	return a?.connectionId === b?.connectionId && a?.model === b?.model;
}

/** Whether the draft can be saved: chat needs a connection and model; the others may be off. */
function isSavable(job: ModelJob, draft: JobAssignment | null): boolean {
	if (draft === null) {
		return job !== "chat";
	}
	return draft.model !== "";
}

/**
 * The draft of one job: the connection and model chosen but not yet saved. It
 * starts from the saved job and starts again whenever the saved job changes,
 * so a save, a removal or a refetch is reflected without a stale draft.
 */
function useJobDraft(job: ModelJob, saved: JobAssignment | null) {
	const savedKey = `${saved?.connectionId ?? ""}\n${saved?.model ?? ""}`;
	const [seenKey, setSeenKey] = useState(savedKey);
	const [choice, setChoice] = useState(() => choiceFrom(job, saved));
	if (seenKey !== savedKey) {
		setSeenKey(savedKey);
		setChoice(choiceFrom(job, saved));
	}
	const draft = assignmentOf(choice);
	return {
		choice,
		draft,
		dirty: !sameAssignment(draft, saved),
		savable: isSavable(job, draft),
		setChoice,
	};
}

/**
 * One of the three jobs. A connection picker (only the connections whose type
 * can do the job, and Off where the job is optional), a searchable model
 * picker, the job's status and a Save button. A draft is held until Save.
 * For search, the status also says whether the check passed, with a button to
 * run it again.
 */
export function JobRow({
	connections,
	job,
	onLoadModels,
	onSave,
	recommendedFor,
	saved,
	searchStatus,
	testing,
	tests,
}: JobRowProps) {
	const copy = JOB_COPY[job];
	const headingId = useId();
	const savedJob = saved[job];
	const { choice, draft, dirty, savable, setChoice } = useJobDraft(
		job,
		savedJob
	);
	const [busy, setBusy] = useState<"checking" | "saving" | null>(null);
	const [failure, setFailure] = useState<string | null>(null);

	const chosen = connections.find((item) => item.id === choice.connectionId);
	const savedConnection = connections.find(
		(item) => item.id === savedJob?.connectionId
	);

	function selectConnection(value: string) {
		const next = connections.find((item) => item.id === value);
		const keepsSaved = savedJob && value === savedJob.connectionId;
		setChoice(
			keepsSaved
				? choiceFrom(job, savedJob)
				: {
						connectionId: value,
						model: next ? (recommendedFor(next) ?? "") : "",
					}
		);
	}

	async function run(roles: RolesInput, kind: "checking" | "saving") {
		setBusy(kind);
		setFailure(null);
		const result = await onSave(roles);
		setBusy(null);
		if (!result.ok) {
			setFailure(result.message);
		}
	}

	return (
		<fieldset
			aria-labelledby={headingId}
			className="space-y-3 rounded-lg border border-border bg-card p-4"
			id={`ai-models-job-${job}`}
		>
			<div className="space-y-1">
				<h4 className="font-medium text-foreground text-sm" id={headingId}>
					{copy.title}
				</h4>
				<p className="text-muted-foreground text-sm">{copy.hint}</p>
			</div>

			<div className="grid gap-3">
				<ConnectionPicker
					connections={connections}
					offAllowed={copy.off !== null}
					onChange={selectConnection}
					value={choice.connectionId}
				/>
				{chosen && (
					<ModelField
						connection={chosen}
						job={job}
						key={chosen.id}
						onChange={(model) => setChoice({ ...choice, model })}
						onLoadModels={onLoadModels}
						recommended={recommendedFor(chosen)}
						test={tests[chosen.id]}
						testing={testing.includes(chosen.id)}
						value={choice.model}
					/>
				)}
			</div>

			<JobStatus
				connectionLabel={savedConnection?.label}
				job={job}
				model={savedJob?.model ?? null}
				search={searchStatus}
			/>

			<JobActions
				busy={busy}
				canSave={busy === null && savable && dirty}
				job={job}
				onCheckAgain={() => run(saved, "checking")}
				onSave={() => run({ ...saved, [job]: draft }, "saving")}
				showCheckAgain={searchStatus?.kind === "failed"}
			/>
			{failure && (
				<p className="text-destructive text-sm" role="alert">
					{failure}
				</p>
			)}
		</fieldset>
	);
}
