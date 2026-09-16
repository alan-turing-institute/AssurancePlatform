import { render } from "@testing-library/react";
import { getSmoothStepPath, Position } from "reactflow";
import { describe, expect, it, vi } from "vitest";
import SupportEdge from "../support-edge";

/**
 * ADR 0005 D8: `support` is a smoothstep edge that reads `data.centerY` to
 * bend below the whole cell rather than React Flow's default midpoint. The
 * edge itself just forwards its props to `getSmoothStepPath` and `BaseEdge`
 * — these tests confirm that wiring, not ELK's own geometry (covered in
 * `lib/case/__tests__/layout-helper.test.ts`).
 *
 * The global `reactflow` mock (`src/__tests__/setup/component-mocks.tsx`)
 * doesn't stub `getSmoothStepPath`/`BaseEdge` — nothing needed them before
 * this edge type — so this file restores the real implementations, scoped
 * to itself only.
 */
vi.mock("reactflow", async (importOriginal) => {
	const actual = await importOriginal<typeof import("reactflow")>();
	return {
		...actual,
		Position: { Top: "top", Right: "right", Bottom: "bottom", Left: "left" },
	};
});
function renderEdge(centerY: number | undefined) {
	const props = {
		id: "e1",
		sourceX: 100,
		sourceY: 40,
		sourcePosition: Position.Bottom,
		targetX: 100,
		targetY: 400,
		targetPosition: Position.Top,
		source: "a",
		target: "b",
		data: { centerY },
	} as unknown as Parameters<typeof SupportEdge>[0];

	const { container } = render(
		// biome-ignore lint/a11y/noSvgWithoutTitle: test fixture, not UI
		<svg>
			<SupportEdge {...props} />
		</svg>
	);
	return container.querySelector("path");
}

describe("SupportEdge (ADR 0005 D8)", () => {
	it("bends at data.centerY when set, matching getSmoothStepPath's own output for that centerY", () => {
		const path = renderEdge(600);
		const [expectedPath] = getSmoothStepPath({
			sourceX: 100,
			sourceY: 40,
			sourcePosition: Position.Bottom,
			targetX: 100,
			targetY: 400,
			targetPosition: Position.Top,
			centerY: 600,
		});

		expect(path?.getAttribute("d")).toBe(expectedPath);
	});

	it("falls back to getSmoothStepPath's own default bend when centerY is undefined", () => {
		const path = renderEdge(undefined);
		const [expectedPath] = getSmoothStepPath({
			sourceX: 100,
			sourceY: 40,
			sourcePosition: Position.Bottom,
			targetX: 100,
			targetY: 400,
			targetPosition: Position.Top,
		});

		expect(path?.getAttribute("d")).toBe(expectedPath);
	});

	it("produces a different path when centerY is set than when it isn't", () => {
		const withCenterY = renderEdge(600)?.getAttribute("d");
		const withoutCenterY = renderEdge(undefined)?.getAttribute("d");

		expect(withCenterY).not.toBe(withoutCenterY);
	});
});

/**
 * Selected-node edge highlight (issue: highlight a selected node's edges).
 * `flow.tsx`'s `getHighlightedEdges` (`lib/case/edge-highlight.ts`) sets
 * `data.highlighted` on every edge touching the selected node — this is
 * SupportEdge's own side of reading that flag.
 */
describe("SupportEdge — selected-node highlight", () => {
	function renderWithData(data: { centerY?: number; highlighted?: boolean }) {
		const props = {
			id: "e1",
			sourceX: 100,
			sourceY: 40,
			sourcePosition: Position.Bottom,
			targetX: 100,
			targetY: 400,
			targetPosition: Position.Top,
			source: "a",
			target: "b",
			data,
		} as unknown as Parameters<typeof SupportEdge>[0];

		const { container } = render(
			// biome-ignore lint/a11y/noSvgWithoutTitle: test fixture, not UI
			<svg>
				<SupportEdge {...props} />
			</svg>
		);
		return container.querySelector<SVGPathElement>(
			"path.react-flow__edge-path"
		);
	}

	it("applies the highlighted stroke style when data.highlighted is true", () => {
		const path = renderWithData({ highlighted: true });

		expect(path?.style.stroke).toBe("var(--color-primary)");
		expect(path?.style.strokeWidth).toBe("4");
	});

	it("carries the highlighted-path class (the moving dash — CSS, not inline, so prefers-reduced-motion can suppress it) when highlighted", () => {
		const path = renderWithData({ highlighted: true });

		expect(path?.classList.contains("case-edge__path--highlighted")).toBe(true);
	});

	it("applies no highlight style or class when data.highlighted is false or absent", () => {
		const path = renderWithData({ highlighted: false });

		expect(path?.style.stroke).toBe("");
		expect(path?.classList.contains("case-edge__path--highlighted")).toBe(
			false
		);
	});
});
