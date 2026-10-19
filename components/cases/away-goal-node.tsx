"use client";

import type { ReactNode } from "react";
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
 * The "Cites" line's text — three distinct states, checked in priority
 * order: the cited CASE itself is unavailable in this environment
 * (Chris's ruling, 2026-09-16); the case resolved but the cited ELEMENT
 * didn't (pre-existing ADR 0004 D5 behaviour); both resolved. Extracted to
 * avoid nesting ternaries in the JSX below.
 */
function citationLine(
	moduleReferenceDangling: boolean,
	citedElementId: string | null | undefined,
	citedCaseName: string | null,
	citedElementName: string | null
): ReactNode {
	if (moduleReferenceDangling) {
		return (
			<p className="text-muted-foreground text-sm italic">
				Cited case not available
			</p>
		);
	}
	if (!citedElementId) {
		return (
			<p className="text-muted-foreground text-sm italic">
				Cited element not resolved
			</p>
		);
	}
	return (
		<p className="text-sm">
			{citedCaseName ?? "Unknown case"}
			{citedElementName ? ` — ${citedElementName}` : ""}
		</p>
	);
}

/**
 * Away goal card (ADR 0005 D3): a goal that cites a goal in another case.
 * Shows the cited case's name and cited goal's name (resolved server-side by
 * `case-fetch-service.ts`), links to the cited case when the viewer can
 * access it, and says so plainly when the citation didn't resolve
 * (`citedElementId` is null — the citation was dangling at import, ADR 0004 D5).
 * When the cited CASE itself isn't available in this environment
 * (`moduleReferenceDangling` — Chris's ruling, 2026-09-16), the card says
 * that instead, since a missing case is a different failure than a missing
 * element within an otherwise-present case. Read-only beyond the
 * description: no add-child menu (away goals are leaves in 1.0 core).
 */
function AwayGoalNode({ data, ...props }: NodeProps) {
	const [editDialogOpen, setEditDialogOpen] = useState(false);
	const node = { data, position: { x: 0, y: 0 }, ...props };

	const citedCaseName = (data.citedCaseName as string | null) ?? null;
	const citedElementName = (data.citedElementName as string | null) ?? null;
	const citedCaseAccessible = !!data.citedCaseAccessible;
	const moduleReferenceId = data.moduleReferenceId as string | undefined;
	const citedElementId = data.citedElementId as string | null | undefined;
	const moduleReferenceDangling = !!data.moduleReferenceDangling;

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
					{citationLine(
						moduleReferenceDangling,
						citedElementId,
						citedCaseName,
						citedElementName
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
