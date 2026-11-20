import { expect, test } from "./helpers/auth";
import {
	anyDialog,
	expectCanvasMounted,
	goalNode,
	openCase,
	openGoalDialog,
	pressKeyOn,
	recordSpaceDefaults,
	spaceDefaultsSeen,
} from "./helpers/case-keyboard";

const CASES = ["Simple Case", "Medium Case"] as const;
// Each of these opens a dialog, sheet or panel.
const OPENING_BUTTONS = [
	"toolbar-reset-ids",
	"toolbar-case-information",
	"toolbar-help",
	"toolbar-share",
	"toolbar-export",
	"toolbar-json",
	"toolbar-notes",
	"toolbar-delete",
] as const;
const ALL_BUTTONS = ["toolbar-focus", ...OPENING_BUTTONS] as const;

const SPACE = "Space";
const DARK = /dark/;
const TRAILING_XY = / x y$/;
const SELECTED = /selected/;

for (const caseName of CASES) {
	test.describe(`Space on the case page (${caseName})`, () => {
		for (const testId of OPENING_BUTTONS) {
			test(`Space on ${testId} opens it`, async ({ page }) => {
				await openCase(page, caseName);
				const button = page.getByTestId(testId);
				// Medium Case may lack some owner-only buttons for other roles; the
				// seeded owner sees them all.
				await expect(button).toBeVisible();
				await pressKeyOn(page, button, SPACE);
				await expect(anyDialog(page).first()).toBeVisible();
			});
		}

		test("a Space keydown reaches the document unprevented on every toolbar button", async ({
			page,
		}) => {
			await openCase(page, caseName);
			await recordSpaceDefaults(page);
			for (const testId of ALL_BUTTONS) {
				const button = page.getByTestId(testId);
				await button.focus();
				await page.keyboard.down(SPACE);
				// Release off the button so the press does not also click it.
				await page.keyboard.up(SPACE);
			}
			const seen = await spaceDefaultsSeen(page);
			expect(seen.length).toBeGreaterThan(0);
			expect(seen.every((prevented) => !prevented)).toBe(true);
		});
	});
}

test.describe("Space inside dialogs opened from the toolbar", () => {
	test("Space on Cancel closes the delete dialog and keeps the case", async ({
		page,
	}) => {
		await openCase(page, "Simple Case");
		await pressKeyOn(page, page.getByTestId("toolbar-delete"), "Enter");
		const cancel = page.getByRole("button", { name: "Cancel" });
		await pressKeyOn(page, cancel, SPACE);
		await expect(anyDialog(page)).toHaveCount(0);
		await expect(page.getByTestId("toolbar-delete")).toBeVisible();
	});

	test("Space on Cancel closes the reset identifiers dialog", async ({
		page,
	}) => {
		await openCase(page, "Simple Case");
		await pressKeyOn(page, page.getByTestId("toolbar-reset-ids"), "Enter");
		const keep = page.getByRole("button", {
			name: "No, keep current identifiers",
		});
		await pressKeyOn(page, keep, SPACE);
		await expect(anyDialog(page)).toHaveCount(0);
	});

	test("Space on a sheet's Close button closes the case information sheet", async ({
		page,
	}) => {
		await openCase(page, "Simple Case");
		await pressKeyOn(
			page,
			page.getByTestId("toolbar-case-information"),
			"Enter"
		);
		const close = page.getByRole("button", { name: "Close", exact: true });
		await pressKeyOn(page, close, SPACE);
		await expect(anyDialog(page)).toHaveCount(0);
	});

	test("Space on Close closes the JSON editor", async ({ page }) => {
		await openCase(page, "Simple Case");
		await pressKeyOn(page, page.getByTestId("toolbar-json"), "Enter");
		const close = page.getByRole("button", { name: "Close", exact: true });
		await pressKeyOn(page, close, SPACE);
		await expect(anyDialog(page)).toHaveCount(0);
	});

	test("Space on the edit dialog's Cancel and Update buttons", async ({
		page,
	}) => {
		await openCase(page, "Simple Case");
		await openGoalDialog(page);
		await pressKeyOn(page, page.getByRole("button", { name: "Cancel" }), SPACE);
		await expect(anyDialog(page)).toHaveCount(0);
		await openGoalDialog(page);
		await pressKeyOn(
			page,
			page.getByRole("button", { name: "Update Goal" }),
			SPACE
		);
		await expect(anyDialog(page)).toHaveCount(0);
	});

	test("Space on the edit button inside a canvas node opens the dialog", async ({
		page,
	}) => {
		await openCase(page, "Simple Case");
		const edit = goalNode(page).getByRole("button", {
			name: "Edit element",
			exact: true,
		});
		await pressKeyOn(page, edit, SPACE);
		await expect(page.getByRole("dialog")).toContainText("Editing G1");
	});
});

