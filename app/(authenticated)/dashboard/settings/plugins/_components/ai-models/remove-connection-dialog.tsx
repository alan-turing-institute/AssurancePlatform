"use client";

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { ModelConnection } from "@/hooks/use-model-settings";
import type { ModelJob } from "@/lib/models/connection-types";
import { JOB_COPY } from "./ai-models-copy";

export interface RemoveConnectionDialogProps {
	connection: ModelConnection | null;
	/** The jobs that run on the connection, which removing it empties. */
	jobs: readonly ModelJob[];
	onConfirm: (connection: ModelConnection) => void;
	onOpenChange: (open: boolean) => void;
	open: boolean;
}

/** Joins job names for a sentence: "Chat", "Chat and Search", "Chat, Ranking and Search". */
function listJobs(jobs: readonly ModelJob[]): string {
	const names = jobs.map((job) => JOB_COPY[job].title);
	if (names.length <= 1) {
		return names.join("");
	}
	return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

/**
 * The confirmation for removing a connection. It names the jobs that run on
 * the connection, because removing the connection empties them.
 */
export function RemoveConnectionDialog({
	connection,
	jobs,
	onConfirm,
	onOpenChange,
	open,
}: RemoveConnectionDialogProps) {
	return (
		<AlertDialog onOpenChange={onOpenChange} open={open}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>
						{connection ? `Remove ${connection.label}?` : "Remove connection?"}
					</AlertDialogTitle>
					<AlertDialogDescription>
						{jobs.length > 0
							? `This deletes the connection and its stored key, and empties these jobs: ${listJobs(jobs)}.`
							: "This deletes the connection and its stored key. No job uses it."}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Keep it</AlertDialogCancel>
					<AlertDialogAction
						className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						onClick={() => connection && onConfirm(connection)}
					>
						Remove
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
