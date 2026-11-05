"use client";

import type { ReactNode } from "react";
import { memo, useState } from "react";
import type { NodeProps } from "reactflow";
import {
	BaseNode,
	getAssertionStatusIndicator,
	NodeActionGroup,
	withPlaceholderIndicator,
} from "@/components/shared/nodes";
import CitedCaseLink from "./cited-case-link";
import NodeEditDialog from "./node-edit-dialog";

/**
 * The "Cites" line's text, in priority order: the viewer cannot view the cited
 * case (it is in the bin, deleted, never shared, no longer shared, or its
 * reference was cleared), so no name is shown; the case is viewable but the
 * cited ELEMENT did not resolve (none is cited, or it was not found under that
 * case; an element with no name comes back as an empty string and resolves);
 * both resolved. The name line is left out of the dashboard thumbnail, which
 * other people see. Extracted to avoid nesting ternaries in the JSX below.
 */
function citationLine(
	citedCaseAccessible: boolean,
	citedElementId: string | null | undefined,
	citedCaseName: string | null,
	citedElementName: string | null
): ReactNode {
	if (!citedCaseAccessible) {
		return (
			<p className="text-muted-foreground text-sm italic">
				Cited case not available
			</p>
		);
	}
	if (!citedElementId || citedElementName === null) {
		return (
			<p className="text-muted-foreground text-sm italic">
				Cited element not resolved
			</p>
		);
	}
	return (
		<p className="text-sm" data-left-out-of-shared-thumbnail="">
			{citedCaseName}
			{citedElementName ? ` — ${citedElementName}` : ""}
		</p>
	);
}

/**
 * Away goal card (ADR 0005 D3): a goal that cites a goal in another case.
 * Shows the cited case's name and cited goal's name (resolved server-side by
 * `case-fetch-service.ts`, and only for a viewer who can view the cited case)
 * with a link to the cited case. A viewer who cannot view it sees "Cited case
 * not available" and no link; so does a reference that was cleared on import.
 * When the case is viewable but the citation did not resolve (`citedElementId`
 * is null — the citation was dangling at import, ADR 0004 D5), the card says
 * so plainly. Read-only beyond the description: no add-child menu (away goals
 * are leaves in 1.0 core).
 */
function AwayGoalNode({ data, ...props }: NodeProps) {
	const [editDialogOpen, setEditDialogOpen] = useState(false);
	const node = { data, position: { x: 0, y: 0 }, ...props };

	const citedCaseName = (data.citedCaseName as string | null) ?? null;
	const citedElementName = (data.citedElementName as string | null) ?? null;
	const citedCaseAccessible = !!data.citedCaseAccessible;
	const moduleReferenceId = data.moduleReferenceId as string | undefined;
	const citedElementId = data.citedElementId as string | null | undefined;

	const topRightActions = withPlaceholderIndicator(
		data,
		getAssertionStatusIndicator(data.assertionStatus)
	);

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
				isPlaceholder={!!data.isPlaceholder}
				name={data.name}
				nodeType="awayGoal"
				placeholderHint={data.placeholderHint}
				selected={props.selected}
				topRightActions={topRightActions}
			>
				<div className="space-y-1">
					<span className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
						Cites
					</span>
					{citationLine(
						citedCaseAccessible,
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
