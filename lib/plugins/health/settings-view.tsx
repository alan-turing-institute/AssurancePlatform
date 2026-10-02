"use client";

import { FileText } from "lucide-react";
import {
	type RefObject,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { ServedSettings } from "@/lib/schemas/health-criteria";
import { VersionCompare } from "./criteria-compare";
import { draftFromCheck, draftFromStored } from "./criteria-draft";
import { CriteriaForm, type CriteriaFormProps } from "./criteria-form";
import { StoppedNotice } from "./criteria-notices";
import { type CheckChoice, CheckSelect } from "./criteria-sections";
import { compareBlocks, mergeVersionMove } from "./criteria-version-move";
import type {
	HealthCheckListOffer,
	HealthCriteriaResponse,
} from "./health-types";
import type { ClaimScopedFetchResult } from "./use-claim-scoped-fetch";
import { type CaseChecksState, useCaseChecks } from "./use-criteria";
import { useVersionMove, type VersionMove } from "./use-version-move";

function choiceKey(integrationId: string, name: string): string {
	return JSON.stringify([integrationId, name]);
}

function choicesFrom(lists: HealthCheckListOffer[] | null): CheckChoice[] {
	return (lists ?? []).flatMap((list) =>
		list.checks.map((check) => ({
			check,
			integrationId: list.integration.id,
			key: choiceKey(list.integration.id, check.name),
			pipeline: list.pipeline,
		}))
	);
}

/** The check the stored settings hold, as it was when last found in the list; null when the settings are not in use. */
function storedChoice(view: HealthCriteriaResponse | null): CheckChoice | null {
	const stored = view?.criteria;
	if (!(stored && view?.check_description) || stored.state === "inactive") {
		return null;
	}
	const integrationId = view.integration?.id ?? "";
	return {
		check: view.check_description,
		integrationId,
		key: choiceKey(integrationId, stored.check.name),
		pipeline: view.integration?.name ?? "",
	};
}

const PICKER_NOTES: Record<CaseChecksState["status"], string> = {
	idle: "",
	loading: "Loading the checks your pipelines offer.",
	error:
		"Could not load the checks your pipelines offer. Try reopening this element.",
	ready: "No pipeline has published a check list for this case yet.",
};

function CheckPicker({
	checks,
	choices,
	onPick,
}: {
	checks: CaseChecksState;
	choices: CheckChoice[];
	onPick: (choice: CheckChoice) => void;
}) {
	return (
		<div className="space-y-3">
			<p className="text-sm">
				Choose the check a pipeline runs for this claim. You can then set how
				its results are judged.
			</p>
			{choices.length > 0 ? (
				<CheckSelect
					choices={choices}
					disabled={false}
					label="Check"
					onChange={(key) => {
						const choice = choices.find((candidate) => candidate.key === key);
						if (choice) {
							onPick(choice);
						}
					}}
					placeholder="Choose a check"
					value=""
				/>
			) : (
				<p className="wrap-anywhere text-muted-foreground text-sm">
					{PICKER_NOTES[checks.status]}
				</p>
			)}
		</div>
	);
}

type FormHost = Pick<
	CriteriaFormProps,
	| "canEdit"
	| "choices"
	| "claimId"
	| "onCancelNew"
	| "onChanged"
	| "onRefresh"
	| "onReplace"
	| "onUnsavedChange"
>;

/** The form for a check that has just been picked and not yet saved. */
function PickedForm({
	host,
	picked,
	view,
}: {
	host: FormHost;
	picked: CheckChoice;
	view: HealthCriteriaResponse;
}) {
	return (
		<div className="space-y-3">
			<StoppedNotice view={view} />
			<CriteriaForm
				{...host}
				initialCheck={picked.check}
				initialChoiceKey={picked.key}
				initialDraft={draftFromCheck(picked.check, picked.integrationId)}
				key={`new:${picked.key}`}
				revision={view.criteria?.revision ?? null}
				state="new"
				view={null}
			/>
		</div>
	);
}

/** The check list's entry for a different version of the stored settings' check, from the same pipeline; null when there is none. */
function newerVersionOf(
	view: HealthCriteriaResponse,
	lists: HealthCheckListOffer[] | null
): CheckChoice | null {
	const accepted = view.criteria;
	const integrationId = view.integration?.id;
	if (!(accepted && integrationId)) {
		return null;
	}
	const list = lists?.find((offer) => offer.integration.id === integrationId);
	const check = list?.checks.find(
		(candidate) => candidate.name === accepted.check.name
	);
	return list && check && check.version !== accepted.check.version
		? {
				check,
				integrationId,
				key: choiceKey(integrationId, check.name),
				pipeline: list.pipeline,
			}
		: null;
}

/** The host callbacks for a form holding moved settings: leaving the form also leaves the move, and the moved check stands in the list. */
function hostForMove(
	host: FormHost,
	stored: CheckChoice,
	move: VersionMove
): FormHost {
	const { moved } = move;
	if (!moved) {
		return host;
	}
	return {
		...host,
		choices: host.choices.map((choice) =>
			choice.key === stored.key ? { ...choice, check: moved.check } : choice
		),
		onChanged: () => {
			move.clear();
			host.onChanged();
		},
		onReplace: (next) => {
			move.clear();
			host.onReplace(next);
		},
	};
}

interface CompareStepProps {
	accepted: ServedSettings;
	entry: CheckChoice;
	move: VersionMove;
	stored: CheckChoice;
}

/** The comparison of accepted settings with the newer version; continuing hands the merged settings to the move. */
function CompareStep({ accepted, entry, move, stored }: CompareStepProps) {
	const { check, integrationId } = entry;
	return (
		<VersionCompare
			newVersion={check.version}
			onCancel={move.cancel}
			onContinue={(choices) =>
				move.continueWith({
					check,
					draft: mergeVersionMove({
						accepted,
						choices,
						entry: check,
						integrationId,
					}),
				})
			}
			rows={compareBlocks({
				accepted,
				acceptedCheck: stored.check,
				entry: check,
				integrationId,
			})}
		/>
	);
}

interface StoredFormProps {
	/** The newer version's entry, when the pipeline offers one. */
	entry: CheckChoice | null;
	host: FormHost;
	stored: CheckChoice;
	/** True when the settings were stopped or discarded by someone else while the form holds unsaved edits. */
	superseded: boolean;
	view: HealthCriteriaResponse;
}

/**
 * The form for settings the claim already has, suggested or accepted. For
 * accepted settings whose check has a newer version, a person who can edit
 * can compare the two versions block by block and continue to the form with
 * the merged settings, which stay unsaved until the person saves.
 */
function StoredForm({
	entry,
	host,
	stored,
	superseded,
	view,
}: StoredFormProps) {
	const move = useVersionMove();
	const criteria = view.criteria;
	if (!criteria) {
		return null;
	}
	const accepted = criteria.state === "accepted";
	const { moved } = move;
	const offered =
		host.canEdit && accepted && view.check_offer === "newer-version"
			? entry
			: null;
	return (
		<>
			{move.comparing && offered && (
				<CompareStep
					accepted={criteria}
					entry={offered}
					move={move}
					stored={stored}
				/>
			)}
			<div hidden={move.comparing}>
				<CriteriaForm
					{...hostForMove(host, stored, move)}
					compare={
						offered && !moved
							? {
									buttonRef: move.opener,
									newVersion: offered.check.version,
									onOpen: move.open,
								}
							: null
					}
					initialCheck={moved?.check ?? stored.check}
					initialChoiceKey={stored.key}
					initialDraft={
						moved?.draft ??
						draftFromStored(criteria, stored.check, stored.integrationId)
					}
					key={moved ? "moved" : "stored"}
					move={
						moved
							? { version: moved.check.version, onCancel: move.clear }
							: undefined
					}
					revision={criteria.revision}
					state={accepted ? "accepted" : "suggested"}
					superseded={superseded}
					view={view}
				/>
			</div>
		</>
	);
}

export interface SettingsViewProps {
	/** True while the Settings view is showing; the case's check lists are fetched the first time it is. */
	active: boolean;
	canEdit: boolean;
	caseId: string;
	claimId: string;
	/** The claim's own text, shown above the settings so its wording can be read beside its numbers. */
	claimText?: string;
	criteria: ClaimScopedFetchResult<HealthCriteriaResponse | null>;
}

const FOCUSABLE =
	'button:not([disabled]), [role="combobox"]:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]';

/**
 * Moves focus into the region shown for a claim without settings, once, after
 * `request` was called and `ready` is true: to its first control, else to its
 * heading, else to the region itself. Stopping the use of settings removes
 * the button that opened the dialog, so focus would otherwise fall out of the
 * view.
 */
function useFocusAfterStop(ready: boolean) {
	const requested = useRef(false);
	const region = useRef<HTMLDivElement>(null);
	useEffect(() => {
		if (!(requested.current && ready)) {
			return;
		}
		requested.current = false;
		const target =
			region.current?.querySelector<HTMLElement>(FOCUSABLE) ??
			region.current?.querySelector<HTMLElement>("[data-settings-heading]") ??
			region.current;
		target?.focus();
	});
	return {
		region,
		request: () => {
			requested.current = true;
		},
	};
}

interface WithoutSettingsProps {
	canEdit: boolean;
	checks: CaseChecksState;
	choices: CheckChoice[];
	onPick: (choice: CheckChoice) => void;
	regionRef: RefObject<HTMLDivElement | null>;
	view: HealthCriteriaResponse;
}

/** What a claim without settings shows: the picker for a person who can edit, a heading saying there are none for one who cannot. */
function WithoutSettings({
	canEdit,
	checks,
	choices,
	onPick,
	regionRef,
	view,
}: WithoutSettingsProps) {
	return (
		<div className="space-y-3 outline-none" ref={regionRef} tabIndex={-1}>
			<StoppedNotice view={view} />
			{canEdit ? (
				<CheckPicker checks={checks} choices={choices} onPick={onPick} />
			) : (
				<h3
					className="font-normal text-sm outline-none"
					data-settings-heading
					tabIndex={-1}
				>
					No evidence settings for this claim.
				</h3>
			)}
		</div>
	);
}

/** The claim's text in a muted block, as text and wrapped; absent when the claim has none. */
function ClaimText({ text }: { text: string | undefined }) {
	const headingId = useId();
	if (!text?.trim()) {
		return null;
	}
	return (
		<section
			aria-labelledby={headingId}
			className="space-y-1 rounded-md border bg-muted/30 p-3"
			data-testid="health-claim-text"
		>
			<h3 className="font-medium text-muted-foreground text-xs" id={headingId}>
				Claim
			</h3>
			<p className="wrap-anywhere max-h-40 overflow-y-auto whitespace-pre-wrap text-muted-foreground text-sm">
				{text}
			</p>
		</section>
	);
}

/**
 * The Settings view of the Evidence tab: a check picker for a claim without
 * settings, the short view for a fresh pick with a usable recommendation or
 * for a suggestion, and the full form for accepted settings. A person
 * without edit rights sees the same settings with every control off.
 */
export function SettingsView(props: SettingsViewProps) {
	const { active, canEdit, caseId, criteria } = props;
	const [opened, setOpened] = useState(active);
	if (active && !opened) {
		setOpened(true);
	}
	const checks = useCaseChecks(caseId, opened && canEdit);
	const [unsaved, setUnsaved] = useState(false);
	const [lastView, setLastView] = useState<HealthCriteriaResponse | null>(null);
	if (
		criteria.status === "ready" &&
		criteria.data &&
		criteria.data !== lastView
	) {
		setLastView(criteria.data);
	}

	if (criteria.status === "loading") {
		return <Skeleton className="h-40 w-full rounded-md" />;
	}
	const failed = criteria.status === "error" || !criteria.data;
	const view = criteria.data ?? (unsaved ? lastView : null);
	if (!view) {
		return (
			<EmptyState
				icon={FileText}
				message="Could not load the evidence settings. Try reopening this element."
				title="Settings unavailable"
			/>
		);
	}
	return (
		<SettingsContent
			{...props}
			checks={checks}
			onUnsavedChange={setUnsaved}
			refreshFailed={failed}
			unsaved={unsaved}
			view={view}
		/>
	);
}

interface SettingsContentProps extends SettingsViewProps {
	checks: CaseChecksState;
	onUnsavedChange: (unsaved: boolean) => void;
	/** True when the last read of the settings failed and the view shows what was read before. */
	refreshFailed: boolean;
	/** True while a form holds changes that have not been saved. */
	unsaved: boolean;
	view: HealthCriteriaResponse;
}

interface StoredSettings {
	stored: CheckChoice;
	view: HealthCriteriaResponse;
}

/**
 * The stored settings the view shows. While the form holds unsaved edits,
 * settings that someone else has since stopped or discarded stay on screen
 * (`held`), so the edits are not lost.
 */
function useShownSettings(
	view: HealthCriteriaResponse,
	picked: CheckChoice | null,
	unsaved: boolean
) {
	const stored = storedChoice(view);
	const [lastStored, setLastStored] = useState<StoredSettings | null>(null);
	if (stored && lastStored?.view !== view) {
		setLastStored({ stored, view });
	}
	const held = !(picked || stored) && unsaved ? lastStored : null;
	return { held, shown: stored ? { stored, view } : held, stored };
}

interface HostInput {
	canEdit: boolean;
	choices: CheckChoice[];
	claimId: string;
	criteria: SettingsViewProps["criteria"];
	focusAfterStop: ReturnType<typeof useFocusAfterStop>;
	onUnsavedChange: (unsaved: boolean) => void;
	setPicked: (picked: CheckChoice | null) => void;
}

/** What the forms call back into: leaving a pick, reading again, showing the server's answer, and reporting unsaved edits. */
function hostOf({
	canEdit,
	choices,
	claimId,
	criteria,
	focusAfterStop,
	onUnsavedChange,
	setPicked,
}: HostInput): FormHost {
	return {
		canEdit,
		choices,
		claimId,
		onCancelNew: () => setPicked(null),
		onChanged: () => {
			// Only stopping the use of settings calls this; focus moves into the view once the read shows no settings.
			focusAfterStop.request();
			onUnsavedChange(false);
			setPicked(null);
			criteria.refetch();
		},
		onRefresh: () => {
			criteria.refetch();
		},
		onReplace: (next) => {
			onUnsavedChange(false);
			criteria.replace(next);
			setPicked(null);
		},
		onUnsavedChange,
	};
}

interface StoredBranchProps {
	entry: CheckChoice | null;
	/** True when the settings shown were stopped or discarded by someone else. */
	held: boolean;
	host: FormHost;
	shown: StoredSettings;
	view: HealthCriteriaResponse;
}

/** The form for stored settings, with who stopped them when someone else has since stopped them under unsaved edits. */
function StoredBranch({ entry, held, host, shown, view }: StoredBranchProps) {
	return (
		<>
			{held && <StoppedNotice view={view} />}
			<StoredForm
				entry={entry}
				host={host}
				stored={shown.stored}
				superseded={held}
				view={shown.view}
			/>
		</>
	);
}

/** The loaded Settings view: the claim's text, then the picker, the form for a fresh pick, or the form for stored settings. */
function SettingsContent({
	canEdit,
	checks,
	claimId,
	claimText,
	criteria,
	onUnsavedChange,
	refreshFailed,
	unsaved,
	view,
}: SettingsContentProps) {
	const [picked, setPicked] = useState<CheckChoice | null>(null);
	const { held, shown, stored } = useShownSettings(view, picked, unsaved);
	const choices = useMemo(() => {
		const live = choicesFrom(checks.lists);
		return stored
			? [stored, ...live.filter((choice) => choice.key !== stored.key)]
			: live;
	}, [checks.lists, stored]);
	const focusAfterStop = useFocusAfterStop(stored === null && held === null);

	const host = hostOf({
		canEdit,
		choices,
		claimId,
		criteria,
		focusAfterStop,
		onUnsavedChange,
		setPicked,
	});

	return (
		<div className="space-y-4">
			{refreshFailed && (
				<output className="wrap-anywhere block text-sm">
					The settings could not be refreshed.
				</output>
			)}
			<ClaimText text={claimText} />
			{picked && <PickedForm host={host} picked={picked} view={view} />}
			{!picked && shown && (
				<StoredBranch
					entry={stored ? newerVersionOf(view, checks.lists) : null}
					held={held !== null}
					host={host}
					shown={shown}
					view={view}
				/>
			)}
			{!(picked || shown) && (
				<WithoutSettings
					canEdit={canEdit}
					checks={checks}
					choices={choices}
					onPick={setPicked}
					regionRef={focusAfterStop.region}
					view={view}
				/>
			)}
		</div>
	);
}
