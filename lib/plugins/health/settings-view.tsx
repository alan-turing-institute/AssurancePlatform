"use client";

import { FileText } from "lucide-react";
import {
	type ReactNode,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { HealthCheck } from "@/lib/schemas/health-checks";
import { VersionCompare } from "./criteria-compare";
import {
	type CriteriaDraft,
	draftFromCheck,
	draftFromStored,
	recommendationIsUsable,
} from "./criteria-draft";
import {
	CriteriaForm,
	type CriteriaFormProps,
	type PendingMove,
} from "./criteria-form";
import { StoppedNotice } from "./criteria-notices";
import { type CheckChoice, CheckSelect } from "./criteria-sections";
import { compareBlocks, mergeVersionMove } from "./criteria-version-move";
import type {
	HealthCheckListOffer,
	HealthCriteriaResponse,
} from "./health-types";
import type { ClaimScopedFetchResult } from "./use-claim-scoped-fetch";
import { type CaseChecksState, useCaseChecks } from "./use-criteria";

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
	"canEdit" | "choices" | "claimId" | "onCancelNew" | "onChanged" | "onReplace"
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
				revision={null}
				startShort={recommendationIsUsable(picked.check, picked.integrationId)}
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

interface MovedSettings {
	check: HealthCheck;
	draft: CriteriaDraft;
}

interface StoredFormProps {
	/** The newer version's entry, when the pipeline offers one. */
	entry: CheckChoice | null;
	host: FormHost;
	stored: CheckChoice;
	view: HealthCriteriaResponse;
}

/**
 * The form for settings the claim already has, suggested or accepted. For
 * accepted settings whose check has a newer version, a person who can edit
 * can compare the two versions block by block and continue to the form with
 * the merged settings, which stay unsaved until the person saves.
 */
function StoredForm({ entry, host, stored, view }: StoredFormProps) {
	const [comparing, setComparing] = useState(false);
	const [moved, setMoved] = useState<MovedSettings | null>(null);
	const criteria = view.criteria;
	if (!criteria) {
		return null;
	}
	const accepted = criteria.state === "accepted";
	const move: PendingMove | undefined = moved
		? { version: moved.check.version, onCancel: () => setMoved(null) }
		: undefined;
	const offered =
		host.canEdit && accepted && view.check_offer === "newer-version"
			? entry
			: null;
	const formHost: FormHost = moved
		? {
				...host,
				choices: host.choices.map((choice) =>
					choice.key === stored.key ? { ...choice, check: moved.check } : choice
				),
				onChanged: () => {
					setMoved(null);
					host.onChanged();
				},
				onReplace: (next) => {
					setMoved(null);
					host.onReplace(next);
				},
			}
		: host;
	return (
		<>
			{comparing && offered && (
				<VersionCompare
					newVersion={offered.check.version}
					onCancel={() => setComparing(false)}
					onContinue={(choices) => {
						setMoved({
							check: offered.check,
							draft: mergeVersionMove({
								accepted: criteria,
								choices,
								entry: offered.check,
								integrationId: offered.integrationId,
							}),
						});
						setComparing(false);
					}}
					rows={compareBlocks({
						accepted: criteria,
						acceptedCheck: stored.check,
						entry: offered.check,
						integrationId: offered.integrationId,
					})}
				/>
			)}
			<div hidden={comparing}>
				<CriteriaForm
					{...formHost}
					compare={
						offered && !moved
							? {
									newVersion: offered.check.version,
									onOpen: () => setComparing(true),
								}
							: null
					}
					initialCheck={moved ? moved.check : stored.check}
					initialChoiceKey={stored.key}
					initialDraft={
						moved
							? moved.draft
							: draftFromStored(criteria, stored.check, stored.integrationId)
					}
					key={moved ? "moved" : "stored"}
					move={move}
					revision={criteria.revision}
					startShort={criteria.state === "suggested"}
					state={accepted ? "accepted" : "suggested"}
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
export function SettingsView({
	active,
	canEdit,
	caseId,
	claimId,
	claimText,
	criteria,
}: SettingsViewProps) {
	const [opened, setOpened] = useState(active);
	if (active && !opened) {
		setOpened(true);
	}
	const checks = useCaseChecks(caseId, opened && canEdit);
	const [picked, setPicked] = useState<CheckChoice | null>(null);
	const view = criteria.data;
	const stored = storedChoice(view);
	const choices = useMemo(() => {
		const live = choicesFrom(checks.lists);
		return stored
			? [stored, ...live.filter((choice) => choice.key !== stored.key)]
			: live;
	}, [checks.lists, stored]);
	const focusAfterStop = useRef(false);
	const withoutSettings = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!focusAfterStop.current || stored || criteria.status !== "ready") {
			return;
		}
		focusAfterStop.current = false;
		const region = withoutSettings.current;
		(
			region?.querySelector<HTMLElement>(FOCUSABLE) ??
			region?.querySelector<HTMLElement>("[data-settings-heading]") ??
			region
		)?.focus();
	});

	if (criteria.status === "loading") {
		return <Skeleton className="h-40 w-full rounded-md" />;
	}
	if (criteria.status === "error" || !view) {
		return (
			<EmptyState
				icon={FileText}
				message="Could not load the evidence settings. Try reopening this element."
				title="Settings unavailable"
			/>
		);
	}

	const host: FormHost = {
		canEdit,
		choices,
		claimId,
		onCancelNew: () => setPicked(null),
		onChanged: () => {
			// Only stopping the use of settings calls this; focus moves into the view once the read shows no settings.
			focusAfterStop.current = true;
			setPicked(null);
			criteria.refetch();
		},
		onReplace: (next) => {
			criteria.replace(next);
			setPicked(null);
		},
	};

	let body: ReactNode;
	if (picked) {
		body = <PickedForm host={host} picked={picked} view={view} />;
	} else if (stored) {
		body = (
			<StoredForm
				entry={newerVersionOf(view, checks.lists)}
				host={host}
				stored={stored}
				view={view}
			/>
		);
	} else {
		body = (
			<div
				className="space-y-3 outline-none"
				ref={withoutSettings}
				tabIndex={-1}
			>
				<StoppedNotice view={view} />
				{canEdit ? (
					<CheckPicker checks={checks} choices={choices} onPick={setPicked} />
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
	return (
		<div className="space-y-4">
			<ClaimText text={claimText} />
			{body}
		</div>
	);
}
