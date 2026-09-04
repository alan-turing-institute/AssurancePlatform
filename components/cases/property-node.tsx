"use client";

import { memo, useState } from "react";
import type { NodeProps } from "reactflow";
import { BaseNode, NodeActionGroup } from "@/components/shared/nodes";
import { useNodeTopRightActions } from "@/hooks/use-node-top-right-actions";
import AddChildTrigger from "./add-child-trigger";
import NodeEditDialog from "./node-edit-dialog";
import ToggleButton from "./toggle-button";

function PropertyNode({ data, ...props }: NodeProps) {
	const [editDialogOpen, setEditDialogOpen] = useState(false);

	const node = { data, position: { x: 0, y: 0 }, ...props };

	const topRightActions = useNodeTopRightActions(data, "property");

	const dataTour =
		data.isDemo && data.name === "P1" ? "demo-claim-1" : undefined;

	return (
		<>
			<BaseNode
				assumption={data.assumption}
				bottomLeftActions={
					<NodeActionGroup
						addPopover={<AddChildTrigger node={node} nodeType="property" />}
						commentCount={
							Array.isArray(data.comments) ? data.comments.length : 0
						}
						node={node}
						nodeType="property"
						onEditClick={() => setEditDialogOpen(true)}
						toggleButton={<ToggleButton node={node} />}
					/>
				}
				context={data.context}
				dataTour={dataTour}
				description={data.description}
				justification={data.justification}
				name={data.name}
				nodeType="property"
				selected={props.selected}
				topRightActions={topRightActions}
			/>

			{/* Edit Dialog */}
			<NodeEditDialog
				node={node}
				nodeType="property"
				onOpenChange={setEditDialogOpen}
				open={editDialogOpen}
			/>
		</>
	);
}

export default memo(PropertyNode);
