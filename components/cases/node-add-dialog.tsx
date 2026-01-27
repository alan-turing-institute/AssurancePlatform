"use client";

import { FileText, GitBranch, Scale } from "lucide-react";
import { useState } from "react";
import type { Node } from "reactflow";
import NewLinkForm from "@/components/common/new-link-form";
import type { NodeType } from "@/components/shared/nodes/node-config";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

type NodeAddDialogProps = {
	/** The ReactFlow node object */
	node: Node;
	/** The type of node */
	nodeType: NodeType;
	/** The type of element to create (strategy, claim, evidence) */
	elementType: string | null;
	/** Whether the dialog is open */
	open: boolean;
	/** Callback when open state changes */
	onOpenChange: (open: boolean) => void;
};

/** Get display label for element type */
function getElementLabel(elementType: string): string {
	switch (elementType) {
		case "strategy":
			return "Strategy";
		case "claim":
			return "Property Claim";
		case "evidence":
			return "Evidence";
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
		default:
			return null;
	}
}

/** Get display label for parent node type */
function getParentLabel(nodeType: NodeType): string {
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

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						{icon}
						Add {label}
					</DialogTitle>
					<DialogDescription>
						Create a new {label.toLowerCase()} as a child of this{" "}
						{parentLabel.toLowerCase()}.
					</DialogDescription>
				</DialogHeader>
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
			</DialogContent>
		</Dialog>
	);
}
