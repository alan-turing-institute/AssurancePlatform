import { render, screen } from "@testing-library/react";
import type React from "react";
import type { NodeProps } from "reactflow";
import { Position } from "reactflow";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BaseNode from "@/components/shared/nodes/base-node";
import { useEdgeAppearance } from "@/hooks/use-element-appearance";
import type { ElementAppearance } from "@/lib/plugins/slots";
import {
	CASE_ID,
	type CanvasWorld,
	enablePlugins,
	installCanvasWorld,
	NODE_ID,
	registerHealthOnly,
	removeCanvasWorld,
	settle,
} from "@/src/__tests__/utils/live-node-canvas-kit";
import {
	expiredResult,
	healthStatus,
	liveNodeItem,
} from "@/src/__tests__/utils/live-node-ui-kit";
import EvidenceNode from "../evidence-node";
import SupportEdge from "../support-edge";

vi.mock("@/hooks/use-plugin-enablement", () => ({
	useEnabledPluginIds: vi.fn(),
}));

// The repo-wide reactflow mock lacks what the node's action menu and the
// edge's path need, so this restores them for this file only.
vi.mock("reactflow", async () => {
	const actual = await vi.importActual<typeof import("reactflow")>("reactflow");
	const ReactLib: typeof React = require("react");
	return {
		getSmoothStepPath: actual.getSmoothStepPath,
		Position: { Top: "top", Right: "right", Bottom: "bottom", Left: "left" },
		ReactFlowProvider: ({ children }: { children: React.ReactNode }) =>
			children,
		useNodes: () => [],
		useEdges: () => [],
		useReactFlow: () => ({
			fitView: vi.fn(),
			getNodes: vi.fn(() => []),
			getEdges: vi.fn(() => []),
		}),
		Handle: ({ id }: { id?: string }) =>
			ReactLib.createElement("div", { "data-handle": id }),
	};
});

vi.mock("@/hooks/use-element-appearance", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@/hooks/use-element-appearance")>();
	return { ...actual, useEdgeAppearance: vi.fn(actual.useEdgeAppearance) };
});

const TONES = ["positive", "caution", "negative", "neutral"] as const;
const NODE_NAME_WITH_BADGE_PHRASE =
	/^E4\s*,\s*Live results for P1\. Health: failing\s*,\s*Results from the check/;
const OPACITY_CLASS = /(^|\s)opacity-/;

function card(container: HTMLElement) {
	const found = container.querySelector(".border-2");
	if (!found) {
		throw new Error("no card");
	}
	return found as HTMLElement;
}

function borderClasses(element: Element) {
	return [...element.classList]
		.filter((name) => name.startsWith("border"))
		.sort();
}

