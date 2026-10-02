"use client";

import { useId } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { HealthCheck } from "@/lib/schemas/health-checks";
import {
	type CriteriaDraft,
	type DraftAnalysis,
	isWholeSystem,
	type ParamDraft,
	paramDraftOf,
	shapeFitsCheck,
} from "./criteria-draft";
import {
	DurationField,
	Field,
	NOKEY_CONTENT,
	Section,
	SelectField,
	TextField,
	VersionChip,
} from "./criteria-fields";
import { readingUnit, ruleOutcomes } from "./criteria-plain-words";
import { disabledShapeHint, RuleFields } from "./criteria-rule-fields";

export interface SectionProps {
	analysis: DraftAnalysis;
	check: HealthCheck;
	disabled: boolean;
	draft: CriteriaDraft;
	setDraft: (patch: Partial<CriteriaDraft>) => void;
}

/** Version labels of the saved settings, shown beside each step; absent before the first save. */
export interface VersionLabels {
	aggregation: string | undefined;
	check: string;
	reduction: string | undefined;
	rule: string;
}

/** One selectable check, from a pipeline's published list or the one the settings already hold. */
export interface CheckChoice {
	check: HealthCheck;
	integrationId: string;
	key: string;
	pipeline: string;
}

const READING_TYPES = {
	boolean: () => "Yes or no",
	number: (check: HealthCheck) =>
		check.value.type === "number" && check.value.unit
			? `Number, in ${check.value.unit}`
			: "Number",
	string: () => "Text",
	datetime: () => "Date and time",
} as const;

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
	return (
		<div className="min-w-0 space-y-0.5">
			<dt className="text-muted-foreground text-xs">{label}</dt>
			<dd className="wrap-anywhere text-sm">{value}</dd>
		</div>
	);
}

function checkOptions(choices: CheckChoice[]) {
	const pipelines = [...new Set(choices.map((choice) => choice.pipeline))];
	const grouped = pipelines.length > 1;
	const item = (choice: CheckChoice) => (
		<SelectItem className="wrap-anywhere" key={choice.key} value={choice.key}>
			{choice.check.name}
		</SelectItem>
	);
	if (!grouped) {
		return choices.map(item);
	}
	return pipelines.map((pipeline) => (
		<SelectGroup key={pipeline}>
			<SelectLabel className="wrap-anywhere pl-2">{pipeline}</SelectLabel>
			{choices.filter((choice) => choice.pipeline === pipeline).map(item)}
		</SelectGroup>
	));
}

/** A select of checks, grouped by pipeline when more than one pipeline offers a list. */
export function CheckSelect({
	choices,
	disabled,
	label,
	onChange,
	placeholder,
	value,
}: {
	choices: CheckChoice[];
	disabled: boolean;
	label: string;
	onChange: (key: string) => void;
	placeholder: string | undefined;
	value: string;
}) {
	return (
		<Field label={label}>
			{(control) => (
				<Select disabled={disabled} onValueChange={onChange} value={value}>
					<SelectTrigger {...control}>
						<SelectValue placeholder={placeholder} />
					</SelectTrigger>
					<SelectContent className={NOKEY_CONTENT}>
						{checkOptions(choices)}
					</SelectContent>
				</Select>
			)}
		</Field>
	);
}

function ParamControl({
	disabled,
	error,
	onChange,
	spec,
	value,
}: {
	disabled: boolean;
	error: string | undefined;
	onChange: (patch: Partial<ParamDraft>) => void;
	spec: NonNullable<HealthCheck["params"]>[number];
	value: ParamDraft;
}) {
	const switchId = useId();
	if (spec.type === "boolean") {
		return (
			<div className="flex items-center gap-3">
				<Switch
					checked={value.flag === true}
					disabled={disabled}
					id={switchId}
					onCheckedChange={(flag) => onChange({ flag })}
				/>
				<Label className="wrap-anywhere" htmlFor={switchId}>
					{spec.label}
				</Label>
			</div>
		);
	}
	if (spec.type === "enum") {
		return (
			<SelectField
				disabled={disabled}
				error={error}
				label={spec.label}
				onChange={(text) => onChange({ text })}
				options={(spec.options ?? []).map((option) => ({
					label: option,
					value: option,
				}))}
				placeholder="Not set"
				value={value.text}
			/>
		);
	}
	if (spec.type === "duration") {
		return (
			<DurationField
				disabled={disabled}
				error={error}
				label={spec.label}
				onChange={(next) => onChange({ amount: next.amount, unit: next.unit })}
				value={{ amount: value.amount, unit: value.unit }}
			/>
		);
	}
	return (
		<TextField
			disabled={disabled}
			error={error}
			inputMode={spec.type === "number" ? "decimal" : "text"}
			label={spec.label}
			onChange={(text) => onChange({ text })}
			suffix={spec.unit}
			value={value.text}
		/>
	);
}

