import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PublishableItemSummaryResponse } from "@/lib/services/discover-transforms";

/**
 * The sector filter on the Discover list is found by its name, whatever the
 * selected value shows, and it is the only control with that name.
 */

vi.mock("@/actions/discover", () => ({
	fetchPublishedItems: vi.fn(),
	fetchPublishedItemBySlug: vi.fn(),
}));

import PublishedItems from "../_components/published-items";

function item(
	id: string,
	sector: string | null
): PublishableItemSummaryResponse {
	return {
		id,
		slug: `item-${id}`,
		title: `Item ${id}`,
		description: null,
		type: "ASSURANCE_CASE",
		sector,
		authors: null,
		featureImageUrl: null,
		publishedAt: "2026-01-02T00:00:00.000Z",
		archivedAt: null,
	};
}

describe("PublishedItems sector filter", () => {
	it.each([
		["with sectors", [item("1", "Health"), item("2", "Energy")]],
		["with items that have no sector", [item("3", null)]],
	])("is a combobox named Filter by sector %s", (_label, items) => {
		render(<PublishedItems items={items} />);

		expect(
			screen.getAllByRole("combobox", { name: "Filter by sector" })
		).toHaveLength(1);
	});
});
