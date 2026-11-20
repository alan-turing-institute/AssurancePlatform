import { expect, type Locator, type Page, test } from "@playwright/test";

// Two plugin toggles saved at once on Settings, Plugins. The requests are
// answered by the test after a delay (the plugin state itself never changes),
// so the second can finish while the first is still saving.

const PLUGINS_URL = "/dashboard/settings/plugins";
const SLOW_MS = 2500;
const FAST_MS = 400;

async function answerAfter(page: Page, delaysByIndex: number[]) {
	let seen = 0;
	await page.route("**/api/user/plugins", async (route) => {
		if (route.request().method() !== "PATCH") {
			await route.fallback();
			return;
		}
		const delay = delaysByIndex[seen++] ?? FAST_MS;
		await new Promise((resolve) => setTimeout(resolve, delay));
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({ ok: true }),
		});
	});
}

function cardOfSwitch(toggle: Locator): Locator {
	return toggle.locator(
		"xpath=ancestor::div[contains(@class,'rounded-lg')][1]"
	);
}

async function toggle(page: Page, which: Locator) {
	await which.click();
	const turnOff = page.getByRole("button", { name: "Turn off", exact: true });
	if (await turnOff.isVisible()) {
		await turnOff.click();
	}
}

function saving(page: Page) {
	return page.getByRole("status").filter({ hasText: "Saving…" });
}

test("a status region is present on every plugin card", async ({ page }) => {
	await page.goto(PLUGINS_URL);
	const switches = page.getByRole("switch");
	await expect(switches.first()).toBeVisible();
	const count = await switches.count();
	await expect(page.getByRole("status")).toHaveCount(count);
});

test("the first plugin keeps saving after the second finishes first", async ({
	page,
}) => {
	await answerAfter(page, [SLOW_MS, FAST_MS]);
	await page.goto(PLUGINS_URL);
	const switches = page.getByRole("switch");
	await expect(switches.nth(1)).toBeVisible();
	const first = switches.nth(0);
	const second = switches.nth(1);

	await toggle(page, first);
	await toggle(page, second);
	await expect(saving(page)).toHaveCount(2);

	// The second request answers first; the first card must still say Saving.
	await expect(cardOfSwitch(second).getByRole("status")).not.toHaveText(
		"Saving…",
		{ timeout: SLOW_MS }
	);
	await expect(cardOfSwitch(first).getByRole("status")).toHaveText("Saving…");
	await expect(saving(page)).toHaveCount(1);

	await expect(saving(page)).toHaveCount(0, { timeout: SLOW_MS * 2 });
});

test("a saving card ignores a second press and keeps its switch focusable", async ({
	page,
}) => {
	let patches = 0;
	await page.route("**/api/user/plugins", async (route) => {
		if (route.request().method() === "PATCH") {
			patches++;
			await new Promise((resolve) => setTimeout(resolve, 1200));
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({ ok: true }),
			});
			return;
		}
		await route.fallback();
	});
	await page.goto(PLUGINS_URL);
	const first = page.getByRole("switch").first();
	await expect(first).toBeVisible();
	await toggle(page, first);
	await expect(saving(page)).toHaveCount(1);
	await first.focus();
	await page.keyboard.press("Space");
	await page.keyboard.press("Space");
	await expect(saving(page)).toHaveCount(0, { timeout: 5000 });
	expect(patches).toBe(1);
	await expect(first).toBeFocused();
});
