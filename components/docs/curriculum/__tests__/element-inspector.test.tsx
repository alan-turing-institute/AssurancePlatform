import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { nodeTypeConfigs } from "@/components/shared/nodes/node-config";
import type { SelectedElementSummary } from "@/lib/docs/selected-element";
import { ELEMENT_GUIDE } from "@/lib/help/help-guide";
import ElementInspector from "../element-inspector";

const strategy: SelectedElementSummary = {
	id: "strategy-1",
	name: "S1",
	type: "strategy",
	isDefeater: false,
	attributes: { context: 2, assumption: false, justification: false },
	parent: { name: "G1", type: "goal" },
	children: [
		{ name: "P1", type: "property" },
		{ name: "P2", type: "property" },
	],
};

const EMPTY_STATE = /Select an element on the canvas/;
const RELATIONSHIP = /S1 supports G1, a goal\. S1 is supported by P1 and P2\./;
const CONTEXT_HINT = /Context:/;

describe("ElementInspector", () => {
	it("explains how to use it when nothing is selected", () => {
		render(<ElementInspector element={null} />);
		expect(screen.getByText(EMPTY_STATE)).toBeInTheDocument();
	});

	it("headlines the element with its type label and icon colour class", () => {
		const { container } = render(<ElementInspector element={strategy} />);
		expect(
			screen.getByRole("heading", {
				name: `${nodeTypeConfigs.strategy.label} S1`,
			})
		).toBeInTheDocument();
		expect(container.querySelector("svg")).toHaveClass(
			nodeTypeConfigs.strategy.colours.icon
		);
	});

	it("states how the element connects to its parent and children", () => {
		render(<ElementInspector element={strategy} />);
		expect(
			screen.getByText(
				/S1 supports G1, a goal\. S1 is supported by P1 and P2\./
			)
		).toBeInTheDocument();
	});

	it("hints at context on the card when the count is two", () => {
		render(<ElementInspector element={strategy} />);
		expect(screen.getByText(CONTEXT_HINT)).toHaveTextContent(
			"Use the chevron in the card's bottom-right corner to read it."
		);
	});

	it("shows a defeater chip for a defeater", () => {
		render(<ElementInspector element={{ ...strategy, isDefeater: true }} />);
		expect(screen.getByText("Defeater")).toBeInTheDocument();
	});

	it("links to the element's docs entry", () => {
		render(<ElementInspector element={strategy} />);
		expect(
			screen.getByRole("link", { name: "Read more about strategies" })
		).toHaveAttribute(
			"href",
			ELEMENT_GUIDE.find((g) => g.id === "STRATEGY")?.docsHref
		);
	});
});
