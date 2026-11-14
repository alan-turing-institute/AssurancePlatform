import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { PublishableItemSummaryResponse } from "@/lib/services/discover-transforms";
import PublishedItems from "../published-items";

// The real select, not the shared stand-in: the stand-in shows a select's raw
// value until it has been opened once, so it cannot show what a visitor sees
// before touching the filter.
vi.mock(
	"@radix-ui/react-select",
	async (importOriginal) => await importOriginal()
);

/**
 * The Discover list's filter by type, alone and together with the search box
 * and the sector list; the badge each card carries; the empty state; and what
 * happens to an item whose type is not one the list knows.
 */

const CASE_BADGE = "Worked example";
const PATTERN_BADGE = "Reusable template";
const NOTHING_MATCHES = "No published items match your search criteria.";

type ItemType = PublishableItemSummaryResponse["type"];

function item(
	id: string,
	type: ItemType | undefined | null,
	overrides: Partial<PublishableItemSummaryResponse> = {}
): PublishableItemSummaryResponse {
	return {
		id,
		slug: `item-${id}`,
		title: `Item ${id}`,
		description: null,
		type: type as ItemType,
		sector: null,
		authors: null,
		featureImageUrl: null,
		publishedAt: "2026-01-02T00:00:00.000Z",
		archivedAt: null,
		...overrides,
	};
}

const ITEMS = [
	item("a", "ASSURANCE_CASE", { title: "Safety case", sector: "Health" }),
	item("b", "ASSURANCE_CASE", { title: "Fairness case", sector: "Energy" }),
	item("c", "ARGUMENT_PATTERN", { title: "Safety pattern", sector: "Health" }),
	item("d", "ARGUMENT_PATTERN", {
		title: "Fairness pattern",
		sector: "Energy",
	}),
	item("e", "ARGUMENT_PATTERN", {
		title: "Robustness pattern",
		sector: "Health",
	}),
];

function cards(): HTMLElement[] {
	return screen.queryAllByRole("article");
}

function titlesShown(): string[] {
	return cards().map(
		(card) => within(card).getByRole("heading").textContent ?? ""
	);
}

/** The pills in a card's header row: the type badge, the sector and the archive label. */
function pillsIn(card: HTMLElement): string[] {
	return [...card.querySelectorAll(".rounded-full")].map(
		(pill) => pill.textContent ?? ""
	);
}

function typeFilter() {
	return screen.getByRole("combobox", { name: "Filter by type" });
}

function sectorFilter() {
	const sector = screen
		.getAllByRole("combobox")
		.find((box) => box.getAttribute("aria-label") !== "Filter by type");
	if (!sector) {
		throw new Error("the sector filter is missing");
	}
	return sector;
}

type User = ReturnType<typeof userEvent.setup>;

async function chooseType(user: User, name: string) {
	await user.click(typeFilter());
	await user.click(screen.getByRole("option", { name }));
}

async function chooseSector(user: User, name: string) {
	await user.click(sectorFilter());
	await user.click(screen.getByRole("option", { name }));
}

async function search(user: User, text: string) {
	await user.type(
		screen.getByPlaceholderText("Search published items..."),
		text
	);
}

describe("the Discover list before any filter is chosen", () => {
	it("is on All types and lists every item", () => {
		render(<PublishedItems items={ITEMS} />);

		expect(typeFilter()).toHaveTextContent("All types");
		expect(titlesShown()).toEqual(ITEMS.map((entry) => entry.title));
	});

	it("marks each case as a worked example and each pattern as a reusable template, never both", () => {
		render(<PublishedItems items={ITEMS} />);

		for (const [index, card] of cards().entries()) {
			const pills = pillsIn(card);
			const expected =
				ITEMS[index]?.type === "ARGUMENT_PATTERN" ? PATTERN_BADGE : CASE_BADGE;
			const other = expected === CASE_BADGE ? PATTERN_BADGE : CASE_BADGE;
			expect(pills).toContain(expected);
			expect(pills).not.toContain(other);
		}
		expect(screen.getAllByText(CASE_BADGE)).toHaveLength(2);
		expect(screen.getAllByText(PATTERN_BADGE)).toHaveLength(3);
	});

	it("shows an archived pattern with both its type and the Archived label", () => {
		render(
			<PublishedItems
				items={[
					item("x", "ARGUMENT_PATTERN", {
						archivedAt: "2026-02-01T00:00:00.000Z",
					}),
				]}
			/>
		);

		const [card] = cards();
		expect(pillsIn(card as HTMLElement)).toEqual(
			expect.arrayContaining([PATTERN_BADGE, "Archived"])
		);
	});
});

