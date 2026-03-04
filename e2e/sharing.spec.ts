import { expect, signIn, test } from "./helpers/auth";
import { CASE_URL_PATTERN } from "./helpers/constants";

// Sharing tests use different user sessions — no pre-saved state
test.use({ storageState: { cookies: [], origins: [] } });

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
	});
});
