import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./helpers/auth";
import { CASE_URL_PATTERN } from "./helpers/constants";
import { DashboardPage } from "./pages/dashboard-page";

// Closing a sheet or dialog must hand keyboard focus back to the control
// that opened it, whether it was opened from the keyboard or by mouse, and
// whether it opened from a toolbar button, a menu item, a popover button or
// from inside another dialog.

const TOOLBAR_OPENERS = [
	"toolbar-case-information",
	"toolbar-help",
	"toolbar-notes",
	"toolbar-json",
	"toolbar-share",
] as const;

const MENU_ITEMS = ["Move", "Detach", "Delete"] as const;
const COMMENTS_BUTTON = /^View comments(?: \(\d+\))?$/;
const DIALOG_SELECTOR = "[role='dialog'],[role='alertdialog']";
const DISCARD_PROMPT = "No, keep editing";

async function openSimpleCase(page: Page) {
	const dashboard = new DashboardPage(page);
	await dashboard.goto();
	await dashboard.caseCard("Simple Case").click();
	await page.waitForURL(CASE_URL_PATTERN);
	await expect(page.getByTestId("toolbar-delete")).toBeVisible();
}

async function openFromKeyboard(opener: Locator) {
	await opener.focus();
	await expect(opener).toBeFocused();
	await opener.press("Enter");
}

async function visibleDialog(page: Page) {
	const dialog = page.locator(DIALOG_SELECTOR).last();
	await expect(dialog).toBeVisible();
	return dialog;
}

async function expectFocusInSheet(page: Page) {
	await expect
		.poll(() =>
			page.evaluate(
				() => document.activeElement?.closest("[role='dialog']") !== null
			)
		)
		.toBe(true);
}

// A person takes a moment before dismissing a dialog; opening one from a
// menu or popover lets that control finish closing first.
const READING_PAUSE_MS = 800;

async function closeWithEscape(page: Page, { pause = false } = {}) {
	const dialog = await visibleDialog(page);
	if (pause) {
		await page.waitForTimeout(READING_PAUSE_MS);
	}
	await page.keyboard.press("Escape");
	// A tooltip on the focused control may take the first Escape.
	await page.waitForTimeout(300);
	if (await dialog.isVisible()) {
		await page.keyboard.press("Escape");
	}
	await expect(dialog).toBeHidden();
}

async function closeWithButton(
	page: Page,
	name: string,
	{ pause = false } = {}
) {
	const dialog = await visibleDialog(page);
	if (pause) {
		await page.waitForTimeout(READING_PAUSE_MS);
	}
	await dialog.getByRole("button", { name, exact: true }).click();
	await expect(dialog).toBeHidden();
}

test.describe("Focus return: toolbar sheets and dialogs", () => {
	for (const testId of TOOLBAR_OPENERS) {
		test(`${testId} opened from the keyboard returns focus on Escape`, async ({
			page,
		}) => {
			await openSimpleCase(page);
			const opener = page.getByTestId(testId);
			await openFromKeyboard(opener);
			await closeWithEscape(page);
			await expect(opener).toBeFocused();
		});

		test(`${testId} opened by mouse returns focus on Escape`, async ({
			page,
		}) => {
			await openSimpleCase(page);
			const opener = page.getByTestId(testId);
			await opener.click();
			await closeWithEscape(page);
			await expect(opener).toBeFocused();
		});

		test(`${testId} returns focus when closed with its Close button`, async ({
			page,
		}) => {
			await openSimpleCase(page);
			const opener = page.getByTestId(testId);
			await openFromKeyboard(opener);
			await closeWithButton(page, "Close");
			await expect(opener).toBeFocused();
		});
	}

	test("opening and closing twice returns focus both times", async ({
		page,
	}) => {
		await openSimpleCase(page);
		const first = page.getByTestId("toolbar-help");
		const second = page.getByTestId("toolbar-notes");
		await openFromKeyboard(first);
		await closeWithEscape(page);
		await expect(first).toBeFocused();
		await openFromKeyboard(second);
		await closeWithEscape(page);
		await expect(second).toBeFocused();
	});
});

