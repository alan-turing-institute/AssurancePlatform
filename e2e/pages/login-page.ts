import type { Locator, Page } from "@playwright/test";

export class LoginPage {
	readonly identifier: Locator;
	readonly password: Locator;
	readonly submitButton: Locator;
	readonly successMessage: Locator;
	readonly errorMessage: Locator;
	private readonly page: Page;

	constructor(page: Page) {
		this.page = page;
		this.identifier = page.getByLabel("Email or Username");
		this.password = page.getByLabel("Password", { exact: true });
		this.submitButton = page.getByRole("button", { name: "Login" });
		this.successMessage = page.getByText("Account created successfully");
		this.errorMessage = page.getByText("Invalid credentials");
	}

	async goto() {
		await this.page.goto("/login");
	}

	async signIn(username: string, password: string) {
		await this.identifier.fill(username);
		await this.password.fill(password);
		await this.submitButton.click();
	}
}
