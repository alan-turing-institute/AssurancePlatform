import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

/**
 * Both Discover filters have an accessible name, so a screen reader announces
 * what each one filters.
 */

const { fetchPublishedItems } = vi.hoisted(() => ({
	fetchPublishedItems: vi.fn(),
}));

vi.mock("@/actions/discover", () => ({
	fetchPublishedItems,
	fetchPublishedItemBySlug: vi.fn(),
}));

import DiscoverPage from "../page";

describe("the Discover filters", () => {
	it("name the sector filter as well as the type filter", async () => {
		fetchPublishedItems.mockResolvedValue([]);

		render(await DiscoverPage());

		expect(
			screen.getByRole("combobox", { name: "Filter by sector" })
		).toBeVisible();
		expect(
			screen.getByRole("combobox", { name: "Filter by type" })
		).toBeVisible();
	});
});
