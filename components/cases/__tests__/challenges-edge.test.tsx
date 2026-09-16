import { render } from "@testing-library/react";
import type { EdgeProps } from "reactflow";
import { describe, expect, it, vi } from "vitest";
import ChallengesEdge from "../challenges-edge";

/**
 * ADR 0005 D4: `challenges` is a dashed, destructive-token straight edge
 * with a per-instance arrowhead marker. These tests cover the
 * selected-node highlight (issue: highlight a selected node's edges) —
 * `data.highlighted` (set by `lib/case/edge-highlight.ts`) should restyle
 * the connector path only, leaving the arrowhead marker untouched.
 *
 * The global `reactflow` mock (`src/__tests__/setup/component-mocks.tsx`)
 * doesn't stub `getStraightPath` — nothing needed it before this edge type
 * — so this file restores the real implementation, scoped to itself only
 * (same pattern as `support-edge.test.tsx`).
 */
vi.mock("reactflow", async (importOriginal) => {
	const actual = await importOriginal<typeof import("reactflow")>();
	return { ...actual };
});
function renderEdge(highlighted?: boolean) {
	const props = {
		id: "e1",
		sourceX: 100,
		sourceY: 40,
		targetX: 300,
		targetY: 40,
		data: { highlighted },
	} as unknown as EdgeProps<{ highlighted?: boolean }>;

	const { container } = render(
		// biome-ignore lint/a11y/noSvgWithoutTitle: test fixture, not UI
		<svg>
			<ChallengesEdge {...props} />
		</svg>
	);
	return container;
}

describe("ChallengesEdge — selected-node highlight", () => {
	it("renders the ordinary static dashed stroke when not highlighted", () => {
		const container = renderEdge(false);
		const path = container.querySelector<SVGPathElement>("path#e1");

		expect(path?.getAttribute("stroke-dasharray")).toBe("6 4");
		expect(path?.getAttribute("stroke-width")).toBe("2");
		expect(path?.style.stroke).toBe("");
	});

	it("applies the highlighted stroke style to the connector path when highlighted", () => {
		const container = renderEdge(true);
		const path = container.querySelector<SVGPathElement>("path#e1");

		expect(path?.style.stroke).toBe("var(--color-primary)");
		expect(path?.style.strokeWidth).toBe("4");
		expect(path?.style.strokeDasharray).toBe("8 4");
		expect(path?.style.animation).toContain("case-edge-highlight-dash");
	});

	it("leaves the arrowhead marker's own path untouched when highlighted", () => {
		const container = renderEdge(true);
		const markerPath = container.querySelector("marker path");

		expect(markerPath?.getAttribute("stroke-width")).toBe("1.5");
		expect(markerPath?.getAttribute("class")).toBe(
			"fill-none stroke-destructive"
		);
		expect(markerPath?.getAttribute("style")).toBeNull();
	});
});
