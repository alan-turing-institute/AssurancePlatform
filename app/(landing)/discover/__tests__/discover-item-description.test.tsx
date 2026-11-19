import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublishableItemDetailResponse } from "@/lib/services/discover-transforms";

const { fetchPublishedItemBySlug } = vi.hoisted(() => ({
	fetchPublishedItemBySlug: vi.fn(),
}));

vi.mock("@/actions/discover", () => ({
	fetchPublishedItemBySlug,
}));

import DiscoverItemPage from "../[slug]/page";

function detail(description: string): PublishableItemDetailResponse {
	return {
		id: "one",
		slug: "item-one",
		title: "Item one",
		description,
		type: "ASSURANCE_CASE",
		sector: null,
		authors: null,
		featureImageUrl: null,
		publishedAt: "2026-01-02T00:00:00.000Z",
		archivedAt: null,
		content: { tree: {} },
	};
}

async function renderPage(description: string) {
	fetchPublishedItemBySlug.mockResolvedValue(detail(description));
	return render(
		await DiscoverItemPage({ params: Promise.resolve({ slug: "item-one" }) })
	);
}

describe("the Discover item page description", () => {
	beforeEach(() => {
		fetchPublishedItemBySlug.mockReset();
	});

	it("keeps typed line breaks in one text element that preserves them", async () => {
		await renderPage("Line one\nLine two");

		const text = screen.getByText(
			(_, element) => element?.textContent === "Line one\nLine two"
		);
		expect(text.tagName).toBe("P");
		expect(text).toHaveClass("whitespace-pre-line");
	});

	it("shows typed markup as text, never as elements", async () => {
		const typed = "<a href=x target=_blank rel=opener>link</a>";
		const { container } = await renderPage(typed);

		expect(screen.getByText(typed)).toBeVisible();
		expect(container.querySelector("a[target]")).toBeNull();
	});
});
