import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CaseList from "@/components/cases/case-list";

beforeEach(() => {
	// jsdom here has no working localStorage; CaseList reads its saved sort.
	vi.stubGlobal("localStorage", {
		getItem: () => null,
		setItem: () => undefined,
	});
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("the Import File button in the case list", () => {
	it("keeps its accessible name below the md breakpoint", () => {
		render(<CaseList assuranceCases={[]} />);

		const button = screen.getByRole("button", { name: "Import File" });
		const label = screen.getByText("Import File");

		expect(button).toContainElement(label);
		// jsdom applies no stylesheet, so assert the classes: the label is
		// visually hidden below md rather than removed from layout, and it is
		// shown as ordinary text from md up.
		expect(label).toHaveClass("sr-only", "md:not-sr-only");
		expect(label).not.toHaveClass("hidden");
	});
});
