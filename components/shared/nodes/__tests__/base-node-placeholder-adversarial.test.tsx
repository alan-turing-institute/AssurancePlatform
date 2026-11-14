import { afterEach, describe, expect, it } from "vitest";
import { renderWithReactFlow, screen } from "@/src/__tests__/utils/test-utils";
import useStore from "@/store/store";
import BaseNode from "../base-node";
import { buildNodeContainerClasses } from "../node-styles";

const HINT = "Say what this claim asserts";

function showCase(kind: "CASE" | "PATTERN"): void {
	useStore.setState({
		assuranceCase: {
			id: "case-1",
			name: "Test",
			type: "assurance-case",
			permissions: "manage",
			createdDate: new Date().toISOString(),
			comments: [],
			kind,
		},
	});
}

afterEach(() => {
	useStore.setState({ assuranceCase: null });
});

describe("a card for a placeholder in a case", () => {
	it("draws the hint in muted italics where the text will go, instead of the no-description note", () => {
		showCase("CASE");

		renderWithReactFlow(
			<BaseNode
				description=""
				isPlaceholder
				name="P1"
				nodeType="property"
				placeholderHint={HINT}
			/>
		);

		const hint = screen.getByText(HINT);
		expect(hint).toHaveClass("italic");
		expect(hint).toHaveClass("text-muted-foreground");
		expect(screen.queryByText("No description available")).toBeNull();
	});

	it("draws its own text, and not the hint, once it has some", () => {
		showCase("CASE");

		renderWithReactFlow(
			<BaseNode
				description="Operators are trained"
				isPlaceholder
				name="P1"
				nodeType="property"
				placeholderHint={HINT}
			/>
		);

		expect(screen.getByText("Operators are trained")).not.toHaveClass("italic");
		expect(screen.queryByText(HINT)).toBeNull();
	});

	it("draws the no-description note when it has neither text nor a hint", () => {
		showCase("CASE");

		renderWithReactFlow(
			<BaseNode description="" isPlaceholder name="P1" nodeType="property" />
		);

		expect(screen.getByText("No description available")).toBeInTheDocument();
	});

	it("draws the no-description note, not a stored hint, for an element that is not a placeholder", () => {
		showCase("CASE");

		renderWithReactFlow(
			<BaseNode
				description=""
				name="P1"
				nodeType="property"
				placeholderHint={HINT}
			/>
		);

		expect(screen.getByText("No description available")).toBeInTheDocument();
		expect(screen.queryByText(HINT)).toBeNull();
	});
});

describe("a card for a placeholder in a pattern", () => {
	it("draws the hint in italics where the text will go", () => {
		showCase("PATTERN");

		renderWithReactFlow(
			<BaseNode
				description=""
				isPlaceholder
				name="P1"
				nodeType="property"
				placeholderHint={HINT}
			/>
		);

		expect(screen.getByText(HINT)).toHaveClass("italic");
		expect(screen.queryByText("No description available")).toBeNull();
	});
});

describe("the outline of a card", () => {
	it.each([
		"goal",
		"strategy",
		"property",
		"evidence",
	] as const)("is dashed for a placeholder %s and solid otherwise", (nodeType) => {
		expect(
			buildNodeContainerClasses({ nodeType, isPlaceholder: true })
		).toContain("border-dashed");
		expect(buildNodeContainerClasses({ nodeType })).not.toContain(
			"border-dashed"
		);
	});

	it("stays dashed for a placeholder that is also a defeater, keeping the defeater border colour", () => {
		const classes = buildNodeContainerClasses({
			nodeType: "property",
			isPlaceholder: true,
			isDefeater: true,
		});

		expect(classes).toContain("border-dashed");
		expect(classes).toContain("border-destructive/60");
	});
});
