import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./helpers/auth";
import {
	anyDialog,
	openCase,
	openGoalDialog,
	pressKeyOn,
} from "./helpers/case-keyboard";

const SPACE = "Space";
const LOSES_VALUE = /loses its value/;
const EMPTY_VALUE = /loses its value \(\)/;

function valueBox(page: Page, n: number): Locator {
	return page.getByRole("textbox", {
		name: `Context entry ${n} value`,
		exact: true,
	});
}

function removeName(page: Page, n: number): Locator {
	return page.getByRole("button", {
		name: `Remove name of context entry ${n}`,
	});
}

function keepName(page: Page): Locator {
	return page.getByRole("button", { name: "Keep name" });
}

function warning(page: Page): Locator {
	return page.getByRole("alert").filter({ hasText: LOSES_VALUE });
}

/** Opens the goal's dialog and gives its named entry a value. */
async function openWithValue(page: Page, value: string): Promise<void> {
	await openCase(page, "Simple Case");
	await openGoalDialog(page);
	await valueBox(page, 1).fill(value);
}

/** Adds a second named entry with a value, through the dialog's own controls. */
async function addSecondNamedEntry(page: Page): Promise<void> {
	await page.getByPlaceholder("Add new context...").fill("another meaning");
	await page.getByRole("button", { name: "Add", exact: true }).click();
	await page.getByRole("button", { name: "Name context entry 2" }).click();
	await page
		.getByRole("textbox", { name: "Context entry 2 name", exact: true })
		.fill("second");
	await valueBox(page, 2).fill("42 units");
}

test.describe("the un-name warning from the keyboard", () => {
	test("Space on Remove name opens the warning with focus on Keep name", async ({
		page,
	}) => {
		await openWithValue(page, "5 minutes");
		await pressKeyOn(page, removeName(page, 1), SPACE);
		await expect(warning(page)).toContainText("(5 minutes)");
		await expect(keepName(page)).toBeFocused();
	});

	test("Keep name by Space returns focus to Remove name, again and again", async ({
		page,
	}) => {
		await openWithValue(page, "5 minutes");
		for (let round = 0; round < 3; round++) {
			await pressKeyOn(page, removeName(page, 1), SPACE);
			await expect(keepName(page)).toBeFocused();
			await page.keyboard.press(SPACE);
			await expect(warning(page)).toHaveCount(0);
			await expect(removeName(page, 1)).toBeFocused();
		}
		await expect(page.getByRole("dialog")).toContainText("Editing G1");
	});

	test("Keep name by Enter also returns focus to Remove name", async ({
		page,
	}) => {
		await openWithValue(page, "5 minutes");
		await pressKeyOn(page, removeName(page, 1), "Enter");
		await page.keyboard.press("Enter");
		await expect(removeName(page, 1)).toBeFocused();
	});

	test("Tab from Keep name leaves the warning without passing the row's trash button", async ({
		page,
	}) => {
		await openWithValue(page, "5 minutes");
		await pressKeyOn(page, removeName(page, 1), SPACE);
		await page.keyboard.press("Tab");
		await expect(
			page.getByRole("textbox", { name: "Context entry 1", exact: true })
		).toBeFocused();
	});

	test("Shift+Tab from Keep name reaches Remove name and value first", async ({
		page,
	}) => {
		await openWithValue(page, "5 minutes");
		await pressKeyOn(page, removeName(page, 1), SPACE);
		await page.keyboard.press("Shift+Tab");
		await expect(
			page.getByRole("button", { name: "Remove name and value" })
		).toBeFocused();
	});

	test("clearing the value closes the warning without an empty value in it", async ({
		page,
	}) => {
		await openWithValue(page, "5 minutes");
		await pressKeyOn(page, removeName(page, 1), SPACE);
		await valueBox(page, 1).fill("");
		await expect(warning(page)).toHaveCount(0);
		await expect(page.getByText(EMPTY_VALUE)).toHaveCount(0);
	});

	test("a value of only spaces closes the warning", async ({ page }) => {
		await openWithValue(page, "5 minutes");
		await pressKeyOn(page, removeName(page, 1), SPACE);
		await valueBox(page, 1).fill("   ");
		await expect(warning(page)).toHaveCount(0);
	});

	test("editing the value keeps the warning and shows the new value", async ({
		page,
	}) => {
		await openWithValue(page, "5 minutes");
		await pressKeyOn(page, removeName(page, 1), SPACE);
		await valueBox(page, 1).fill("7 hours");
		await expect(warning(page)).toContainText("(7 hours)");
		await expect(warning(page)).not.toContainText("5 minutes");
	});

	test("after the warning closes on a cleared value, typing again does not reopen it", async ({
		page,
	}) => {
		await openWithValue(page, "5 minutes");
		await pressKeyOn(page, removeName(page, 1), SPACE);
		await valueBox(page, 1).fill("");
		await valueBox(page, 1).fill("9 days");
		await expect(warning(page)).toHaveCount(0);
	});

	test("with no value, Remove name removes the name at once", async ({
		page,
	}) => {
		await openCase(page, "Simple Case");
		await openGoalDialog(page);
		await pressKeyOn(page, removeName(page, 1), SPACE);
		await expect(warning(page)).toHaveCount(0);
		await expect(removeName(page, 1)).toHaveCount(0);
	});

	test("Remove name and value by Space turns the entry back into plain text", async ({
		page,
	}) => {
		await openWithValue(page, "5 minutes");
		await pressKeyOn(page, removeName(page, 1), SPACE);
		await pressKeyOn(
			page,
			page.getByRole("button", { name: "Remove name and value" }),
			SPACE
		);
		await expect(removeName(page, 1)).toHaveCount(0);
		await expect(page.getByRole("dialog")).toContainText("Editing G1");
	});

	test("Space on the dialog's Cancel still closes it with a warning open", async ({
		page,
	}) => {
		await openWithValue(page, "5 minutes");
		await pressKeyOn(page, removeName(page, 1), SPACE);
		await pressKeyOn(page, page.getByRole("button", { name: "Cancel" }), SPACE);
		await expect(anyDialog(page)).toHaveCount(0);
	});
});

