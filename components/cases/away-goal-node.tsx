"use client";

import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { memo, useState } from "react";
import type { NodeProps } from "reactflow";
import {
	BaseNode,
	getAssertionStatusIndicator,
	NodeActionGroup,
} from "@/components/shared/nodes";
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
					{citedCaseAccessible && moduleReferenceId && (
						<Link
							className="flex items-center gap-1.5 text-info text-sm hover:text-info/80 hover:underline"
							href={`/case/${moduleReferenceId}`}
							onClick={(e) => e.stopPropagation()}
							onMouseDown={(e) => e.stopPropagation()}
						>
							<ExternalLink
								aria-hidden="true"
								className="h-3.5 w-3.5 shrink-0"
							/>
							<span>View cited case</span>
						</Link>
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
