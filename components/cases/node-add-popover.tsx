"use client";

import { FileText, GitBranch, Scale } from "lucide-react";
import { useState } from "react";
import type { Node } from "reactflow";
import type { DiagramNodeType } from "@/components/shared/nodes/node-config";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverAnchor,
	PopoverContent,
} from "@/components/ui/popover";
import NodeAddDialog from "./node-add-dialog";

interface NodeAddPopoverProps {
	/** The trigger element (children) */
	children: React.ReactNode;
	/** The ReactFlow node object */
	node: Node;
	/** The type of node */
	nodeType: DiagramNodeType;
	/** Callback when open state changes */
	onOpenChange: (open: boolean) => void;
	/** Whether the popover is open */
	open: boolean;
}

interface AddOption {
	icon: React.ReactNode;
	label: string;
	type: string;
}

/**
 * Get the available add options based on node type
 */
function getAddOptions(nodeType: DiagramNodeType): AddOption[] {
	switch (nodeType) {
		case "goal":
			return [
				{
					type: "strategy",
					label: "Add Strategy",
					icon: <GitBranch className="h-4 w-4" />,
				},
				{
					type: "claim",
					label: "Add Property Claim",
					icon: <Scale className="h-4 w-4" />,
				},
			];
		case "strategy":
			return [
				{
					type: "claim",
					label: "Add Property Claim",
					icon: <Scale className="h-4 w-4" />,
				},
			];
		case "property":
			return [
				{
					type: "claim",
					label: "Add Property Claim",
					icon: <Scale className="h-4 w-4" />,
				},
				{
					type: "evidence",
					label: "Add Evidence",
					icon: <FileText className="h-4 w-4" />,
				},
			];
		default:
			return [];
	}
}

/**
 * NodeAddPopover - Contextual popover for adding child elements
 *
 * Shows different options based on node type:
 * - Goal: Add Strategy, Add Property Claim
 * - Strategy: Add Property Claim
 * - Property: Add Property Claim, Add Evidence
 * - Evidence: (no add options)
 *
 * When an option is selected, the popover closes and a dialog opens
 * with the form for creating the new element.
 */
export default function NodeAddPopover({
	node,
	nodeType,
	open,
	onOpenChange,
	children,
}: NodeAddPopoverProps) {
	const [dialogOpen, setDialogOpen] = useState(false);
	const [selectedElementType, setSelectedElementType] = useState<string | null>(
		null
	);

	const options = getAddOptions(nodeType);

	const handleOptionClick = (type: string) => {
		// Close the popover and open the dialog
		onOpenChange(false);
		setSelectedElementType(type);
		setDialogOpen(true);
	};

	const handleDialogClose = (isOpen: boolean) => {
		setDialogOpen(isOpen);
		if (!isOpen) {
			setSelectedElementType(null);
		}
	};

	// If no options, don't render
	if (options.length === 0) {
		return <>{children}</>;
	}

	return (
		<>
			<Popover onOpenChange={onOpenChange} open={open}>
				<PopoverAnchor className="inline-flex">{children}</PopoverAnchor>
				<PopoverContent align="start" className="w-56 p-2" side="top">
					<div className="flex flex-col gap-1">
						<p className="mb-1 px-2 font-medium text-muted-foreground text-xs uppercase tracking-wider">
							Add Element
						</p>
						{options.map((option) => (
							<Button
								className="w-full justify-start gap-2"
								key={option.type}
								onClick={() => handleOptionClick(option.type)}
								variant="ghost"
							>
								{option.icon}
								{option.label}
							</Button>
						))}
					</div>
				</PopoverContent>
			</Popover>

			<NodeAddDialog
				elementType={selectedElementType}
				node={node}
				nodeType={nodeType}
				onOpenChange={handleDialogClose}
				open={dialogOpen}
			/>
		</>
	);
}
