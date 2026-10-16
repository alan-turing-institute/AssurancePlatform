"use client";

import { useId } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { NodeOffer } from "./criteria-node-offer";

/** A piece of case text shown as text, wrapped and scrollable when long. */
function TextBlock({
	id,
	label,
	testId,
	text,
}: {
	id?: string;
	label?: string;
	testId?: string;
	text: string | null;
}) {
	return (
		<div className="min-w-0 space-y-0.5">
			{label && (
				<p className="font-medium text-muted-foreground text-xs">{label}</p>
			)}
			<p
				className="wrap-anywhere whitespace-pre-wrap rounded-md border bg-background p-2 text-sm"
				data-testid={testId}
				id={id}
			>
				{text ?? "The text could not be read."}
			</p>
		</div>
	);
}

interface NodeOptionsProps {
	addTicked: boolean;
	disabled: boolean;
	offer: NodeOffer;
	onAddChange: (ticked: boolean) => void;
	onUpdateChange: (ticked: boolean) => void;
	updateTicked: boolean;
}

/**
 * The evidence node's part of the accept and save step. An acceptance with no
 * node in place offers to add one, with the whole text it will carry and no
 * identifier, because the number is chosen when the node is saved. An
 * acceptance that reuses a live node says which node results will show on. A
 * live node whose text names another check than the one chosen is offered an
 * update, with the text now and the text after side by side.
 */
export function NodeOptions({
	addTicked,
	disabled,
	offer,
	onAddChange,
	onUpdateChange,
	updateTicked,
}: NodeOptionsProps) {
	const addId = useId();
	const addTextId = useId();
	const updateId = useId();
	const { add, node, update } = offer;
	const nodeName = update?.name ?? node?.name;

	return (
		<section
			aria-label="Evidence node"
			className="space-y-3 rounded-md border bg-muted/30 p-3"
			data-testid="health-node-options"
		>
			{add && (
				<div className="space-y-2">
					<div className="flex items-start gap-2">
						<Checkbox
							aria-describedby={addTextId}
							checked={addTicked}
							className="mt-0.5"
							disabled={disabled}
							id={addId}
							onCheckedChange={(checked) => onAddChange(checked === true)}
						/>
						<Label className="wrap-anywhere leading-snug" htmlFor={addId}>
							Add an evidence node under this claim
						</Label>
					</div>
					<TextBlock
						id={addTextId}
						testId="health-node-new-text"
						text={add.text}
					/>
				</div>
			)}
			{node && (
				<p className="wrap-anywhere text-sm" data-testid="health-node-reused">
					Results will show on evidence node {node.name ?? "under this claim"}.
				</p>
			)}
			{update && (
				<div className="space-y-2">
					<div className="flex items-start gap-2">
						<Checkbox
							checked={updateTicked}
							className="mt-0.5"
							disabled={disabled}
							id={updateId}
							onCheckedChange={(checked) => onUpdateChange(checked === true)}
						/>
						<Label className="wrap-anywhere leading-snug" htmlFor={updateId}>
							{`Update ${nodeName ?? "the evidence node"}'s text to name the new check`}
						</Label>
					</div>
					<div className="grid gap-2 sm:grid-cols-2">
						<TextBlock
							label="Now"
							testId="health-node-old-text"
							text={update.before}
						/>
						<TextBlock
							label="After"
							testId="health-node-after-text"
							text={update.after}
						/>
					</div>
				</div>
			)}
		</section>
	);
}
