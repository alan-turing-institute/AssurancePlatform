import { expect, type Locator, type Page, test } from "@playwright/test";
import {
	activeDescription,
	cardOf,
	failWith500,
	INTEGRATIONS_URL,
	removeSeededData,
	type SeededIntegration,
	seedCases,
	seedIntegration,
} from "./helpers/integration-fixtures";

// The grant form and its case picker on Settings, Integrations: keyboard
// focus around the form, and the picker's size and position with a very long
// case name and sixty cases on a phone-width screen.

const STAMP = Date.now();
const LONG_NAME = `e2e-kb-long ${"w".repeat(100)} ${STAMP} end`;
const GRANT_BUTTON = "Grant access to a case…";
const MANY = Array.from(
	{ length: 60 },
	(_, i) => `e2e-kb-many ${STAMP} number ${i}`
);
const TARGET = `e2e-kb-target ${STAMP}`;

test.beforeAll(() => seedCases([LONG_NAME, TARGET, ...MANY]));
test.afterAll(removeSeededData);

async function openForm(page: Page, integration: SeededIntegration) {
	await page.goto(INTEGRATIONS_URL);
	const card = cardOf(page, integration);
	await card.getByRole("button", { name: GRANT_BUTTON }).click();
	const form = card.getByRole("form", { name: "Grant access to a case" });
	await expect(form).toBeVisible();
	return { card, form };
}

function picker(form: Locator) {
	return form.getByRole("combobox", { name: "Case" });
}

async function chooseCase(page: Page, form: Locator, name: string) {
	await picker(form).click();
	await page.getByPlaceholder("Search cases").fill(name);
	await page.getByRole("option", { name }).click();
}

test.describe("Grant form focus", () => {
	test("opening moves focus to the form and Tab reaches the picker", async ({
		page,
	}) => {
		const integration = await seedIntegration("grant-open");
		const { form } = await openForm(page, integration);
		await expect(form).toBeFocused();
		await expect(picker(form)).toBeVisible();
		await page.keyboard.press("Tab");
		await expect(picker(form)).toBeFocused();
	});

	test("Cancel returns focus to the grant button, five times over", async ({
		page,
	}) => {
		const integration = await seedIntegration("grant-cycle");
		const { card, form } = await openForm(page, integration);
		for (let i = 0; i < 5; i++) {
			await form.getByRole("button", { name: "Cancel" }).click();
			const button = card.getByRole("button", { name: GRANT_BUTTON });
			await expect(button).toBeFocused();
			await button.press("Enter");
			await expect(form).toBeFocused();
		}
	});

	test("a granted case closes the form onto the button and is not offered again", async ({
		page,
	}) => {
		const integration = await seedIntegration("grant-ok");
		const { card, form } = await openForm(page, integration);
		await chooseCase(page, form, TARGET);
		await form.getByRole("button", { name: "Grant access" }).click();
		const button = card.getByRole("button", { name: GRANT_BUTTON });
		await expect(button).toBeFocused();

		await button.click();
		await picker(form).click();
		await page.getByPlaceholder("Search cases").fill(TARGET);
		await expect(page.getByText("No case matches.")).toBeVisible();
	});

	test("a refused grant keeps the form open and focus off the body", async ({
		page,
	}) => {
		await page.route("**/api/integrations/*/case-grants", (route) =>
			route.request().method() === "POST"
				? failWith500(route)
				: route.fallback()
		);
		const integration = await seedIntegration("grant-refused");
		const { form } = await openForm(page, integration);
		await chooseCase(page, form, TARGET);
		await form.getByRole("button", { name: "Grant access" }).click();
		await expect(form.getByRole("alert")).toBeVisible();
		await expect(form).toBeVisible();
		await expect.poll(() => activeDescription(page)).not.toBe("BODY");
	});
});

interface PickerBox {
	bottom: number;
	left: number;
	right: number;
	top: number;
}

