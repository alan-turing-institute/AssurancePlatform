// biome-ignore-all lint/suspicious/noMisplacedAssertion: the helpers below are called from within it() blocks
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { getPlaceholderIndicator } from "../placeholder-badge";

// The repo-wide tooltip mock opens on focus and adds nothing of its own, so it
// would hide how the real primitive behaves for a keyboard user.
vi.unmock("@radix-ui/react-tooltip");

const HINT = "Say what the claim asserts, in one sentence";
const HINT_PATTERN = new RegExp(HINT);
const MOST_TAB_STOPS = 6;

function renderBadge() {
	return render(
		<main>
			<h1>Case</h1>
			{getPlaceholderIndicator({ isPlaceholder: true, placeholderHint: HINT })}
		</main>
	);
}

/** Whether the element's accessible name or description carries the hint. */
function carriesHint(element: HTMLElement): boolean {
	for (const check of [
		() => expect(element).toHaveAccessibleName(HINT_PATTERN),
		() => expect(element).toHaveAccessibleDescription(HINT_PATTERN),
	]) {
		try {
			check();
			return true;
		} catch {
			// Try the next way the hint could be carried.
		}
	}
	return false;
}

/** Presses Tab until a stop carries the hint, and returns that stop. */
async function tabToHint(
	user: ReturnType<typeof userEvent.setup>
): Promise<HTMLElement | null> {
	for (let press = 0; press < MOST_TAB_STOPS; press++) {
		await user.tab();
		const stop = document.activeElement;
		if (stop instanceof HTMLElement && carriesHint(stop)) {
			return stop;
		}
	}
	return null;
}

describe("the To fill in badge, for a keyboard user", () => {
	it("is reached by Tab at a stop whose accessible name or description carries the hint", async () => {
		const user = userEvent.setup();
		renderBadge();

		const stop = await tabToHint(user);

		expect(stop).not.toBeNull();
	});

	it("shows the hint on screen once that stop has focus", async () => {
		const user = userEvent.setup();
		renderBadge();

		await tabToHint(user);

		await waitFor(() =>
			expect(screen.getAllByText(HINT).length).toBeGreaterThan(0)
		);
	});

	it("still shows the words To fill in as visible text", () => {
		renderBadge();

		expect(screen.getByText("To fill in")).toBeVisible();
	});

	it("shows the hint on a mouse hover, as before", async () => {
		const user = userEvent.setup();
		renderBadge();

		await user.hover(screen.getByText("To fill in"));

		await waitFor(() =>
			expect(screen.getAllByText(HINT).length).toBeGreaterThan(0)
		);
	});
});
