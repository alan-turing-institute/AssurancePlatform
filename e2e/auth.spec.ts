import { passwordSchema } from "../lib/schemas/user";
import { expect, test } from "./helpers/auth";
import { LoginPage } from "./pages/login-page";

// Auth tests use empty storageState — no saved session
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Authentication lifecycle", () => {
	test("register a new account", async ({ page }) => {
		const uniqueUsername = `e2e_user_${Date.now()}`;
		// Throwaway, per-run password — never the seed secret, so a failure
		// snapshot (error-context.md / trace.zip) can't leak SEED_USER_PASSWORD.
		// Fixed prefix guarantees uppercase + digit + special char; the random
		// tail guarantees length and uniqueness.
		const registerPassword = `Aa1!${Date.now()}`;
		expect(passwordSchema.safeParse(registerPassword).success).toBe(true);

		await page.goto("/register");
		await page.getByLabel("Username").fill(uniqueUsername);
		await page.getByLabel("Email Address").fill(`${uniqueUsername}@test.com`);
		await page.locator('input[type="password"]').first().fill(registerPassword);
		await page.locator('input[type="password"]').last().fill(registerPassword);
		await page.getByRole("button", { name: "Submit" }).click();

		// Redirects to login with success query param
		await page.waitForURL("**/login?registered=true");
		await expect(page.getByText("Account created successfully")).toBeVisible();
	});

	test("sign in with valid credentials", async ({ page, seedPassword }) => {
		const loginPage = new LoginPage(page);
		await loginPage.goto();
		await loginPage.signIn("chris", seedPassword);

		await page.waitForURL("**/dashboard");
		await expect(page.getByTestId("case-list-grid")).toBeVisible();
	});

	test("sign out redirects to login", async ({ page, seedPassword }) => {
		// Sign in first
		const loginPage = new LoginPage(page);
		await loginPage.goto();
		await loginPage.signIn("chris", seedPassword);
		await page.waitForURL("**/dashboard");

		// Sign out
		await page.getByRole("button", { name: "Logout" }).click();
		await page.waitForURL("**/login");
	});

	test("unauthenticated access to /dashboard redirects to /login", async ({
		page,
	}) => {
		await page.goto("/dashboard");
		await page.waitForURL("**/login*");
	});

	test("invalid credentials show error message", async ({ page }) => {
		const loginPage = new LoginPage(page);
		await loginPage.goto();
		await loginPage.signIn("chris", "WrongPassword1!");

		await expect(loginPage.errorMessage).toBeVisible();
		await expect(page.getByText("Invalid credentials")).toBeVisible();
	});
});
