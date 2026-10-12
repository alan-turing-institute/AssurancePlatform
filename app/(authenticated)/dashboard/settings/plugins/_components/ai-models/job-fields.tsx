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
	ModelConnection,
	TestOutcome,
} from "@/hooks/use-model-settings";
import type { ModelJob } from "@/lib/models/connection-types";
import { CONNECTION_TYPE_LABELS } from "./ai-models-copy";
import { ModelCombobox } from "./model-combobox";
import { StatusRegion } from "./status-region";

/** The value the connection picker uses for "Off". */
export const OFF = "off";

export interface ConnectionPickerProps {
	/** The connections whose type can do the job. */
	connections: readonly ModelConnection[];
	/** Whether the job may be switched off. */
	offAllowed: boolean;
	onChange: (value: string) => void;
	value: string;
}

/** The connection `select` of a job: only the connections that can do it, and Off where the job is optional. */
export function ConnectionPicker({
	connections,
	offAllowed,
	onChange,
	value,
}: ConnectionPickerProps) {
	const id = useId();
	const placeholder =
		connections.length === 0
			? "No connection can do this job"
			: "Choose a connection";
	return (
		<div className="space-y-2">
			<Label htmlFor={id}>Connection</Label>
			<Select onValueChange={onChange} value={value}>
				<SelectTrigger id={id}>
					<SelectValue placeholder={placeholder} />
				</SelectTrigger>
				<SelectContent>
					{offAllowed && <SelectItem value={OFF}>Off</SelectItem>}
					{connections.map((item) => (
						<SelectItem key={item.id} value={item.id}>
							{`${item.label} (${CONNECTION_TYPE_LABELS[item.type]})`}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);
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

export interface ModelFieldProps {
	/** The connection the job would run on. */
	connection: ModelConnection;
	job: ModelJob;
	/** Fetches the connection's models unless they are known; null when there was nothing to fetch. */
	onChange: (model: string) => void;
	/** Fetches the connection's models unless they are known; null when there was nothing to fetch. */
	onLoadModels: (
		connectionId: string
	) => Promise<ActionResult<TestOutcome> | null>;
	recommended: string | null;
	/** The latest test result for the connection, if it has been tested this session. */
	test: TestOutcome | undefined;
	/** Whether a test of the connection is in flight. */
	testing: boolean;
	value: string;
}

/**
 * The model picker of a job with the note beneath it. The list is the
 * connection's own, from its test result; opening the picker fetches it when
 * it is not yet known. Mounted once per connection, so a failure to list one
 * connection's models is not shown beside another's.
 */
export function ModelField({
	connection,
	job,
	onChange,
	onLoadModels,
	recommended,
	test,
	testing,
	value,
}: ModelFieldProps) {
	const labelId = useId();
	const id = useId();
	const [loadFailure, setLoadFailure] = useState<string | null>(null);

	async function loadModels() {
		const result = await onLoadModels(connection.id);
		if (result) {
			setLoadFailure(result.ok ? null : result.message);
		}
	}

	const note = loadFailure ?? listNote(test, testing);
	return (
		<div className="min-w-0">
			<div className="space-y-2">
				<Label htmlFor={id} id={labelId}>
					Model
				</Label>
				<ModelCombobox
					id={id}
					labelledBy={labelId}
					loading={testing}
					models={test?.models[job] ?? []}
					onChange={onChange}
					onOpen={loadModels}
					recommended={recommended}
					value={value}
				/>
			</div>
			<StatusRegion className="not-empty:mt-2 text-muted-foreground text-sm">
				{note}
			</StatusRegion>
		</div>
	);
}

function saveLabel(saving: boolean, job: ModelJob): string {
	if (!saving) {
		return "Save";
	}
	return job === "search" ? "Saving and checking…" : "Saving…";
}

export interface JobActionsProps {
	busy: "checking" | "saving" | null;
	canSave: boolean;
	job: ModelJob;
	onCheckAgain: () => void;
	onSave: () => void;
	/** Whether the search check has failed, which is when it can be run again. */
	showCheckAgain: boolean;
}

/** Save, and for a search job whose check has not passed, Check again. */
export function JobActions({
	busy,
	canSave,
	job,
	onCheckAgain,
	onSave,
	showCheckAgain,
}: JobActionsProps) {
	return (
		<div className="flex flex-wrap items-center gap-2">
			<Button disabled={!canSave} onClick={onSave} size="sm" type="button">
				{busy === "saving" && (
					<Loader2 aria-hidden="true" className="animate-spin" />
				)}
				{saveLabel(busy === "saving", job)}
			</Button>
			{showCheckAgain && (
				<Button
					disabled={busy !== null}
					onClick={onCheckAgain}
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
	);
}
