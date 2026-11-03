import { describe, expect, it, vi } from "vitest";
import type { DefinedTerm } from "@/lib/case/defined-terms";
import { render, screen } from "@/src/__tests__/utils/test-utils";
import TermsInReachList from "../terms-in-reach-list";

function term(elementId: string): DefinedTerm {
	return {
		id: "k3f9x2m7qa",
		name: "window",
		text: `meaning on ${elementId}`,
		definedOn: { elementId, elementName: elementId },
	};
}

describe("TermsInReachList", () => {
	it("lists two terms that share an id without a repeated key", () => {
		const consoleError = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);

		render(<TermsInReachList terms={[term("G1"), term("S2")]} />, {
			withProviders: false,
		});

		expect(screen.getAllByRole("listitem")).toHaveLength(2);
		expect(consoleError).not.toHaveBeenCalled();
		consoleError.mockRestore();
	});
	it("lets a long unbroken value wrap inside the list instead of running past it", () => {
		const value = "x".repeat(160);
		render(
			<TermsInReachList
				terms={[
					{ ...term("G1"), variable: true, value },
					{ ...term("S2"), id: "a1b2c3d4e5", value },
				]}
			/>,
			{ withProviders: false }
		);

		for (const item of screen.getAllByRole("listitem")) {
			expect(item).toHaveClass("wrap-anywhere");
		}
		expect(screen.getByText(`(variable: ${value})`)).toBeInTheDocument();
		expect(screen.getByText(`Value: ${value}`)).toBeInTheDocument();
	});
});
