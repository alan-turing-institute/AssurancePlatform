import type { Locator, Page } from "@playwright/test";

const STATUS_PATTERN = /Draft|Ready to Publish|Published/;
const CASE_STATUS_PATTERN = /Case Status:/;

export class CaseEditorPage {
	readonly statusButton: Locator;
	readonly shareButton: Locator;
	readonly statusModalTitle: Locator;
	readonly markReadyButton: Locator;

	constructor(page: Page) {
		this.statusButton = page.getByRole("button", {
			name: STATUS_PATTERN,
		});
		this.shareButton = page.locator('[data-tour="toolbar-share"]');
		this.statusModalTitle = page.getByText(CASE_STATUS_PATTERN);
		this.markReadyButton = page.getByRole("button", {
			name: "Mark as Ready to Publish",
		});
	}
}
