"use client";

import { type EdgeProps, getStraightPath } from "reactflow";

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
 */
export default function ChallengesEdge({
	id,
	sourceX,
	sourceY,
	targetX,
	targetY,
}: EdgeProps) {
	const [edgePath] = getStraightPath({ sourceX, sourceY, targetX, targetY });
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
			/>
		</>
	);
}
