import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import useStore from "@/store/store";
import { PatternBanner } from "../pattern-banner";

function setKind(kind?: "CASE" | "PATTERN") {
	useStore.setState({
		assuranceCase: {
			id: "case-1",
			name: "Test case",
			type: "assurance-case",
			...(kind ? { kind } : {}),
			permissions: "view",
			createdDate: new Date().toISOString(),
			comments: [],
		} as never,
	});
}

afterEach(() => {
	useStore.setState({ assuranceCase: null });
});

describe("PatternBanner", () => {
	it("says the case on screen is a pattern", () => {
		setKind("PATTERN");
		render(<PatternBanner />);

		expect(screen.getByTestId("pattern-banner")).toHaveTextContent(
			"This is a pattern."
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
