"use client";

import { useEffect, useState } from "react";
import type { Node } from "reactflow";
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
import { useCitedElementPicker } from "@/hooks/use-cited-element-picker";
import { createAssuranceCaseNode } from "@/lib/case";
import {
	buildCitedElementPayload,
	type CitedElementKind,
} from "@/lib/case/build-cited-element-payload";
import { recordCreate } from "@/lib/services/history-service";
import { toast } from "@/lib/toast";
import useStore from "@/store/store";

export type { CitedElementKind } from "@/lib/case/build-cited-element-payload";

export interface AddCitedElementFormProps {
	kind: CitedElementKind;
	node: Node;
	onClose: () => void;
}

const ENTITY_BY_KIND: Record<CitedElementKind, string> = {
	"away-goal": "awaygoals",
	module: "modules",
};
const LABEL_BY_KIND: Record<CitedElementKind, string> = {
	"away-goal": "Away Goal",
	module: "Module",
};

/**
 * The "Add away goal" / "Add module" two-step picker (ADR 0005 D7): first a
 * case the user can access (own or shared), then — for an away goal only —
 * a goal within it. Description prefills from the cited goal for an away
 * goal; both name and description stay editable. Fetching and selection
 * state live in `useCitedElementPicker`; the discriminated create payload
 * lives in `buildCitedElementPayload` — both extracted (review round 1) so
 * this component stays a thin presentational shell.
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
	const picker = useCitedElementPicker(kind);

	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [submitting, setSubmitting] = useState(false);

	const label = LABEL_BY_KIND[kind];
	const entity = ENTITY_BY_KIND[kind];

	// Prefill the description from the selected goal — editable afterwards.
	useEffect(() => {
		if (picker.selectedGoalDescription !== null) {
			setDescription(picker.selectedGoalDescription);
		}
	}, [picker.selectedGoalDescription]);

	const canSubmit =
		!(picker.casesLoading || submitting) &&
		(kind === "away-goal"
			? !!(picker.selectedCaseId && picker.selectedGoalId)
			: !!picker.selectedCaseId);

	const handleSubmit = async () => {
		if (!(canSubmit && assuranceCase)) {
			return;
		}
		setSubmitting(true);

		const payload = buildCitedElementPayload({
			kind,
			parentId: node.data.id as string,
			assuranceCaseId: assuranceCase.id,
			moduleReferenceId: picker.selectedCaseId,
			citedElementId: picker.selectedGoalId,
			name,
			description,
		});

		const result = await createAssuranceCaseNode(entity, payload, "");

		if (result.error) {
			toast({
				variant: "destructive",
				title: "Error",
				description: `Failed to create ${label.toLowerCase()}`,
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
					disabled={picker.casesLoading}
					onValueChange={picker.selectCase}
					value={picker.selectedCaseId}
				>
					<SelectTrigger id="cited-case">
						<SelectValue
							placeholder={
								picker.casesLoading ? "Loading cases…" : "Select a case"
							}
						/>
					</SelectTrigger>
					<SelectContent>
						{picker.cases.map((c) => (
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
						disabled={!picker.selectedCaseId || picker.goalsLoading}
						onValueChange={picker.selectGoal}
						value={picker.selectedGoalId}
					>
						<SelectTrigger id="cited-goal">
							<SelectValue
								placeholder={
									picker.goalsLoading ? "Loading goals…" : "Select a goal"
								}
							/>
						</SelectTrigger>
						<SelectContent>
							{picker.goals.map((g) => (
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
					{submitting ? "Adding…" : `Add ${label}`}
				</Button>
				<Button onClick={onClose} type="button" variant="outline">
					Cancel
				</Button>
			</DialogFooter>
		</div>
	);
}
