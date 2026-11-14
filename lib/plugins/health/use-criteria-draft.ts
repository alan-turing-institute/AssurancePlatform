"use client";

import { useEffect, useMemo, useState } from "react";
import type { HealthCheck } from "@/lib/schemas/health-checks";
import {
	analyseDraft,
	type CriteriaDraft,
	draftFromCheck,
	draftFromStored,
	draftsEqual,
	friendlyMessage,
} from "./criteria-draft";
import { plainWords } from "./criteria-plain-words";
import type { CheckChoice } from "./criteria-sections";
import type { HealthCriteriaResponse } from "./health-types";

interface UseCriteriaDraftOptions {
	choices: CheckChoice[];
	initialCheck: HealthCheck;
	initialChoiceKey: string;
	initialDraft: CriteriaDraft;
	/** Told whether the form holds unsaved changes, and that it holds none once it is gone. */
	onUnsavedChange?: ((unsaved: boolean) => void) | undefined;
	/** The stored revision the values were taken from; null for a check that has not been saved. */
	revision: number | null;
	/** True when the initial draft is itself an unsaved change, such as settings moved to a new check version. */
	unsaved?: boolean;
}

/**
 * The settings form's value and what is known about it: the draft being
 * edited, whether it differs from what is stored, the problems the shared
 * checks find in it, and the plain-words summary. A refetch never replaces a
 * draft with unsaved changes; when the stored revision moves under one,
 * `changedElsewhere` is true until the person reloads.
 */
export function useCriteriaDraft({
	choices,
	initialCheck,
	initialChoiceKey,
	initialDraft,
	onUnsavedChange,
	revision,
	unsaved = false,
}: UseCriteriaDraftOptions) {
	const [stillUnsaved, setStillUnsaved] = useState(unsaved);
	const [draft, setDraftState] = useState(initialDraft);
	const [baseline, setBaseline] = useState(initialDraft);
	const [baseRevision, setBaseRevision] = useState(revision);
	const [chosenKey, setChosenKey] = useState(initialChoiceKey);
	const [serverErrors, setServerErrors] = useState<Record<string, string>>({});

	const dirty = stillUnsaved || !draftsEqual(draft, baseline);
	useEffect(() => {
		onUnsavedChange?.(dirty);
		return () => onUnsavedChange?.(false);
	}, [dirty, onUnsavedChange]);
	if (revision !== baseRevision && !dirty) {
		setDraftState(initialDraft);
		setBaseline(initialDraft);
		setBaseRevision(revision);
		setChosenKey(initialChoiceKey);
	}

	const listed = choices.find((choice) => choice.key === chosenKey)?.check;
	const check =
		chosenKey === initialChoiceKey ? initialCheck : (listed ?? initialCheck);
	const analysis = useMemo(() => analyseDraft(draft, check), [draft, check]);
	const errors = useMemo(
		() =>
			Object.fromEntries(
				Object.entries({ ...serverErrors, ...analysis.errors }).map(
					([path, message]) => [path, friendlyMessage(path, message)]
				)
			),
		[serverErrors, analysis.errors]
	);
	const sentences = useMemo(
		() => plainWords(analysis.settings, check),
		[analysis.settings, check]
	);

	const reload = () => {
		setDraftState(initialDraft);
		setBaseline(initialDraft);
		setBaseRevision(revision);
		setChosenKey(initialChoiceKey);
	};

	return {
		analysis,
		baseRevision,
		changedElsewhere: revision !== baseRevision,
		check,
		dirty,
		draft,
		draftKey: chosenKey,
		errors,
		hasProblems: Object.keys(analysis.errors).length > 0,
		onPick: (key: string) => {
			const choice = choices.find((candidate) => candidate.key === key);
			if (choice) {
				setChosenKey(key);
				setDraftState(draftFromCheck(choice.check, choice.integrationId));
				setServerErrors({});
			}
		},
		reload,
		resetToStored: () => {
			setDraftState(baseline);
			setChosenKey(initialChoiceKey);
			setServerErrors({});
		},
		saved: (view: HealthCriteriaResponse) => {
			const stored = view.criteria;
			const shown =
				stored && stored.state !== "inactive"
					? draftFromStored(
							stored,
							view.check_description ?? check,
							view.integration?.id ?? draft.integrationId
						)
					: draft;
			setDraftState(shown);
			setBaseline(shown);
			setBaseRevision(stored?.revision ?? null);
			setStillUnsaved(false);
		},
		sentences,
		setDraft: (patch: Partial<CriteriaDraft>) => {
			setDraftState((current) => ({ ...current, ...patch }));
			setServerErrors({});
		},
		setServerErrors,
	};
}
