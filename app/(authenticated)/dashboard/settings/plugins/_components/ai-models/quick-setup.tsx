"use client";

import { type FormEvent, useId, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/hooks/use-model-settings";
import {
	MODEL_FIELD_LIMITS,
	type ModelJob,
} from "@/lib/models/connection-types";
import { JOB_COPY } from "./ai-models-copy";

export interface QuickSetupProps {
	onQuickSetup: (
		openRouterKey: string
	) => Promise<ActionResult<{ unsetJobs: ModelJob[] }>>;
}

/** The jobs quick setup could not fill, each linking to its row. */
function StillToChoose({ jobs }: { jobs: readonly ModelJob[] }) {
	if (jobs.length === 0) {
		return <p>All three jobs are set.</p>;
	}
	return (
		<div className="space-y-1">
			<p>Still to choose:</p>
			<ul className="list-disc pl-5">
				{jobs.map((job) => (
					<li key={job}>
						<Button asChild className="h-auto p-0" variant="link">
							<a href={`#ai-models-job-${job}`}>{JOB_COPY[job].title}</a>
						</Button>
					</li>
				))}
			</ul>
		</div>
	);
}

/**
 * Quick setup: one OpenRouter key adds a connection and fills every job that
 * has a recommended model. The key goes to the server and the field is
 * cleared once it is saved; the page keeps no copy. A refused key shows the
 * server's fixed message, and the jobs still to choose link to their rows.
 */
export function QuickSetup({ onQuickSetup }: QuickSetupProps) {
	const keyId = useId();
	const [key, setKey] = useState("");
	const [busy, setBusy] = useState(false);
	const [failure, setFailure] = useState<string | null>(null);
	const [unsetJobs, setUnsetJobs] = useState<readonly ModelJob[] | null>(null);

	async function submit(event: FormEvent) {
		event.preventDefault();
		if (key.trim() === "" || busy) {
			return;
		}
		setBusy(true);
		setFailure(null);
		setUnsetJobs(null);
		const result = await onQuickSetup(key.trim());
		setBusy(false);
		if (result.ok) {
			setKey("");
			setUnsetJobs(result.value.unsetJobs);
			return;
		}
		setFailure(result.message);
	}

	return (
		<form className="space-y-3" onSubmit={submit}>
			<div className="space-y-1">
				<h3 className="font-medium text-foreground text-sm">Quick setup</h3>
				<p className="text-muted-foreground text-sm">
					Paste one OpenRouter key to add the connection and fill in the
					recommended models.
				</p>
			</div>
			<div className="space-y-2">
				<Label htmlFor={keyId}>OpenRouter key</Label>
				<div className="flex gap-2">
					<Input
						autoComplete="off"
						id={keyId}
						maxLength={MODEL_FIELD_LIMITS.apiKey}
						onChange={(event) => setKey(event.target.value)}
						type="password"
						value={key}
					/>
					<Button disabled={busy || key.trim() === ""} type="submit">
						{busy ? "Setting up…" : "Set up"}
					</Button>
				</div>
			</div>
			{failure && (
				<Alert variant="destructive">
					<AlertDescription>{failure}</AlertDescription>
				</Alert>
			)}
			{unsetJobs && (
				<output className="block text-sm">
					<p>The OpenRouter connection is added.</p>
					<StillToChoose jobs={unsetJobs} />
				</output>
			)}
		</form>
	);
}
