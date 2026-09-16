"use client";

import { type EdgeProps, getStraightPath } from "reactflow";
import { HIGHLIGHTED_EDGE_STYLE } from "@/components/cases/edge-highlight-style";

/**
 * React Flow's default `.react-flow__handle-{left,right}` styling (its own
 * stylesheet, not ours) sits the handle dot 4px outside the node's own
 * border. `getStraightPath` draws to the handle's centre, so the visible
 * line — and the marker anchored to its end — reads as stopping a few
 * pixels short of the card itself (walkthrough finding 1, 2026-09-15).
 * Extending the endpoint by that same 4px, along the source -> target
 * direction, closes the gap without changing the marker's own geometry.
 */
const HANDLE_OUTWARD_OFFSET_PX = 4;

/**
 * The `challenges` edge (ADR 0005 D4): dashed line, open arrowhead pointing
 * AT the attacked element, destructive theme token — no hard-coded colour.
 * Straight and horizontal because `BaseNode`'s side handles put the
 * defeater's inner handle and the target's outer handle on the same row
 * (ADR 0005 D1's cells put them there).
 *
 * The marker is defined per-edge-instance with an id derived from the
 * edge's own id, so multiple `challenges` edges on one canvas never collide
 * on a shared `<marker>` id.
 *
 * `data.highlighted` (`lib/case/edge-highlight.ts`) is set when this edge's
 * source or target is the currently selected node. The connector path
 * (not the arrowhead — the `<marker>` above is untouched) gets
 * `HIGHLIGHTED_EDGE_STYLE` applied via `style`, which overrides this
 * edge's own `strokeWidth`/`strokeDasharray` attributes — CSS inline style
 * wins over SVG presentation attributes — so the highlighted state reads
 * as distinct from the edge's ordinary static dashed line.
 */
export default function ChallengesEdge({
	id,
	sourceX,
	sourceY,
	targetX,
	targetY,
	data,
}: EdgeProps<{ highlighted?: boolean }>) {
	// Shorten only by the handle's own outward offset — see
	// HANDLE_OUTWARD_OFFSET_PX above — so the arrow ends at the target's
	// card, not its handle centre.
	const dx = targetX - sourceX;
	const dy = targetY - sourceY;
	const length = Math.hypot(dx, dy) || 1;
	const endX = targetX + (dx / length) * HANDLE_OUTWARD_OFFSET_PX;
	const endY = targetY + (dy / length) * HANDLE_OUTWARD_OFFSET_PX;

	const [edgePath] = getStraightPath({
		sourceX,
		sourceY,
		targetX: endX,
		targetY: endY,
	});
	const markerId = `challenges-arrow-${id}`;

	return (
		<>
			<defs>
				<marker
					id={markerId}
					markerHeight={10}
					markerWidth={10}
					orient="auto-start-reverse"
					refX={8}
					refY={4}
					viewBox="0 0 10 8"
				>
					<path
						className="fill-none stroke-destructive"
						d="M1 1 L8 4 L1 7"
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={1.5}
					/>
				</marker>
			</defs>
			<path
				className="fill-none stroke-destructive"
				d={edgePath}
				id={id}
				markerEnd={`url(#${markerId})`}
				strokeDasharray="6 4"
				strokeWidth={2}
				style={data?.highlighted ? HIGHLIGHTED_EDGE_STYLE : undefined}
			/>
		</>
	);
}
