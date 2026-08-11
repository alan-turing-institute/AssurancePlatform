import { expect, test } from "./helpers/auth";
import { CASE_URL_PATTERN, LOGIN_PATTERN } from "./helpers/constants";
import { CaseEditorPage } from "./pages/case-editor-page";

// ADR 0003 §2 retired the READY_TO_PUBLISH intermediate state — a case is
// now either DRAFT or PUBLISHED. The status pill opens the guided Publish
// flow (draft) or the divergence/unpublish view (published). Full
// end-to-end journey coverage (fill case information → publish → visit
// Discover → republish → unpublish) lands with the next issue in the
// chain, which retires case studies and lands the publish journey e2e —
// these specs pin the current behaviour of the status dialog itself.

const ADD_DESCRIPTION_PATTERN = /Add Description/;
// Chris's ruling, 2026-08-11: the publish gate widened from description-only
// to description + authors + sector — this pins that all three are named.
const ADD_ALL_THREE_FIELDS_PATTERN = /Add Description, Authors, Sector/;

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

	test("draft case with no case information shows the missing-fields publish gate", async ({
		page,
	}) => {
		// "Simple Case" is seeded DRAFT with no case-information record
		// (prisma/seed/dev-seed.ts) — every required field is missing.
		await page.goto("/dashboard");
		await page.getByText("Simple Case").click();
		await page.waitForURL(CASE_URL_PATTERN);

		const editor = new CaseEditorPage(page);
		await editor.statusButton.click();

		await expect(editor.statusModalTitle).toBeVisible();
		await expect(page.getByText("Case Status: Draft")).toBeVisible();
		await expect(page.getByTestId("publish-content-incomplete")).toBeVisible();
		await expect(page.getByText(ADD_DESCRIPTION_PATTERN)).toBeVisible();
		// The bar was widened (Chris's ruling, 2026-08-11): description alone
		// no longer clears it — authors and sector are also required.
		await expect(page.getByText(ADD_ALL_THREE_FIELDS_PATTERN)).toBeVisible();

		// The gap is surfaced in place: this opens the existing case
		// information pane focused on the missing field, not a from-scratch
		// questionnaire (ADR 0003 §2).
		await page
			.getByRole("button", { name: "Complete case information" })
			.click();

		await expect(page.getByText("Case Status: Draft")).toHaveCount(0);
		await expect(
			page.getByRole("heading", { name: "Case Information" })
		).toBeVisible();
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

	test("status modal opens immediately with Published content, not gated on change-detection", async ({
		page,
	}) => {
		await page.goto("/dashboard");
		await page.getByText("Medium Case").click();
		await page.waitForURL(CASE_URL_PATTERN);

		const editor = new CaseEditorPage(page);
		await editor.statusButton.click();

		// Deliberately no `waitForResponse` gate here: opening this dialog
		// must never wait on `GET /api/cases/[id]/status` or `/changes`
		// (both run a full export + tree diff when a published snapshot
		// exists). A default-timeout visibility check is itself the
		// regression tripwire — if the open ever regresses to blocking on
		// that fetch, this assertion times out instead of quietly passing.
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
