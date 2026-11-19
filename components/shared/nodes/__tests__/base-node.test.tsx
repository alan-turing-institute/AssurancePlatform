import { afterEach, describe, expect, it } from "vitest";
import type { AssuranceCaseResponse } from "@/lib/services/case-response-types";
import { renderWithReactFlow, screen } from "@/src/__tests__/utils/test-utils";
import useStore from "@/store/store";
import BaseNode from "../base-node";

/**
 * ADR 0005 D2: a defeater is a decoration on its existing card — a
 * "Defeater" chip and a distinct destructive-token border — applied
 * centrally in BaseNode so every node kind gets it for free.
 */
describe("BaseNode — defeater decoration (ADR 0005 D2)", () => {
	it("shows no Defeater chip and the node kind's own border by default", () => {
		const { container } = renderWithReactFlow(
			<BaseNode description="A claim" name="P1" nodeType="property" />
		);

		expect(screen.queryByText("Defeater")).not.toBeInTheDocument();
		const card = container.querySelector(".border-2");
		expect(card).not.toHaveClass("border-destructive/60");
	});

	it("shows the Defeater chip and a destructive-token border when isDefeater is true", () => {
		const { container } = renderWithReactFlow(
			<BaseNode
				description="A counter-claim"
				isDefeater
				name="P2"
				nodeType="property"
			/>
		);

		expect(screen.getByText("Defeater")).toBeInTheDocument();
		const card = container.querySelector(".border-2");
		expect(card).toHaveClass("border-destructive/60");
	});

	it.each([
		"goal",
		"strategy",
		"property",
		"evidence",
	] as const)("applies the chip and border to the %s card kind too", (nodeType) => {
		renderWithReactFlow(
			<BaseNode
				description="Defeats something"
				isDefeater
				name="X1"
				nodeType={nodeType}
			/>
		);

		expect(screen.getByText("Defeater")).toBeInTheDocument();
	});
});

describe("BaseNode — placeholders", () => {
	afterEach(() => {
		useStore.setState({ assuranceCase: null });
	});

	it("draws a dashed outline for a placeholder and a solid one otherwise", () => {
		const placeholder = renderWithReactFlow(
			<BaseNode description="" isPlaceholder name="P1" nodeType="property" />
		);
		const outline = placeholder.container.querySelector(".border-2");
		placeholder.unmount();
		const ordinary = renderWithReactFlow(
			<BaseNode description="Written" name="P2" nodeType="property" />
		);

		expect(outline).toHaveClass("border-dashed");
		expect(ordinary.container.querySelector(".border-2")).not.toHaveClass(
			"border-dashed"
		);
	});

	it("shows the hint in a case in place of text it does not have yet", () => {
		renderWithReactFlow(
			<BaseNode
				description=""
				isPlaceholder
				name="G1"
				nodeType="goal"
				placeholderHint="Describe your top-level assurance goal"
			/>
		);

		expect(
			screen.getByText("Describe your top-level assurance goal")
		).toHaveClass("italic");
		expect(screen.queryByText("No description available")).toBeNull();
	});

	it("shows written text, not the hint, and the usual note when there is neither", () => {
		const written = renderWithReactFlow(
			<BaseNode
				description="Already written"
				isPlaceholder
				name="P1"
				nodeType="property"
				placeholderHint="A hint"
			/>
		);

		expect(screen.getByText("Already written")).toBeInTheDocument();
		expect(screen.queryByText("A hint")).toBeNull();
		written.unmount();
		renderWithReactFlow(
			<BaseNode description="" isPlaceholder name="P2" nodeType="property" />
		);

		expect(screen.getByText("No description available")).toBeInTheDocument();
	});

	it("shows a pattern's placeholder hint in italics, as a case does", () => {
		useStore.setState({
			assuranceCase: { kind: "PATTERN" } as AssuranceCaseResponse,
		});
		renderWithReactFlow(
			<BaseNode
				description=""
				isPlaceholder
				name="P1"
				nodeType="property"
				placeholderHint="A hint"
			/>
		);

		expect(screen.getByText("A hint")).toHaveClass("italic");
		expect(screen.queryByText("No description available")).toBeNull();
	});

	it("keeps the usual note for a pattern's non-placeholder with no text, and shows written text", () => {
		useStore.setState({
			assuranceCase: { kind: "PATTERN" } as AssuranceCaseResponse,
		});
		const empty = renderWithReactFlow(
			<BaseNode
				description=""
				name="P1"
				nodeType="property"
				placeholderHint="A hint"
			/>
		);

		expect(screen.getByText("No description available")).toBeInTheDocument();
		expect(screen.queryByText("A hint")).toBeNull();
		empty.unmount();
		renderWithReactFlow(
			<BaseNode
				description="Written"
				isPlaceholder
				name="P2"
				nodeType="property"
				placeholderHint="A hint"
			/>
		);

		expect(screen.getByText("Written")).toBeInTheDocument();
		expect(screen.queryByText("A hint")).toBeNull();
	});
});