test.describe("the un-name warning with several named entries", () => {
	test("each warning's Keep name returns focus to its own row", async ({
		page,
	}) => {
		await openWithValue(page, "5 minutes");
		await addSecondNamedEntry(page);
		await pressKeyOn(page, removeName(page, 2), SPACE);
		await pressKeyOn(page, removeName(page, 1), SPACE);
		await expect(keepName(page)).toHaveCount(2);
		await keepName(page).nth(1).focus();
		await page.keyboard.press(SPACE);
		await expect(removeName(page, 2)).toBeFocused();
		await expect(keepName(page)).toHaveCount(1);
		await keepName(page).first().focus();
		await page.keyboard.press(SPACE);
		await expect(removeName(page, 1)).toBeFocused();
	});

	test("clearing one entry's value closes only its own warning", async ({
		page,
	}) => {
		await openWithValue(page, "5 minutes");
		await addSecondNamedEntry(page);
		await pressKeyOn(page, removeName(page, 1), SPACE);
		await pressKeyOn(page, removeName(page, 2), SPACE);
		await valueBox(page, 1).fill("");
		await expect(keepName(page)).toHaveCount(1);
		await expect(warning(page)).toContainText("(42 units)");
		await expect(page.getByText(EMPTY_VALUE)).toHaveCount(0);
	});

	test("removing the first entry's name keeps the second entry's warning usable", async ({
		page,
	}) => {
		await openWithValue(page, "5 minutes");
		await addSecondNamedEntry(page);
		await pressKeyOn(page, removeName(page, 2), SPACE);
		await expect(keepName(page)).toBeFocused();
		await pressKeyOn(
			page,
			page.getByRole("button", { name: "Remove name and value" }),
			SPACE
		);
		await expect(removeName(page, 2)).toHaveCount(0);
		await expect(removeName(page, 1)).toBeVisible();
	});
});