test.describe("Space in the settings popover", () => {
	test("Space toggles the unsupported markers switch and picks a mode", async ({
		page,
	}) => {
		await openCase(page, "Simple Case");
		await pressKeyOn(
			page,
			page.getByTestId("toolbar-settings").getByRole("button"),
			SPACE
		);
		const popover = page.getByRole("dialog");
		const markers = popover.getByRole("switch");
		const before = await markers.getAttribute("aria-checked");
		await pressKeyOn(page, markers, SPACE);
		await expect(markers).not.toHaveAttribute("aria-checked", before ?? "");
		await pressKeyOn(
			page,
			popover.getByRole("button", { name: "Dark", exact: true }),
			SPACE
		);
		await expect(page.locator("html")).toHaveClass(DARK);
	});
});

test.describe("typing a space still works", () => {
	test("in the assumption box of the edit dialog", async ({ page }) => {
		await openCase(page, "Simple Case");
		await openGoalDialog(page);
		const box = page.getByPlaceholder("Type your assumption here (optional).");
		await box.click();
		await page.keyboard.type("two words");
		await expect(box).toHaveValue("two words");
	});

	test("in the add-context box and a context entry of the edit dialog", async ({
		page,
	}) => {
		await openCase(page, "Simple Case");
		await openGoalDialog(page);
		const add = page.getByPlaceholder("Add new context...");
		await add.click();
		await page.keyboard.type("a b c");
		await expect(add).toHaveValue("a b c");
		const text = page.getByRole("textbox", {
			name: "Context entry 1",
			exact: true,
		});
		await text.click();
		await page.keyboard.press("End");
		await page.keyboard.type(" x y");
		await expect(text).toHaveValue(TRAILING_XY);
	});

	test("in the rich-text description editor", async ({ page }) => {
		await openCase(page, "Simple Case");
		await openGoalDialog(page);
		const editor = page
			.getByRole("dialog")
			.locator('[contenteditable="true"]')
			.first();
		await editor.click();
		await page.keyboard.press("Control+End");
		await page.keyboard.type(" alpha beta");
		await expect(editor).toContainText("alpha beta");
	});

	test("in the JSON editor", async ({ page }) => {
		await openCase(page, "Simple Case");
		await pressKeyOn(page, page.getByTestId("toolbar-json"), "Enter");
		const editor = page.locator(".cm-content");
		await editor.click();
		await page.keyboard.press("Control+End");
		await page.keyboard.type("qq ww");
		const text = await editor.evaluate((el) => el.textContent ?? "");
		expect(text.replace(/ /g, " ")).toContain("qq ww");
	});

	test("in the case notes", async ({ page }) => {
		await openCase(page, "Simple Case");
		await pressKeyOn(page, page.getByTestId("toolbar-notes"), "Enter");
		const box = page.getByRole("dialog").getByRole("textbox").first();
		await box.click();
		await page.keyboard.type("note one two");
		await expect(box).toContainText("note one two");
	});
});

test.describe("the canvas keeps its own keys", () => {
	for (const key of ["Space", "Enter"]) {
		test(`${key} on a focused node selects it`, async ({ page }) => {
			await openCase(page, "Simple Case");
			const node = goalNode(page);
			await expect(node).not.toHaveClass(SELECTED);
			await pressKeyOn(page, node, key);
			await expect(node).toHaveClass(SELECTED);
		});
	}

	test("dragging the empty canvas pans it", async ({ page }) => {
		await openCase(page, "Simple Case");
		const viewport = page.locator(".react-flow__viewport");
		const before = await viewport.getAttribute("style");
		const pane = await page.locator(".react-flow__pane").boundingBox();
		if (!pane) {
			throw new Error("no pane");
		}
		const y = pane.y + pane.height / 2;
		await page.mouse.move(pane.x + 8, y);
		await page.mouse.down();
		await page.mouse.move(pane.x + 80, y + 40, { steps: 8 });
		await page.mouse.up();
		await expect
			.poll(async () => await viewport.getAttribute("style"))
			.not.toBe(before);
	});
});

test.describe("the docs page's read-only canvas", () => {
	const DOCS = "/docs/curriculum/tea-trainee/01-first-sip/exploration";

	test("Space presses docs buttons and the canvas controls", async ({
		page,
	}) => {
		await page.goto(DOCS);
		await expectCanvasMounted(page);
		const guide = page.getByRole("button", { name: "Platform Guide" });
		await expect(guide).toHaveAttribute("aria-expanded", "true");
		await pressKeyOn(page, guide, SPACE);
		await expect(guide).toHaveAttribute("aria-expanded", "false");
		const sidebar = page.getByRole("button", { name: "Collapse Sidebar" });
		await pressKeyOn(page, sidebar.first(), SPACE);
		await expect(sidebar.first()).toHaveAttribute("data-collapsed", "true");
		const viewport = page.locator(".react-flow__viewport").first();
		const before = await viewport.getAttribute("style");
		const zoomOut = page.getByRole("button", { name: "zoom out" });
		await pressKeyOn(page, zoomOut, SPACE);
		await expect
			.poll(async () => await viewport.getAttribute("style"))
			.not.toBe(before);
	});

	test("Space on a canvas node still selects it", async ({ page }) => {
		await page.goto(DOCS);
		const node = page.locator(".react-flow__node", { hasText: "G1" }).first();
		await expect(node).toBeVisible();
		await pressKeyOn(page, node, SPACE);
		await expect(node).toHaveClass(SELECTED);
	});
});
