import { expect, test } from "./helpers/auth";
import { CASE_URL_PATTERN } from "./helpers/constants";
import { CaseEditorPage } from "./pages/case-editor-page";
import { DashboardPage } from "./pages/dashboard-page";

const JSON_EDITOR_TITLE = "JSON Editor";
const LONG_LINE = "x".repeat(400);

test.describe("JSON editor — full screen and horizontal scroll", () => {
	test("full screen toggles via the toolbar button, and Esc leaves full screen without closing the editor", async ({
		page,
	}) => {
		const dashboard = new DashboardPage(page);
		await dashboard.goto();
		await dashboard.caseCard("Simple Case").click();
		await page.waitForURL(CASE_URL_PATTERN);

		const caseEditor = new CaseEditorPage(page);
		await caseEditor.jsonViewButton.click();

		const dialog = page.getByRole("dialog", { name: JSON_EDITOR_TITLE });
		await expect(dialog).toBeVisible();

		const enterFullScreen = dialog.getByRole("button", {
			name: "Enter full screen",
		});
		const widthBefore = (await dialog.boundingBox())?.width ?? 0;

		await enterFullScreen.click();

		const exitFullScreen = dialog.getByRole("button", {
			name: "Exit full screen",
		});
		await expect(exitFullScreen).toHaveAttribute("aria-pressed", "true");

		const viewportWidth = page.viewportSize()?.width ?? 0;
		const widthAfter = (await dialog.boundingBox())?.width ?? 0;
		expect(widthAfter).toBeGreaterThan(widthBefore);
		// Full screen should fill most of the viewport, not just widen a little.
		expect(widthAfter).toBeGreaterThan(viewportWidth * 0.9);

		// Esc leaves full screen but keeps the editor open, and returns focus
		// to the toggle button.
		await page.keyboard.press("Escape");

		await expect(dialog).toBeVisible();
		const enterFullScreenAgain = dialog.getByRole("button", {
			name: "Enter full screen",
		});
		await expect(enterFullScreenAgain).toHaveAttribute("aria-pressed", "false");
		await expect(enterFullScreenAgain).toBeFocused();

		// A second Esc (not full screen any more) closes the editor as before.
		await page.keyboard.press("Escape");
		await expect(dialog).not.toBeVisible();
	});

	test("horizontal scroll moves the buffer instead of triggering back navigation", async ({
		page,
	}) => {
		const dashboard = new DashboardPage(page);
		await dashboard.goto();
		await dashboard.caseCard("Simple Case").click();
		await page.waitForURL(CASE_URL_PATTERN);

		const caseEditor = new CaseEditorPage(page);
		await caseEditor.jsonViewButton.click();

		const dialog = page.getByRole("dialog", { name: JSON_EDITOR_TITLE });
		const scroller = dialog.locator(".cm-scroller");
		await expect(scroller).toBeVisible();

		// The fix for the back-navigation bug: overscroll-behavior-x: contain
		// on the editor's own scroller, so a horizontal swipe never escapes to
		// the browser's history gesture.
		await expect(scroller).toHaveCSS("overscroll-behavior-x", "contain");

		// Force a long, unwrapped line so there's something to scroll to —
		// plain characters only, so CodeMirror's bracket/quote auto-close
		// doesn't interfere.
		const content = dialog.locator(".cm-content");
		await content.click();
		await page.keyboard.press("ControlOrMeta+a");
		await page.keyboard.type(LONG_LINE);

		// Typing leaves the cursor (and CodeMirror's auto-scroll-into-view)
		// at the end of the line, i.e. already scrolled to its maximum — a
		// wheel-scroll further right would have nowhere to go and the
		// assertion below would fail every time. Home returns the cursor
		// (and the scroller) to the start of the line first.
		await page.keyboard.press("Home");
		await expect.poll(() => scroller.evaluate((el) => el.scrollLeft)).toBe(0);

		const scrollLeftBefore = await scroller.evaluate((el) => el.scrollLeft);
		await scroller.hover();
		await page.mouse.wheel(300, 0);

		await expect
			.poll(() => scroller.evaluate((el) => el.scrollLeft))
			.toBeGreaterThan(scrollLeftBefore);

		// The scroll must have moved the buffer, not the browser — still on
		// the case page.
		await expect(page).toHaveURL(CASE_URL_PATTERN);
	});
});
