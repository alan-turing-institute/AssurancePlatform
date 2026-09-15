"use client";

import { memo, useState } from "react";
import type { NodeProps } from "reactflow";
import { BaseNode, NodeActionGroup } from "@/components/shared/nodes";
import CitedCaseLink from "./cited-case-link";
import NodeEditDialog from "./node-edit-dialog";

/**
 * Module card (ADR 0005 D3): a reference to a whole other case. Shows the
 * referenced case's name (resolved server-side by `case-fetch-service.ts`)
 * and links to it when the viewer can access it. Read-only beyond the
 * description: no add-child menu (modules are leaves in 1.0 core).
 */
function ModuleNode({ data, ...props }: NodeProps) {
	const [editDialogOpen, setEditDialogOpen] = useState(false);
	const node = { data, position: { x: 0, y: 0 }, ...props };

	const moduleCaseName = (data.moduleCaseName as string | null) ?? null;
	const moduleCaseAccessible = !!data.moduleCaseAccessible;
	const moduleReferenceId = data.moduleReferenceId as string | undefined;

	return (
		<>
			<BaseNode
				bottomLeftActions={
					<NodeActionGroup
						commentCount={
							Array.isArray(data.comments) ? data.comments.length : 0
						}
						node={node}
						nodeType="module"
						onEditClick={() => setEditDialogOpen(true)}
						showAdd={false}
					/>
				}
				description={data.description}
				// The referenced case is the card's whole point — unlike a
				// description preview, it shouldn't be hidden behind a click.
				initialExpanded
				name={data.name}
				nodeType="module"
				selected={props.selected}
			>
				<div className="space-y-1">
					<span className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
						References
					</span>
					<p className="text-sm">{moduleCaseName ?? "Unknown case"}</p>
					{moduleReferenceId && (
						<CitedCaseLink
							caseId={moduleReferenceId}
							isAccessible={moduleCaseAccessible}
							label="View referenced case"
						/>
					)}
				</div>
			</BaseNode>

			<NodeEditDialog
				node={node}
				nodeType="module"
				onOpenChange={setEditDialogOpen}
				open={editDialogOpen}
			/>
		</>
	);
}

export default memo(ModuleNode);
