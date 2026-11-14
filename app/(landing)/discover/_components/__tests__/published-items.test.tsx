import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { PublishableItemSummaryResponse } from "@/lib/services/discover-transforms";
import PublishedItems from "../published-items";

function item(
	id: string,
	type: PublishableItemSummaryResponse["type"],
	overrides: Partial<PublishableItemSummaryResponse> = {}
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
		...overrides,
	};
}

const ITEMS = [
	item("alpha", "ASSURANCE_CASE", { title: "Alpha case" }),
	item("beta", "ARGUMENT_PATTERN", { title: "Beta pattern" }),
	item("gamma", "ARGUMENT_PATTERN", { title: "Gamma pattern" }),
];

function titlesShown(): string[] {
	return screen
		.queryAllByRole("article")
		.map((card) => within(card).getByRole("heading").textContent ?? "");
}

async function chooseType(
	user: ReturnType<typeof userEvent.setup>,
	name: string
) {
	await user.click(screen.getByRole("combobox", { name: "Filter by type" }));
	await user.click(screen.getByRole("option", { name }));
}

describe("the Discover list", () => {
	it("shows cases and patterns together, each marked with its type", () => {
		render(<PublishedItems items={ITEMS} />);

		expect(titlesShown()).toEqual([
			"Alpha case",
			"Beta pattern",
			"Gamma pattern",
		]);
		const [caseCard, patternCard] = screen.getAllByRole("article");
		expect(
			within(caseCard as HTMLElement).getByText("Worked example")
		).toBeVisible();
		expect(
			within(patternCard as HTMLElement).getByText("Reusable template")
		).toBeVisible();
	});

	it("offers All types, Cases and Patterns", async () => {
		const user = userEvent.setup();
		render(<PublishedItems items={ITEMS} />);

		await user.click(screen.getByRole("combobox", { name: "Filter by type" }));

		expect(
			screen.getAllByRole("option").map((option) => option.textContent)
		).toEqual(["All types", "Cases", "Patterns"]);
	});

	it("filters to patterns, to cases, and back to everything", async () => {
		const user = userEvent.setup();
		render(<PublishedItems items={ITEMS} />);

		await chooseType(user, "Patterns");
		expect(titlesShown()).toEqual(["Beta pattern", "Gamma pattern"]);

		await chooseType(user, "Cases");
		expect(titlesShown()).toEqual(["Alpha case"]);

		await chooseType(user, "All types");
		expect(titlesShown()).toEqual([
			"Alpha case",
			"Beta pattern",
			"Gamma pattern",
		]);
	});

	it("applies the type filter together with the search", async () => {
		const user = userEvent.setup();
		render(
			<PublishedItems
				items={[
					item("one", "ARGUMENT_PATTERN", {
						title: "Fairness pattern",
						sector: "Health",
					}),
					item("two", "ARGUMENT_PATTERN", {
						title: "Safety pattern",
						sector: "Energy",
					}),
					item("three", "ASSURANCE_CASE", {
						title: "Fairness case",
						sector: "Health",
					}),
				]}
			/>
		);

		await chooseType(user, "Patterns");
		await user.type(
			screen.getByPlaceholderText("Search published items..."),
			"fairness"
		);

		expect(titlesShown()).toEqual(["Fairness pattern"]);
	});

	it("says nothing matches when the chosen type has no items", async () => {
		const user = userEvent.setup();
		render(<PublishedItems items={[item("alpha", "ASSURANCE_CASE")]} />);

		await chooseType(user, "Patterns");

		expect(titlesShown()).toEqual([]);
		expect(
			screen.getByText("No published items match your search criteria.")
		).toBeVisible();
	});
});
