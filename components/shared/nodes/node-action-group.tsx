"use client";

import { MessageCircle, Pencil } from "lucide-react";
import type { Node } from "reactflow";
import ActionTooltip from "@/components/ui/action-tooltip";
import useStore from "@/data/store";
import type { NodeType } from "./node-config";
import NodeOptionsMenu from "./node-options-menu";

type NodeActionGroupProps = {
	/** The ReactFlow node object */
	node: Node;
	/** The type of node (goal, strategy, property, evidence) */
	nodeType: NodeType;
	/** Whether to show the Add button (false for evidence nodes) */
	showAdd?: boolean;
	/** Whether to show the Toggle button */
	showToggle?: boolean;
	/** The Toggle button component to render */
	toggleButton?: React.ReactNode;
	/** Callback when edit is clicked */
	onEditClick: () => void;
	/** The Add popover component to wrap around the Add button */
	addPopover?: React.ReactNode;
};

/**
 * NodeActionGroup - Horizontal icon group for node actions
 *
 * Displayed in the bottom-left corner of each node.
 * Contains Edit, Add (optional), Comment, and Toggle (optional) buttons.
 */
export default function NodeActionGroup({
	node,
	nodeType,
	showAdd = true,
	showToggle = true,
	toggleButton,
	onEditClick,
	addPopover,
}: NodeActionGroupProps) {
	const { setCommentsSheetOpen, setCommentsSheetNode, assuranceCase } =
		useStore();

	const readOnly = !!(
		assuranceCase?.permissions === "view" ||
		assuranceCase?.permissions === "comment"
	);

	const handleEditClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		onEditClick();
	};

	const handleCommentClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		setCommentsSheetNode(node);
		setCommentsSheetOpen(true);
	};

	return (
		<div className="flex items-center gap-0.5">
			{/* Edit Button */}
			<ActionTooltip label={readOnly ? "View details" : "Edit element"}>
				<button
					onClick={handleEditClick}
					onMouseDown={(e) => e.stopPropagation()}
					type="button"
				>
					<div className="inline-flex rounded-full p-1 hover:bg-foreground/10">
						<Pencil aria-hidden="true" size={16} />
					</div>
				</button>
			</ActionTooltip>

			{/* Add Button with Popover (not shown for evidence or when read-only) */}
			{showAdd && nodeType !== "evidence" && !readOnly && addPopover}

			{/* Comment Button */}
			<ActionTooltip label="View comments">
				<button
					onClick={handleCommentClick}
					onMouseDown={(e) => e.stopPropagation()}
					type="button"
				>
					<div className="inline-flex rounded-full p-1 hover:bg-foreground/10">
						<MessageCircle aria-hidden="true" size={16} />
					</div>
				</button>
			</ActionTooltip>

			{/* More Options (Detach/Delete) - not shown when read-only */}
			{!readOnly && <NodeOptionsMenu node={node} nodeType={nodeType} />}

			{/* Toggle Button (existing, passed as child) */}
			{showToggle && toggleButton}
		</div>
	);
}
