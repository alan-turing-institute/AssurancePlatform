import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import useStore from "@/store/store";
import { PatternBanner } from "../pattern-banner";

function setKind(kind?: "CASE" | "PATTERN", permissions?: string) {
	useStore.setState({
		assuranceCase: {
			id: "case-1",
			name: "Test case",
			type: "assurance-case",
			...(kind ? { kind } : {}),
			...(permissions ? { permissions } : {}),
			createdDate: new Date().toISOString(),
			comments: [],
		} as never,
	});
}

afterEach(() => {
	useStore.setState({ assuranceCase: null });
});

describe("PatternBanner", () => {
	it.each([
		["edit"],
		["manage"],
	])("says you are editing a pattern with %s permission", (permissions) => {
		setKind("PATTERN", permissions);
		render(<PatternBanner />);

		expect(screen.getByTestId("pattern-banner")).toHaveTextContent(
			"You are editing a pattern."
		);
	});

	it.each([
		["view"],
		["review"],
		[undefined],
	])("says you are viewing a pattern with %s permission", (permissions) => {
		setKind("PATTERN", permissions);
		render(<PatternBanner />);

		expect(screen.getByTestId("pattern-banner")).toHaveTextContent(
			"You are viewing a pattern."
		);
	});

	it.each([
		["CASE" as const],
		[undefined],
	])("is absent for an ordinary case (kind: %s)", (kind) => {
		setKind(kind);
		render(<PatternBanner />);

		expect(screen.queryByTestId("pattern-banner")).not.toBeInTheDocument();
	});

	it("follows the stored kind when it changes while the editor is open", () => {
		setKind("CASE");
		const { rerender } = render(<PatternBanner />);
		expect(screen.queryByTestId("pattern-banner")).not.toBeInTheDocument();

		useStore.setState({
			assuranceCase: {
				...useStore.getState().assuranceCase,
				kind: "PATTERN",
			} as never,
		});
		rerender(<PatternBanner />);

		expect(screen.getByTestId("pattern-banner")).toBeInTheDocument();
	});
});
