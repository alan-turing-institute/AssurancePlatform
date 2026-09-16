import type { CSSProperties } from "react";

/**
 * Inline style applied to a `support`/`challenges` edge's own connector
 * `<path>` when `data.highlighted` is set (`lib/case/edge-highlight.ts`) —
 * a stronger, primary-token stroke plus a moving dash, so the edge reads as
 * traceable even where it shares a drawn rail with other edges (ADR 0005
 * D8's cell bend).
 *
 * Deliberately NOT React Flow's own `animated: true` edge flag: that adds
 * `.react-flow__edge.animated path` from React Flow's stylesheet, which
 * would also dash-animate the `challenges` edge's arrowhead marker (nested
 * in the same `<g>` as its connector path) — an unwanted side effect on the
 * one edge type that already has a static dashed line. Driving the look
 * from inline style instead keeps both edge types' highlighted state
 * identical and leaves the arrowhead untouched. `strokeDasharray` differs
 * from the challenges edge's own static "6 4" so the highlighted state
 * reads as distinct even before the animation is noticed.
 */
export const HIGHLIGHTED_EDGE_STYLE: CSSProperties = {
	stroke: "var(--color-primary)",
	strokeWidth: 4,
	strokeDasharray: "8 4",
	animation: "case-edge-highlight-dash 0.6s linear infinite",
};
