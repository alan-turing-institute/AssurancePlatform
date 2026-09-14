"use client";

import {
	ArrowUpRight,
	FileText,
	GitBranch,
	Package,
	Scale,
	ShieldAlert,
} from "lucide-react";
import { useState } from "react";
import type { Node } from "reactflow";
import AddCitedElementForm, {
	type CitedElementKind,
} from "@/components/cases/add-cited-element-form";
import NewLinkForm from "@/components/cases/new-link-form";
import type { DiagramNodeType } from "@/components/shared/nodes/node-config";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

interface NodeAddDialogProps {
	/** The type of element to create (strategy, claim, evidence, defeater, away-goal, module) */
	elementType: string | null;
	/** The ReactFlow node object */
	node: Node;
	/** The type of node */
	nodeType: DiagramNodeType;
	/** Callback when open state changes */
	onOpenChange: (open: boolean) => void;
	/** Whether the dialog is open */
	open: boolean;
}

/** Get display label for element type */
function getElementLabel(elementType: string): string {
	switch (elementType) {
		case "strategy":
			return "Strategy";
		case "claim":
			return "Property Claim";
		case "evidence":
			return "Evidence";
		case "defeater":
			return "Defeater";
		case "away-goal":
			return "Away Goal";
		case "module":
			return "Module";
		default:
			return "Element";
	}
}

/** Get icon for element type */
function getElementIcon(elementType: string): React.ReactNode {
	switch (elementType) {
		case "strategy":
			return <GitBranch className="h-5 w-5 text-muted-foreground" />;
		case "claim":
			return <Scale className="h-5 w-5 text-muted-foreground" />;
		case "evidence":
			return <FileText className="h-5 w-5 text-muted-foreground" />;
		case "defeater":
			return <ShieldAlert className="h-5 w-5 text-muted-foreground" />;
		case "away-goal":
			return <ArrowUpRight className="h-5 w-5 text-muted-foreground" />;
		case "module":
			return <Package className="h-5 w-5 text-muted-foreground" />;
		default:
			return null;
	}
}

/** Whether `elementType` is created through the cited-element picker rather than `NewLinkForm`. */
function isCitedElementKind(
	elementType: string
): elementType is CitedElementKind {
	return elementType === "away-goal" || elementType === "module";
}

/** Dialog description text, per element type. */
function getDialogDescription(
	elementType: string,
	label: string,
	parentLabel: string
): string {
	if (isCitedElementKind(elementType)) {
		const goalClause =
			elementType === "away-goal" ? " and a goal within it" : "";
		return `Cite a case${goalClause} to add as a child of this ${parentLabel.toLowerCase()}.`;
	}
	if (elementType === "defeater") {
		return `Create a counter-claim that challenges this ${parentLabel.toLowerCase()}.`;
	}
	return `Create a new ${label.toLowerCase()} as a child of this ${parentLabel.toLowerCase()}.`;
}

/** Get display label for parent node type */
function getParentLabel(nodeType: DiagramNodeType): string {
	switch (nodeType) {
		case "goal":
			return "Goal";
		case "strategy":
			return "Strategy";
		default:
			return "Property Claim";
	}
}

/**
 * NodeAddDialog - Dialog modal for creating new child elements
 *
 * Displays a form for creating new elements based on the selected type.
 */
export default function NodeAddDialog({
	node,
	nodeType,
	elementType,
	open,
	onOpenChange,
}: NodeAddDialogProps) {
	const [_unresolvedChanges, setUnresolvedChanges] = useState(false);

	const handleClose = () => {
		setUnresolvedChanges(false);
		onOpenChange(false);
	};

	if (!elementType) {
		return null;
	}

	const label = getElementLabel(elementType);
	const icon = getElementIcon(elementType);
	const parentLabel = getParentLabel(nodeType);
	const description = getDialogDescription(elementType, label, parentLabel);

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						{icon}
						Add {label}
					</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				{isCitedElementKind(elementType) ? (
					<AddCitedElementForm
						kind={elementType}
						node={node}
						onClose={handleClose}
					/>
				) : (
					<NewLinkForm
						actions={{
							setSelectedLink: () => {
								// No-op: managed by dialog state
							},
							setLinkToCreate: () => {
								// No-op: managed by dialog state
							},
							handleClose,
						}}
						linkType={elementType}
						node={node}
						setUnresolvedChanges={setUnresolvedChanges}
					/>
				)}
			</DialogContent>
		</Dialog>
	);
}
