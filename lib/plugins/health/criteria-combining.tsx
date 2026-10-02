"use client";

import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import {
	aggregationIsHeld,
	BLANK_AGGREGATION,
	isWholeSystem,
	ownRuleRequired,
	type ReductionDraft,
	type ReductionKind,
	reductionAvailable,
	reductionRuleIsShare,
	rescaleRule,
} from "./criteria-draft";
import {
	Section,
	SelectField,
	TextField,
	VersionChip,
} from "./criteria-fields";
import { readingUnit, ruleOutcomes, subjectsOf } from "./criteria-plain-words";
import { RuleFields } from "./criteria-rule-fields";
import type { SectionProps, VersionLabels } from "./criteria-sections";

const KIND_LABELS: Record<ReductionKind, string> = {
	mean: "Average",
	median: "Median",
	max: "Highest",
	min: "Lowest",
	last: "Latest reading",
	sum: "Sum",
	percentile: "Percentile",
};

const KIND_OPTIONS = (Object.keys(KIND_LABELS) as ReductionKind[]).map(
	(kind) => ({ label: KIND_LABELS[kind], value: kind })
);

const OWN_RULE_SHAPES = ["at-least", "at-most", "between"] as const;

interface HeldStep {
	disabled: boolean;
	/** The shared checks' problem with keeping the step. */
	error: string | undefined;
	onRemove: () => void;
	/** What the remove button names. */
	title: string;
}

/** A step the check does not use, with a button for each step the settings still hold that the check cannot use. */
function NotUsed({
	held = [],
	reason,
	title,
}: {
	held?: HeldStep[];
	reason: string;
	title: string;
}) {
	return (
		<section className="min-w-0 space-y-1 rounded-md border border-dashed p-3 text-muted-foreground">
			<h3 className="wrap-anywhere font-medium text-sm">{title}</h3>
			<p className="wrap-anywhere text-sm">{reason}</p>
			{held.map((step) => (
				<div
					className="flex min-w-0 flex-wrap items-center justify-between gap-2"
					key={step.title}
				>
					<p className="wrap-anywhere text-destructive text-sm">
						{step.title}: {step.error ?? "is not used by this check"}
					</p>
					<Button
						disabled={step.disabled}
						onClick={step.onRemove}
						size="sm"
						type="button"
						variant="outline"
					>
						Remove {step.title}
					</Button>
				</div>
			))}
		</section>
	);
}

function OwnRuleChoice({
	disabled,
	forced,
	own,
	onChange,
}: {
	disabled: boolean;
	forced: boolean;
	onChange: (own: boolean) => void;
	own: boolean;
}) {
	const sameId = useId();
	const ownId = useId();
	return (
		<fieldset className="min-w-0 space-y-2 border-0 p-0">
			<legend className="mb-2 font-medium text-sm">
				Judge the combined value with
			</legend>
			<RadioGroup
				disabled={disabled}
				onValueChange={(value) => onChange(value === "own")}
				value={own || forced ? "own" : "same"}
			>
				<div className="flex items-center gap-2">
					<RadioGroupItem
						disabled={disabled || forced}
						id={sameId}
						value="same"
					/>
					<Label className="wrap-anywhere leading-snug" htmlFor={sameId}>
						The rule in step 1
					</Label>
				</div>
				<div className="flex items-center gap-2">
					<RadioGroupItem disabled={disabled} id={ownId} value="own" />
					<Label className="wrap-anywhere leading-snug" htmlFor={ownId}>
						Its own rule
					</Label>
				</div>
			</RadioGroup>
			{forced && (
				<p className="text-muted-foreground text-xs">
					The rule in step 1 cannot judge this combined value, so it needs a
					rule of its own.
				</p>
			)}
		</fieldset>
	);
}