test.describe("Focus return: confirmation nested in the Case Information sheet", () => {
	async function openDirtySheet(page: Page) {
		const opener = page.getByTestId("toolbar-case-information");
		await openFromKeyboard(opener);
		const sheet = await visibleDialog(page);
		const name = sheet.getByRole("textbox").first();
		await name.fill("Renamed but not saved");
		await page.keyboard.press("Escape");
		await expect(
			page.getByRole("button", { name: DISCARD_PROMPT })
		).toBeVisible();
		return opener;
	}

	test("keeping the edits leaves focus inside the sheet, not on the page body", async ({
		page,
	}) => {
		await openSimpleCase(page);
		await openDirtySheet(page);
		await page.getByRole("button", { name: DISCARD_PROMPT }).click();
		await expect(
			page.getByRole("button", { name: DISCARD_PROMPT })
		).toBeHidden();
		await expectFocusInSheet(page);
	});

	test("discarding the edits returns focus to Case Information", async ({
		page,
	}) => {
		await openSimpleCase(page);
		const opener = await openDirtySheet(page);
		await page
			.getByRole("button", { name: "Yes, discard changes!", exact: true })
			.click();
		await expect(page.locator(DIALOG_SELECTOR)).toHaveCount(0);
		await expect(opener).toBeFocused();
	});

	test("Escape on the nested confirmation keeps focus inside the sheet", async ({
		page,
	}) => {
		await openSimpleCase(page);
		await openDirtySheet(page);
		await page.keyboard.press("Escape");
		await expect(
			page.getByRole("button", { name: DISCARD_PROMPT })
		).toBeHidden();
		await expect(page.locator(DIALOG_SELECTOR)).toHaveCount(1);
		await expectFocusInSheet(page);
	});
});

test.describe("Focus return: element controls on the canvas", () => {
	test("every Edit element button gets focus back on Escape and on Cancel", async ({
		page,
	}) => {
		await openSimpleCase(page);
		const buttons = page.getByRole("button", {
			name: "Edit element",
			exact: true,
		});
		await expect(buttons.first()).toBeVisible();
		const count = await buttons.count();
		expect(count).toBeGreaterThan(1);
		for (let i = 0; i < count; i++) {
			const opener = buttons.nth(i);
			await openFromKeyboard(opener);
			await closeWithEscape(page);
			await expect(opener).toBeFocused();
			await openFromKeyboard(opener);
			await closeWithButton(page, "Cancel");
			await expect(opener).toBeFocused();
		}
	});

	test("Edit element opened by mouse returns focus on Escape", async ({
		page,
	}) => {
		await openSimpleCase(page);
		const opener = page
			.getByRole("button", { name: "Edit element", exact: true })
			.first();
		await opener.click();
		await closeWithEscape(page);
		await expect(opener).toBeFocused();
	});

	test("every comments button gets focus back on Escape", async ({ page }) => {
		await openSimpleCase(page);
		const buttons = page.getByRole("button", { name: COMMENTS_BUTTON });
		await expect(buttons.first()).toBeVisible();
		const count = await buttons.count();
		expect(count).toBeGreaterThan(0);
		for (let i = 0; i < count; i++) {
			const opener = buttons.nth(i);
			await openFromKeyboard(opener);
			await closeWithEscape(page);
			await expect(opener).toBeFocused();
		}
	});

	test("Search opened from the keyboard returns focus on Escape", async ({
		page,
	}) => {
		await openSimpleCase(page);
		const opener = page.getByRole("button", { name: "Search" });
		await openFromKeyboard(opener);
		await closeWithEscape(page);
		await expect(opener).toBeFocused();
	});

	test("an Add element dialog returns focus to the Add child button", async ({
		page,
	}) => {
		await openSimpleCase(page);
		const opener = page
			.getByRole("button", { name: "Add child element", exact: true })
			.first();
		await openFromKeyboard(opener);
		const option = page
			.getByText("Add Element")
			.locator("..")
			.getByRole("button");
		await option.first().click();
		await closeWithEscape(page, { pause: true });
		await expect(opener).toBeFocused();
	});
});

test.describe("Focus return: dialogs opened from the More options menu", () => {
	function moreOptions(page: Page) {
		return page
			.getByRole("button", { name: "More options", exact: true })
			.first();
	}

	async function chooseItem(page: Page, name: string) {
		await page.getByRole("menuitem", { name, exact: true }).press("Enter");
	}

	for (const item of MENU_ITEMS) {
		test(`${item} from the keyboard returns focus on Escape`, async ({
			page,
		}) => {
			await openSimpleCase(page);
			const trigger = moreOptions(page);
			await openFromKeyboard(trigger);
			await chooseItem(page, item);
			await closeWithEscape(page, { pause: true });
			await expect(trigger).toBeFocused();
		});

		test(`${item} by mouse returns focus on Escape`, async ({ page }) => {
			await openSimpleCase(page);
			const trigger = moreOptions(page);
			await trigger.click();
			await page.getByRole("menuitem", { name: item, exact: true }).click();
			await closeWithEscape(page, { pause: true });
			await expect(trigger).toBeFocused();
		});
	}

	for (const item of ["Detach", "Delete"] as const) {
		test(`${item} confirmation returns focus on Cancel`, async ({ page }) => {
			await openSimpleCase(page);
			const trigger = moreOptions(page);
			await openFromKeyboard(trigger);
			await chooseItem(page, item);
			await closeWithButton(page, "Cancel", { pause: true });
			await expect(trigger).toBeFocused();
		});
	}
});
