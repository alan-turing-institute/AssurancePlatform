import type { Locator, Page } from "@playwright/test";

export class DashboardPage {
	readonly caseGrid: Locator;
	readonly createCaseButton: Locator;
	readonly searchInput: Locator;
	readonly logoutButton: Locator;
	private readonly page: Page;

	constructor(page: Page) {
		this.page = page;
		this.caseGrid = page.getByTestId("case-list-grid");
		this.createCaseButton = page.getByRole("button", {
			name: "Create new case",
		});
		this.searchInput = page
			.getByTestId("search-container")
			.getByRole("textbox");
		this.logoutButton = page.getByRole("button", { name: "Logout" });
	}

	async goto() {
		await this.page.goto("/dashboard");
	}

	caseCard(name: string) {
		return this.caseGrid.getByRole("link", { name });
	}

	deleteCaseButton(name: string) {
		return this.caseGrid
			.locator("[href]", { has: this.page.getByText(name, { exact: true }) })
			.locator("..")
			.getByTestId("delete-case-button");
	}
}
