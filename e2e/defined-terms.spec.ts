import path from "node:path";
import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./helpers/auth";
import { CASE_URL_PATTERN } from "./helpers/constants";
import { DashboardPage } from "./pages/dashboard-page";

const INPUTS_OPTION = /inputs/;
const ADD_NAME_BUTTON = /^Name context entry \d+$/;
const AXE_SCRIPT = path.resolve("node_modules/axe-core/axe.min.js");

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

async function openPropertyClaimEditor(page: Page) {
	await openSimpleCase(page);
	const editButton = cardButton(page, "P1", "Edit element");
	await editButton.waitFor({ state: "visible" });
	await editButton.click();
	const dialog = page.getByRole("dialog", { name: "Editing P1", exact: true });
	const description = dialog.getByRole("textbox", {
		name: "Description",
		exact: true,
	});
	await expect(description).toBeVisible();
	return { dialog, description };
}

/** Adds a plain context entry to the open dialog and gives it a name, without saving. */
async function addNamedEntry(dialog: Locator, page: Page, name: string) {
	await dialog.getByPlaceholder("Add new context...").fill(`${name} meaning`);
	await dialog.getByRole("button", { name: "Add", exact: true }).click();
	await dialog.getByRole("button", { name: ADD_NAME_BUTTON }).last().click();
	// A new name box takes focus.
	await page.keyboard.type(name);
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
		const description = dialog.getByRole("textbox", {
			name: "Description",
			exact: true,
		});
		await expect(description).toBeVisible();
		await description.click();
		await page.keyboard.press("ControlOrMeta+End");
		await page.keyboard.type(" and {");

		// The list names the entry and the element it is defined on.
		const list = page.getByRole("listbox", {
			name: "Terms you can insert",
			exact: true,
		});
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

		await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
		await expect(dialog).not.toBeVisible();
	});

	test("Escape closes only the list when no term matches what was typed", async ({
		page,
	}) => {
		const { dialog, description } = await openPropertyClaimEditor(page);
		await description.click();
		await page.keyboard.press("ControlOrMeta+End");
		await page.keyboard.type(" and {zzz");

		const note = page.getByText("No matching terms.", { exact: true });
		await expect(note).toBeVisible();

		await page.keyboard.press("Escape");
		await expect(note).not.toBeVisible();
		await expect(dialog).toBeVisible();
		await expect(description).toContainText("and {zzz");

		await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
		await expect(dialog).not.toBeVisible();
	});

	test("braces typed as plain text do not open the list", async ({ page }) => {
		const { dialog, description } = await openPropertyClaimEditor(page);
		await description.click();
		await page.keyboard.press("ControlOrMeta+End");
		await page.keyboard.type(" {like this} and more");

		await expect(description).toContainText("{like this} and more");
		await expect(
			page.getByRole("dialog", { name: "Insert a term", exact: true })
		).toHaveCount(0);

		await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
		await expect(dialog).not.toBeVisible();
	});

	test("the open pick-list, with enough terms to scroll, passes an accessibility scan", async ({
		page,
	}) => {
		const { dialog, description } = await openPropertyClaimEditor(page);
		for (const name of ["alpha", "beta", "gamma", "delta", "epsilon"]) {
			await addNamedEntry(dialog, page, name);
		}
		await description.click();
		await page.keyboard.press("ControlOrMeta+End");
		await page.keyboard.type(" {");

		const popover = page.getByRole("dialog", {
			name: "Insert a term",
			exact: true,
		});
		await expect(popover).toBeVisible();
		await expect(
			popover.getByRole("option", { name: INPUTS_OPTION })
		).toBeVisible();

		await page.addScriptTag({ path: AXE_SCRIPT });
		const violations = await page.evaluate(async () => {
			const scope = Array.from(document.querySelectorAll('[role="dialog"]'));
			const results = await (
				window as unknown as {
					axe: {
						run: (context: { include: Element[] }) => Promise<{
							violations: Array<{ id: string; nodes: unknown[] }>;
						}>;
					};
				}
			).axe.run({ include: scope });
			return results.violations.map((violation) => ({
				id: violation.id,
				nodes: violation.nodes.length,
			}));
		});
		expect(violations).toEqual([]);

		await page.keyboard.press("Escape");
		await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
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
