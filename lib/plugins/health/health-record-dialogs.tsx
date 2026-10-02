"use client";

import { type RefObject, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { HealthActionDialog } from "./health-action-dialog";
import { CAUSE_LABELS } from "./health-format";
import type { HealthRevocationCause } from "./health-types";

interface RecordDialogProps {
	claimId: string;
	onDone: () => void;
	onOpenChange: (open: boolean) => void;
	onRefused?: () => void;
	open: boolean;
	/** The record's own `record_id`. */
	recordId: string;
	returnFocusTo?: RefObject<HTMLElement | null>;
}

const CAUSES = Object.keys(CAUSE_LABELS) as HealthRevocationCause[];

/** Withdraws a record from the claim's status, with a cause and a reason. */
export function RevokeRecordDialog({
	claimId,
	onDone,
	onOpenChange,
	onRefused,
	open,
	recordId,
	returnFocusTo,
}: RecordDialogProps) {
	const [cause, setCause] = useState<HealthRevocationCause | "">("");

	return (
		<HealthActionDialog
			buildRequest={(reason) => ({
				method: "POST",
				url: `/api/elements/${claimId}/health/records/${recordId}/revocation`,
				body: { cause, reason },
			})}
			description="The record stays in the log, marked as revoked, and no longer counts towards the claim's status. You can put it back later."
			failureTitle="Could not revoke the record"
			fieldsValid={cause !== ""}
			onDone={onDone}
			onOpenChange={onOpenChange}
			onRefused={onRefused}
			open={open}
			returnFocusTo={returnFocusTo}
			submitLabel="Revoke"
			submitVariant="destructive"
			title="Revoke this record"
		>
			<fieldset className="space-y-2">
				<legend className="font-medium text-sm">Cause</legend>
				<RadioGroup
					onValueChange={(value) => setCause(value as HealthRevocationCause)}
					value={cause}
				>
					{CAUSES.map((value) => (
						<div className="flex items-center gap-2" key={value}>
							<RadioGroupItem id={`health-cause-${value}`} value={value} />
							<Label htmlFor={`health-cause-${value}`}>
								{CAUSE_LABELS[value]}
							</Label>
						</div>
					))}
				</RadioGroup>
			</fieldset>
		</HealthActionDialog>
	);
}

/** Puts a revoked record back into the claim's status. */
export function ReinstateRecordDialog({
	claimId,
	onDone,
	onOpenChange,
	onRefused,
	open,
	recordId,
	returnFocusTo,
}: RecordDialogProps) {
	return (
		<HealthActionDialog
			buildRequest={(reason) => ({
				method: "POST",
				url: `/api/elements/${claimId}/health/records/${recordId}/reinstatement`,
				body: { reason },
			})}
			description="The record counts towards the claim's status again. The earlier revocation stays in the record's history."
			failureTitle="Could not reinstate the record"
			onDone={onDone}
			onOpenChange={onOpenChange}
			onRefused={onRefused}
			open={open}
			returnFocusTo={returnFocusTo}
			submitLabel="Reinstate"
			title="Reinstate this record"
		/>
	);
}

interface ChangeCheckDialogProps {
	claimId: string;
	currentCheck: string;
	onDone: () => void;
	onOpenChange: (open: boolean) => void;
	onRefused?: () => void;
	open: boolean;
	returnFocusTo?: RefObject<HTMLElement | null>;
}

/** Changes the check the claim accepts records from. */
export function ChangeCheckDialog({
	claimId,
	currentCheck,
	onDone,
	onOpenChange,
	onRefused,
	open,
	returnFocusTo,
}: ChangeCheckDialogProps) {
	const [name, setName] = useState("");
	const trimmed = name.trim();

	return (
		<HealthActionDialog
			buildRequest={(reason) => ({
				method: "PUT",
				url: `/api/elements/${claimId}/health/bound-check`,
				body: { name: trimmed, reason },
			})}
			description={`This claim accepts results from "${currentCheck}". Results naming any other check are refused. Records already stored are kept.`}
			failureTitle="Could not change the check"
			fieldsValid={trimmed.length > 0 && trimmed !== currentCheck}
			onDone={onDone}
			onOpenChange={onOpenChange}
			onRefused={onRefused}
			open={open}
			returnFocusTo={returnFocusTo}
			submitLabel="Change check"
			title="Change the accepted check"
		>
			<div className="space-y-2">
				<Label htmlFor="health-bound-check-name">New check name</Label>
				<Input
					id="health-bound-check-name"
					maxLength={200}
					onChange={(event) => setName(event.target.value)}
					value={name}
				/>
			</div>
		</HealthActionDialog>
	);
}
