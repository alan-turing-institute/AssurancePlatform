"use client";

import { useEffect, useState } from "react";
import {
	type CitableCaseSummary,
	type CitableGoalSummary,
	listCitableCases,
	listCitableGoals,
} from "@/actions/cited-element-picker";
import type { CitedElementKind } from "@/lib/case/build-cited-element-payload";
import { toast } from "@/lib/toast";

export interface CitedElementPicker {
	cases: CitableCaseSummary[];
	casesLoading: boolean;
	goals: CitableGoalSummary[];
	goalsLoading: boolean;
	selectCase: (caseId: string) => void;
	selectedCaseId: string;
	/** The selected goal's own description — callers use it to prefill their own description field. `null` while nothing (or no matching goal) is selected. */
	selectedGoalDescription: string | null;
	selectedGoalId: string;
	selectGoal: (goalId: string) => void;
}

/**
 * Fetches the cases (and, for an away goal, the goals within the selected
 * case) the "Add away goal" / "Add module" picker offers (ADR 0005 D7), and
 * owns the two-step selection state. Selecting a different case always
 * clears any previously selected goal — a goal id from case A means nothing
 * once case B is selected. Extracted from `add-cited-element-form.tsx`
 * (review round 1) so the fetching/selection logic is unit-testable without
 * rendering the form.
 */
export function useCitedElementPicker(
	kind: CitedElementKind
): CitedElementPicker {
	const [cases, setCases] = useState<CitableCaseSummary[]>([]);
	const [casesLoading, setCasesLoading] = useState(true);
	const [selectedCaseId, setSelectedCaseId] = useState("");

	const [goals, setGoals] = useState<CitableGoalSummary[]>([]);
	const [goalsLoading, setGoalsLoading] = useState(false);
	const [selectedGoalId, setSelectedGoalId] = useState("");

	useEffect(() => {
		let cancelled = false;
		listCitableCases().then((result) => {
			if (cancelled) {
				return;
			}
			setCasesLoading(false);
			if (result.success) {
				setCases(result.data);
			} else {
				toast({
					variant: "destructive",
					title: "Error",
					description: "Failed to load cases",
				});
			}
		});
		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		setSelectedGoalId("");
		setGoals([]);
		if (kind !== "away-goal" || !selectedCaseId) {
			return;
		}
		let cancelled = false;
		setGoalsLoading(true);
		listCitableGoals(selectedCaseId).then((result) => {
			if (cancelled) {
				return;
			}
			setGoalsLoading(false);
			if (result.success) {
				setGoals(result.data);
			} else {
				toast({
					variant: "destructive",
					title: "Error",
					description: "Failed to load goals",
				});
			}
		});
		return () => {
			cancelled = true;
		};
	}, [kind, selectedCaseId]);

	const selectedGoal = goals.find((g) => g.id === selectedGoalId);

	return {
		cases,
		casesLoading,
		goals,
		goalsLoading,
		selectedCaseId,
		selectedGoalId,
		selectCase: setSelectedCaseId,
		selectGoal: setSelectedGoalId,
		selectedGoalDescription: selectedGoal?.description ?? null,
	};
}
