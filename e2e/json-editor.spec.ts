import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./helpers/auth";
import { CASE_URL_PATTERN } from "./helpers/constants";
import { CaseEditorPage } from "./pages/case-editor-page";
import { DashboardPage } from "./pages/dashboard-page";

const JSON_EDITOR_TITLE = "JSON Editor";
const LONG_LINE = "x".repeat(400);
const APPLY_BUTTON = { name: "Apply", exact: true } as const;

/**
 * A fresh case, created on the canvas rather than imported — an imported
 * case hangs the editor's export read on the disposable standalone QA
 * server (see tea-qa-server.sh's KNOWN LIMIT comment).
 */
async function createCaseViaModal(page: Page, name: string): Promise<void> {
	const dashboard = new DashboardPage(page);
	await dashboard.goto();
	await dashboard.createCaseButton.click();
	await page.getByLabel("Name").waitFor({ state: "visible" });
	await page.getByLabel("Name").fill(name);
	await page.getByLabel("Description").fill(`${name} — e2e fixture`);
	await page.getByRole("button", { name: "Submit" }).click();
	await page.waitForURL(CASE_URL_PATTERN);
}

/**
 * Reads the editor's buffer back out as plain text. `.cm-content`'s own
 * `textContent` collapses CodeMirror's per-line `<div>`s with no separator,
 * corrupting multi-line JSON — join each `.cm-line` explicitly instead.
 */
function editorText(content: Locator): Promise<string> {
	return content.evaluate((el) =>
		Array.from(el.querySelectorAll(".cm-line"))
			.map((line) => line.textContent ?? "")
			.join("\n")
	);
}

/**
 * Replaces the whole buffer in one go. `keyboard.insertText` drives
 * Chromium's CDP `Input.insertText` — a paste-like event, not a sequence of
 * keydowns — so CodeMirror's bracket/quote auto-close never fires and the
 * JSON goes in byte-for-byte. This is the "CDP insertText" input method
 * named in the bug's staging reproduction.
 */
async function replaceEditorContent(
	page: Page,
	content: Locator,
	text: string
): Promise<void> {
	await content.click();
	await page.keyboard.press("ControlOrMeta+a");
	await page.keyboard.insertText(text);
}

/**
 * Narrows an indexed array read (`noUncheckedIndexedAccess`, tsconfig.json)
 * to its non-undefined element. The preceding `expect(...).toHaveLength(n)`
 * already proves the index exists — this is a type-level narrowing, not a
 * real runtime possibility, so a thrown error (never expected to fire) is
 * enough.
 */
function must<T>(value: T | undefined, label: string): T {
	if (value === undefined) {
		throw new Error(`expected ${label} to be defined`);
	}
	return value;
}

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
		await expect
			.poll(() => scroller.evaluate((el) => el.scrollLeft))
			.toBeLessThanOrEqual(1);

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

test.describe("JSON editor — Apply after a rejection", () => {
	// The bug: after the server rejects an Apply (400), every later Apply
	// re-sent the ORIGINAL rejected body — same changes, same
	// expectedVersion — no matter what the user typed afterwards. Root
	// cause: `hooks/use-json-validation.ts`'s debounced revalidation left
	// `isValid`/`parsedData` describing the REJECTED buffer for up to
	// 300ms after a new edit, and the toolbar re-enabled Apply the instant
	// `isDirty` flipped — well before that debounce settled — so a fast
	// click sent the stale diff. Confirmed on jsdom in
	// components/cases/__tests__/json-view-panel.test.tsx; this is the
	// real-browser confirmation the brief calls for, since the earlier bugs
	// in this file were exactly the kind jsdom missed.
	test("a second Apply, after the document is corrected, sends the corrected diff — not the rejected one", async ({
		page,
	}) => {
		const caseName = `Editor Resubmit Case ${Date.now()}`;
		await createCaseViaModal(page, caseName);

		const caseEditor = new CaseEditorPage(page);
		await caseEditor.jsonViewButton.click();

		const dialog = page.getByRole("dialog", { name: JSON_EDITOR_TITLE });
		await expect(dialog).toBeVisible();

		const content = dialog.locator(".cm-content");
		await expect(content).toContainText("G1");

		const originalDoc = JSON.parse(await editorText(content));

		const requests: { changes: unknown[]; expectedVersion: string }[] = [];
		await page.route("**/api/cases/*/batch", async (route) => {
			requests.push(route.request().postDataJSON());
			await route.continue();
		});

		const applyButton = dialog.getByRole("button", APPLY_BUTTON);

		// First Apply: AS_CITED is derived-only (rejectDeclaredAsCited,
		// element-service.ts) — a hand-set value is always a 400.
		const rejectedDoc = structuredClone(originalDoc);
		rejectedDoc.tree.assertionStatus = "AS_CITED";
		await replaceEditorContent(
			page,
			content,
			JSON.stringify(rejectedDoc, null, 2)
		);

		await expect(applyButton).toBeEnabled();
		await applyButton.click();
		await expect(page.getByText("Failed to apply changes")).toBeVisible();

		expect(requests).toHaveLength(1);
		const firstBody = must(requests[0], "the first Apply's request body");
		expect(
			firstBody.changes.some(
				(c) =>
					(c as { data?: { assertionStatus?: string } }).data
						?.assertionStatus === "AS_CITED"
			)
		).toBe(true);

		// Correct the document: revert assertionStatus AND make an unrelated
		// edit, matching the staging reproduction. `description` rather than
		// `name` — GOAL names are constrained to the G1/G1.1 prefix pattern
		// (validateElementName), so a hand-edited name is its own 400 and
		// would leave the second Apply's outcome ambiguous between "still
		// stale" and "a different, unrelated rejection".
		const correctedDoc = structuredClone(originalDoc);
		correctedDoc.tree.description = "Root goal — corrected";
		await replaceEditorContent(
			page,
			content,
			JSON.stringify(correctedDoc, null, 2)
		);

		await expect(applyButton).toBeEnabled();
		await applyButton.click();
		await expect(page.getByText("Changes applied")).toBeVisible();

		expect(requests).toHaveLength(2);
		const secondBody = must(requests[1], "the second Apply's request body");
		expect(secondBody).not.toEqual(firstBody);
		expect(
			secondBody.changes.some(
				(c) =>
					(c as { data?: { assertionStatus?: string } }).data
						?.assertionStatus === "AS_CITED"
			)
		).toBe(false);
		expect(
			secondBody.changes.some(
				(c) =>
					(c as { data?: { description?: string } }).data?.description ===
					"Root goal — corrected"
			)
		).toBe(true);
	});
});
