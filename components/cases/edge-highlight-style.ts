import type { CSSProperties } from "react";
import type { AppearanceTone, ElementAppearance } from "@/lib/plugins/slots";

const APPEARANCE_STROKES: Record<AppearanceTone, string> = {
	positive: "var(--success)",
	caution: "var(--warning)",
	negative: "var(--destructive)",
	neutral: "var(--muted-foreground)",
};

/** Edge strokes drawn faded keep this share of their strength. */
const FADED_STROKE_OPACITY = 0.35;

/**
 * Inline style for a `support` edge's connector `<path>` that a plugin has
 * given an appearance: the tone's theme colour, a little heavier than an
 * ordinary edge so the colour reads, and at about a third of its strength when
 * faded. With no tone the edge keeps its own colour and width, so only the
 * fade is set. Image capture removes these three properties
 * (`plugin-display-capture.ts`).
 */
export function buildAppearanceEdgeStyle(
	appearance: ElementAppearance
): CSSProperties {
	const strokeOpacity = appearance.faded ? FADED_STROKE_OPACITY : 1;
	if (!appearance.tone) {
		return { strokeOpacity };
	}
	return {
		stroke: APPEARANCE_STROKES[appearance.tone],
		strokeWidth: 3,
		strokeOpacity,
	};
}

/**
 * Class applied to a `support`/`challenges` edge's own connector `<path>`
 * (not the `challenges` edge's arrowhead marker, a separate `<path>` in the
 * same `<g>`) when `data.highlighted` is set. Carries the moving-dash
 * animation — see `app/globals.css`'s `.case-edge__path--highlighted` rule
 * and its `prefers-reduced-motion: reduce` override — so a user who has
 * asked for reduced motion still gets the stroke change but not the motion.
 * Deliberately a class, not inline `style.animation`: an inline style
 * always wins over an external stylesheet rule with equal specificity, so
 * the media-query override could never suppress it if the animation lived
 * in `HIGHLIGHTED_EDGE_STYLE` below (vincent review, bf4139b5).
 */
export const HIGHLIGHTED_EDGE_PATH_CLASS = "case-edge__path--highlighted";

/**
 * Inline style applied to a `support`/`challenges` edge's own connector
 * `<path>` when `data.highlighted` is set (`lib/case/edge-highlight.ts`) —
 * a stronger, primary-token stroke, so the edge reads as traceable even
 * where it shares a drawn rail with other edges (ADR 0005 D8's cell bend).
 * The motion itself is `HIGHLIGHTED_EDGE_PATH_CLASS` above, not here.
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
};
