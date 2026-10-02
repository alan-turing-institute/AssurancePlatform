"use client";

import { type ReactNode, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
	CAUSE_LABELS,
	describeDuration,
	describeLevels,
	describeUncertainty,
	describeValue,
	formatDateTime,
	isInapplicable,
	isWebAddress,
	VERDICT_DOT_CLASSES,
	VERDICT_LABELS,
	windowRange,
} from "./health-format";
import {
	ReinstateRecordDialog,
	RevokeRecordDialog,
} from "./health-record-dialogs";
import type { HealthEvidenceLogItem } from "./health-types";

const FAILED_SUBJECTS_SHOWN = 20;

type Record1 = HealthEvidenceLogItem["record"];

function Row({ label, children }: { label: string; children: ReactNode }) {
	return (
		<p className="wrap-anywhere text-sm">
			<span className="text-muted-foreground">{label}: </span>
			{children}
		</p>
	);
}

function RunText({ run }: { run: string }) {
	if (!isWebAddress(run)) {
		return run;
	}
	return (
		<a
			className="text-primary underline"
			href={run}
			rel="noopener noreferrer"
			target="_blank"
		>
			{run}
		</a>
	);
}

/** What the record found: value, rule, judged statistic, uncertainty, comment, subject, and a summary's members. */
function FindingRows({ record }: { record: Record1 }) {
	const value = describeValue(record);
	const { members, failed_subjects: failed } = record.provenance;

	return (
		<>
			{value !== null && <Row label="Value">{value}</Row>}
			{record.judged && (
				<Row label="Judged">
					{record.judged.statistic} {String(record.judged.value)} (
					{record.judged.method})
				</Row>
			)}
			{record.uncertainty && (
				<Row label="Uncertainty">{describeUncertainty(record.uncertainty)}</Row>
			)}
			{record.comment && <Row label="Comment">{record.comment}</Row>}
			{record.subject && (
				<Row label="Subject">
					{record.subject.kind} {record.subject.id}
				</Row>
			)}
			{record.aggregation && <Row label="Members">{members?.length ?? 0}</Row>}
			{record.aggregation && failed && failed.length > 0 && (
				<Row label="Failed subjects">
					{failed
						.slice(0, FAILED_SUBJECTS_SHOWN)
						.map((subject) => `${subject.kind} ${subject.id}`)
						.join(", ")}
					{failed.length > FAILED_SUBJECTS_SHOWN &&
						` and ${failed.length - FAILED_SUBJECTS_SHOWN} more`}
				</Row>
			)}
		</>
	);
}

/** How the finding was produced: check, the levels of judgement, window, validity and run. */
function MethodRows({
	expiresAt,
	record,
}: {
	expiresAt: string | null;
	record: Record1;
}) {
	const window = windowRange(record.timestamp, record.window);
	const { run } = record.provenance;
	let validity = "indefinitely";
	if (record.valid_for !== "indefinite") {
		validity = `for ${describeDuration(record.valid_for)}`;
		if (expiresAt) {
			validity += `, until ${formatDateTime(expiresAt)}`;
		}
	}

	return (
		<>
			<Row label="Check">
				{record.check.name} {record.check.version}, scope {record.check.scope}
			</Row>
			{describeLevels(record).map((level) => (
				<Row key={level.label} label={level.label}>
					{level.text}
				</Row>
			))}
			{window && (
				<Row label="Window">
					{formatDateTime(window.start)} to {formatDateTime(window.end)}
				</Row>
			)}
			<Row label="Valid">{validity}</Row>
			{run !== undefined && (
				<Row label="Run">
					<RunText run={run} />
				</Row>
			)}
		</>
	);
}

function RevocationNotice({
	revocation,
}: {
	revocation: NonNullable<HealthEvidenceLogItem["revocation"]>;
}) {
	return (
		<p
			className="wrap-anywhere rounded bg-destructive/10 px-2 py-1 text-sm"
			data-testid="health-evidence-revoked"
		>
			Revoked ({CAUSE_LABELS[revocation.cause]}): {revocation.reason}
			<span className="block text-muted-foreground text-xs">
				By {revocation.revoked_by_name ?? "an unknown person"},{" "}
				{formatDateTime(revocation.revoked_at)}
			</span>
		</p>
	);
}