describe("a node drawn with a plugin's appearance", () => {
	function draw(
		appearance: ElementAppearance | null | undefined,
		extra: {
			initialExpanded?: boolean;
			isDefeater?: boolean;
			selected?: boolean;
		} = {}
	) {
		return render(
			<BaseNode
				appearance={appearance}
				description="Results from the check"
				name="E4"
				nodeType="evidence"
				{...extra}
			/>
		);
	}

	it.each(
		TONES
	)("paints its %s tint on a layer of its own, not on the card or its text", (tone) => {
		const { container } = draw({ tone, faded: false });
		const element = card(container);

		expect(element).toHaveAttribute("data-appearance", tone);
		const layers = element.querySelectorAll("[data-plugin-display]");
		expect(layers).toHaveLength(1);
		expect(layers[0]).toHaveAttribute("aria-hidden", "true");
		expect(layers[0]?.textContent).toBe("");
		expect(layers[0]?.contains(screen.getByText("E4"))).toBe(false);
	});

	it.each([
		["positive", "success"],
		["caution", "warning"],
		["negative", "destructive"],
		["neutral", "muted-foreground"],
	] as const)("tints the %s tone with the theme's %s colour and no other", (tone, token) => {
		const others = ["success", "warning", "destructive"].filter(
			(name) => name !== token
		);
		for (const faded of [false, true]) {
			const { container, unmount } = draw({ tone, faded });
			const layer = card(container).querySelector("[data-plugin-display]");
			const classes = layer?.getAttribute("class") ?? "";

			expect(classes).toContain(`from-${token}/`);
			if (token !== "muted-foreground") {
				expect(classes).not.toContain("muted-foreground");
			}
			for (const other of others) {
				expect(classes).not.toContain(`from-${other}/`);
			}
			unmount();
		}
	});

	it("fades a card that has no tone without tinting it, leaving its border and fill colours alone", () => {
		const plain = draw(null);
		const colourClasses = (element: Element) =>
			[...element.classList].filter(
				(name) =>
					name.startsWith("bg-") ||
					name.startsWith("border") ||
					name.startsWith("ring")
			);
		const plainColours = colourClasses(card(plain.container));
		plain.unmount();

		const { container } = draw({ tone: null, faded: true });
		const element = card(container);
		const layer = element.querySelector("[data-plugin-display]");
		const classes = layer?.getAttribute("class") ?? "";

		expect(element).toHaveAttribute("data-appearance", "plain");
		expect(element).toHaveAttribute("data-faded");
		expect(classes).toContain("bg-muted/65");
		expect(classes).not.toContain("from-");
		expect(classes).not.toContain("to-");
		expect(colourClasses(element)).toEqual(plainColours);
	});

	it("draws the card's secondary text in the full text colour, on its content and not on the tint, only while an appearance is set", () => {
		const FULL_TEXT = '[class~="[--muted-foreground:var(--foreground)]"]';
		const plain = draw(null);
		expect(plain.container.querySelector(FULL_TEXT)).toBeNull();
		plain.unmount();

		for (const initialExpanded of [false, true]) {
			for (const appearance of [
				{ tone: "neutral", faded: false },
				{ tone: null, faded: true },
			] as const) {
				const drawn = draw(appearance, { initialExpanded });
				const element = card(drawn.container);
				const layer = element.querySelector("[data-plugin-display]");

				expect(element.matches(FULL_TEXT)).toBe(false);
				expect(layer?.closest(FULL_TEXT)).toBeNull();
				for (const content of [
					...screen.getAllByText("E4"),
					screen.getByText("Results from the check"),
					screen.getByRole("button", {
						name: initialExpanded ? "Collapse node" : "Expand node",
					}),
				]) {
					expect(content.closest(FULL_TEXT)).not.toBeNull();
				}
				drawn.unmount();
			}
		}
	});

	it("draws the expanded footer's identifier in the whole secondary text colour only while an appearance is set", () => {
		function footerIdentifier(appearance: ElementAppearance | null) {
			const { container, unmount } = render(
				<BaseNode
					appearance={appearance}
					description="Results from the check"
					initialExpanded
					name="E4"
					nodeType="evidence"
				/>
			);
			const classes = container.querySelector("span.font-mono")?.className;
			unmount();
			return classes ?? "";
		}

		expect(footerIdentifier(null)).toContain("text-muted-foreground/70");
		expect(footerIdentifier({ tone: "caution", faded: true })).not.toContain(
			"/70"
		);
		expect(footerIdentifier({ tone: null, faded: true })).toContain(
			"text-muted-foreground"
		);
	});

	it("keeps the text at full contrast when the node is faded", () => {
		const { container } = draw({ tone: "negative", faded: true });
		const element = card(container);

		expect(element).toHaveAttribute("data-faded");
		expect(element.className).not.toMatch(OPACITY_CLASS);
		for (
			let current: HTMLElement | null = screen.getByText("E4");
			current && current !== element.parentElement;
			current = current.parentElement
		) {
			expect(current.className).not.toMatch(OPACITY_CLASS);
			expect(current.style.opacity).toBe("");
		}
	});

	it("draws a faded tint differently from a full one", () => {
		const full = draw({ tone: "positive", faded: false });
		const fullLayer = card(full.container)
			.querySelector("[data-plugin-display]")
			?.getAttribute("class");
		full.unmount();
		const faded = draw({ tone: "positive", faded: true });
		const fadedLayer = card(faded.container)
			.querySelector("[data-plugin-display]")
			?.getAttribute("class");

		expect(fadedLayer).not.toBe(fullLayer);
		expect(card(faded.container)).toHaveAttribute("data-faded");
	});

	it.each(
		TONES
	)("leaves the card's border alone for the %s tone, so a verdict never looks like a defeater", (tone) => {
		const plain = draw(null);
		const plainBorder = borderClasses(card(plain.container));
		plain.unmount();

		const tinted = draw({ tone, faded: false });

		expect(borderClasses(card(tinted.container))).toEqual(plainBorder);
		expect(card(tinted.container).className).not.toContain(
			"border-destructive"
		);
	});

	it("keeps a defeater's border whatever the tint", () => {
		const { container } = draw(
			{ tone: "positive", faded: false },
			{ isDefeater: true }
		);

		expect(card(container)).toHaveClass("border-destructive/60");
		expect(screen.getByText("Defeater")).toBeInTheDocument();
	});

	it("keeps the selection ring when the node is selected", () => {
		const plain = draw(null, { selected: true });
		const ring = [...card(plain.container).classList].filter((name) =>
			name.startsWith("ring")
		);
		plain.unmount();
		expect(ring.length).toBeGreaterThan(0);

		const tinted = draw({ tone: "negative", faded: false }, { selected: true });

		expect(
			[...card(tinted.container).classList].filter((name) =>
				name.startsWith("ring")
			)
		).toEqual(ring);
	});

	it("is drawn exactly as before when no appearance is given", () => {
		const unspecified = draw(undefined);
		const none = draw(null);

		expect(card(none.container).outerHTML).toBe(
			card(unspecified.container).outerHTML
		);
		expect(card(none.container)).not.toHaveAttribute("data-appearance");
		expect(
			card(none.container).querySelector("[data-plugin-display]")
		).toBeNull();
	});

	it("has the same text with and without an appearance", () => {
		const plain = draw(null);
		const plainText = card(plain.container).textContent;
		plain.unmount();

		const tinted = draw({ tone: "caution", faded: true });

		expect(card(tinted.container).textContent).toBe(plainText);
	});
});

