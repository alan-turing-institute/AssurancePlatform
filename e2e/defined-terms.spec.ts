import type { Page } from "@playwright/test";
import { expect, test } from "./helpers/auth";
import { CASE_URL_PATTERN } from "./helpers/constants";
import { DashboardPage } from "./pages/dashboard-page";

const INPUTS_OPTION = /inputs/;

// Simple Case's G1 names a context entry `inputs`, and P1 refers to it.
// Neither test saves, so the seeded case is as the other specs expect it.

// A card's own wrapper is a button whose name folds in everything inside it,
// so the buttons are found inside the card and by exact name.
function cardButton(page: Page, card: string, name: string) {
	return page
		.locator(".react-flow__node", { hasText: card })
		.getByRole("button", { name, exact: true });
}

async function openSimpleCase(page: Page) {
	const dashboard = new DashboardPage(page);
	await dashboard.goto();
	await dashboard.caseCard("Simple Case").click();
	await page.waitForURL(CASE_URL_PATTERN);
}

test.describe("Defined terms", () => {
	test("typing { in a description lists the terms in reach; Escape closes only the list and a click inserts one", async ({
		page,
	}) => {
		await openSimpleCase(page);
		const editButton = cardButton(page, "P1", "Edit element");
		await editButton.waitFor({ state: "visible" });
		await editButton.click();

		const dialog = page.getByRole("dialog");
		const description = dialog.getByRole("textbox", { name: "Description" });
		await expect(description).toBeVisible();
		await description.click();
		await page.keyboard.press("ControlOrMeta+End");
		await page.keyboard.type(" and {");

		// The list names the entry and the element it is defined on.
		const list = page.getByRole("listbox", { name: "Terms you can insert" });
		await expect(list).toBeVisible();
		await expect(
			list.getByRole("option", { name: INPUTS_OPTION })
		).toContainText("G1");

		// Escape closes the list and leaves the dialog and the typed text.
		await page.keyboard.press("Escape");
		await expect(list).not.toBeVisible();
		await expect(dialog).toBeVisible();
		await expect(description).toContainText("and {");

		// Picking a term with the mouse inserts it as a highlighted word.
		await page.keyboard.press("Backspace");
		await page.keyboard.type("{");
		await expect(list).toBeVisible();
		await list.getByRole("option", { name: INPUTS_OPTION }).click();
		await expect(list).not.toBeVisible();
		await expect(dialog).toBeVisible();
		await expect(description.locator('span[data-type="mention"]')).toHaveCount(
			2
		);

		await dialog.getByRole("button", { name: "Cancel" }).click();
		await expect(dialog).not.toBeVisible();
	});

	test("an expanded card shows a reference's meaning and where it is defined when hovered", async ({
		page,
	}) => {
		await openSimpleCase(page);
		const expand = cardButton(page, "P1", "Expand node");
		await expand.waitFor({ state: "visible" });
		await expand.click();

		const word = page
			.locator(".react-flow__node", { hasText: "P1" })
			.locator('[data-reference-state="found"]');
		await expect(word).toHaveText("inputs");

		// Expanding a card lays the diagram out again once it has finished
		// moving, so the word can slip from under the pointer; hover again until
		// the tooltip stays.
		const tooltip = page.getByRole("tooltip");
		await expect(async () => {
			await word.hover();
			await expect(tooltip).toBeVisible({ timeout: 1000 });
		}).toPass();
		await expect(tooltip).toContainText(
			"all data that users or other systems send to the system"
		);
		await expect(tooltip).toContainText("Defined on G1");
	});
});
