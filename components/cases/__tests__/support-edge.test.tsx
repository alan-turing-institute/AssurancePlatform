import { render, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { getSmoothStepPath, Position } from "reactflow";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetPluginFetchDedupeForTests } from "@/hooks/use-plugin-enablement";
import { elementAppearanceSlot } from "@/lib/plugins/slots";
import { server } from "@/src/__tests__/mocks/server";
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

/**
 * The `element-appearance` slot: a plugin colours the edge between two
 * elements it names. The selection highlight replaces that colour.
 */
describe("SupportEdge — plugin appearance", () => {
	function renderWithAppearance(data: {
		highlighted?: boolean;
		sourceElementId?: string;
		targetElementId?: string;
	}) {
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

	beforeEach(() => {
		server.use(
			http.get("/api/user/plugins", () =>
				HttpResponse.json({
					plugins: [
						{
							pluginId: "tea.health",
							name: "Claim/Evidence Health",
							version: "0.1.0",
							description: "Test plugin description.",
							surfaces: [],
							available: true,
							enabled: true,
							pinnedAt: null,
							settings: null,
						},
					],
				})
			)
		);
		elementAppearanceSlot.register({
			pluginId: "tea.health",
			useAppearance: (subject) =>
				subject.kind === "edge" &&
				subject.sourceElementId === "claim-1" &&
				subject.targetElementId === "node-1"
					? { tone: "negative", faded: false }
					: null,
		});
	});

	afterEach(() => {
		elementAppearanceSlot.resetForTests();
		resetPluginFetchDedupeForTests();
	});

	it("colours the edge the plugin answers for, and marks it", async () => {
		const path = renderWithAppearance({
			sourceElementId: "claim-1",
			targetElementId: "node-1",
		});

		await waitFor(() => expect(path?.style.stroke).toBe("var(--destructive)"));
		expect(path?.style.strokeOpacity).toBe("1");
		expect(path).toHaveAttribute("data-appearance", "negative");
	});

	it("draws a faded edge at a third of its strength", async () => {
		elementAppearanceSlot.resetForTests();
		elementAppearanceSlot.register({
			pluginId: "tea.health",
			useAppearance: () => ({ tone: "positive", faded: true }),
		});
		const path = renderWithAppearance({
			sourceElementId: "claim-1",
			targetElementId: "node-1",
		});

		await waitFor(() => expect(path?.style.stroke).toBe("var(--success)"));
		expect(path?.style.strokeOpacity).toBe("0.35");
		expect(path).toHaveAttribute("data-faded", "");
	});

	it("leaves an edge the plugin has no answer for exactly as it was", async () => {
		const path = renderWithAppearance({
			sourceElementId: "claim-1",
			targetElementId: "other-node",
		});

		await waitFor(() =>
			expect(document.querySelector("path")).toBeInTheDocument()
		);
		expect(path?.style.stroke).toBe("");
		expect(path).not.toHaveAttribute("data-appearance");
	});

	it("lets the selection highlight win over the plugin's colour", async () => {
		const path = renderWithAppearance({
			highlighted: true,
			sourceElementId: "claim-1",
			targetElementId: "node-1",
		});

		await waitFor(() =>
			expect(path?.style.stroke).toBe("var(--color-primary)")
		);
		expect(path?.style.strokeWidth).toBe("4");
		expect(path).not.toHaveAttribute("data-appearance");
	});
});
