import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import useStore from "@/store/store";
import { PatternBanner } from "../pattern-banner";

function show(kind?: "CASE" | "PATTERN", permissions?: string): void {
	useStore.setState({
		assuranceCase: {
			id: "case-1",
			name: "Test",
			type: "assurance-case",
			createdDate: new Date().toISOString(),
			comments: [],
			...(kind ? { kind } : {}),
			...(permissions ? { permissions } : {}),
		} as never,
	});
}

const notice = () => screen.getByTestId("pattern-banner");

afterEach(() => {
	useStore.setState({ assuranceCase: null });
});

describe("the pattern notice wording", () => {
	it.each(["edit", "manage"])("says editing for %s", (permission) => {
		show("PATTERN", permission);
		render(<PatternBanner />);
		expect(notice()).toHaveTextContent("You are editing a pattern.");
	});

	it.each([
		"view",
		"review",
		"owner",
		"EDIT",
		"",
	])("says viewing for %j", (permission) => {
		show("PATTERN", permission);
		render(<PatternBanner />);
		expect(notice()).toHaveTextContent("You are viewing a pattern.");
	});

	it("says viewing when permission is missing", () => {
		show("PATTERN");
		render(<PatternBanner />);
		expect(notice()).toHaveTextContent("You are viewing a pattern.");
	});

	it("renders nothing for an ordinary case or no case", () => {
		show("CASE", "manage");
		const { container, rerender } = render(<PatternBanner />);
		expect(container).toBeEmptyDOMElement();
		act(() => useStore.setState({ assuranceCase: null }));
		rerender(<PatternBanner />);
		expect(container).toBeEmptyDOMElement();
	});

	it("updates when the kind or permission changes in the store", () => {
		show("CASE", "view");
		const { container } = render(<PatternBanner />);
		expect(container).toBeEmptyDOMElement();
		act(() => show("PATTERN", "view"));
		expect(notice()).toHaveTextContent("You are viewing a pattern.");
		act(() => show("PATTERN", "edit"));
		expect(notice()).toHaveTextContent("You are editing a pattern.");
		act(() => show("CASE", "edit"));
		expect(container).toBeEmptyDOMElement();
	});
});