interface SourceSectionProps extends SectionProps {
	choices: CheckChoice[];
	chosen: string;
	onPick: (key: string) => void;
	version: string | undefined;
}

/** The check, what it measures, and the check's own settings. */
export function SourceSection({
	analysis,
	check,
	choices,
	chosen,
	disabled,
	draft,
	onPick,
	setDraft,
	version,
}: SourceSectionProps) {
	const about = isWholeSystem(check)
		? "The whole system"
		: (check.scope_label?.one ?? check.scope);
	const params = check.params ?? [];
	return (
		<Section
			chip={version ? <VersionChip>check {version}</VersionChip> : null}
			title="Evidence source"
		>
			<CheckSelect
				choices={choices}
				disabled={disabled || choices.length < 2}
				label="Check"
				onChange={onPick}
				placeholder={undefined}
				value={chosen}
			/>
			<dl className="grid gap-3 sm:grid-cols-2">
				{check.description && (
					<ReadOnlyRow label="Measures" value={check.description} />
				)}
				<ReadOnlyRow label="One reading is about" value={about} />
				<ReadOnlyRow
					label="Reading type"
					value={READING_TYPES[check.value.type](check)}
				/>
			</dl>
			{params.length === 0 ? (
				<p className="text-muted-foreground text-sm">
					This check has no settings.
				</p>
			) : (
				<div className="grid gap-3 sm:grid-cols-2">
					{params.map((spec) => (
						<ParamControl
							disabled={disabled}
							error={analysis.errors[`check.params.${spec.key}`]}
							key={spec.key}
							onChange={(patch) =>
								setDraft({
									params: {
										...draft.params,
										[spec.key]: { ...paramDraftOf(draft, spec.key), ...patch },
									},
								})
							}
							spec={spec}
							value={paramDraftOf(draft, spec.key)}
						/>
					))}
				</div>
			)}
		</Section>
	);
}

/** Step 1: how each reading is judged. */
export function RuleSection({
	analysis,
	check,
	disabled,
	draft,
	setDraft,
	version,
}: SectionProps & { version: string | undefined }) {
	const shapes = [
		"identity",
		"at-least",
		"at-most",
		"between",
		"one-of",
	] as const;
	const allFit = shapes.every((shape) => shapeFitsCheck(shape, check));
	return (
		<Section
			chip={version ? <VersionChip>rule {version}</VersionChip> : null}
			title="1. Judge each reading"
		>
			<RuleFields
				disabled={disabled}
				errors={analysis.errors}
				fits={(shape) => shapeFitsCheck(shape, check)}
				hint={allFit ? null : disabledShapeHint(check.value.type)}
				label="How a reading is judged"
				onChange={(rule) => setDraft({ rule })}
				outcomes={
					analysis.settings.rule
						? ruleOutcomes(analysis.settings.rule, {
								share: false,
								unit: readingUnit(check),
							})
						: null
				}
				prefix="rule"
				rule={draft.rule}
				shapes={[...shapes]}
				unit={readingUnit(check)}
			/>
		</Section>
	);
}

/** The window length and how long a result counts, with the choice of no time limit. */
export function TimingFields({
	analysis,
	disabled,
	draft,
	setDraft,
}: SectionProps) {
	const checkboxId = useId();
	return (
		<>
			<div className="grid gap-3 sm:grid-cols-2">
				<DurationField
					disabled={disabled}
					error={analysis.errors.window}
					label="Window length"
					onChange={(window) => setDraft({ window })}
					value={draft.window}
				/>
				<DurationField
					disabled={disabled || draft.indefinite}
					error={analysis.errors.valid_for}
					label="Each result counts for"
					onChange={(validFor) => setDraft({ validFor })}
					value={draft.validFor}
				/>
			</div>
			<div className="flex items-start gap-2">
				<Checkbox
					checked={draft.indefinite}
					className="mt-0.5"
					disabled={disabled}
					id={checkboxId}
					onCheckedChange={(checked) =>
						setDraft({ indefinite: checked === true })
					}
				/>
				<Label className="wrap-anywhere leading-snug" htmlFor={checkboxId}>
					A result counts until someone withdraws it (no time limit)
				</Label>
			</div>
		</>
	);
}

/** Window length and how long a result counts. */
export function TimingSection(props: SectionProps) {
	return (
		<Section title="Timing">
			<TimingFields {...props} />
		</Section>
	);
}