/** Step 2: combine one subject's readings over the window. */
function ReductionSection({
	analysis,
	check,
	disabled,
	draft,
	setDraft,
	versions,
}: SectionProps & { versions: VersionLabels | undefined }) {
	const switchId = useId();
	const subjects = subjectsOf(check);
	const title = `2. Combine each ${subjects.one}'s readings over the window`;
	if (!reductionAvailable(check)) {
		return (
			<NotUsed
				held={
					draft.reductionOn
						? [
								{
									disabled,
									error: analysis.errors.reduction,
									onRemove: () => setDraft({ reductionOn: false }),
									title: "step 2",
								},
							]
						: []
				}
				reason="This check returns text, which cannot be combined."
				title={title}
			/>
		);
	}
	const { reduction } = draft;
	const patch = (change: Partial<ReductionDraft>) =>
		setDraft({ reduction: { ...reduction, ...change } });
	const forced = ownRuleRequired(draft.rule.shape, reduction.kind, check);
	const own = reduction.ownRule || forced;
	const valueType = check.value.type;
	const share = reductionRuleIsShare(valueType, reduction.kind);
	const onKind = (kind: ReductionKind) => {
		const next = reductionRuleIsShare(valueType, kind);
		const factor = next ? 100 : 0.01;
		patch({
			kind,
			rule:
				next === share ? reduction.rule : rescaleRule(reduction.rule, factor),
		});
	};
	const ownRule = analysis.settings.reduction?.rule;
	return (
		<Section
			action={
				<div className="flex items-center gap-2">
					<Switch
						checked={draft.reductionOn}
						disabled={disabled}
						id={switchId}
						onCheckedChange={(on) => setDraft({ reductionOn: on })}
					/>
					<Label htmlFor={switchId}>{draft.reductionOn ? "On" : "Off"}</Label>
				</div>
			}
			chip={
				draft.reductionOn && versions?.reduction ? (
					<VersionChip>{versions.reduction}</VersionChip>
				) : null
			}
			title={title}
		>
			{draft.reductionOn && (
				<div className="space-y-3">
					<div className="grid gap-3 sm:grid-cols-2">
						<SelectField
							disabled={disabled}
							error={analysis.errors["reduction.kind"]}
							label="Combine by"
							onChange={onKind}
							options={KIND_OPTIONS}
							value={reduction.kind}
						/>
						{reduction.kind === "percentile" && (
							<TextField
								disabled={disabled}
								error={analysis.errors["reduction.params.p"]}
								inputMode="decimal"
								label="Percentile (0 to 100)"
								onChange={(percentile) => patch({ percentile })}
								value={reduction.percentile}
							/>
						)}
					</div>
					<OwnRuleChoice
						disabled={disabled}
						forced={forced}
						onChange={(value) => patch({ ownRule: value })}
						own={own}
					/>
					{own && (
						<RuleFields
							disabled={disabled}
							errors={analysis.errors}
							fits={() => true}
							hint={null}
							label="How the combined value is judged"
							onChange={(rule) => patch({ rule })}
							outcomes={
								ownRule
									? ruleOutcomes(ownRule, {
											share,
											unit: share ? undefined : readingUnit(check),
										})
									: null
							}
							prefix="reduction.rule"
							rule={reduction.rule}
							shapes={[...OWN_RULE_SHAPES]}
							unit={share ? "%" : readingUnit(check)}
						/>
					)}
					<TextField
						disabled={disabled}
						error={analysis.errors["reduction.params.avail_floor"]}
						hint="Optional. The share of readings that must have an answer."
						inputMode="decimal"
						label="Readings needed"
						onChange={(readingsNeeded) => patch({ readingsNeeded })}
						suffix="%"
						value={reduction.readingsNeeded}
					/>
				</div>
			)}
		</Section>
	);
}

/** Step 3: combine all subjects into the claim's result. */
function AggregationSection({
	analysis,
	check,
	disabled,
	draft,
	setDraft,
	versions,
}: SectionProps & { versions: VersionLabels | undefined }) {
	const subjects = subjectsOf(check);
	const { aggregation } = draft;
	return (
		<Section
			chip={
				versions?.aggregation ? (
					<VersionChip>{versions.aggregation}</VersionChip>
				) : null
			}
			title={`3. Combine all ${subjects.many} into the claim's result`}
		>
			<p className="wrap-anywhere text-sm">
				<span className="text-muted-foreground">Method: </span>
				Share of {subjects.many} that pass
			</p>
			<div className="grid gap-3 sm:grid-cols-2">
				<TextField
					disabled={disabled}
					error={analysis.errors["aggregation.params.threshold"]}
					inputMode="decimal"
					label="Claim passes at"
					onChange={(threshold) =>
						setDraft({ aggregation: { ...aggregation, threshold } })
					}
					suffix="%"
					value={aggregation.threshold}
				/>
				<TextField
					disabled={disabled}
					error={analysis.errors["aggregation.params.avail_floor"]}
					hint="Optional."
					inputMode="decimal"
					label="Answers needed"
					onChange={(answersNeeded) =>
						setDraft({ aggregation: { ...aggregation, answersNeeded } })
					}
					suffix={`% of ${subjects.many}`}
					value={aggregation.answersNeeded}
				/>
			</div>
		</Section>
	);
}

/** Steps 2 and 3, or the note that a whole-system check does not use them. */
export function CombiningSections(
	props: SectionProps & { versions: VersionLabels | undefined }
) {
	if (isWholeSystem(props.check)) {
		return <WholeSystemNotUsed {...props} />;
	}
	return (
		<>
			<ReductionSection {...props} />
			<AggregationSection {...props} />
		</>
	);
}

/** The note that a whole-system check combines nothing, with a way to remove any combining step the settings still hold. */
function WholeSystemNotUsed({
	analysis,
	disabled,
	draft,
	setDraft,
}: SectionProps) {
	const held: HeldStep[] = [];
	if (draft.reductionOn) {
		held.push({
			disabled,
			error: analysis.errors.reduction,
			onRemove: () => setDraft({ reductionOn: false }),
			title: "step 2",
		});
	}
	if (aggregationIsHeld(draft.aggregation)) {
		held.push({
			disabled,
			error: analysis.errors.aggregation,
			onRemove: () => setDraft({ aggregation: BLANK_AGGREGATION }),
			title: "step 3",
		});
	}
	return (
		<NotUsed
			held={held}
			reason="A whole-system check gives one reading at a time, so there is nothing to combine."
			title="Combining readings: not used"
		/>
	);
}
