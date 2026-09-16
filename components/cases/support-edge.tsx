"use client";

import { type EdgeProps, getSmoothStepPath } from "reactflow";
import {
	HIGHLIGHTED_EDGE_PATH_CLASS,
	HIGHLIGHTED_EDGE_STYLE,
} from "@/components/cases/edge-highlight-style";
import { cn } from "@/lib/utils";

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
 *
 * `data.highlighted` (`lib/case/edge-highlight.ts`) is set when this edge's
 * source or target is the currently selected node — merges
 * `HIGHLIGHTED_EDGE_STYLE` over any edge-supplied `style`, and adds
 * `HIGHLIGHTED_EDGE_PATH_CLASS` (the moving dash, suppressed under
 * `prefers-reduced-motion`), so the connector reads as traceable among the
 * other edges sharing a cell's rail.
 *
 * Renders the path manually rather than via React Flow's `BaseEdge` —
 * `BaseEdge` doesn't accept a `className`, which the highlighted state
 * needs on the path itself (see `edge-highlight-style.ts`). This mirrors
 * `BaseEdge`'s own output (including its `interactionWidth = 20` default)
 * exactly, so the unhighlighted render is unchanged.
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
	interactionWidth = 20,
	data,
}: EdgeProps<{
	centerX?: number;
	centerY?: number;
	highlighted?: boolean;
}>) {
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

	const highlighted = !!data?.highlighted;
	const pathStyle = highlighted
		? { ...style, ...HIGHLIGHTED_EDGE_STYLE }
		: style;

	return (
		<>
			<path
				className={cn(
					"react-flow__edge-path",
					highlighted && HIGHLIGHTED_EDGE_PATH_CLASS
				)}
				d={edgePath}
				fill="none"
				id={id}
				markerEnd={markerEnd}
				markerStart={markerStart}
				style={pathStyle}
			/>
			{interactionWidth && (
				<path
					className="react-flow__edge-interaction"
					d={edgePath}
					fill="none"
					strokeOpacity={0}
					strokeWidth={interactionWidth}
				/>
			)}
		</>
	);
}
