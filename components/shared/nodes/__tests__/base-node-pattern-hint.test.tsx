import { afterEach, describe, expect, it } from "vitest";
import { renderWithReactFlow, screen } from "@/src/__tests__/utils/test-utils";
import useStore from "@/store/store";
import BaseNode from "../base-node";

const HINT = "Say what this claim asserts";
const NONE = "No description available";

function showKind(kind: "CASE" | "PATTERN"): void {
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

function card(
	props: { description: string; isPlaceholder?: boolean; hint?: string },
	expanded: boolean
) {
	renderWithReactFlow(
		<BaseNode
			description={props.description}
			initialExpanded={expanded}
			isPlaceholder={props.isPlaceholder}
			name="P1"
			nodeType="property"
			placeholderHint={props.hint}
		/>
	);
}

afterEach(() => {
	useStore.setState({ assuranceCase: null });
});

describe.each([
	["collapsed", false],
	["expanded", true],
])("a %s card", (_label, expanded) => {
	it.each([
		["PATTERN" as const],
		["CASE" as const],
	])("shows the hint in muted italics for an empty placeholder in a %s", (kind) => {
		showKind(kind);
		card({ description: "", isPlaceholder: true, hint: HINT }, expanded);

		const hints = screen.getAllByText(HINT);
		expect(hints.length).toBeGreaterThan(0);
		for (const el of hints) {
			expect(el).toHaveClass("italic");
			expect(el).toHaveClass("text-muted-foreground");
		}
		expect(screen.queryByText(NONE)).toBeNull();
	});

	it.each([
		["PATTERN" as const],
		["CASE" as const],
	])("shows the text and not the hint for a filled placeholder in a %s", (kind) => {
		showKind(kind);
		card(
			{ description: "Operators are trained", isPlaceholder: true, hint: HINT },
			expanded
		);

		expect(screen.getAllByText("Operators are trained").length).toBeGreaterThan(
			0
		);
		expect(screen.queryByText(HINT)).toBeNull();
	});

	it("shows the no-description note for a non-placeholder with a stored hint in a pattern", () => {
		showKind("PATTERN");
		card({ description: "", hint: HINT }, expanded);

		expect(screen.getAllByText(NONE).length).toBeGreaterThan(0);
		expect(screen.queryByText(HINT)).toBeNull();
	});

	it("shows the no-description note for a placeholder with no hint in a pattern", () => {
		showKind("PATTERN");
		card({ description: "", isPlaceholder: true }, expanded);

		expect(screen.getAllByText(NONE).length).toBeGreaterThan(0);
	});
});
