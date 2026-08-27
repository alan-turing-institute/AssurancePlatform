import { expect, test } from "./helpers/auth";
import { CASE_URL_PATTERN, STATUS_BUTTON_PATTERN } from "./helpers/constants";
import { DashboardPage } from "./pages/dashboard-page";

const ASSERTION_STATUS_COMBOBOX_PATTERN = /assertion status/i;

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

		// Wait for the modal to open, then fill
		await page.getByLabel("Name").waitFor({ state: "visible" });
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
		await page.getByLabel("Name").waitFor({ state: "visible" });
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

		// Confirm deletion in alert modal and wait for the API response
		await Promise.all([
			page.waitForResponse(
				(resp) =>
					resp.url().includes("/api/cases/") &&
					resp.request().method() === "DELETE"
			),
			page.getByRole("button", { name: "Delete" }).click(),
		]);

		// Re-navigate to dashboard to ensure fresh data (router.refresh()
		// triggers an async RSC re-fetch that may not complete in CI)
		await dashboard.goto();
		await expect(page.getByText("Delete Me Case")).not.toBeVisible();
	});

	test("clicking the case title opens the case information sheet", async ({
		page,
	}) => {
		const dashboard = new DashboardPage(page);
		await dashboard.goto();

		await dashboard.caseCard("Simple Case").click();
		await page.waitForURL(CASE_URL_PATTERN);

		await page.getByTestId("case-title-button").click();

		await expect(
			page.getByRole("heading", { name: "Case Information" })
		).toBeVisible();
	});

	test("dismissing the assertion status dropdown by clicking the edit dialog body leaves the dialog open", async ({
		page,
	}) => {
		// Regression test: opening the "Assertion status" Select inside the
		// element edit dialog and then clicking elsewhere in the dialog body
		// (without picking an option) used to close the whole dialog too —
		// jsdom can't reproduce this, because it relies on real pointer-events
		// hit-testing falling through the dialog's own (now pointer-events:
		// none) content to its overlay once a nested Radix Select is open.
		const dashboard = new DashboardPage(page);
		await dashboard.goto();

		await dashboard.caseCard("Simple Case").click();
		await page.waitForURL(CASE_URL_PATTERN);

		const editButton = page.locator("button:has(svg.lucide-pencil)").first();
		await editButton.waitFor({ state: "visible" });
		await editButton.click();

		// A plain text locator, not `getByRole("dialog")`: while the Select
		// below is open, Radix's `hideOthers` marks the whole dialog
		// `aria-hidden="true"` (everything outside the Select's own popper is
		// hidden from assistive tech while it's open), which would make any
		// role-based query against the dialog time out for the rest of this
		// test even though the dialog is still visibly on screen.
		const dialogTitle = page.getByText("Editing G1", { exact: true });
		await expect(dialogTitle).toBeVisible();

		const assertionStatusTrigger = page.getByRole("combobox", {
			name: ASSERTION_STATUS_COMBOBOX_PATTERN,
		});
		await assertionStatusTrigger.click();
		await expect(page.getByRole("listbox")).toBeVisible();

		// Click on the dialog body — the dialog's own title, well clear of
		// the open dropdown's own popper — without choosing an option from
		// the open dropdown. `force: true` because, pre-fix, Radix sets
		// `pointer-events: none` on the dialog's own content while the
		// Select is open — Playwright's default click would otherwise wait
		// forever for a target that (correctly, per the bug) never becomes
		// clickable; a real user's click still lands there and falls through
		// to the dialog's own overlay underneath.
		await dialogTitle.click({ force: true });

		await expect(page.getByRole("listbox")).not.toBeVisible();
		await expect(dialogTitle).toBeVisible();

		// The dialog's own close paths must still work.
		await page.getByRole("button", { name: "Cancel" }).click();
		await expect(dialogTitle).not.toBeVisible();
	});

	test("rapid open/close of the assertion status dropdown does not leave the dialog stuck open or stuck unable to close", async ({
		page,
	}) => {
		// Stability regression: rapid open/close cycling of the Select must
		// not leave the dialog's outside-dismiss guard (see
		// `useAssertionSelectDismissGuard` in node-edit-dialog.tsx) stuck
		// open, since that would make the dialog ignore every subsequent
		// outside click.
		const dashboard = new DashboardPage(page);
		await dashboard.goto();

		await dashboard.caseCard("Simple Case").click();
		await page.waitForURL(CASE_URL_PATTERN);

		const editButton = page.locator("button:has(svg.lucide-pencil)").first();
		await editButton.waitFor({ state: "visible" });
		await editButton.click();

		const dialogTitle = page.getByText("Editing G1", { exact: true });
		await expect(dialogTitle).toBeVisible();

		const assertionStatusTrigger = page.getByRole("combobox", {
			name: ASSERTION_STATUS_COMBOBOX_PATTERN,
		});

		// Five cycles is enough to expose ordering/state-leak bugs between
		// rapid open/close toggles; the exact count is arbitrary.
		for (let i = 0; i < 5; i++) {
			await assertionStatusTrigger.click();
			await expect(page.getByRole("listbox")).toBeVisible();
			await page.keyboard.press("Escape");
			await expect(page.getByRole("listbox")).not.toBeVisible();
		}

		// Click the dialog body (not the Select, which is now closed) —
		// this must be a genuine outside-of-Select click and must not
		// dismiss the dialog.
		await dialogTitle.click({ force: true });
		await expect(dialogTitle).toBeVisible();

		// The dialog must still be dismissable by a subsequent overlay
		// click — this is the assertion that catches a stuck-open guard.
		await page.mouse.click(5, 5);
		await expect(dialogTitle).not.toBeVisible();
	});

	test("Escape-closing the assertion status dropdown, then immediately clicking outside the dialog, still closes the dialog", async ({
		page,
	}) => {
		// Regression: the dismiss guard reads whether the Select was open at
		// the start of the outside click's own pointerdown event, not a
		// time window since the Select last closed — so a click that lands
		// immediately after an Escape-close is not mistaken for the pointer
		// event that closed the Select.
		const dashboard = new DashboardPage(page);
		await dashboard.goto();

		await dashboard.caseCard("Simple Case").click();
		await page.waitForURL(CASE_URL_PATTERN);

		const editButton = page.locator("button:has(svg.lucide-pencil)").first();
		await editButton.waitFor({ state: "visible" });
		await editButton.click();

		const dialogTitle = page.getByText("Editing G1", { exact: true });
		await expect(dialogTitle).toBeVisible();

		const assertionStatusTrigger = page.getByRole("combobox", {
			name: ASSERTION_STATUS_COMBOBOX_PATTERN,
		});

		// Five cycles is enough to expose ordering/state-leak bugs between
		// rapid open/close toggles; the exact count is arbitrary.
		for (let i = 0; i < 5; i++) {
			await assertionStatusTrigger.click();
			await expect(page.getByRole("listbox")).toBeVisible();
			await page.keyboard.press("Escape");
			await expect(page.getByRole("listbox")).not.toBeVisible();
		}

		await expect(dialogTitle).toBeVisible();

		// No artificial pause: this click must be indistinguishable from a
		// genuine outside click landing right after the last Escape-close.
		await page.mouse.click(5, 5);
		await expect(dialogTitle).not.toBeVisible();
	});
});
