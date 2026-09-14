"use client";

import { useEffect, useState } from "react";
import type { Node } from "reactflow";
import {
	type CitableCaseSummary,
	type CitableGoalSummary,
	listCitableCases,
	listCitableGoals,
} from "@/actions/cited-element-picker";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createAssuranceCaseNode } from "@/lib/case";
import { recordCreate } from "@/lib/services/history-service";
import { toast } from "@/lib/toast";
import useStore from "@/store/store";

export type CitedElementKind = "away-goal" | "module";

export interface AddCitedElementFormProps {
	kind: CitedElementKind;
	node: Node;
	onClose: () => void;
}

/**
 * The "Add away goal" / "Add module" two-step picker (ADR 0005 D7): first a
 * case the user can access (own or shared), then — for an away goal only —
 * a goal within it. Description prefills from the cited goal for an away
 * goal; both name and description stay editable.
 *
 * Creation relies on the existing SSE-driven case refetch (`element:created`,
 * `use-case-events.ts`) rather than local optimistic tree splicing — the
 * same path a strategy created under a property claim already relies on
 * (see the equivalent comment in `use-new-link-form.ts`), because away
 * goals and modules would otherwise need their own nested-array splicer for
 * every position PROPERTY_CLAIM is admitted.
 */
export default function AddCitedElementForm({
	kind,
	node,
	onClose,
}: AddCitedElementFormProps) {
	const { assuranceCase } = useStore();

	const [cases, setCases] = useState<CitableCaseSummary[]>([]);
	const [casesLoading, setCasesLoading] = useState(true);
	const [selectedCaseId, setSelectedCaseId] = useState("");

	const [goals, setGoals] = useState<CitableGoalSummary[]>([]);
	const [goalsLoading, setGoalsLoading] = useState(false);
	const [selectedGoalId, setSelectedGoalId] = useState("");

	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [submitting, setSubmitting] = useState(false);

	const label = kind === "away-goal" ? "away goal" : "module";
	const entity = kind === "away-goal" ? "awaygoals" : "modules";

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

	const handleGoalChange = (goalId: string) => {
		setSelectedGoalId(goalId);
		const goal = goals.find((g) => g.id === goalId);
		if (goal) {
			setDescription(goal.description);
		}
	};

	const canSubmit =
		!(casesLoading || submitting) &&
		(kind === "away-goal"
			? !!(selectedCaseId && selectedGoalId)
			: !!selectedCaseId);

	const handleSubmit = async () => {
		if (!(canSubmit && assuranceCase)) {
			return;
		}
		setSubmitting(true);

		const payload = {
			description,
			name: name.trim() || undefined,
			parentId: node.data.id as string,
			assuranceCaseId: assuranceCase.id,
			moduleReferenceId: selectedCaseId,
			...(kind === "away-goal"
				? { citedElementId: selectedGoalId }
				: // Required for MODULE at the Prisma validation layer. "COPY"
					// (a snapshot, not a live link) is the safer default absent
					// any UI for choosing embed type in 1.0.
					{ moduleEmbedType: "COPY" as const }),
		};

		const result = await createAssuranceCaseNode(entity, payload, "");

		if (result.error) {
			toast({
				variant: "destructive",
				title: "Error",
				description: `Failed to create ${label}`,
			});
			setSubmitting(false);
			return;
		}

		if (result.data) {
			recordCreate(
				result.data.id as string | number,
				kind === "away-goal" ? "away_goal" : "module",
				result.data as Record<string, unknown>
			);
		}

		setSubmitting(false);
		onClose();
	};

	return (
		<div className="space-y-4">
			<div className="space-y-2">
				<Label htmlFor="cited-case">Case</Label>
				<Select
					disabled={casesLoading}
					onValueChange={setSelectedCaseId}
					value={selectedCaseId}
				>
					<SelectTrigger id="cited-case">
						<SelectValue
							placeholder={casesLoading ? "Loading cases…" : "Select a case"}
						/>
					</SelectTrigger>
					<SelectContent>
						{cases.map((c) => (
							<SelectItem key={c.id} value={c.id}>
								{c.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			{kind === "away-goal" && (
				<div className="space-y-2">
					<Label htmlFor="cited-goal">Goal</Label>
					<Select
						disabled={!selectedCaseId || goalsLoading}
						onValueChange={handleGoalChange}
						value={selectedGoalId}
					>
						<SelectTrigger id="cited-goal">
							<SelectValue
								placeholder={goalsLoading ? "Loading goals…" : "Select a goal"}
							/>
						</SelectTrigger>
						<SelectContent>
							{goals.map((g) => (
								<SelectItem key={g.id} value={g.id}>
									{g.name || g.id}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			)}

			<div className="space-y-2">
				<Label htmlFor="cited-name">Name (optional)</Label>
				<Input
					id="cited-name"
					onChange={(e) => setName(e.target.value)}
					placeholder="Leave blank to auto-generate"
					value={name}
				/>
			</div>

			<div className="space-y-2">
				<Label htmlFor="cited-description">Description</Label>
				<Textarea
					id="cited-description"
					onChange={(e) => setDescription(e.target.value)}
					placeholder="Type your description here."
					value={description}
				/>
			</div>

			<DialogFooter className="pt-2">
				<Button
					className="bg-primary text-primary-foreground hover:bg-primary/90"
					disabled={!canSubmit}
					onClick={handleSubmit}
					type="button"
				>
					{submitting
						? "Adding…"
						: `Add ${label === "away goal" ? "Away Goal" : "Module"}`}
				</Button>
				<Button onClick={onClose} type="button" variant="outline">
					Cancel
				</Button>
			</DialogFooter>
		</div>
	);
}