interface RecordActionsProps {
	claimId: string;
	onChanged?: () => void;
	recordId: string;
	revoked: boolean;
}

/** The Revoke or Reinstate button for one record, with its dialog. */
function RecordActions({
	claimId,
	onChanged,
	recordId,
	revoked,
}: RecordActionsProps) {
	const [open, setOpen] = useState(false);
	const [reinstating, setReinstating] = useState(revoked);
	const button = useRef<HTMLButtonElement>(null);
	// The dialog is chosen when it opens and kept until the next opening, so a
	// refetch that flips `revoked` underneath an open dialog does not swap it.
	const Dialog = reinstating ? ReinstateRecordDialog : RevokeRecordDialog;

	return (
		<div className="flex justify-end pt-1">
			<Button
				onClick={() => {
					setReinstating(revoked);
					setOpen(true);
				}}
				ref={button}
				size="sm"
				type="button"
				variant="outline"
			>
				{revoked ? "Reinstate" : "Revoke"}
			</Button>
			<Dialog
				claimId={claimId}
				onDone={() => onChanged?.()}
				onOpenChange={setOpen}
				onRefused={() => onChanged?.()}
				open={open}
				recordId={recordId}
				returnFocusTo={button}
			/>
		</div>
	);
}

interface EvidenceLogEntryProps {
	canEdit?: boolean;
	claimId: string;
	item: HealthEvidenceLogItem;
	/** Called after a revocation or reinstatement succeeds, so the log and status can be fetched again. */
	onChanged?: () => void;
}

/**
 * One record in the Evidence tab. Every string the producer supplied is
 * rendered as text, and `provenance.run` becomes a link only when it begins
 * `http://` or `https://`. Revoke and Reinstate appear only for a person
 * who can edit; the server enforces permission whatever is shown here.
 */
export function EvidenceLogEntry({
	canEdit = false,
	claimId,
	item,
	onChanged,
}: EvidenceLogEntryProps) {
	const { record, revocation } = item;
	const verdictLabel = isInapplicable(record)
		? "Inapplicable"
		: VERDICT_LABELS[record.verdict];

	return (
		<div
			className={cn(
				"space-y-1 rounded-md border p-3",
				revocation && "bg-muted/40"
			)}
			data-testid="health-evidence-entry"
		>
			<div className="flex items-center justify-between gap-2">
				<div className="flex min-w-0 items-center gap-2">
					<span
						aria-hidden="true"
						className={cn(
							"inline-block size-2 shrink-0 rounded-full",
							VERDICT_DOT_CLASSES[record.verdict]
						)}
					/>
					<span
						className={cn("font-medium text-sm", revocation && "line-through")}
					>
						{verdictLabel}
					</span>
					<span className="wrap-anywhere min-w-0 text-muted-foreground text-sm">
						{record.check.name}
					</span>
				</div>
				<span className="whitespace-nowrap text-muted-foreground text-xs">
					{formatDateTime(record.timestamp)}
				</span>
			</div>

			{revocation && <RevocationNotice revocation={revocation} />}
			<FindingRows record={record} />
			<MethodRows expiresAt={item.expires_at} record={record} />

			<details
				className="pt-1 text-xs"
				data-testid="health-evidence-provenance"
			>
				<summary className="cursor-pointer text-muted-foreground">
					Provenance and payload
				</summary>
				<pre className="wrap-anywhere mt-1 whitespace-pre-wrap rounded bg-muted p-2">
					{JSON.stringify(
						{ provenance: record.provenance, payload: record.payload },
						null,
						2
					)}
				</pre>
			</details>

			{canEdit && (
				<RecordActions
					claimId={claimId}
					onChanged={onChanged}
					recordId={record.record_id}
					revoked={revocation !== null}
				/>
			)}
		</div>
	);
}
