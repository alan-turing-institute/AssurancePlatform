"use client";

import { Loader2 } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type {
	ActionResult,
	JobAssignment,
	ModelConnection,
	RolesInput,
	TestOutcome,
} from "@/hooks/use-model-settings";
import type { ModelJob } from "@/lib/models/connection-types";
import { CONNECTION_TYPE_LABELS, JOB_COPY } from "./ai-models-copy";
import { JobStatus, type SearchStatus } from "./job-status";
import { ModelCombobox } from "./model-combobox";

const OFF = "off";

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

function saveLabel(saving: boolean, job: ModelJob): string {
	if (!saving) {
		return "Save";
	}
	return job === "search" ? "Saving and checking…" : "Saving…";
}

/** What the model list says about the connection: still loading, or why it is empty. */
function listNote(
	outcome: TestOutcome | undefined,
	loading: boolean
): string | null {
	if (loading) {
		return "Loading models…";
	}
	if (outcome && !outcome.ok) {
		return `${outcome.message} You can still type a model name.`;
	}
	return null;
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
	const connectionId = useId();
	const modelLabelId = useId();
	const modelId = useId();
	const savedJob = saved[job];
	const savedKey = `${savedJob?.connectionId ?? ""}\n${savedJob?.model ?? ""}`;
	const [seenKey, setSeenKey] = useState(savedKey);
	const [choice, setChoice] = useState(() => choiceFrom(job, savedJob));
	const [busy, setBusy] = useState<"checking" | "saving" | null>(null);
	const [failure, setFailure] = useState<string | null>(null);
	const [loadFailure, setLoadFailure] = useState<string | null>(null);
	if (seenKey !== savedKey) {
		setSeenKey(savedKey);
		setChoice(choiceFrom(job, savedJob));
	}

	const chosen = connections.find((item) => item.id === choice.connectionId);
	const draft = assignmentOf(choice);
	const canSave =
		busy === null && isSavable(job, draft) && !sameAssignment(draft, savedJob);
	const savedConnection = connections.find(
		(item) => item.id === savedJob?.connectionId
	);

	function selectConnection(value: string) {
		const next = connections.find((item) => item.id === value);
		setLoadFailure(null);
		if (value === savedJob?.connectionId && savedJob) {
			setChoice(choiceFrom(job, savedJob));
		} else {
			setChoice({
				connectionId: value,
				model: next ? (recommendedFor(next) ?? "") : "",
			});
		}
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

	async function loadModels(id: string) {
		const result = await onLoadModels(id);
		if (result) {
			setLoadFailure(result.ok ? null : result.message);
		}
	}

	const save = () => run({ ...saved, [job]: draft }, "saving");
	const checkAgain = () => run(saved, "checking");

	const outcome = chosen ? tests[chosen.id] : undefined;
	const loading = chosen ? testing.includes(chosen.id) : false;
	const note = loadFailure ?? listNote(outcome, loading);
	const listed = outcome?.models[job] ?? [];

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
				<div className="space-y-2">
					<Label htmlFor={connectionId}>Connection</Label>
					<Select onValueChange={selectConnection} value={choice.connectionId}>
						<SelectTrigger id={connectionId}>
							<SelectValue
								placeholder={
									connections.length === 0
										? "No connection can do this job"
										: "Choose a connection"
								}
							/>
						</SelectTrigger>
						<SelectContent>
							{copy.off !== null && <SelectItem value={OFF}>Off</SelectItem>}
							{connections.map((item) => (
								<SelectItem key={item.id} value={item.id}>
									{`${item.label} (${CONNECTION_TYPE_LABELS[item.type]})`}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				{chosen && (
					<div className="space-y-2">
						<Label htmlFor={modelId} id={modelLabelId}>
							Model
						</Label>
						<ModelCombobox
							id={modelId}
							labelledBy={modelLabelId}
							loading={loading}
							models={listed}
							onChange={(model) => setChoice({ ...choice, model })}
							onOpen={() => loadModels(chosen.id)}
							recommended={recommendedFor(chosen)}
							value={choice.model}
						/>
						{note && (
							<output className="block text-muted-foreground text-sm">
								{note}
							</output>
						)}
					</div>
				)}
			</div>

			<JobStatus
				connectionLabel={savedConnection?.label}
				job={job}
				model={savedJob?.model ?? null}
				search={searchStatus}
			/>

			<div className="flex flex-wrap items-center gap-2">
				<Button disabled={!canSave} onClick={save} size="sm" type="button">
					{busy === "saving" && (
						<Loader2 aria-hidden="true" className="animate-spin" />
					)}
					{saveLabel(busy === "saving", job)}
				</Button>
				{searchStatus?.kind === "failed" && (
					<Button
						disabled={busy !== null}
						onClick={checkAgain}
						size="sm"
						type="button"
						variant="outline"
					>
						{busy === "checking" && (
							<Loader2 aria-hidden="true" className="animate-spin" />
						)}
						{busy === "checking" ? "Checking…" : "Check again"}
					</Button>
				)}
			</div>
			{failure && (
				<p className="text-destructive text-sm" role="alert">
					{failure}
				</p>
			)}
		</fieldset>
	);
}
