import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UnsupportedMarkersForm } from "../unsupported-markers-form";

vi.mock("@/actions/unsupported-markers", () => ({
	fetchShowUnsupportedMarkers: vi.fn(),
	saveShowUnsupportedMarkers: vi.fn(),
}));

describe("UnsupportedMarkersForm", () => {
	it("is not a setting that says it is saved to the browser", () => {
		render(<UnsupportedMarkersForm initialValue={true} />);

		const form = screen.getByTestId("unsupported-markers-form");
		expect(form.textContent).toContain("account");
		expect(form.textContent?.toLowerCase()).not.toContain(
			"saved to your browser"
		);
	});
});
