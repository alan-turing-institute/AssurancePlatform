"use client";

import { Plus } from "lucide-react";
import { memo, useState } from "react";
import type { NodeProps } from "reactflow";
import { BaseNode, NodeActionGroup } from "@/components/shared/nodes";
import ActionTooltip from "@/components/ui/action-tooltip";
import IconIndicator from "./icon-indicator";
import NodeAddPopover from "./node-add-popover";
import NodeEditDialog from "./node-edit-dialog";
import ToggleButton from "./toggle-button";

function StrategyNode({ data, ...props }: NodeProps) {
	const [editDialogOpen, setEditDialogOpen] = useState(false);
	const [addPopoverOpen, setAddPopoverOpen] = useState(false);

	const node = { data, position: { x: 0, y: 0 }, ...props };

	const addPopover = (
		<NodeAddPopover
			node={node}
			nodeType="strategy"
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
					<div className="inline-flex rounded-full p-1 hover:bg-slate-900/10">
						<Plus aria-hidden="true" size={16} />
					</div>
				</button>
			</ActionTooltip>
		</NodeAddPopover>
	);

	return (
		<>
			<BaseNode
				assumption={data.assumption}
				bottomLeftActions={
					<NodeActionGroup
						addPopover={addPopover}
						node={node}
						nodeType="strategy"
						onEditClick={() => setEditDialogOpen(true)}
						toggleButton={<ToggleButton node={node} />}
					/>
				}
				context={data.context}
				description={data.description}
				justification={data.justification}
				name={data.name}
				nodeType="strategy"
				selected={props.selected}
				topRightActions={<IconIndicator data={data} />}
			/>

			{/* Edit Dialog */}
			<NodeEditDialog
				node={node}
				nodeType="strategy"
				onOpenChange={setEditDialogOpen}
				open={editDialogOpen}
			/>
		</>
	);
}

export default memo(StrategyNode);
