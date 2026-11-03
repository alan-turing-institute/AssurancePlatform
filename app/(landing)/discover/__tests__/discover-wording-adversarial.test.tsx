import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
	PublishableItemDetailResponse,
	PublishableItemSummaryResponse,
} from "@/lib/services/discover-transforms";

/**
 * What the Discover pages call themselves and the things they list: the
 * list page's title and introduction, and the item page for a case and for a
 * pattern, archived or not. The words stand for both kinds of item.
 */

const { fetchPublishedItems, fetchPublishedItemBySlug } = vi.hoisted(() => ({
	fetchPublishedItems: vi.fn(),
	fetchPublishedItemBySlug: vi.fn(),
}));

vi.mock("@/actions/discover", () => ({
	fetchPublishedItems,
	fetchPublishedItemBySlug,
}));

import DiscoverItemPage, { generateMetadata } from "../[slug]/page";
import DiscoverPage, { metadata } from "../page";

const FROZEN = /frozen/i;
const NO_LONGER_UPDATES = /no longer receives updates/;
const CASES = /\bcases?\b/i;
const PATTERNS = /\bpatterns?\b/i;
const OLD_TITLE = /case studies/i;
const ARCHIVED_NOTICE = /Archived on/;
const USE_THIS_PATTERN = { name: /Use this pattern/ };

beforeEach(() => {
	fetchPublishedItems.mockReset();
	fetchPublishedItemBySlug.mockReset();
});

function summary(
	id: string,
	type: PublishableItemSummaryResponse["type"]
): PublishableItemSummaryResponse {
	return {
		id,
		slug: `item-${id}`,
		title: `Item ${id}`,
		description: null,
		type,
		sector: null,
		authors: null,
		featureImageUrl: null,
		publishedAt: "2026-01-02T00:00:00.000Z",
		archivedAt: null,
	};
}

function detail(
	type: PublishableItemDetailResponse["type"],
	overrides: Partial<PublishableItemDetailResponse> = {}
): PublishableItemDetailResponse {
	return {
		...summary("one", type),
		description: "<p>What it is for</p>",
		content: { tree: {} },
		...overrides,
	};
}

describe("the Discover page", () => {
	it("is titled for cases and patterns, in the tab and in the page", async () => {
		fetchPublishedItems.mockResolvedValue([]);

		render(await DiscoverPage());

		const tabTitle = String(metadata.title);
		expect(tabTitle).toMatch(CASES);
		expect(tabTitle).toMatch(PATTERNS);
		expect(tabTitle).not.toMatch(OLD_TITLE);
		const heading = screen.getByRole("heading", { level: 2 });
		expect(heading.textContent).toMatch(CASES);
		expect(heading.textContent).toMatch(PATTERNS);
		expect(heading.textContent).not.toMatch(OLD_TITLE);
	});

	it("introduces both cases and patterns, and still says each is a frozen snapshot", async () => {
		fetchPublishedItems.mockResolvedValue([]);

		render(await DiscoverPage());

		const intro = screen.getByRole("heading", { level: 2 }).nextElementSibling;
		expect(intro?.textContent).toMatch(CASES);
		expect(intro?.textContent).toMatch(PATTERNS);
		expect(intro?.textContent).toMatch(FROZEN);
	});

	it("lists what the data feed returns, a case and a pattern each under its own badge, with the type filter in place", async () => {
		fetchPublishedItems.mockResolvedValue([
			summary("c", "ASSURANCE_CASE"),
			summary("p", "ARGUMENT_PATTERN"),
		]);

		render(await DiscoverPage());

		const [caseCard, patternCard] = screen.getAllByRole("article");
		expect(
			within(caseCard as HTMLElement).getByText("Worked example")
		).toBeVisible();
		expect(
			within(patternCard as HTMLElement).getByText("Reusable template")
		).toBeVisible();
		expect(
			screen.getByRole("combobox", { name: "Filter by type" })
		).toBeVisible();
	});
});

describe("the page of one published item", () => {
	it.each([
		["a pattern", "ARGUMENT_PATTERN", "Reusable template", "Worked example"],
		["a case", "ASSURANCE_CASE", "Worked example", "Reusable template"],
	] as const)("marks %s with its own badge and not the other", async (_name, type, badge, otherBadge) => {
		fetchPublishedItemBySlug.mockResolvedValue(detail(type));

		render(
			await DiscoverItemPage({ params: Promise.resolve({ slug: "item-one" }) })
		);

		expect(screen.getByText(badge)).toBeVisible();
		expect(screen.queryByText(otherBadge)).not.toBeInTheDocument();
	});

	it("offers Use this pattern for a pattern only", async () => {
		fetchPublishedItemBySlug.mockResolvedValue(detail("ARGUMENT_PATTERN"));
		const pattern = render(
			await DiscoverItemPage({ params: Promise.resolve({ slug: "p" }) })
		);
		expect(screen.getByRole("button", USE_THIS_PATTERN)).toBeVisible();
		pattern.unmount();

		fetchPublishedItemBySlug.mockResolvedValue(detail("ASSURANCE_CASE"));
		render(await DiscoverItemPage({ params: Promise.resolve({ slug: "c" }) }));
		expect(
			screen.queryByRole("button", USE_THIS_PATTERN)
		).not.toBeInTheDocument();
		expect(
			screen.getByRole("heading", { name: "Frozen snapshot" })
		).toBeVisible();
	});

	it.each([
		["ARGUMENT_PATTERN"],
		["ASSURANCE_CASE"],
	] as const)("says an archived %s no longer receives updates, in words that do not name the wrong kind of item", async (type) => {
		fetchPublishedItemBySlug.mockResolvedValue(
			detail(type, { archivedAt: "2026-02-01T00:00:00.000Z" })
		);

		render(
			await DiscoverItemPage({ params: Promise.resolve({ slug: "item-one" }) })
		);

		const text = screen.getByText(ARCHIVED_NOTICE).textContent ?? "";
		expect(text).toMatch(NO_LONGER_UPDATES);
		const namesOnlyCases = CASES.test(text) && !PATTERNS.test(text);
		expect(namesOnlyCases).toBe(false);
	});

	it("shows no archive notice for a live item of either kind", async () => {
		for (const type of ["ARGUMENT_PATTERN", "ASSURANCE_CASE"] as const) {
			fetchPublishedItemBySlug.mockResolvedValue(detail(type));
			const view = render(
				await DiscoverItemPage({ params: Promise.resolve({ slug: "x" }) })
			);
			expect(screen.queryByText(ARCHIVED_NOTICE)).not.toBeInTheDocument();
			view.unmount();
		}
	});

	it("is titled with the item's own title in the tab", async () => {
		fetchPublishedItemBySlug.mockResolvedValue(
			detail("ARGUMENT_PATTERN", { title: "A fairness pattern" })
		);

		const title = await generateMetadata({
			params: Promise.resolve({ slug: "item-one" }),
		});

		expect(String(title.title)).toContain("A fairness pattern");
	});
});
