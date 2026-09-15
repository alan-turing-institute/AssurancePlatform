"use client";

import { memo, useState } from "react";
import type { NodeProps } from "reactflow";
import {
	BaseNode,
	getAssertionStatusIndicator,
	NodeActionGroup,
} from "@/components/shared/nodes";
import CitedCaseLink from "./cited-case-link";
import NodeEditDialog from "./node-edit-dialog";

/**
 * Away goal card (ADR 0005 D3): a goal that cites a goal in another case.
 * Shows the cited case's name and cited goal's name (resolved server-side by
 * `case-fetch-service.ts`), links to the cited case when the viewer can
 * access it, and says so plainly when the citation didn't resolve
 * (`citedElementId` is null — the citation was dangling at import, ADR 0004 D5).
 * Read-only beyond the description: no add-child menu (away goals are leaves
 * in 1.0 core).
 */
function AwayGoalNode({ data, ...props }: NodeProps) {
	const [editDialogOpen, setEditDialogOpen] = useState(false);
	const node = { data, position: { x: 0, y: 0 }, ...props };

	const citedCaseName = (data.citedCaseName as string | null) ?? null;
	const citedElementName = (data.citedElementName as string | null) ?? null;
	const citedCaseAccessible = !!data.citedCaseAccessible;
	const moduleReferenceId = data.moduleReferenceId as string | undefined;
	const citedElementId = data.citedElementId as string | null | undefined;

	const topRightActions = getAssertionStatusIndicator(data.assertionStatus);

	return (
		<>
			<BaseNode
				bottomLeftActions={
					<NodeActionGroup
						commentCount={
							Array.isArray(data.comments) ? data.comments.length : 0
						}
						node={node}
						nodeType="awayGoal"
						onEditClick={() => setEditDialogOpen(true)}
						showAdd={false}
					/>
				}
				description={data.description}
				// The cited case/goal is the card's whole point — unlike a
				// description preview, it shouldn't be hidden behind a click.
				initialExpanded
				name={data.name}
				nodeType="awayGoal"
				selected={props.selected}
				topRightActions={topRightActions}
			>
				<div className="space-y-1">
					<span className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
						Cites
					</span>
					{citedElementId ? (
						<p className="text-sm">
							{citedCaseName ?? "Unknown case"}
							{citedElementName ? ` — ${citedElementName}` : ""}
						</p>
					) : (
						<p className="text-muted-foreground text-sm italic">
							Cited element not resolved
						</p>
					)}
					{moduleReferenceId && (
						<CitedCaseLink
							caseId={moduleReferenceId}
							isAccessible={citedCaseAccessible}
							label="View cited case"
						/>
					)}
				</div>
			</BaseNode>

			<NodeEditDialog
				node={node}
				nodeType="awayGoal"
				onOpenChange={setEditDialogOpen}
				open={editDialogOpen}
			/>
		</>
	);
}

export default memo(AwayGoalNode);