describe("a support edge drawn with a plugin's appearance", () => {
	const PROPS = {
		id: "e1",
		sourceX: 100,
		sourceY: 40,
		sourcePosition: Position.Bottom,
		targetX: 100,
		targetY: 400,
		targetPosition: Position.Top,
		source: "a",
		target: "b",
	};

	function drawEdge(data: Record<string, unknown> = {}, style?: object) {
		const props = {
			...PROPS,
			style,
			data: { sourceElementId: "claim-1", targetElementId: "node-1", ...data },
		} as unknown as Parameters<typeof SupportEdge>[0];
		const view = render(
			// biome-ignore lint/a11y/noSvgWithoutTitle: test fixture, not UI
			<svg>
				<SupportEdge {...props} />
			</svg>
		);
		const path = view.container.querySelector(".react-flow__edge-path");
		if (!path) {
			throw new Error("no edge path");
		}
		return path as SVGPathElement;
	}

	function answer(appearance: ElementAppearance | null) {
		vi.mocked(useEdgeAppearance).mockReturnValue(appearance);
	}

	it("asks about the line by the ids of the two elements it joins", () => {
		answer(null);

		drawEdge();

		expect(useEdgeAppearance).toHaveBeenCalledWith("claim-1", "node-1");
	});

	it.each([
		["positive", "--success"],
		["caution", "--warning"],
		["negative", "--destructive"],
		["neutral", "--muted-foreground"],
	] as const)("colours the %s tone from the theme's %s colour", (tone, token) => {
		answer({ tone, faded: false });

		const path = drawEdge();

		expect(path.style.stroke).toBe(`var(${token})`);
		expect(path).toHaveAttribute("data-appearance", tone);
		expect(path.style.strokeDasharray).toBe("");
		expect(path.getAttribute("class")).not.toContain("highlighted");
	});

	it("draws a faded line at about a third of its strength and a full one at full strength", () => {
		answer({ tone: "positive", faded: false });
		const full = drawEdge();
		const fullOpacity = Number(full.style.strokeOpacity || "1");
		answer({ tone: "positive", faded: true });
		const faded = drawEdge();
		const fadedOpacity = Number(faded.style.strokeOpacity);

		expect(fullOpacity).toBe(1);
		expect(fadedOpacity).toBeGreaterThan(0.2);
		expect(fadedOpacity).toBeLessThan(0.5);
		expect(faded).toHaveAttribute("data-faded");
		expect(full).not.toHaveAttribute("data-faded");
	});

	it("fades a line that has no tone without changing its colour or width", () => {
		answer({ tone: null, faded: true });

		const path = drawEdge({}, { strokeWidth: 5 });

		expect(path.style.stroke).toBe("");
		expect(path.style.strokeWidth).toBe("5");
		expect(Number(path.style.strokeOpacity)).toBeGreaterThan(0.2);
		expect(Number(path.style.strokeOpacity)).toBeLessThan(0.5);
		expect(path).toHaveAttribute("data-appearance", "plain");
		expect(path).toHaveAttribute("data-faded");
	});

	it("lets the selection highlight replace the colour on the edges it marks", () => {
		answer({ tone: "positive", faded: true });

		const path = drawEdge({ highlighted: true });

		expect(path.style.stroke).toBe("var(--color-primary)");
		expect(path.style.strokeDasharray).not.toBe("");
		expect(path.getAttribute("class")).toContain(
			"case-edge__path--highlighted"
		);
		expect(path).not.toHaveAttribute("data-appearance");
		expect(path).not.toHaveAttribute("data-faded");
		expect(Number(path.style.strokeOpacity || "1")).toBe(1);
	});

	it("is drawn exactly as before when no plugin answers", () => {
		answer(null);
		const withStyle = drawEdge({}, { strokeWidth: 5 });
		expect(withStyle.getAttribute("style")).toBe("stroke-width: 5;");
		expect(withStyle).not.toHaveAttribute("data-appearance");
		expect(withStyle).not.toHaveAttribute("data-faded");

		const bare = drawEdge();
		expect(bare.getAttribute("style")).toBeNull();
	});
});

