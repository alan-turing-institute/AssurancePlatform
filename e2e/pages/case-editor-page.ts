import type { Locator, Page } from "@playwright/test";

// The "Ready to Publish" intermediate state was retired (ADR 0003 §2) — a
// case is either DRAFT or PUBLISHED now, so the status button only ever
// shows one of those two labels.
const STATUS_PATTERN = /Draft|Published/;
const CASE_STATUS_PATTERN = /Case Status:/;

export class CaseEditorPage {
	readonly statusButton: Locator;
	readonly shareButton: Locator;
	readonly statusModalTitle: Locator;
	readonly focusButton: Locator;
	readonly exportButton: Locator;
	readonly jsonViewButton: Locator;
	readonly notesButton: Locator;
	readonly settingsButton: Locator;
	readonly deleteButton: Locator;
	readonly resourcesButton: Locator;

	constructor(page: Page) {
		this.statusButton = page.getByRole("button", {
			name: STATUS_PATTERN,
		});
		this.shareButton = page.getByTestId("toolbar-share");
		this.statusModalTitle = page.getByText(CASE_STATUS_PATTERN);
		this.focusButton = page.getByTestId("toolbar-focus");
		this.exportButton = page.getByTestId("toolbar-export");
		this.jsonViewButton = page.getByTestId("toolbar-json");
		this.notesButton = page.getByTestId("toolbar-notes");
		this.settingsButton = page.getByTestId("toolbar-settings");
		this.deleteButton = page.getByTestId("toolbar-delete");
		this.resourcesButton = page.getByTestId("toolbar-resources");
	}
}
