import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
	getPlaceholderIndicator,
	withPlaceholderIndicator,
} from "../placeholder-badge";

// The repo-wide tooltip mock opens on focus and adds nothing of its own; the
// hover is what these tests look at, so they need the real primitive.
vi.unmock("@radix-ui/react-tooltip");

describe("getPlaceholderIndicator", () => {
	it("gives nothing for an element that is not a placeholder, so the card draws no wrapper", () => {
		expect(getPlaceholderIndicator({})).toBeNull();
		expect(getPlaceholderIndicator({ isPlaceholder: false })).toBeNull();
	});

	it("shows the words To fill in, and the hint on hover", async () => {
		const user = userEvent.setup();
		render(
			getPlaceholderIndicator({
				isPlaceholder: true,
				placeholderHint: "Name the hazard",
			})
		);

		await user.hover(screen.getByText("To fill in"));

		await waitFor(() =>
			expect(screen.getAllByText("Name the hazard").length).toBeGreaterThan(0)
		);
	});

	it("says so on hover when the author gave no hint", async () => {
		const user = userEvent.setup();
		render(getPlaceholderIndicator({ isPlaceholder: true }));

		await user.hover(screen.getByText("To fill in"));

		await waitFor(() =>
			expect(
				screen.getAllByText("This element is still to be filled in.").length
			).toBeGreaterThan(0)
		);
	});
});

describe("withPlaceholderIndicator", () => {
	it("puts the badge in front of the others, and leaves a card with neither as it was", () => {
		const { container } = render(
			withPlaceholderIndicator({ isPlaceholder: true }, <span>Other</span>)
		);

		expect(container.textContent).toBe("To fill inOther");
		expect(withPlaceholderIndicator({}, null)).toBeNull();
		expect(withPlaceholderIndicator({}, "Other")).toBe("Other");
	});
});
