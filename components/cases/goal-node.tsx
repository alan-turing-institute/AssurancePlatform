"use client";

import { Plus } from "lucide-react";
import { memo, useState } from "react";
import type { NodeProps } from "reactflow";
import { BaseNode, NodeActionGroup } from "@/components/shared/nodes";
import ActionTooltip from "@/components/ui/action-tooltip";
import NodeAddPopover from "./node-add-popover";
import NodeEditDialog from "./node-edit-dialog";
import ToggleButton from "./toggle-button";

function GoalNode({ data, ...props }: NodeProps) {
	const [editDialogOpen, setEditDialogOpen] = useState(false);
	const [addPopoverOpen, setAddPopoverOpen] = useState(false);

	const node = { data, position: { x: 0, y: 0 }, ...props };

	const addPopover = (
		<NodeAddPopover
			node={node}
			nodeType="goal"
			onOpenChange={setAddPopoverOpen}
			open={addPopoverOpen}
		>
			<ActionTooltip label="Add child element">
				<button
					onClick={(e) => {
						e.stopPropagation();
						setAddPopoverOpen(true);
					}}
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

	const isDemoGoal = data.isDemo && data.name === "G1";
	const dataTour = isDemoGoal ? "demo-goal" : undefined;

	return (
		<>
			<BaseNode
				assumption={data.assumption}
				bottomLeftActions={
					<NodeActionGroup
						addPopover={addPopover}
						commentCount={
							Array.isArray(data.comments) ? data.comments.length : 0
						}
						node={node}
						nodeType="goal"
						onEditClick={() => setEditDialogOpen(true)}
						toggleButton={<ToggleButton node={node} />}
					/>
				}
				context={data.context}
				dataTour={dataTour}
				defaultExpanded={isDemoGoal}
				description={data.description}
				expandTour={isDemoGoal ? "demo-expand" : undefined}
				justification={data.justification}
				name={data.name}
				nodeType="goal"
				selected={props.selected}
			/>

			{/* Edit Dialog */}
			<NodeEditDialog
				node={node}
				nodeType="goal"
				onOpenChange={setEditDialogOpen}
				open={editDialogOpen}
			/>
		</>
	);
}

export default memo(GoalNode);
