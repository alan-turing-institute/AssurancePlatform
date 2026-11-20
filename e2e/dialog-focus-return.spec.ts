import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./helpers/auth";
import { CASE_URL_PATTERN } from "./helpers/constants";
import { DashboardPage } from "./pages/dashboard-page";

// Dialogs on the case page and dashboard are opened by state, not by a
// Radix trigger, so closing one must return focus to the control that
// opened it rather than leaving it on the page body.

const PUBLISHED_DIALOG_NAME = "This case is published on Discover";

async function openCase(page: Page, name: string) {
	const dashboard = new DashboardPage(page);
	await dashboard.goto();
	await dashboard.caseCard(name).click();
	await page.waitForURL(CASE_URL_PATTERN);
	await expect(page.getByTestId("toolbar-delete")).toBeVisible();
}

async function openWithKeyboard(opener: Locator) {
	await opener.focus();
	await expect(opener).toBeFocused();
	await opener.press("Enter");
}

async function closeWithEscape(page: Page, dialog: Locator) {
	await expect(dialog).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(dialog).toBeHidden();
}

async function closeWithButton(dialog: Locator, name: string) {
	await expect(dialog).toBeVisible();
	await dialog.getByRole("button", { name, exact: true }).click();
	await expect(dialog).toBeHidden();
}

test.describe("Dialog focus return", () => {
	test("Escape on the trash confirmation returns focus to Delete", async ({
		page,
	}) => {
		await openCase(page, "Simple Case");
		const opener = page.getByTestId("toolbar-delete");
		await openWithKeyboard(opener);

		await closeWithEscape(
			page,
			page.getByRole("dialog", { name: "Are you sure?", exact: true })
		);
		await expect(opener).toBeFocused();
	});

	test("Cancel on the trash confirmation returns focus to Delete", async ({
		page,
	}) => {
		await openCase(page, "Simple Case");
		const opener = page.getByTestId("toolbar-delete");
		await openWithKeyboard(opener);

		await closeWithButton(
			page.getByRole("dialog", { name: "Are you sure?", exact: true }),
			"Cancel"
		);
		await expect(opener).toBeFocused();
	});

	test("Escape on Reset Identifiers returns focus to its button", async ({
		page,
	}) => {
		await openCase(page, "Simple Case");
		const opener = page.getByTestId("toolbar-reset-ids");
		await openWithKeyboard(opener);

		await closeWithEscape(
			page,
			page.getByRole("dialog", { name: "Are you sure?", exact: true })
		);
		await expect(opener).toBeFocused();
	});

	test("Cancel on Reset Identifiers returns focus to its button", async ({
		page,
	}) => {
		await openCase(page, "Simple Case");
		const opener = page.getByTestId("toolbar-reset-ids");
		await openWithKeyboard(opener);

		await closeWithButton(
			page.getByRole("dialog", { name: "Are you sure?", exact: true }),
			"No, keep current identifiers"
		);
		await expect(opener).toBeFocused();
	});

	test("Escape on the published-case dialog returns focus to Delete", async ({
		page,
	}) => {
		await openCase(page, "Medium Case");
		const opener = page.getByTestId("toolbar-delete");
		await openWithKeyboard(opener);

		await closeWithEscape(
			page,
			page.getByRole("alertdialog", { name: PUBLISHED_DIALOG_NAME })
		);
		await expect(opener).toBeFocused();
	});

	test("Cancel on the published-case dialog returns focus to Delete", async ({
		page,
	}) => {
		await openCase(page, "Medium Case");
		const opener = page.getByTestId("toolbar-delete");
		await openWithKeyboard(opener);

		await closeWithButton(
			page.getByRole("alertdialog", { name: PUBLISHED_DIALOG_NAME }),
			"Cancel"
		);
		await expect(opener).toBeFocused();
	});

	test("Escape on a dashboard card's delete dialog returns focus to its button", async ({
		page,
	}) => {
		const dashboard = new DashboardPage(page);
		await dashboard.goto();
		await expect(dashboard.caseCard("Simple Case")).toBeVisible();

		await dashboard.caseCard("Simple Case").hover();
		const opener = dashboard.deleteCaseButton("Simple Case");
		await opener.click();

		await closeWithEscape(
			page,
			page.getByRole("dialog", { name: "Are you sure?", exact: true })
		);
		await expect(opener).toBeFocused();
	});

	test("Escape on the import window returns focus to Import File", async ({
		page,
	}) => {
		const dashboard = new DashboardPage(page);
		await dashboard.goto();
		await expect(dashboard.caseGrid).toBeVisible();

		const opener = page.getByRole("button", {
			name: "Import File",
			exact: true,
		});
		await openWithKeyboard(opener);

		const dialog = page.getByRole("dialog", {
			name: "Import Case",
			exact: true,
		});
		await closeWithEscape(page, dialog);
		await expect(opener).toBeFocused();
	});
});
