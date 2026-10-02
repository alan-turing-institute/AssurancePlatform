"use client";

import { type RefObject, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { HealthCheck } from "@/lib/schemas/health-checks";
import { CombiningSections } from "./criteria-combining";
import type { CriteriaDraft } from "./criteria-draft";
import {
	type CompareOffer,
	FreshPickNotice,
	MoveNotice,
	PipelineFooter,
	PlainWordsSummary,
	StateNotices,
} from "./criteria-notices";
import {
	type CheckChoice,
	RuleSection,
	type SectionProps,
	SourceSection,
	TimingSection,
	type VersionLabels,
} from "./criteria-sections";
import { ShortViewBody } from "./criteria-short-view";
import type { HealthCriteriaResponse } from "./health-types";
import { RetireCriteriaDialog } from "./retire-criteria-dialog";
import { retireCriteria, saveCriteria } from "./use-criteria";
import { useCriteriaDraft } from "./use-criteria-draft";

export type FormState = "accepted" | "new" | "suggested";

/** Settings moved to another version of their check, held in the form and not yet saved. */
export interface PendingMove {
	/** Leaves the move and returns to the settings as stored. */
	onCancel: () => void;
	/** The version of the check the settings were moved to. */
	version: string;
}

export interface CriteriaFormProps {
	canEdit: boolean;
	choices: CheckChoice[];
	claimId: string;
	/** Offers the move to a newer version of the check, from the notice that says there is one. */
	compare?: CompareOffer | null;
	initialCheck: HealthCheck;
	initialChoiceKey: string;
	initialDraft: CriteriaDraft;
	/** Set when `initialDraft` is a move to a new check version, which is an unsaved change. */
	move?: PendingMove;
	/** Leaves a form for a check that has not been saved. */
	onCancelNew: () => void;
	/** Called when something changed that the form cannot read from the answer, so the view is fetched again. */
	onChanged: () => void;
	/** Called when the server has answered a change and the view should show its answer. */
	onReplace: (view: HealthCriteriaResponse) => void;
	/** The stored revision these values were taken from; null for a check that has not been saved. */
	revision: number | null;
	startShort: boolean;
	state: FormState;
	view: HealthCriteriaResponse | null;
}

const PLACED_PATH =
	/^(check\.params\.[^.]+|rule\.(kind|params\.(pass_values|marginal_values))|reduction\.(kind|params\.(p|avail_floor)|rule\.(kind|params\.(pass_values|marginal_values)))|aggregation\.params\.(threshold|avail_floor)|window|valid_for)$/;

/** What Cancel does: leave a form for a check not yet saved, leave a move to another version, or put the stored values back. */
function cancelOf(
	state: FormState,
	move: PendingMove | undefined,
	leaveNew: () => void,
	resetToStored: () => void
): () => void {
	if (state === "new") {
		return leaveNew;
	}
	return move ? move.onCancel : resetToStored;
}

/** Whether the check's entry recommends anything at all. */
function hasRecommendation(check: HealthCheck): boolean {
	return (
		check.recommended !== undefined && Object.keys(check.recommended).length > 0
	);
}

function versionsOf(
	view: HealthCriteriaResponse | null,
	move: PendingMove | undefined
): VersionLabels | undefined {
	const stored = view?.criteria;
	if (!stored || stored.state === "inactive") {
		return undefined;
	}
	return {
		check: move?.version ?? stored.check.version,
		rule: stored.rule.version,
		reduction: stored.reduction?.version,
		aggregation: stored.aggregation?.version,
	};
}

interface ButtonRowProps {
	canSave: boolean;
	changedElsewhere: boolean;
	onAccept: () => void;
	onCancel: () => void;
	onDiscard: () => void;
	onStop: () => void;
	onSuggest: () => void;
	pending: boolean;
	state: FormState;
	stopButton: RefObject<HTMLButtonElement | null>;
}

function ButtonRow({
	canSave,
	changedElsewhere,
	onAccept,
	onCancel,
	onDiscard,
	onStop,
	onSuggest,
	pending,
	state,
	stopButton,
}: ButtonRowProps) {
	const blocked = pending || changedElsewhere || !canSave;
	const locked = pending || changedElsewhere;
	const accepted = state === "accepted";
	return (
		<div className="flex flex-wrap items-center gap-2">
			<Button disabled={blocked} onClick={onAccept} type="button">
				{accepted ? "Save settings" : "Accept settings"}
			</Button>
			{!accepted && (
				<Button
					disabled={blocked}
					onClick={onSuggest}
					type="button"
					variant="outline"
				>
					Save without accepting
				</Button>
			)}
			<Button
				disabled={pending}
				onClick={onCancel}
				type="button"
				variant="outline"
			>
				Cancel
			</Button>
			{state === "suggested" && (
				<Button
					disabled={locked}
					onClick={onDiscard}
					type="button"
					variant="ghost"
				>
					Discard suggestion
				</Button>
			)}
			{accepted && (
				<Button
					disabled={locked}
					onClick={onStop}
					ref={stopButton}
					type="button"
					variant="ghost"
				>
					Stop using these settings
				</Button>
			)}
		</div>
	);
}

function ChangedElsewhere({ onReload }: { onReload: () => void }) {
	return (
		<div
			className="flex flex-wrap items-center gap-2 rounded-md border border-warning/50 bg-warning/10 px-3 py-2 text-sm"
			role="alert"
		>
			<span className="wrap-anywhere">
				These settings were changed by someone else. Reload to see them.
			</span>
			<Button onClick={onReload} size="sm" type="button" variant="outline">
				Reload
			</Button>
		</div>
	);
}

/** Problems that have no field of their own, and the server's message when it names none. */
function ProblemList({
	errors,
	message,
}: {
	errors: Record<string, string>;
	message: string | null;
}) {
	const unplaced = Object.entries(errors).filter(
		([path]) => !PLACED_PATH.test(path)
	);
	if (unplaced.length > 0) {
		return (
			<ul className="space-y-1" role="alert">
				{unplaced.map(([path, text]) => (
					<li className="wrap-anywhere text-destructive text-sm" key={path}>
						{path}: {text}
					</li>
				))}
			</ul>
		);
	}
	return message ? (
		<p className="wrap-anywhere text-destructive text-sm" role="alert">
			{message}
		</p>
	) : null;
}

/** Saving, accepting and discarding, with the request in flight and the server's refusal. */
function useCriteriaActions(
	claimId: string,
	form: ReturnType<typeof useCriteriaDraft>,
	onReplace: (view: HealthCriteriaResponse) => void
) {
	const [pending, setPending] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const { analysis, draft } = form;

	const run = async (
		request: () => ReturnType<typeof retireCriteria>
	): Promise<HealthCriteriaResponse | null> => {
		setPending(true);
		setMessage(null);
		const outcome = await request();
		setPending(false);
		if (outcome.ok) {
			return outcome.view;
		}
		form.setServerErrors(outcome.fieldErrors);
		setMessage(outcome.message);
		return null;
	};

	return {
		clearMessage: () => setMessage(null),
		discard: async () => {
			const view = await run(() => retireCriteria(claimId));
			if (view) {
				onReplace(view);
			}
		},
		message,
		pending,
		save: async (accept: boolean) => {
			if (!analysis.complete) {
				return;
			}
			const settings = analysis.complete;
			const view = await run(() =>
				saveCriteria(claimId, {
					accept,
					integrationId: draft.integrationId,
					settings,
				})
			);
			if (view) {
				form.saved(view.criteria?.revision ?? null);
				onReplace(view);
			}
		},
	};
}

interface FormSectionsProps {
	choices: CheckChoice[];
	chosen: string;
	onPick: (key: string) => void;
	sectionProps: SectionProps;
	short: boolean;
	versions: VersionLabels | undefined;
}

/** The short view, or every section of the full form. */
function FormSections({
	choices,
	chosen,
	onPick,
	sectionProps,
	short,
	versions,
}: FormSectionsProps) {
	const [showAll, setShowAll] = useState(false);
	if (short && !showAll) {
		return (
			<ShortViewBody {...sectionProps} onShowAll={() => setShowAll(true)} />
		);
	}
	return (
		<>
			<SourceSection
				{...sectionProps}
				choices={choices}
				chosen={chosen}
				onPick={onPick}
				version={versions?.check}
			/>
			<RuleSection {...sectionProps} version={versions?.rule} />
			<CombiningSections {...sectionProps} versions={versions} />
			<TimingSection {...sectionProps} />
		</>
	);
}

interface FormFooterProps
	extends Omit<ButtonRowProps, "onStop" | "stopButton"> {
	claimId: string;
	hasProblems: boolean;
	onChanged: () => void;
}

/** The buttons, with the reminder about problems and the dialog for stopping the use of accepted settings. */
function FormFooter({
	claimId,
	hasProblems,
	onChanged,
	...buttons
}: FormFooterProps) {
	const [stopping, setStopping] = useState(false);
	const stopButton = useRef<HTMLButtonElement>(null);
	return (
		<div className="space-y-2">
			{hasProblems && (
				<p className="text-muted-foreground text-xs">
					Fix the problems marked above before saving.
				</p>
			)}
			<ButtonRow
				{...buttons}
				onStop={() => setStopping(true)}
				stopButton={stopButton}
			/>
			{buttons.state === "accepted" && (
				<RetireCriteriaDialog
					claimId={claimId}
					onDone={onChanged}
					onOpenChange={setStopping}
					open={stopping}
					returnFocusTo={stopButton}
				/>
			)}
		</div>
	);
}

type CriteriaDraftState = ReturnType<typeof useCriteriaDraft>;
type CriteriaActions = ReturnType<typeof useCriteriaActions>;

function sectionPropsOf(
	form: CriteriaDraftState,
	actions: CriteriaActions,
	canEdit: boolean
): SectionProps {
	return {
		analysis: { ...form.analysis, errors: form.errors },
		check: form.check,
		disabled: !canEdit || actions.pending,
		draft: form.draft,
		setDraft: (patch) => {
			form.setDraft(patch);
			actions.clearMessage();
		},
	};
}

/** Whether the form's value can be sent: no known problem, a pipeline to send it for, and for accepted settings something changed. */
function canSaveOf(form: CriteriaDraftState, state: FormState): boolean {
	return (
		form.analysis.complete !== null &&
		form.draft.integrationId !== "" &&
		(state !== "accepted" || form.dirty)
	);
}

/** The notices above the summary: the settings' state, and a change made by someone else under unsaved edits. */
function FormNotices({
	compare,
	form,
	move,
	state,
	recommends,
	view,
}: {
	compare: CompareOffer | null | undefined;
	form: CriteriaDraftState;
	move: PendingMove | undefined;
	recommends: boolean;
	state: FormState;
	view: HealthCriteriaResponse | null;
}) {
	return (
		<>
			{state === "new" && <FreshPickNotice recommends={recommends} />}
			{view && <StateNotices compare={move ? null : compare} view={view} />}
			{move && <MoveNotice version={move.version} />}
			{form.changedElsewhere && form.dirty && (
				<ChangedElsewhere
					onReload={() => {
						form.reload();
						move?.onCancel();
					}}
				/>
			)}
		</>
	);
}

/**
 * The settings for one claim: the plain-words summary, then either the short
 * view or every setting, then the buttons. The form keeps its own draft, so a
 * refetch never overwrites what a person has typed; when the stored settings
 * move underneath unsaved changes the form says so and refuses to save.
 */
export function CriteriaForm({
	canEdit,
	choices,
	claimId,
	compare,
	initialCheck,
	initialChoiceKey,
	initialDraft,
	move,
	onCancelNew,
	onChanged,
	onReplace,
	revision,
	startShort,
	state,
	view,
}: CriteriaFormProps) {
	const form = useCriteriaDraft({
		choices,
		initialCheck,
		initialChoiceKey,
		initialDraft,
		revision,
		unsaved: move !== undefined,
	});
	const actions = useCriteriaActions(claimId, form, onReplace);
	const cancel = cancelOf(state, move, onCancelNew, form.resetToStored);

	return (
		<div className="space-y-4" data-testid="health-criteria-form">
			<FormNotices
				compare={compare}
				form={form}
				move={move}
				recommends={hasRecommendation(initialCheck)}
				state={state}
				view={view}
			/>
			<PlainWordsSummary sentences={form.sentences} />
			<FormSections
				choices={choices}
				chosen={form.draftKey}
				onPick={form.onPick}
				sectionProps={sectionPropsOf(form, actions, canEdit)}
				short={state !== "accepted" && startShort}
				versions={versionsOf(view, move)}
			/>
			<ProblemList errors={form.errors} message={actions.message} />
			{view && <PipelineFooter view={view} />}
			{canEdit && (
				<FormFooter
					canSave={canSaveOf(form, state)}
					changedElsewhere={form.changedElsewhere}
					claimId={claimId}
					hasProblems={form.hasProblems}
					onAccept={() => actions.save(true)}
					onCancel={cancel}
					onChanged={onChanged}
					onDiscard={actions.discard}
					onSuggest={() => actions.save(false)}
					pending={actions.pending}
					state={state}
				/>
			)}
		</div>
	);
}
