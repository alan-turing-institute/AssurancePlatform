"use client";

import { type ReactNode, useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
	DURATION_UNITS,
	type DurationDraft,
	type DurationUnit,
} from "./criteria-draft";
import type { RuleOutcome } from "./criteria-plain-words";
import { VERDICT_DOT_CLASSES, VERDICT_LABELS } from "./health-format";

/**
 * Small building blocks for the settings form. Every control has a visible
 * label tied to it and shows its problem beside it, announced to assistive
 * technology. The popups of selects carry `nokey`, because they are drawn
 * outside the panel and the canvas would otherwise take their arrow keys.
 */

export const NOKEY_CONTENT =
	"nokey max-w-(--radix-select-content-available-width)";

interface FieldProps {
	children: (control: {
		"aria-describedby": string | undefined;
		"aria-invalid": boolean;
		id: string;
	}) => ReactNode;
	className?: string;
	error?: string | undefined;
	hint?: ReactNode;
	label: ReactNode;
}

/** A label, a control, an optional hint and the control's problem, tied together. */
export function Field({ children, className, error, hint, label }: FieldProps) {
	const id = useId();
	const hintId = `${id}-hint`;
	const errorId = `${id}-error`;
	const describedBy =
		[hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") ||
		undefined;
	return (
		<div className={cn("min-w-0 space-y-1.5", className)}>
			<Label className="wrap-anywhere leading-snug" htmlFor={id}>
				{label}
			</Label>
			{children({
				id,
				"aria-describedby": describedBy,
				"aria-invalid": Boolean(error),
			})}
			{hint && (
				<p className="wrap-anywhere text-muted-foreground text-xs" id={hintId}>
					{hint}
				</p>
			)}
			{error && (
				<p className="wrap-anywhere text-destructive text-sm" id={errorId}>
					{error}
				</p>
			)}
		</div>
	);
}

interface TextFieldProps {
	disabled: boolean;
	error?: string | undefined;
	hint?: ReactNode;
	inputMode?: "decimal" | "numeric" | "text";
	label: ReactNode;
	onChange: (value: string) => void;
	suffix?: string | undefined;
	value: string;
}

/** A one-line field for text or for a number typed as text; `suffix` is its unit. */
export function TextField({
	disabled,
	error,
	hint,
	inputMode = "text",
	label,
	onChange,
	suffix,
	value,
}: TextFieldProps) {
	return (
		<Field error={error} hint={hint} label={label}>
			{(control) => (
				<div className="flex items-center gap-2">
					<Input
						{...control}
						disabled={disabled}
						inputMode={inputMode}
						onChange={(event) => onChange(event.target.value)}
						value={value}
					/>
					{suffix && (
						<span className="max-w-2/5 shrink-0 break-words text-muted-foreground text-sm">
							{suffix}
						</span>
					)}
				</div>
			)}
		</Field>
	);
}

interface SelectFieldProps<T extends string> {
	disabled: boolean;
	error?: string | undefined;
	hint?: ReactNode;
	label: ReactNode;
	onChange: (value: T) => void;
	options: { label: string; value: T }[];
	placeholder?: string;
	value: T | "";
}

/** A select with a visible label. */
export function SelectField<T extends string>({
	disabled,
	error,
	hint,
	label,
	onChange,
	options,
	placeholder,
	value,
}: SelectFieldProps<T>) {
	return (
		<Field error={error} hint={hint} label={label}>
			{(control) => (
				<Select
					disabled={disabled}
					onValueChange={(next) => onChange(next as T)}
					value={value}
				>
					<SelectTrigger {...control}>
						<SelectValue placeholder={placeholder} />
					</SelectTrigger>
					<SelectContent className={NOKEY_CONTENT}>
						{options.map((option) => (
							<SelectItem
								className="wrap-anywhere"
								key={option.value}
								value={option.value}
							>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			)}
		</Field>
	);
}

const UNIT_OPTIONS = DURATION_UNITS.map((unit) => ({
	label: unit,
	value: unit,
}));

interface DurationFieldProps {
	disabled: boolean;
	error?: string | undefined;
	hint?: ReactNode;
	label: ReactNode;
	onChange: (value: DurationDraft) => void;
	value: DurationDraft;
}

/** An amount and a unit; the form sends them as an ISO 8601 duration. */
export function DurationField({
	disabled,
	error,
	hint,
	label,
	onChange,
	value,
}: DurationFieldProps) {
	const unitId = useId();
	return (
		<Field error={error} hint={hint} label={label}>
			{(control) => (
				<div className="flex gap-2">
					<Input
						{...control}
						className="min-w-0"
						disabled={disabled}
						inputMode="numeric"
						onChange={(event) =>
							onChange({ ...value, amount: event.target.value })
						}
						value={value.amount}
					/>
					<Select
						disabled={disabled}
						onValueChange={(unit) =>
							onChange({ ...value, unit: unit as DurationUnit })
						}
						value={value.unit}
					>
						<SelectTrigger
							aria-label="Unit"
							className="w-32 shrink-0"
							id={unitId}
						>
							<SelectValue />
						</SelectTrigger>
						<SelectContent className={NOKEY_CONTENT}>
							{UNIT_OPTIONS.map((unit) => (
								<SelectItem key={unit.value} value={unit.value}>
									{unit.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			)}
		</Field>
	);
}

/** A small chip carrying a version label. */
export function VersionChip({ children }: { children: ReactNode }) {
	return (
		<span className="wrap-anywhere inline-flex rounded-full border px-2 py-0.5 font-normal text-muted-foreground text-xs">
			{children}
		</span>
	);
}

/** A verdict word with a dot in the verdict's colour; the word carries the meaning. */
function VerdictChip({ verdict }: { verdict: RuleOutcome["verdict"] }) {
	return (
		<span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 align-middle text-xs">
			<span
				aria-hidden="true"
				className={cn(
					"inline-block size-2 rounded-full",
					VERDICT_DOT_CLASSES[verdict]
				)}
			/>
			{VERDICT_LABELS[verdict]}
		</span>
	);
}

/** What passes, what is marginal and what fails, each behind its verdict chip. */
export function OutcomeLine({ outcomes }: { outcomes: RuleOutcome[] }) {
	return (
		<p className="wrap-anywhere space-x-1 text-sm leading-7">
			{outcomes.map((outcome) => (
				<span key={outcome.verdict}>
					<VerdictChip verdict={outcome.verdict} />{" "}
					<span>when {outcome.text}.</span>
				</span>
			))}
		</p>
	);
}

/** A titled step of the form, with an optional version chip and a control for the right-hand side. */
export function Section({
	action,
	chip,
	children,
	title,
}: {
	action?: ReactNode;
	children: ReactNode;
	chip?: ReactNode;
	title: ReactNode;
}) {
	return (
		<section className="min-w-0 space-y-3 rounded-md border p-3">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<h3 className="wrap-anywhere flex min-w-0 flex-wrap items-center gap-2 font-medium text-sm">
					{title}
					{chip}
				</h3>
				{action}
			</div>
			{children}
		</section>
	);
}
