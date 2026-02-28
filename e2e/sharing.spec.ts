import { expect, signIn, test } from "./helpers/auth";

const CASE_URL_PATTERN = /\/case\/[a-f0-9-]+/;

// Sharing tests use different user sessions — no pre-saved state
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Sharing and permissions", () => {
	test("alice sees Medium Case on shared page", async ({
		page,
		seedPassword,
	}) => {
		await signIn(page, "alice", seedPassword);

		await page.goto("/dashboard/shared");
		await expect(page.getByText("Medium Case")).toBeVisible();
	});

	test("charlie cannot see chris's cases on dashboard", async ({
		page,
		seedPassword,
	}) => {
		await signIn(page, "charlie", seedPassword);

		await page.goto("/dashboard");
		await expect(page.getByText("Simple Case")).not.toBeVisible();
		await expect(page.getByText("Medium Case")).not.toBeVisible();
	});

	test("charlie sees Bob's Case on shared page", async ({
		page,
		seedPassword,
	}) => {
		await signIn(page, "charlie", seedPassword);

		await page.goto("/dashboard/shared");
		await expect(page.getByText("Bob's Case")).toBeVisible();
	});

	test("bob sees Alice's Case via team on shared page", async ({
		page,
		seedPassword,
	}) => {
		await signIn(page, "bob", seedPassword);

		await page.goto("/dashboard/shared");
		await expect(page.getByText("Alice's Case")).toBeVisible();
	});

	test("share dialog opens for case owner", async ({ page, seedPassword }) => {
		await signIn(page, "chris", seedPassword);

		// Navigate to Simple Case
		await page.goto("/dashboard");
		await page.getByText("Simple Case").click();
		await page.waitForURL(CASE_URL_PATTERN);

		// Click share button
		await page.locator('[data-tour="toolbar-share"]').click();
		await expect(page.getByText("Share Case")).toBeVisible();
	});
});