function openPickerMetrics(page: Page) {
	return page.evaluate(() => {
		const list = document.querySelector('[role="listbox"]');
		const wrapper = list?.closest("[data-radix-popper-content-wrapper]");
		const box = wrapper?.getBoundingClientRect();
		return {
			listScrolls: list ? list.scrollHeight > list.clientHeight : false,
			pageOverflow: document.documentElement.scrollWidth - window.innerWidth,
			box: box
				? { top: box.top, bottom: box.bottom, left: box.left, right: box.right }
				: null,
			innerHeight: window.innerHeight,
			innerWidth: window.innerWidth,
		};
	});
}

function expectInsideWindow(
	box: PickerBox | null,
	size: { innerHeight: number; innerWidth: number }
) {
	expect(box).not.toBeNull();
	expect(box?.top).toBeGreaterThanOrEqual(0);
	expect(box?.left).toBeGreaterThanOrEqual(0);
	expect(box?.bottom).toBeLessThanOrEqual(size.innerHeight);
	expect(box?.right).toBeLessThanOrEqual(size.innerWidth);
}

for (const viewport of [
	{ width: 375, height: 667 },
	{ width: 375, height: 420 },
	{ width: 1280, height: 720 },
]) {
	test.describe(`Case picker at ${viewport.width}x${viewport.height}`, () => {
		test.use({ viewport });

		test("opens inside the window without widening the page", async ({
			page,
		}) => {
			const integration = await seedIntegration(`picker-${viewport.height}`);
			const { form } = await openForm(page, integration);
			await picker(form).click();
			await expect(page.getByRole("listbox")).toBeVisible();
			const metrics = await openPickerMetrics(page);
			expect(metrics.pageOverflow).toBeLessThanOrEqual(0);
			expectInsideWindow(metrics.box, metrics);
		});

		test("keeps the list scrolling inside the popover", async ({ page }) => {
			const integration = await seedIntegration(`scroll-${viewport.height}`);
			const { form } = await openForm(page, integration);
			await picker(form).click();
			await expect(page.getByRole("listbox")).toBeVisible();
			expect((await openPickerMetrics(page)).listScrolls).toBe(true);
		});

		test("shows the 120-character name in full, inside the window", async ({
			page,
		}) => {
			const integration = await seedIntegration(`long-${viewport.height}`);
			const { form } = await openForm(page, integration);
			await picker(form).click();
			await page.getByPlaceholder("Search cases").fill("e2e-kb-long");
			const option = page.getByRole("option", { name: LONG_NAME });
			await expect(option).toBeVisible();
			const fit = await option.evaluate((el) => {
				const rect = el.getBoundingClientRect();
				return {
					clipped: el.scrollWidth > el.clientWidth,
					right: rect.right,
					left: rect.left,
					width: window.innerWidth,
					text: el.textContent,
				};
			});
			expect(fit.clipped).toBe(false);
			expect(fit.left).toBeGreaterThanOrEqual(0);
			expect(fit.right).toBeLessThanOrEqual(fit.width);
			expect(fit.text).toContain(LONG_NAME);
		});

		test("typing narrows sixty cases to the one typed", async ({ page }) => {
			const integration = await seedIntegration(`type-${viewport.height}`);
			const { form } = await openForm(page, integration);
			await picker(form).click();
			await page.getByPlaceholder("Search cases").fill(`${STAMP} number 59`);
			await expect(page.getByRole("option")).toHaveCount(1);
		});
	});
}

test.describe("Case picker keyboard use", () => {
	test("typing, Arrow and Enter choose a case and close the list", async ({
		page,
	}) => {
		const integration = await seedIntegration("picker-keys");
		const { form } = await openForm(page, integration);
		await picker(form).focus();
		await page.keyboard.press("Enter");
		await page.keyboard.type(TARGET);
		await page.keyboard.press("Enter");
		await expect(page.getByRole("listbox")).toHaveCount(0);
		await expect(picker(form)).toContainText(TARGET);
		await expect(picker(form)).toBeFocused();
	});

	test("Escape closes the list and keeps focus on the picker", async ({
		page,
	}) => {
		const integration = await seedIntegration("picker-escape");
		const { form } = await openForm(page, integration);
		await picker(form).click();
		await expect(page.getByRole("listbox")).toBeVisible();
		await page.keyboard.press("Escape");
		await expect(page.getByRole("listbox")).toHaveCount(0);
		await expect(form).toBeVisible();
		await expect(picker(form)).toBeFocused();
	});
});
