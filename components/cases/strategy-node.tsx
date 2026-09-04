"use client";

import { memo, useState } from "react";
import type { NodeProps } from "reactflow";
import { BaseNode, NodeActionGroup } from "@/components/shared/nodes";
import { useNodeTopRightActions } from "@/hooks/use-node-top-right-actions";
import AddChildTrigger from "./add-child-trigger";
import NodeEditDialog from "./node-edit-dialog";
import ToggleButton from "./toggle-button";

function StrategyNode({ data, ...props }: NodeProps) {
	const [editDialogOpen, setEditDialogOpen] = useState(false);

	const node = { data, position: { x: 0, y: 0 }, ...props };

	const topRightActions = useNodeTopRightActions(data, "strategy");

	const dataTour =
		data.isDemo && data.name === "S1" ? "demo-strategy-1" : undefined;

	return (
		<>
			<BaseNode
				assumption={data.assumption}
				bottomLeftActions={
					<NodeActionGroup
						addPopover={<AddChildTrigger node={node} nodeType="strategy" />}
						commentCount={
							Array.isArray(data.comments) ? data.comments.length : 0
						}
						node={node}
						nodeType="strategy"
						onEditClick={() => setEditDialogOpen(true)}
						toggleButton={<ToggleButton node={node} />}
					/>
				}
				context={data.context}
				dataTour={dataTour}
				description={data.description}
				justification={data.justification}
				name={data.name}
				nodeType="strategy"
				selected={props.selected}
				topRightActions={topRightActions}
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
