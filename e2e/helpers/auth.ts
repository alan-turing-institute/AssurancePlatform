import { test as base, type Page } from "@playwright/test";

export { expect } from "@playwright/test";

/**
 * Sign in via the login form UI.
 * Waits for redirect to /dashboard before returning.
 */
export async function signIn(
	page: Page,
	username: string,
	password: string
): Promise<void> {
	await page.goto("/login");
	await page.getByLabel("Email or Username").fill(username);
	await page.getByLabel("Password").fill(password);
	await page.getByRole("button", { name: "Login" }).click();
	await page.waitForURL("**/dashboard");
}

/**
 * Custom Playwright fixture that provides `seedPassword` from env.
 */
export const test = base.extend<{ seedPassword: string }>({
	// biome-ignore lint/correctness/noEmptyPattern: Playwright fixture API requires destructured first arg
	seedPassword: async ({}, use) => {
		const password = process.env.SEED_USER_PASSWORD;
		if (!password) {
			throw new Error(
				"SEED_USER_PASSWORD environment variable is required for E2E tests"
			);
		}
		await use(password);
	},
});
