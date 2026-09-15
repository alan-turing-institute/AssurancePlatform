"use client";

import { BaseEdge, type EdgeProps, getSmoothStepPath } from "reactflow";

/**
 * The `support` edge (ADR 0005 D8): a smoothstep edge whose horizontal run
 * bends at `data.centerY` (set by `lib/case/layout-helper.ts`'s
 * `applyCellCenterY` for a cell's outgoing children edges) instead of
 * React Flow's default midpoint between source and target. With two
 * stacked defeaters, that default midpoint sits below the target's own
 * card — inside the second defeater's card — so the connector reads as
 * leaving from underneath it; bending below the whole cell fixes that.
 *
 * `data.centerY` is `undefined` for every edge outside a cell, in which
 * case `getSmoothStepPath` falls back to its own default midpoint — the
 * same bend the built-in `smoothstep` type always used — so this edge type
 * is a drop-in replacement, not a visual change for ordinary edges.
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
}: EdgeProps<{ centerY?: number }>) {
	const [edgePath] = getSmoothStepPath({
		sourceX,
		sourceY,
		sourcePosition,
		targetX,
		targetY,
		targetPosition,
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
