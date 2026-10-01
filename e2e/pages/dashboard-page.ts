import type { Locator, Page } from "@playwright/test";

export class DashboardPage {
	readonly caseGrid: Locator;
	readonly createCaseButton: Locator;
	readonly searchInput: Locator;
	readonly logoutButton: Locator;
	private readonly page: Page;

	constructor(page: Page) {
		this.page = page;
		// The streamed dashboard briefly holds a hidden second copy of the
		// grid (the server's loading-placeholder shell keeps the real list
		// rendered but hidden until React swaps it into view), so an
		// unfiltered lookup can momentarily see two grids and two of every
		// card inside them.
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
