import { expect, test } from "./helpers/auth";
import { CASE_URL_PATTERN, STATUS_BUTTON_PATTERN } from "./helpers/constants";
import { DashboardPage } from "./pages/dashboard-page";

test.describe("Case management", () => {
	test("dashboard shows seeded cases", async ({ page }) => {
		const dashboard = new DashboardPage(page);
		await dashboard.goto();

		await expect(dashboard.caseGrid).toBeVisible();
		await expect(page.getByText("Simple Case")).toBeVisible();
		await expect(page.getByText("Medium Case")).toBeVisible();
	});

	test("create a new case via modal", async ({ page }) => {
		const dashboard = new DashboardPage(page);
		await dashboard.goto();

		await dashboard.createCaseButton.click();

		// Fill the create case modal
		await page.getByLabel("Name").fill("E2E Test Case");
		await page.getByLabel("Description").fill("Created by Playwright E2E test");
		await page.getByRole("button", { name: "Submit" }).click();

		// Should redirect to the new case editor
		await page.waitForURL(CASE_URL_PATTERN);
	});

	test("open existing case navigates to editor", async ({ page }) => {
		const dashboard = new DashboardPage(page);
		await dashboard.goto();

		await dashboard.caseCard("Simple Case").click();
		await page.waitForURL(CASE_URL_PATTERN);

		// Verify editor loaded — status button is always present
		await expect(
			page.getByRole("button", { name: STATUS_BUTTON_PATTERN })
		).toBeVisible();
	});

	test("filter cases by name", async ({ page }) => {
		const dashboard = new DashboardPage(page);
		await dashboard.goto();

		await dashboard.searchInput.fill("Simple");

		await expect(page.getByText("Simple Case")).toBeVisible();
		await expect(page.getByText("Medium Case")).not.toBeVisible();
	});

	test("delete a case", async ({ page }) => {
		const dashboard = new DashboardPage(page);
		await dashboard.goto();

		// Create a throwaway case first
		await dashboard.createCaseButton.click();
		await page.getByLabel("Name").fill("Delete Me Case");
		await page.getByLabel("Description").fill("To be deleted");
		await page.getByRole("button", { name: "Submit" }).click();
		await page.waitForURL(CASE_URL_PATTERN);

		// Navigate back to dashboard
		await dashboard.goto();
		await expect(page.getByText("Delete Me Case")).toBeVisible();

		// Hover over card to reveal delete button, then click it
		await dashboard.caseCard("Delete Me Case").hover();
		await dashboard.deleteCaseButton("Delete Me Case").click();

		// Confirm deletion in alert modal
		await page.getByRole("button", { name: "Delete" }).click();

		// Case should disappear
		await expect(page.getByText("Delete Me Case")).not.toBeVisible();
	});
});
