import { expect, test } from "./helpers/auth";
import { CASE_URL_PATTERN } from "./helpers/constants";
import { CaseEditorPage } from "./pages/case-editor-page";
import { DashboardPage } from "./pages/dashboard-page";

const ANY_VALUE_PATTERN = /.+/;
const PLATFORM_GUIDE_PATTERN = /\/docs\/platform-guide$/;

test.describe("Help panel", () => {
	test("Full documentation opens the docs with the panel closed", async ({
		page,
	}) => {
		const dashboard = new DashboardPage(page);
		await dashboard.goto();
		await dashboard.caseCard("Simple Case").click();
		await page.waitForURL(CASE_URL_PATTERN);

		const caseEditor = new CaseEditorPage(page);
		await caseEditor.helpButton.click();

		const sheet = page.getByTestId("help-sheet");
		await expect(sheet).toBeVisible();

		await sheet.getByRole("link", { name: "Full documentation" }).click();
		await page.waitForURL("**/docs");

		await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
		await expect(sheet).toBeHidden();
		// The docs must be clickable: an open panel would hold a scroll lock
		// and block pointer events on the page behind it.
		await expect(page.locator("body")).not.toHaveAttribute(
			"data-scroll-locked",
			ANY_VALUE_PATTERN
		);
		await page
			.getByRole("main")
			.getByRole("link", { name: "Platform Guide", exact: true })
			.click();
		await expect(page).toHaveURL(PLATFORM_GUIDE_PATTERN);
	});
});
