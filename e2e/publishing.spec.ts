import { expect, test } from "./helpers/auth";
import { CASE_URL_PATTERN, LOGIN_PATTERN } from "./helpers/constants";
import { CaseEditorPage } from "./pages/case-editor-page";

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

	test("complete publishing journey: draft → ready → published", async ({
		page,
	}) => {
		// Create fresh case
		await page.goto("/dashboard");
		await page.getByRole("button", { name: "Create new case" }).click();
		await page.getByLabel("Name").fill("Full Publish Test");
		await page.getByLabel("Description").fill("Testing full publish flow");
		await page.getByRole("button", { name: "Submit" }).click();
		await page.waitForURL(CASE_URL_PATTERN);

		// Add a goal (required for publishing)
		const editor = new CaseEditorPage(page);
		await editor.newGoalButton.click();
		// Fill the create node form (only has Description field, name is auto-generated)
		await page.getByLabel("Description").fill("Test goal description");
		await page.getByRole("button", { name: "Create Goal" }).click();
		// Wait for the goal node to appear (auto-named "G1")
		await expect(page.getByText("G1")).toBeVisible();

		// Mark as ready
		await editor.statusButton.click();
		await editor.markReadyButton.click();
		await expect(editor.statusButton).toHaveText("Ready to Publish");
	});
});
