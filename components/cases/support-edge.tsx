"use client";

import { BaseEdge, type EdgeProps, getSmoothStepPath } from "reactflow";

/**
 * The `support` edge (ADR 0005 D8): a smoothstep edge whose run bends at
 * `data.centerY` (top-down/bottom-up trees) or `data.centerX` (left-right
 * trees — a live per-case toggle, `case-settings-popover.tsx`) instead of
 * React Flow's default midpoint between source and target. Both are set by
 * `lib/case/layout-helper.ts`'s `applyCellBend` for a cell's outgoing
 * children edges, in whichever axis the tree actually progresses along.
 * With two stacked (or, in a left-right tree, side-by-side) defeaters,
 * that default midpoint sits inside the second defeater's card — the
 * connector reads as leaving from underneath it; bending past the whole
 * cell fixes that.
 *
 * Both are `undefined` for every edge outside a cell, in which case
 * `getSmoothStepPath` falls back to its own default midpoint — the same
 * bend the built-in `smoothstep` type always used — so this edge type is a
 * drop-in replacement, not a visual change for ordinary edges.
 */
export default function SupportEdge({
	id,
	sourceX,
	sourceY,
	sourcePosition,
	targetX,
	targetY,
	targetPosition,
	style,
	markerEnd,
	markerStart,
	interactionWidth,
	data,
}: EdgeProps<{ centerX?: number; centerY?: number }>) {
	const [edgePath] = getSmoothStepPath({
		sourceX,
		sourceY,
		sourcePosition,
		targetX,
		targetY,
		targetPosition,
		centerX: data?.centerX,
		centerY: data?.centerY,
	});

	return (
		<BaseEdge
			id={id}
			interactionWidth={interactionWidth}
			markerEnd={markerEnd}
			markerStart={markerStart}
			path={edgePath}
			style={style}
		/>
	);
}
