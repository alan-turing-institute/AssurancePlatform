import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { UnsupportedMarkerBadge } from "../unsupported-marker-badge";

// The repo-wide tooltip mock opens on focus and adds nothing of its own, so it
// would hide a tab stop the real primitive added. These tests need the real one.
vi.unmock("@radix-ui/react-tooltip");

const EXPLANATION =
	"Nothing supports this yet. Add a strategy, claim or evidence beneath it, or set its status (for example to Needs support or Assumed).";

describe("UnsupportedMarkerBadge", () => {
	it("shows the word Unsupported as visible text", () => {
		render(<UnsupportedMarkerBadge />);

		expect(screen.getByText("Unsupported")).toBeVisible();
	});

	it("takes its accessible name from its text, with no aria-label on the div", () => {
		render(<UnsupportedMarkerBadge />);

		const badge = screen.getByText("Unsupported");

		expect(badge.tagName).toBe("DIV");
		expect(badge).not.toHaveAttribute("aria-label");
	});

	it("adds no tab stop", async () => {
		const user = userEvent.setup();
		render(<UnsupportedMarkerBadge />);

		await user.tab();

		expect(screen.getByText("Unsupported")).not.toHaveFocus();
		expect(screen.getByText("Unsupported")).not.toHaveAttribute("tabindex");
	});

	it("explains itself in plain words on a mouse hover", async () => {
		const user = userEvent.setup();
		render(<UnsupportedMarkerBadge />);

		await user.hover(screen.getByText("Unsupported"));

		await waitFor(() =>
			expect(screen.getAllByText(EXPLANATION).length).toBeGreaterThan(0)
		);
	});

	it("draws the explanation outside the card, in a box with a width limit", async () => {
		const user = userEvent.setup();
		const { container } = render(<UnsupportedMarkerBadge />);

		await user.hover(screen.getByText("Unsupported"));

		const box = (await screen.findAllByText(EXPLANATION))
			.map((node) => node.closest(".max-w-xs"))
			.find((found) => found !== null);
		expect(box).toBeDefined();
		expect(container.contains(box ?? null)).toBe(false);
	});

	it("has no accessibility violations", async () => {
		const { container } = render(
			<main>
				<h1>Case</h1>
				<UnsupportedMarkerBadge />
			</main>
		);

		const results = await axe(container);

		expect(results.violations).toEqual([]);
	});

	it("is tagged so a capture of the diagram leaves it out", () => {
		render(<UnsupportedMarkerBadge />);

		expect(screen.getByText("Unsupported")).toHaveAttribute(
			"data-derived-display"
		);
	});
});
