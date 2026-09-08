import { expect, signIn, test } from "./helpers/auth";
import { CASE_URL_PATTERN } from "./helpers/constants";

// Sharing tests use different user sessions — no pre-saved state
test.use({ storageState: { cookies: [], origins: [] } });

// Matches NodeEditDialog's Save button ("Update Goal", "Update Evidence",
// etc.) — must be absent in read-only mode regardless of element type.
const UPDATE_BUTTON_PATTERN = /^Update /i;
const PERMISSION_LEVEL_PATTERN = /permission level/i;

test.describe("Sharing and permissions", () => {
	test("alice sees Medium Case on shared page", async ({
		page,
		seedPassword,
	}) => {
		await signIn(page, "alice", seedPassword);

		await page.goto("/dashboard/shared");
		const sharedGrid = page.getByTestId("case-list-grid");
		await expect(
			sharedGrid.getByRole("heading", { name: "Medium Case" })
		).toBeVisible();
	});

	test("charlie cannot see chris's cases on dashboard", async ({
		page,
		seedPassword,
	}) => {
		await signIn(page, "charlie", seedPassword);

		await page.goto("/dashboard");
		const caseGrid = page.getByTestId("case-list-grid");
		await expect(
			caseGrid.getByRole("heading", { name: "Simple Case" })
		).not.toBeVisible();
		await expect(
			caseGrid.getByRole("heading", { name: "Medium Case" })
		).not.toBeVisible();
	});

	test("charlie sees Bob's Case on shared page", async ({
		page,
		seedPassword,
	}) => {
		await signIn(page, "charlie", seedPassword);

		await page.goto("/dashboard/shared");
		const sharedGrid = page.getByTestId("case-list-grid");
		await expect(
			sharedGrid.getByRole("heading", { name: "Bob's Case" })
		).toBeVisible();
	});

	test("bob sees Alice's Case via team on shared page", async ({
		page,
		seedPassword,
	}) => {
		await signIn(page, "bob", seedPassword);

		await page.goto("/dashboard/shared");
		const sharedGrid = page.getByTestId("case-list-grid");
		await expect(
			sharedGrid.getByRole("heading", { name: "Alice's Case" })
		).toBeVisible();
	});

	test("share dialog opens for case owner", async ({ page, seedPassword }) => {
		await signIn(page, "chris", seedPassword);

		// Navigate to Simple Case
		await page.goto("/dashboard");
		await page.getByText("Simple Case").click();
		await page.waitForURL(CASE_URL_PATTERN);

		// Click share button
		await page.getByTestId("toolbar-share").click();
		await expect(page.getByText("Share Case")).toBeVisible();
	});

	test("dismissing the Permission Level dropdown by clicking the dialog body leaves the dialog open", async ({
		page,
		seedPassword,
	}) => {
		// Regression test mirroring cases.spec.ts's assertion-status dismiss
		// test (PR #914): opening the sharing dialog's "Permission Level"
		// Select and then clicking elsewhere in the dialog body (without
		// picking an option) used to close the whole dialog too — jsdom can't
		// reproduce this, because it relies on real pointer-events hit-testing
		// falling through the dialog's own (now pointer-events: none) content
		// to its overlay once a nested Radix Select is open.
		await signIn(page, "chris", seedPassword);

		await page.goto("/dashboard");
		await page.getByText("Simple Case").click();
		await page.waitForURL(CASE_URL_PATTERN);

		await page.getByTestId("toolbar-share").click();

		// A plain text locator, not `getByRole("dialog")`: while the Select
		// below is open, Radix's `hideOthers` marks the whole dialog
		// `aria-hidden="true"`, which would make any role-based query against
		// the dialog time out for the rest of this test even though the
		// dialog is still visibly on screen.
		const dialogTitle = page.getByText("Share Case", { exact: true });
		await expect(dialogTitle).toBeVisible();

		const permissionTrigger = page.getByRole("combobox", {
			name: PERMISSION_LEVEL_PATTERN,
		});
		await permissionTrigger.click();
		await expect(page.getByRole("listbox")).toBeVisible();

		// Click the dialog description — well clear of the open dropdown's
		// own popper — without choosing an option. `force: true` because,
		// pre-fix, Radix sets `pointer-events: none` on the dialog's own
		// content while the Select is open — Playwright's default click
		// would otherwise wait forever for a target that (correctly, per the
		// bug) never becomes clickable; a real user's click still lands there
		// and falls through to the dialog's own overlay underneath.
		const dialogDescription = page.getByText(
			"Share this case with individuals or teams",
			{ exact: true }
		);
		await dialogDescription.click({ force: true });

		await expect(page.getByRole("listbox")).not.toBeVisible();
		await expect(dialogTitle).toBeVisible();
	});

	test("Escape-closing the Permission Level dropdown still lets the dialog dismiss normally", async ({
		page,
		seedPassword,
	}) => {
		// Complements the test above: the dismiss guard must only swallow the
		// outside click that the open Select itself caused. Once the Select
		// is closed (via Escape here), the dialog's own overlay-click and
		// Escape dismissal must keep working.
		await signIn(page, "chris", seedPassword);

		await page.goto("/dashboard");
		await page.getByText("Simple Case").click();
		await page.waitForURL(CASE_URL_PATTERN);

		await page.getByTestId("toolbar-share").click();
		const dialogTitle = page.getByText("Share Case", { exact: true });
		await expect(dialogTitle).toBeVisible();

		const permissionTrigger = page.getByRole("combobox", {
			name: PERMISSION_LEVEL_PATTERN,
		});
		await permissionTrigger.click();
		await expect(page.getByRole("listbox")).toBeVisible();
		await page.keyboard.press("Escape");
		await expect(page.getByRole("listbox")).not.toBeVisible();

		// No artificial pause: this click must be indistinguishable from a
		// genuine outside click landing right after the Select's own close.
		await page.mouse.click(5, 5);
		await expect(dialogTitle).not.toBeVisible();
	});

	test("viewer can see shared case but cannot edit", async ({
		page,
		seedPassword,
	}) => {
		await signIn(page, "charlie", seedPassword);

		// Navigate to Bob's shared case (charlie has VIEW permission)
		await page.goto("/dashboard/shared");
		const sharedGrid = page.getByTestId("case-list-grid");
		await sharedGrid.getByRole("heading", { name: "Bob's Case" }).click();
		await page.waitForURL(CASE_URL_PATTERN);

		// Assert: content visible but toolbar buttons for editing are not visible
		await expect(page.getByTestId("action-buttons")).toBeVisible();
		// Viewer should NOT see the share button (requires manage permission)
		await expect(page.getByTestId("toolbar-share")).not.toBeVisible();

		// Opening an element's dialog (the pencil icon relabels itself "View
		// details" for a viewer, but always opens the same dialog) must land
		// in read-only mode, not the editable form.
		const viewDetailsButton = page
			.locator("button:has(svg.lucide-pencil)")
			.first();
		await viewDetailsButton.waitFor({ state: "visible" });
		await viewDetailsButton.click();

		await expect(page.getByText("Viewing G1", { exact: true })).toBeVisible();
		await expect(
			page.getByRole("button", { name: UPDATE_BUTTON_PATTERN })
		).not.toBeVisible();
	});
});
