import { expect, test } from "./helpers/auth";
import { LoginPage } from "./pages/login-page";

// Auth tests use empty storageState — no saved session
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Authentication lifecycle", () => {
	test("register a new account", async ({ page, seedPassword }) => {
		const uniqueUsername = `e2e_user_${Date.now()}`;

		await page.goto("/register");
		await page.getByLabel("Username").fill(uniqueUsername);
		await page.getByLabel("Email Address").fill(`${uniqueUsername}@test.com`);
		await page.getByLabel("Password", { exact: true }).fill(seedPassword);
		await page.getByLabel("Confirm Password").fill(seedPassword);
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
		await page.waitForURL("**/login");
	});

	test("invalid credentials show error message", async ({ page }) => {
		const loginPage = new LoginPage(page);
		await loginPage.goto();
		await loginPage.signIn("chris", "WrongPassword1!");

		await expect(loginPage.errorMessage).toBeVisible();
		await expect(page.getByText("Invalid credentials")).toBeVisible();
	});
});