/**
 * A plugin's appearance (the `element-appearance` slot): a tint on a layer
 * under the content, faded or not. A card with no appearance is drawn exactly
 * as before.
 */
describe("BaseNode — a card given no terms", () => {
	it("writes a stored reference as {name} and highlights nothing", () => {
		const { container } = renderWithReactFlow(
			<BaseNode
				description="Within the {win#k3f9x2m7qa}"
				name="E1"
				nodeType="evidence"
			/>
		);

		expect(screen.getByText("Within the {win}")).toBeInTheDocument();
		expect(container.querySelector("[data-reference-id]")).toBeNull();
	});
});

describe("BaseNode — plugin appearance", () => {
	it("draws no appearance layer and no marker by default", () => {
		const { container } = renderWithReactFlow(
			<BaseNode description="Evidence" name="E1" nodeType="evidence" />
		);

		expect(container.querySelector("[data-plugin-display]")).toBeNull();
		expect(container.querySelector("[data-appearance]")).toBeNull();
		expect(container.querySelector(".border-2")).not.toHaveClass("isolate");
	});

	it.each([
		["positive", "from-success/15"],
		["caution", "from-warning/15"],
		["negative", "from-destructive/15"],
		["neutral", "from-muted-foreground/15"],
	] as const)("tints a %s card on a layer under the content", (tone, tint) => {
		const { container } = renderWithReactFlow(
			<BaseNode
				appearance={{ tone, faded: false }}
				description="Evidence"
				name="E1"
				nodeType="evidence"
			/>
		);

		const card = container.querySelector(".border-2");
		expect(card).toHaveAttribute("data-appearance", tone);
		expect(card).not.toHaveAttribute("data-faded");
		const layer = container.querySelector("[data-plugin-display]");
		expect(layer).toHaveClass(tint, "-z-10");
		expect(layer).toHaveAttribute("aria-hidden", "true");
		expect(card).toHaveClass("isolate");
	});

	it("veils a faded card and draws its tint at a third of the strength", () => {
		const { container } = renderWithReactFlow(
			<BaseNode
				appearance={{ tone: "positive", faded: true }}
				description="Evidence"
				name="E1"
				nodeType="evidence"
			/>
		);

		const layer = container.querySelector("[data-plugin-display]");
		expect(layer).toHaveClass("bg-muted/65", "from-success/5");
		expect(layer).not.toHaveClass("from-success/15");
		expect(container.querySelector(".border-2")).toHaveAttribute(
			"data-faded",
			""
		);
	});

	it("keeps the text outside the tinted layer", () => {
		renderWithReactFlow(
			<BaseNode
				appearance={{ tone: "negative", faded: true }}
				description="Readable text"
				name="E1"
				nodeType="evidence"
			/>
		);

		expect(screen.getByText("Readable text")).not.toHaveClass("opacity-30");
		expect(
			screen.getByText("Readable text").closest("[data-plugin-display]")
		).toBeNull();
	});
});
