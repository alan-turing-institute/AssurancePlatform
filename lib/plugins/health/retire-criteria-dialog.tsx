"use client";

import { type RefObject, useId, useState } from "react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { HealthActionDialog } from "./health-action-dialog";

type NodeChoice = "keep" | "remove";

interface RetireCriteriaDialogProps {
	claimId: string;
	/** The claim's live evidence node. When present the dialog asks what to do with it, and sends the answer. */
	liveNode?: { name: string | null } | null;
	onDone: () => void;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	returnFocusTo?: RefObject<HTMLElement | null>;
}

/** The request's body: the reason, and the answer about the node when the question was asked. */
function retirementBody(
	reason: string,
	choice: NodeChoice | ""
): Record<string, string> {
	return choice === "" ? { reason } : { reason, evidence_node: choice };
}

/** The question about the live node, with neither answer chosen in advance. */
function NodeQuestion({
	choice,
	name,
	onChange,
}: {
	choice: NodeChoice | "";
	name: string;
	onChange: (choice: NodeChoice) => void;
}) {
	const idPrefix = useId();
	const removeId = `${idPrefix}-remove`;
	const keepId = `${idPrefix}-keep`;
	return (
		<fieldset className="space-y-2" data-testid="health-retire-node-choice">
			<legend className="font-medium text-sm">
				What should happen to evidence node {name}?
			</legend>
			<RadioGroup
				onValueChange={(value) =>
					onChange(value === "remove" ? "remove" : "keep")
				}
				required
				value={choice}
			>
				<div className="flex items-start gap-2">
					<RadioGroupItem className="mt-0.5" id={removeId} value="remove" />
					<Label className="wrap-anywhere leading-snug" htmlFor={removeId}>
						{`Remove ${name}`}
						<span className="block font-normal text-muted-foreground text-xs">
							It is taken off this claim and moved to the trash, unless it also
							supports another claim. From the trash it can be restored as
							ordinary evidence.
						</span>
					</Label>
				</div>
				<div className="flex items-start gap-2">
					<RadioGroupItem className="mt-0.5" id={keepId} value="keep" />
					<Label className="wrap-anywhere leading-snug" htmlFor={keepId}>
						{`Keep ${name} as ordinary evidence`}
						<span className="block font-normal text-muted-foreground text-xs">
							It stays under this claim and no longer shows results. If the
							settings are accepted again, it shows them again.
						</span>
					</Label>
				</div>
			</RadioGroup>
		</fieldset>
	);
}

/**
 * Stops the use of a claim's accepted settings, with a required reason. When
 * the claim has a live evidence node, the dialog also asks whether to remove
 * it or keep it, with neither chosen in advance, and always sends the answer.
 * A claim without a live node is not asked.
 */
export function RetireCriteriaDialog({
	claimId,
	liveNode = null,
	onDone,
	onOpenChange,
	open,
	returnFocusTo,
}: RetireCriteriaDialogProps) {
	const [choice, setChoice] = useState<NodeChoice | "">("");
	const asksAboutNode = liveNode !== null;

	return (
		<HealthActionDialog
			buildRequest={(reason) => ({
				method: "POST",
				url: `/api/elements/${claimId}/health/criteria/retirement`,
				body: retirementBody(reason, asksAboutNode ? choice : ""),
			})}
			description="The pipeline will no longer find these settings, and results that arrive afterwards are shown as having no accepted settings. The settings stay in the claim's history."
			failureTitle="Could not stop using the settings"
			fieldsValid={!asksAboutNode || choice !== ""}
			onDone={onDone}
			onOpenChange={(next) => {
				if (!next) {
					setChoice("");
				}
				onOpenChange(next);
			}}
			open={open}
			returnFocusTo={returnFocusTo}
			submitLabel="Stop using these settings"
			submitVariant="destructive"
			title="Stop using these settings"
		>
			{asksAboutNode && (
				<NodeQuestion
					choice={choice}
					name={liveNode.name ?? "under this claim"}
					onChange={setChoice}
				/>
			)}
		</HealthActionDialog>
	);
}
