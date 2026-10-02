"use client";

import { type RefObject, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { HealthCheck } from "@/lib/schemas/health-checks";
import { CombiningSections } from "./criteria-combining";
import { type CriteriaDraft, recommendationIsUsable } from "./criteria-draft";
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
	/** Fetches the settings again, after a save was refused because they had changed. */
	onRefresh: () => void;
	/** Called when the server has answered a change and the view should show its answer. */
	onReplace: (view: HealthCriteriaResponse) => void;
	/** Reports whether the form holds changes that have not been saved. */
	onUnsavedChange?: (unsaved: boolean) => void;
	/** The stored revision these values were taken from; null for a check that has not been saved. */
	revision: number | null;
	state: FormState;
	/** True when the settings the form was opened on have since been stopped or discarded by someone else. */
	superseded?: boolean;
	view: HealthCriteriaResponse | null;
}

/** The server's refusal of a save made from settings that were replaced since the form read them. */
const CHANGED_MESSAGE = "These settings were changed by someone else";

const PLACED_PATH =
	/^(check\.params\.[^.]+|rule\.(kind|params\.(pass_values|marginal_values))|reduction\.(kind|params\.(p|avail_floor)|rule\.(kind|params\.(pass_values|marginal_values)))|aggregation\.params\.(threshold|avail_floor)|window|valid_for|reduction|aggregation)$/;

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
	const [refused, setRefused] = useState(false);
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
		if (outcome.status === 409 && outcome.message === CHANGED_MESSAGE) {
			setRefused(true);
			return null;
		}
		form.setServerErrors(outcome.fieldErrors);
		setMessage(outcome.message);
		return null;
	};

	return {
		clearMessage: () => setMessage(null),
		clearRefusal: () => setRefused(false),
		refused,
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
					expectedRevision: form.baseRevision,
					integrationId: draft.integrationId,
					settings,
				})
			);
			if (view) {
				form.saved(view);
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
				onPick={(key) => {
					// Choosing another check here keeps the full form open.
					setShowAll(true);
					onPick(key);
				}}
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
	changedElsewhere,
	compare,
	move,
	onReload,
	state,
	recommends,
	view,
}: {
	changedElsewhere: boolean;
	compare: CompareOffer | null | undefined;
	move: PendingMove | undefined;
	onReload: () => void;
	recommends: boolean;
	state: FormState;
	view: HealthCriteriaResponse | null;
}) {
	return (
		<>
			{state === "new" && <FreshPickNotice recommends={recommends} />}
			{view && <StateNotices compare={move ? null : compare} view={view} />}
			{move && <MoveNotice version={move.version} />}
			{changedElsewhere && <ChangedElsewhere onReload={onReload} />}
		</>
	);
}

/** Tells the host whether the form holds unsaved changes, and that it holds none once it is gone. */
function useReportUnsaved(
	dirty: boolean,
	onUnsavedChange: ((unsaved: boolean) => void) | undefined
) {
	useEffect(() => {
		onUnsavedChange?.(dirty);
		return () => onUnsavedChange?.(false);
	}, [dirty, onUnsavedChange]);
}

interface ReloadOptions {
	actions: CriteriaActions;
	form: CriteriaDraftState;
	move: PendingMove | undefined;
	onCancelNew: () => void;
	onRefresh: () => void;
	state: FormState;
}

/** What Reload does: drop the unsaved values, leave a move or a fresh pick, and read the settings again after a refused save. */
function reloadOf({
	actions,
	form,
	move,
	onCancelNew,
	onRefresh,
	state,
}: ReloadOptions): () => void {
	return () => {
		form.reload();
		move?.onCancel();
		if (state === "new") {
			onCancelNew();
		}
		if (actions.refused) {
			actions.clearRefusal();
			onRefresh();
		}
	};
}

/** The reason saving is off for settings whose pipeline has been deleted. */
function PipelineGoneNote() {
	return (
		<p className="wrap-anywhere text-sm">
			The pipeline these settings were set up for no longer exists. Choose the
			check again from a current list to keep using them, or stop using these
			settings.
		</p>
	);
}

interface ShortViewOptions {
	canEdit: boolean;
	state: FormState;
}

/**
 * Whether the form opens as the short view: for a person who can accept, a
 * suggestion, or a fresh pick whose recommendation can be saved as it stands.
 * It follows the check currently chosen. A person who cannot edit reads the
 * full form.
 */
function useShortView(
	check: HealthCheck,
	integrationId: string,
	{ canEdit, state }: ShortViewOptions
): boolean {
	const usable = useMemo(
		() => state === "new" && recommendationIsUsable(check, integrationId),
		[check, integrationId, state]
	);
	return canEdit && (state === "suggested" || usable);
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
	onRefresh,
	onReplace,
	onUnsavedChange,
	revision,
	state,
	superseded = false,
	view,
}: CriteriaFormProps) {
	const form = useCriteriaDraft({
		choices,
		initialCheck,
		initialChoiceKey,
		initialDraft,
		revision,
		unsaved: move !== undefined || state === "new",
	});
	const actions = useCriteriaActions(claimId, form, onReplace);
	const cancel = cancelOf(state, move, onCancelNew, form.resetToStored);
	useReportUnsaved(form.dirty, onUnsavedChange);
	const short = useShortView(form.check, form.draft.integrationId, {
		canEdit,
		state,
	});
	const reload = reloadOf({
		actions,
		form,
		move,
		onCancelNew,
		onRefresh,
		state,
	});

	return (
		<div className="space-y-4" data-testid="health-criteria-form">
			<FormNotices
				changedElsewhere={
					actions.refused || superseded || (form.changedElsewhere && form.dirty)
				}
				compare={compare}
				move={move}
				onReload={reload}
				recommends={hasRecommendation(form.check)}
				state={state}
				view={view}
			/>
			<PlainWordsSummary sentences={form.sentences} />
			<FormSections
				choices={choices}
				chosen={form.draftKey}
				onPick={form.onPick}
				sectionProps={sectionPropsOf(form, actions, canEdit)}
				short={short}
				versions={versionsOf(view, move)}
			/>
			<ProblemList errors={form.errors} message={actions.message} />
			<PipelineFooter view={view} />
			{canEdit && form.draft.integrationId === "" && <PipelineGoneNote />}
			{canEdit && (
				<FormFooter
					canSave={canSaveOf(form, state)}
					changedElsewhere={
						form.changedElsewhere || superseded || actions.refused
					}
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
