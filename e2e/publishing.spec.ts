import { expect, test } from "./helpers/auth";
import { CaseEditorPage } from "./pages/case-editor-page";

const CASE_URL_PATTERN = /\/case\/\d+/;
const LOGIN_PATTERN = /\/login/;

test.describe("Publishing", () => {
	test("discover page loads with community heading", async ({ page }) => {
		// Public route — uses chris's saved auth state but that's fine
		await page.goto("/discover");
		await expect(page.getByText("Community Case Studies")).toBeVisible();
	});

	test("status button shows Draft for a draft case", async ({ page }) => {
		await page.goto("/dashboard");
		await page.getByText("Simple Case").click();
		await page.waitForURL(CASE_URL_PATTERN);

		const editor = new CaseEditorPage(page);
		await expect(editor.statusButton).toBeVisible();
		await expect(editor.statusButton).toHaveText("Draft");
	});

	test("status modal opens with Draft content", async ({ page }) => {
		await page.goto("/dashboard");
		await page.getByText("Simple Case").click();
		await page.waitForURL(CASE_URL_PATTERN);

		const editor = new CaseEditorPage(page);
		await editor.statusButton.click();

		await expect(editor.statusModalTitle).toBeVisible();
		await expect(page.getByText("Case Status: Draft")).toBeVisible();
		await expect(editor.markReadyButton).toBeVisible();
	});

	test("mark case as ready to publish", async ({ page }) => {
		// Create a fresh case to avoid mutating seeded data
		await page.goto("/dashboard");
		await page.getByRole("button", { name: "Create new case" }).click();
		await page.getByLabel("Name").fill("Publish Test Case");
		await page.getByLabel("Description").fill("Case for testing publish flow");
		await page.getByRole("button", { name: "Submit" }).click();
		await page.waitForURL(CASE_URL_PATTERN);

		const editor = new CaseEditorPage(page);
		await editor.statusButton.click();
		await editor.markReadyButton.click();

		// Status should now show "Ready to Publish"
		await expect(editor.statusButton).toHaveText("Ready to Publish");
	});

	test("case studies page is accessible", async ({ page }) => {
		await page.goto("/dashboard/case-studies");

		// Should not redirect to login (authenticated via saved state)
		await expect(page).not.toHaveURL(LOGIN_PATTERN);
	});
});
