import type { Locator, Page } from "@playwright/test";

export class DashboardPage {
	readonly caseGrid: Locator;
	readonly createCaseButton: Locator;
	readonly searchInput: Locator;
	readonly logoutButton: Locator;
	private readonly page: Page;

	constructor(page: Page) {
		this.page = page;
		// React streams the dashboard's case list into a hidden holding
		// element (`div[hidden]`) after the loading placeholder and reveals
		// it shortly afterwards; for a moment both the hidden holder and the
		// visible list can be in the page, so an unfiltered lookup can see
		// two grids and two of every card.
		this.caseGrid = page
			.getByTestId("case-list-grid")
			.filter({ visible: true });
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
