"use client";

import { FileText } from "lucide-react";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
	draftFromCheck,
	draftFromStored,
	recommendationIsUsable,
} from "./criteria-draft";
import { CriteriaForm, type CriteriaFormProps } from "./criteria-form";
import { StoppedNotice } from "./criteria-notices";
import { type CheckChoice, CheckSelect } from "./criteria-sections";
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

/** The form for settings the claim already has, suggested or accepted. */
function StoredForm({
	host,
	stored,
	view,
}: {
	host: FormHost;
	stored: CheckChoice;
	view: HealthCriteriaResponse;
}) {
	const criteria = view.criteria;
	if (!criteria) {
		return null;
	}
	return (
		<CriteriaForm
			{...host}
			initialCheck={stored.check}
			initialChoiceKey={stored.key}
			initialDraft={draftFromStored(
				criteria,
				stored.check,
				stored.integrationId
			)}
			key="stored"
			revision={criteria.revision}
			startShort={criteria.state === "suggested"}
			state={criteria.state === "accepted" ? "accepted" : "suggested"}
			view={view}
		/>
	);
}

export interface SettingsViewProps {
	/** True while the Settings view is showing; the case's check lists are fetched the first time it is. */
	active: boolean;
	canEdit: boolean;
	caseId: string;
	claimId: string;
	criteria: ClaimScopedFetchResult<HealthCriteriaResponse | null>;
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
			setPicked(null);
			criteria.refetch();
		},
		onReplace: (next) => {
			criteria.replace(next);
			setPicked(null);
		},
	};

	if (picked) {
		return <PickedForm host={host} picked={picked} view={view} />;
	}
	if (stored) {
		return <StoredForm host={host} stored={stored} view={view} />;
	}
	return (
		<div className="space-y-3">
			<StoppedNotice view={view} />
			{canEdit ? (
				<CheckPicker checks={checks} choices={choices} onPick={setPicked} />
			) : (
				<p className="text-sm">No evidence settings for this claim.</p>
			)}
		</div>
	);
}
