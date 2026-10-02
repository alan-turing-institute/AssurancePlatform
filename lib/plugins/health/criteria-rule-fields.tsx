"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { RuleDraft, RuleShape, ValueType } from "./criteria-draft";
import { Field, OutcomeLine, TextField } from "./criteria-fields";
import type { RuleOutcome } from "./criteria-plain-words";

export const SHAPE_LABELS: Record<RuleShape, string> = {
	identity: "Yes or no",
	"at-least": "At least",
	"at-most": "At most",
	between: "Between",
	"one-of": "One of",
};

/** Why shapes that cannot judge this kind of reading are switched off. */
export function disabledShapeHint(valueType: ValueType): string {
	switch (valueType) {
		case "boolean":
			return "Readings are yes or no, so only “Yes or no” can judge them.";
		case "string":
			return "Readings are text, so only “One of” can judge them.";
		case "datetime":
			return "Readings are dates and times, which cannot be judged yet.";
		default:
			return "“Yes or no” is for checks whose readings are yes or no.";
	}
}

interface ShapeButtonsProps {
	disabled: boolean;
	fits: (shape: RuleShape) => boolean;
	label: string;
	onChange: (shape: RuleShape) => void;
	shapes: RuleShape[];
	value: RuleShape;
}

function ShapeButtons({
	disabled,
	fits,
	label,
	onChange,
	shapes,
	value,
}: ShapeButtonsProps) {
	return (
		<fieldset className="flex min-w-0 flex-wrap gap-2 border-0 p-0">
			<legend className="sr-only">{label}</legend>
			{shapes.map((shape) => (
				<Button
					aria-pressed={value === shape}
					className={cn(
						value === shape && "border-primary bg-accent text-accent-foreground"
					)}
					disabled={disabled || !fits(shape)}
					key={shape}
					onClick={() => onChange(shape)}
					size="sm"
					type="button"
					variant="outline"
				>
					{SHAPE_LABELS[shape]}
				</Button>
			))}
		</fieldset>
	);
}

interface RuleFieldsProps {
	disabled: boolean;
	/** The rule's own path in the form, for the problems beside its fields. */
	errors: Record<string, string>;
	fits: (shape: RuleShape) => boolean;
	hint: string | null;
	label: string;
	onChange: (rule: RuleDraft) => void;
	outcomes: RuleOutcome[] | null;
	prefix: string;
	rule: RuleDraft;
	shapes: RuleShape[];
	unit: string | undefined;
}

function TwoLimits({
	disabled,
	error,
	high,
	label,
	low,
	onHigh,
	onLow,
	suffix,
}: {
	disabled: boolean;
	error: string | undefined;
	high: string;
	label: string;
	low: string;
	onHigh: (value: string) => void;
	onLow: (value: string) => void;
	suffix: string | undefined;
}) {
	return (
		<div className="grid gap-3 sm:grid-cols-2">
			<TextField
				disabled={disabled}
				error={error}
				inputMode="decimal"
				label={`${label}, low`}
				onChange={onLow}
				suffix={suffix}
				value={low}
			/>
			<TextField
				disabled={disabled}
				inputMode="decimal"
				label={`${label}, high`}
				onChange={onHigh}
				suffix={suffix}
				value={high}
			/>
		</div>
	);
}

function ListField({
	disabled,
	error,
	label,
	onChange,
	value,
}: {
	disabled: boolean;
	error: string | undefined;
	label: string;
	onChange: (value: string) => void;
	value: string;
}) {
	return (
		<Field error={error} hint="One value on each line." label={label}>
			{(control) => (
				<Textarea
					{...control}
					disabled={disabled}
					onChange={(event) => onChange(event.target.value)}
					rows={3}
					value={value}
				/>
			)}
		</Field>
	);
}

/** The limits a rule shape needs, with the problem beside each. */
function LimitFields({
	disabled,
	errors,
	onChange,
	prefix,
	rule,
	unit,
}: Pick<
	RuleFieldsProps,
	"disabled" | "errors" | "onChange" | "prefix" | "rule" | "unit"
>) {
	const pass = errors[`${prefix}.params.pass_values`];
	const marginal = errors[`${prefix}.params.marginal_values`];
	const patch = (change: Partial<RuleDraft>) =>
		onChange({ ...rule, ...change });
	if (rule.shape === "at-least" || rule.shape === "at-most") {
		return (
			<div className="grid gap-3 sm:grid-cols-2">
				<TextField
					disabled={disabled}
					error={pass}
					inputMode="decimal"
					label="Pass at"
					onChange={(value) => patch({ pass: value })}
					suffix={unit}
					value={rule.pass}
				/>
				<TextField
					disabled={disabled}
					error={marginal}
					hint="Optional."
					inputMode="decimal"
					label={rule.shape === "at-least" ? "Marginal from" : "Marginal up to"}
					onChange={(value) => patch({ marginal: value })}
					suffix={unit}
					value={rule.marginal}
				/>
			</div>
		);
	}
	if (rule.shape === "between") {
		return (
			<div className="space-y-3">
				<TwoLimits
					disabled={disabled}
					error={pass}
					high={rule.passHigh}
					label="Pass between"
					low={rule.passLow}
					onHigh={(value) => patch({ passHigh: value })}
					onLow={(value) => patch({ passLow: value })}
					suffix={unit}
				/>
				<TwoLimits
					disabled={disabled}
					error={marginal}
					high={rule.marginalHigh}
					label="Marginal between (optional)"
					low={rule.marginalLow}
					onHigh={(value) => patch({ marginalHigh: value })}
					onLow={(value) => patch({ marginalLow: value })}
					suffix={unit}
				/>
			</div>
		);
	}
	if (rule.shape === "one-of") {
		return (
			<div className="grid gap-3 sm:grid-cols-2">
				<ListField
					disabled={disabled}
					error={pass}
					label="Passing values"
					onChange={(value) => patch({ passList: value })}
					value={rule.passList}
				/>
				<ListField
					disabled={disabled}
					error={marginal}
					label="Marginal values (optional)"
					onChange={(value) => patch({ marginalList: value })}
					value={rule.marginalList}
				/>
			</div>
		);
	}
	return null;
}

/** A rule's shape buttons, the limits its shape needs, and a sentence saying what passes, what is marginal and what fails. */
export function RuleFields(props: RuleFieldsProps) {
	const { disabled, fits, hint, label, onChange, outcomes, rule, shapes } =
		props;
	const kindError = props.errors[`${props.prefix}.kind`];
	return (
		<div className="space-y-3">
			<ShapeButtons
				disabled={disabled}
				fits={fits}
				label={label}
				onChange={(shape) => onChange({ ...rule, shape })}
				shapes={shapes}
				value={rule.shape}
			/>
			{hint && (
				<p className="wrap-anywhere text-muted-foreground text-xs">{hint}</p>
			)}
			{kindError && (
				<p className="wrap-anywhere text-destructive text-sm">{kindError}</p>
			)}
			<LimitFields {...props} />
			{outcomes && <OutcomeLine outcomes={outcomes} />}
		</div>
	);
}
