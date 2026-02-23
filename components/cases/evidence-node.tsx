"use client";

import { ExternalLink } from "lucide-react";
import { memo, useState } from "react";
import type { NodeProps } from "reactflow";
import { BaseNode, NodeActionGroup } from "@/components/shared/nodes";
import IconIndicator from "./icon-indicator";
import NodeEditDialog from "./node-edit-dialog";

function EvidenceNode({ data, ...props }: NodeProps) {
	const [editDialogOpen, setEditDialogOpen] = useState(false);

	const url = data.URL || data.url;
	const node = { data, position: { x: 0, y: 0 }, ...props };

	const dataTour =
		data.isDemo && data.name === "E1" ? "demo-evidence-1" : undefined;

	return (
		<>
			<BaseNode
				bottomLeftActions={
					<NodeActionGroup
						node={node}
						nodeType="evidence"
						onEditClick={() => setEditDialogOpen(true)}
						showAdd={false}
						showToggle={false}
					/>
				}
				dataTour={dataTour}
				description={data.description}
				name={data.name}
				nodeType="evidence"
				selected={props.selected}
				topRightActions={<IconIndicator data={data} />}
			>
				{url && (
					<div className="space-y-1">
						<span className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
							Source
						</span>
						<a
							className="flex items-center gap-1.5 text-info text-sm hover:text-info/80 hover:underline"
							href={url}
							onClick={(e) => e.stopPropagation()}
							onMouseDown={(e) => e.stopPropagation()}
							rel="noopener noreferrer"
							target="_blank"
						>
							<ExternalLink
								aria-hidden="true"
								className="h-3.5 w-3.5 shrink-0"
							/>
							<span className="truncate">{url}</span>
						</a>
					</div>
				)}
			</BaseNode>

			{/* Edit Dialog */}
			<NodeEditDialog
				node={node}
				nodeType="evidence"
				onOpenChange={setEditDialogOpen}
				open={editDialogOpen}
			/>
		</>
	);
}

export default memo(EvidenceNode);