describe("an evidence node on the canvas", () => {
	let world: CanvasWorld;

	beforeEach(() => {
		vi.mocked(useEdgeAppearance).mockRestore();
		world = installCanvasWorld();
		enablePlugins(["tea.health"]);
		registerHealthOnly();
	});

	afterEach(() => {
		removeCanvasWorld();
	});

	function props(id: string): NodeProps {
		return {
			id: `evidence-${id}`,
			data: { id, name: "E4", description: "Results from the check" },
			type: "evidence",
			selected: false,
			zIndex: 0,
			isConnectable: true,
			xPos: 0,
			yPos: 0,
			dragging: false,
		} as NodeProps;
	}

	it("shows its tint and its live badge while it is a live node", async () => {
		world.list = [
			liveNodeItem({ id: NODE_ID, status: healthStatus({ verdict: "fail" }) }),
		];

		const { container } = render(<EvidenceNode {...props(NODE_ID)} />);
		await settle();

		expect(card(container)).toHaveAttribute("data-appearance", "negative");
		expect(screen.getByTestId("live-node-badge")).toHaveTextContent("Failing");
	});

	it("reads its badge's label as a phrase of its own in the name of the node's button", async () => {
		world.list = [
			liveNodeItem({ id: NODE_ID, status: healthStatus({ verdict: "fail" }) }),
		];

		render(
			// biome-ignore lint/a11y/useSemanticElements: React Flow gives its node wrapper, a div, this role, and the wrapper is what carries the name
			<div role="button" tabIndex={0}>
				<EvidenceNode {...props(NODE_ID)} />
			</div>
		);
		await settle();

		expect(
			screen.getByRole("button", { name: NODE_NAME_WITH_BADGE_PHRASE })
		).toBeInTheDocument();
	});

	it("fades the tint of a live node whose result is out of date", async () => {
		world.list = [liveNodeItem({ id: NODE_ID, status: expiredResult("pass") })];

		const { container } = render(<EvidenceNode {...props(NODE_ID)} />);
		await settle();

		expect(card(container)).toHaveAttribute("data-appearance", "positive");
		expect(card(container)).toHaveAttribute("data-faded");
		expect(screen.getByTestId("live-node-badge")).toHaveTextContent(
			"Out of date"
		);
	});

	it("draws ordinary evidence with no tint and no badge", async () => {
		world.list = [liveNodeItem({ id: "some-other-node" })];

		const { container } = render(<EvidenceNode {...props(NODE_ID)} />);
		await settle();

		expect(card(container)).not.toHaveAttribute("data-appearance");
		expect(
			card(container).querySelector('[data-plugin-display][aria-hidden="true"]')
		).toBeNull();
		expect(screen.queryByTestId("live-node-badge")).toBeNull();
		expect(screen.getByTestId("element-badge-slot").textContent).toBe("");
		expect(world.requests.some((url) => url.includes(CASE_ID))).toBe(true);
	});
});
