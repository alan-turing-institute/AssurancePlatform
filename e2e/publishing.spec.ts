import { expect, test } from "./helpers/auth";
import { CASE_URL_PATTERN, LOGIN_PATTERN } from "./helpers/constants";
import { CaseEditorPage } from "./pages/case-editor-page";

// ADR 0003 §2 retired the READY_TO_PUBLISH intermediate state — a case is
// now either DRAFT or PUBLISHED, with no "mark as ready" step in between.
// These specs pin the current interim behaviour: a draft case shows an
// informational status modal with no publish control, and a published case
// shows the green "Published" badge. The guided single-action Publish flow
// that replaces the old "mark as ready" journey is not built yet — its e2e
// coverage lands with [[TEA — Retire case studies and land the publish
// journey e2e (ADR 0003)]], the next issue in the chain.

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

	test("status modal opens with Draft content and no publish control", async ({
		page,
	}) => {
		await page.goto("/dashboard");
		await page.getByText("Simple Case").click();
		await page.waitForURL(CASE_URL_PATTERN);

		const editor = new CaseEditorPage(page);
		await editor.statusButton.click();

		await expect(editor.statusModalTitle).toBeVisible();
		await expect(page.getByText("Case Status: Draft")).toBeVisible();
		await expect(
			page.getByText(
				"Draft cases are only visible to you and collaborators with edit permissions."
			)
		).toBeVisible();
		// The retired "mark as ready" control must not be present.
		await expect(
			page.getByRole("button", { name: "Mark as Ready to Publish" })
		).toHaveCount(0);
	});

	test("status button shows Published for a published case", async ({
		page,
	}) => {
		// "Medium Case" is seeded as PUBLISHED (prisma/seed/dev-seed.ts).
		await page.goto("/dashboard");
		await page.getByText("Medium Case").click();
		await page.waitForURL(CASE_URL_PATTERN);

		const editor = new CaseEditorPage(page);
		await expect(editor.statusButton).toBeVisible();
		await expect(editor.statusButton).toHaveText("Published");
	});

	test("status modal opens with Published content for a published case", async ({
		page,
	}) => {
		await page.goto("/dashboard");
		await page.getByText("Medium Case").click();
		await page.waitForURL(CASE_URL_PATTERN);

		const editor = new CaseEditorPage(page);
		await editor.statusButton.click();

		await expect(editor.statusModalTitle).toBeVisible();
		await expect(page.getByText("Case Status: Published")).toBeVisible();
		await expect(
			page.getByText("This case is published and visible in case studies.")
		).toBeVisible();
	});

	test("case studies page is accessible", async ({ page }) => {
		await page.goto("/dashboard/case-studies");

		// Should not redirect to login (authenticated via saved state)
		await expect(page).not.toHaveURL(LOGIN_PATTERN);
	});
});
