import { test as setup, signIn } from "./helpers/auth";

const AUTH_FILE = "e2e/.auth/chris.json";

setup("authenticate as chris", async ({ page, seedPassword }) => {
	await signIn(page, "chris", seedPassword);

	// Verify dashboard loaded before saving state
	await page.waitForURL("**/dashboard");

	await page.context().storageState({ path: AUTH_FILE });
});
