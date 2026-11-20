import type { Locator, Page } from "@playwright/test";
import { expect, signIn, test } from "./helpers/auth";
import {
	openCase,
	pressKeyOn,
	TINY_PNG,
	walkFocus,
} from "./helpers/case-keyboard";
import { CASE_URL_PATTERN } from "./helpers/constants";
import { DashboardPage } from "./pages/dashboard-page";

const INFO_TIP = "button:How author entry works";
const SECTOR = "button:Select a sector";
const DROPZONE = "div:Upload an imageDrag and drop an image fi";
const REMOVE_IMAGE = "button:Remove Image";
const SAVE = "button:Save case information";
const CLOSE = "button:Close";
const PUBLISH_BUTTON_PATTERN = /Draft|Published/;

const WIDTHS = [1280, 390] as const;
const CHIP_SETS: string[][] = [[], ["Ann A"], ["Ann A", "Bo B", "Cy C"]];

let counter = 0;

/** A new case of the test's own, so uploads never touch a shared seed case. */
async function createCase(page: Page, label: string): Promise<void> {
	counter += 1;
	const name = `Tab ${label} ${Date.now()}-${counter}`;
	const dashboard = new DashboardPage(page);
	await dashboard.goto();
	await dashboard.createCaseButton.click();
	await page.getByLabel("Name").fill(name);
	await page.getByLabel("Description").fill("Made for a keyboard check");
	await page.getByRole("button", { name: "Submit" }).click();
	await page.waitForURL(CASE_URL_PATTERN);
	await expect(page.getByTestId("toolbar-help")).toBeVisible();
}

async function openSheet(page: Page): Promise<Locator> {
	await pressKeyOn(page, page.getByTestId("toolbar-case-information"), "Enter");
	const sheet = page.getByRole("dialog");
	await expect(sheet).toBeVisible();
	return sheet;
}

async function addAuthors(page: Page, names: string[]): Promise<void> {
	const authors = page.getByRole("textbox", { name: "Authors" });
	await authors.focus();
	for (const name of names) {
		await page.keyboard.type(name);
		await page.keyboard.press("Enter");
	}
}

async function addImage(sheet: Locator): Promise<void> {
	await sheet
		.locator('input[type="file"]')
		.setInputFiles({ name: "t.png", mimeType: "image/png", buffer: TINY_PNG });
	// The remove button is disabled while the upload runs and is skipped by Tab.
	await expect(
		sheet.getByRole("button", { name: "Remove Image" })
	).toBeEnabled();
}

function forwardStops(chips: string[], withImage: boolean): string[] {
	return [
		INFO_TIP,
		...chips.map((chip) => `button:Remove ${chip}`),
		SECTOR,
		withImage ? REMOVE_IMAGE : DROPZONE,
		SAVE,
		CLOSE,
	];
}

async function setUp(
	page: Page,
	chips: string[],
	withImage: boolean
): Promise<Locator> {
	await createCase(page, "order");
	const sheet = await openSheet(page);
	if (withImage) {
		await addImage(sheet);
	}
	await addAuthors(page, chips);
	await page.getByRole("textbox", { name: "Authors" }).focus();
	return sheet;
}