describe("the type filter on its own", () => {
	it("shows only patterns for Patterns, in list order, each marked as a reusable template", async () => {
		const user = userEvent.setup();
		render(<PublishedItems items={ITEMS} />);

		await chooseType(user, "Patterns");

		expect(typeFilter()).toHaveTextContent("Patterns");
		expect(titlesShown()).toEqual([
			"Safety pattern",
			"Fairness pattern",
			"Robustness pattern",
		]);
		expect(screen.queryByText(CASE_BADGE)).not.toBeInTheDocument();
		expect(screen.getAllByText(PATTERN_BADGE)).toHaveLength(3);
	});

	it("shows only cases for Cases, in list order, each marked as a worked example", async () => {
		const user = userEvent.setup();
		render(<PublishedItems items={ITEMS} />);

		await chooseType(user, "Cases");

		expect(typeFilter()).toHaveTextContent("Cases");
		expect(titlesShown()).toEqual(["Safety case", "Fairness case"]);
		expect(screen.queryByText(PATTERN_BADGE)).not.toBeInTheDocument();
		expect(screen.getAllByText(CASE_BADGE)).toHaveLength(2);
	});

	it("goes back to every item, in the original order, when All types is chosen again", async () => {
		const user = userEvent.setup();
		render(<PublishedItems items={ITEMS} />);

		await chooseType(user, "Patterns");
		await chooseType(user, "Cases");
		await chooseType(user, "All types");

		expect(typeFilter()).toHaveTextContent("All types");
		expect(titlesShown()).toEqual(ITEMS.map((entry) => entry.title));
	});

	it("keeps a case and a pattern with the same title apart", async () => {
		const user = userEvent.setup();
		render(
			<PublishedItems
				items={[
					item("1", "ASSURANCE_CASE", { title: "Same title" }),
					item("2", "ARGUMENT_PATTERN", { title: "Same title" }),
				]}
			/>
		);

		expect(titlesShown()).toEqual(["Same title", "Same title"]);
		await chooseType(user, "Patterns");
		expect(cards()).toHaveLength(1);
		expect(pillsIn(cards()[0] as HTMLElement)).toContain(PATTERN_BADGE);
		await chooseType(user, "Cases");
		expect(cards()).toHaveLength(1);
		expect(pillsIn(cards()[0] as HTMLElement)).toContain(CASE_BADGE);
	});
});

describe("archived items under the type filter", () => {
	it("keep their type: an archived pattern is listed under Patterns and not under Cases, with the Archived label", async () => {
		const user = userEvent.setup();
		render(
			<PublishedItems
				items={[
					item("old-pattern", "ARGUMENT_PATTERN", {
						title: "Old pattern",
						archivedAt: "2026-02-01T00:00:00.000Z",
					}),
					item("old-case", "ASSURANCE_CASE", {
						title: "Old case",
						archivedAt: "2026-02-01T00:00:00.000Z",
					}),
				]}
			/>
		);

		await chooseType(user, "Patterns");
		expect(titlesShown()).toEqual(["Old pattern"]);
		expect(pillsIn(cards()[0] as HTMLElement)).toEqual(
			expect.arrayContaining([PATTERN_BADGE, "Archived"])
		);

		await chooseType(user, "Cases");
		expect(titlesShown()).toEqual(["Old case"]);
		expect(pillsIn(cards()[0] as HTMLElement)).toEqual(
			expect.arrayContaining([CASE_BADGE, "Archived"])
		);
	});
});

