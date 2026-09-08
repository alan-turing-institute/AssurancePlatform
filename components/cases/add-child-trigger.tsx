"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import type { Node } from "reactflow";
import type { DiagramNodeType } from "@/components/shared/nodes/node-config";
import ActionTooltip from "@/components/ui/action-tooltip";
import NodeAddPopover from "./node-add-popover";

const ADD_CHILD_LABEL = "Add child element";

export interface AddChildTriggerProps {
	/** The ReactFlow node object this trigger adds a child under */
	node: Node;
	/** The type of node (goal, strategy or property — evidence never shows this) */
	nodeType: DiagramNodeType;
}

/**
 * AddChildTrigger - the "Add child element" popover trigger shared by
 * goal-node.tsx, strategy-node.tsx and property-node.tsx. Owns its own open
 * state; nothing outside this component needs it.
 */
export default function AddChildTrigger({
	node,
	nodeType,
}: AddChildTriggerProps) {
	const [addPopoverOpen, setAddPopoverOpen] = useState(false);

	return (
		<NodeAddPopover
			node={node}
			nodeType={nodeType}
			onOpenChange={setAddPopoverOpen}
			open={addPopoverOpen}
		>
			<ActionTooltip label={ADD_CHILD_LABEL}>
				<button
					aria-label={ADD_CHILD_LABEL}
					onClick={(e) => e.stopPropagation()}
					onMouseDown={(e) => e.stopPropagation()}
					type="button"
				>
					<div className="inline-flex rounded-full p-1 hover:bg-foreground/10">
						<Plus aria-hidden="true" size={16} />
					</div>
				</button>
			</ActionTooltip>
		</NodeAddPopover>
	);
}