test.describe("Tab and Shift+Tab across the case information sheet", () => {
	for (const width of WIDTHS) {
		for (const chips of CHIP_SETS) {
			for (const withImage of [false, true]) {
				const title = `${width}px, ${chips.length} chips, ${withImage ? "with" : "no"} image`;

				test(`Tab crosses the whole form: ${title}`, async ({ page }) => {
					await page.setViewportSize({ width, height: 900 });
					await setUp(page, chips, withImage);
					const expected = forwardStops(chips, withImage);
					expect(await walkFocus(page, "Tab", expected.length)).toEqual(
						expected
					);
				});

				test(`Shift+Tab crosses it back: ${title}`, async ({ page }) => {
					await page.setViewportSize({ width, height: 900 });
					await setUp(page, chips, withImage);
					const stops = forwardStops(chips, withImage);
					await page
						.getByRole("button", { name: "Save case information" })
						.focus();
					const back = stops.slice(0, -2).reverse();
					expect(await walkFocus(page, "Shift+Tab", back.length)).toEqual(back);
				});
			}
		}
	}

	test("Tab never drops focus to the page body while crossing the form", async ({
		page,
	}) => {
		await setUp(page, ["Ann A", "Bo B"], true);
		const stops = await walkFocus(page, "Tab", 14);
		expect(stops).not.toContain("BODY");
		expect(stops).toContain(SAVE);
	});

	test("Remove Image is visible while focused and hidden again after", async ({
		page,
	}) => {
		const sheet = await setUp(page, [], true);
		const remove = sheet.getByRole("button", { name: "Remove Image" });
		const overlay = remove.locator("..");
		await expect(overlay).toHaveCSS("opacity", "0");
		await walkFocus(page, "Tab", 3);
		await expect(remove).toBeFocused();
		await expect(overlay).toHaveCSS("opacity", "1");
		await page.keyboard.press("Tab");
		await expect(overlay).toHaveCSS("opacity", "0");
	});

	test("Space on a focused Remove Image removes the image", async ({
		page,
	}) => {
		const sheet = await setUp(page, [], true);
		const remove = sheet.getByRole("button", { name: "Remove Image" });
		await pressKeyOn(page, remove, "Space");
		await expect(remove).toHaveCount(0);
		await expect(sheet.getByText("Upload an image")).toBeVisible();
	});

	test("a chip's Remove button works from the keyboard and keeps focus in the form", async ({
		page,
	}) => {
		await setUp(page, ["Ann A", "Bo B"], false);
		await pressKeyOn(
			page,
			page.getByRole("button", { name: "Remove Ann A" }),
			"Space"
		);
		await expect(
			page.getByRole("button", { name: "Remove Ann A" })
		).toHaveCount(0);
		const stops = await walkFocus(page, "Tab", 12);
		expect(stops).not.toContain("BODY");
		expect(stops).toContain(SAVE);
	});

	test("the sector picker opens from the keyboard and keeps the order after choosing", async ({
		page,
	}) => {
		await setUp(page, ["Ann A"], false);
		await pressKeyOn(page, page.getByRole("combobox"), "Enter");
		await page.getByRole("option").first().press("Enter");
		await expect(page.getByRole("combobox")).toBeFocused();
		await page.getByRole("textbox", { name: "Authors" }).focus();
		const stops = await walkFocus(page, "Tab", 4);
		expect(stops[0]).toBe(INFO_TIP);
		expect(stops[1]).toBe("button:Remove Ann A");
		expect(stops[2]?.startsWith("button:")).toBe(true);
		expect(stops[2]).not.toBe(SECTOR);
		expect(stops[3]).toBe(DROPZONE);
	});

	test("an author typed with spaces keeps them", async ({ page }) => {
		await setUp(page, ["Mary Ann Smith"], false);
		await expect(
			page.getByRole("button", { name: "Remove Mary Ann Smith" })
		).toBeVisible();
	});
});

const DESCRIPTION_HINT = "A short description of this assurance case";

async function completeCaseInformation(page: Page): Promise<void> {
	await page.getByRole("button", { name: PUBLISH_BUTTON_PATTERN }).click();
	await page.getByRole("button", { name: "Complete case information" }).click();
	await expect(page.getByRole("dialog")).toBeVisible();
}

async function saveInformation(page: Page): Promise<void> {
	const sheet = page.getByRole("dialog");
	await sheet.getByRole("button", { name: "Save case information" }).click();
	await expect(
		sheet.getByRole("button", { name: "Save case information" })
	).toBeEnabled();
	await sheet.getByRole("button", { name: "Close", exact: true }).click();
	await expect(page.getByRole("dialog")).toHaveCount(0);
}

test.describe("the missing-field link focuses the named field", () => {
	test("description first", async ({ page }) => {
		await createCase(page, "link-d");
		await completeCaseInformation(page);
		await expect(page.getByPlaceholder(DESCRIPTION_HINT)).toBeFocused();
	});

	test("then authors", async ({ page }) => {
		await createCase(page, "link-a");
		await openSheet(page);
		await page.getByPlaceholder(DESCRIPTION_HINT).fill("Made for a check");
		await saveInformation(page);
		await completeCaseInformation(page);
		await expect(page.getByRole("textbox", { name: "Authors" })).toBeFocused();
	});

	test("then the sector picker", async ({ page }) => {
		await createCase(page, "link-s");
		await openSheet(page);
		await page.getByPlaceholder(DESCRIPTION_HINT).fill("Made for a check");
		await addAuthors(page, ["Ann A"]);
		await saveInformation(page);
		await completeCaseInformation(page);
		await expect(page.getByRole("combobox")).toBeFocused();
	});
});

test.describe("an edit collaborator", () => {
	test("can cross the sheet by keyboard on a shared case", async ({
		browser,
		seedPassword,
	}) => {
		const context = await browser.newContext({ storageState: undefined });
		const page = await context.newPage();
		await signIn(page, "alice", seedPassword);
		await openCase(page, "Medium Case");
		await openSheet(page);
		await page.getByRole("textbox", { name: "Authors" }).focus();
		const stops = await walkFocus(page, "Tab", 12);
		await context.close();
		expect(stops).toContain(INFO_TIP);
		expect(stops).toContain(SAVE);
		expect(stops.slice(0, stops.indexOf(SAVE))).not.toContain("BODY");
	});
});