describe("the type filter together with search and sector", () => {
	it("applies search and type together, whichever was chosen first", async () => {
		const user = userEvent.setup();
		const first = render(<PublishedItems items={ITEMS} />);
		await chooseType(user, "Patterns");
		await search(user, "SAFETY");
		expect(titlesShown()).toEqual(["Safety pattern"]);
		first.unmount();

		render(<PublishedItems items={ITEMS} />);
		await search(user, "safety");
		expect(titlesShown()).toEqual(["Safety case", "Safety pattern"]);
		await chooseType(user, "Cases");
		expect(titlesShown()).toEqual(["Safety case"]);
	});

	it("applies sector and type together, and All Sectors widens only within the type", async () => {
		const user = userEvent.setup();
		render(<PublishedItems items={ITEMS} />);

		await chooseSector(user, "Health");
		await chooseType(user, "Patterns");
		expect(titlesShown()).toEqual(["Safety pattern", "Robustness pattern"]);

		await chooseType(user, "Cases");
		expect(titlesShown()).toEqual(["Safety case"]);

		await chooseSector(user, "All Sectors");
		expect(titlesShown()).toEqual(["Safety case", "Fairness case"]);
	});

	it("applies type, sector and search at once, and says nothing matches when they exclude every item", async () => {
		const user = userEvent.setup();
		render(<PublishedItems items={ITEMS} />);

		await chooseType(user, "Patterns");
		await chooseSector(user, "Health");
		await search(user, "robust");
		expect(titlesShown()).toEqual(["Robustness pattern"]);

		await user.clear(screen.getByPlaceholderText("Search published items..."));
		await search(user, "safety");
		expect(titlesShown()).toEqual(["Safety pattern"]);

		await user.clear(screen.getByPlaceholderText("Search published items..."));
		await search(user, "fairness");
		expect(titlesShown()).toEqual([]);
		expect(screen.getByText(NOTHING_MATCHES)).toBeVisible();
	});

	it("keeps the typed search and the chosen sector when the type changes", async () => {
		const user = userEvent.setup();
		render(<PublishedItems items={ITEMS} />);
		await search(user, "safety");
		await chooseSector(user, "Health");

		await chooseType(user, "Patterns");
		await chooseType(user, "All types");

		expect(
			screen.getByPlaceholderText("Search published items...")
		).toHaveValue("safety");
		expect(sectorFilter()).toHaveTextContent("Health");
		expect(titlesShown()).toEqual(["Safety case", "Safety pattern"]);
	});
});

describe("the empty state", () => {
	it("is shown for an empty list under every type, with no cards", async () => {
		const user = userEvent.setup();
		render(<PublishedItems items={[]} />);

		expect(screen.getByText(NOTHING_MATCHES)).toBeVisible();
		await chooseType(user, "Patterns");
		expect(screen.getByText(NOTHING_MATCHES)).toBeVisible();
		await chooseType(user, "Cases");
		expect(screen.getByText(NOTHING_MATCHES)).toBeVisible();
		expect(cards()).toHaveLength(0);
	});

	it("is shown when the chosen type has no items, and goes away when All types is chosen", async () => {
		const user = userEvent.setup();
		render(
			<PublishedItems
				items={[item("a", "ASSURANCE_CASE", { title: "Only" })]}
			/>
		);

		await chooseType(user, "Patterns");
		expect(cards()).toHaveLength(0);
		expect(screen.getByText(NOTHING_MATCHES)).toBeVisible();

		await chooseType(user, "All types");
		expect(screen.queryByText(NOTHING_MATCHES)).not.toBeInTheDocument();
		expect(titlesShown()).toEqual(["Only"]);
	});
});

describe("an item whose type is unknown or missing", () => {
	const ODD = [
		item("u", "SOMETHING_ELSE" as ItemType, { title: "Unknown type" }),
		item("m", undefined, { title: "Missing type" }),
		item("n", null, { title: "Null type" }),
		item("p", "ARGUMENT_PATTERN", { title: "A pattern" }),
		item("c", "ASSURANCE_CASE", { title: "A case" }),
	];

	it("does not stop the list rendering, and is listed under All types", () => {
		render(<PublishedItems items={ODD} />);

		expect(titlesShown()).toEqual([
			"Unknown type",
			"Missing type",
			"Null type",
			"A pattern",
			"A case",
		]);
	});

	it("is not passed off as a pattern or a case: it is left out of both filters", async () => {
		const user = userEvent.setup();
		render(<PublishedItems items={ODD} />);

		await chooseType(user, "Patterns");
		expect(titlesShown()).toEqual(["A pattern"]);
		await chooseType(user, "Cases");
		expect(titlesShown()).toEqual(["A case"]);
	});

	it("does not take either label, which would claim a type it does not have", () => {
		render(<PublishedItems items={ODD} />);

		for (const card of cards().slice(0, 3)) {
			expect(pillsIn(card)).not.toContain(PATTERN_BADGE);
			expect(pillsIn(card)).not.toContain(CASE_BADGE);
		}
	});

	it("does not show an empty badge in place of a label", () => {
		render(<PublishedItems items={ODD} />);

		for (const card of cards()) {
			for (const pill of pillsIn(card)) {
				expect(pill.trim()).not.toBe("");
			}
		}
	});
});
