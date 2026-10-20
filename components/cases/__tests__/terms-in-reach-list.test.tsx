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
});
