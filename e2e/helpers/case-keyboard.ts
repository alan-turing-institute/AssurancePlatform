import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { DashboardPage } from "../pages/dashboard-page";
import { CASE_URL_PATTERN } from "./constants";

/** Opens a seeded case from the dashboard and waits for the toolbar. */
export async function openCase(page: Page, name: string): Promise<void> {
	await page.goto("/dashboard");
	await new DashboardPage(page).caseCard(name).click();
	await page.waitForURL(CASE_URL_PATTERN);
	await expect(page.getByTestId("toolbar-help")).toBeVisible();
	await expectCanvasMounted(page);
}

/**
 * The canvas library attaches its document key listeners when it mounts, so a
 * key pressed before a node is on screen can slip past them and prove nothing.
 */
export async function expectCanvasMounted(page: Page): Promise<void> {
	await expect(page.locator(".react-flow__node").first()).toBeVisible();
}

/** Moves focus to the control with the keyboard API, then presses one key. */
export async function pressKeyOn(
	page: Page,
	target: Locator,
	key: string
): Promise<void> {
	await target.focus();
	await expect(target).toBeFocused();
	await page.keyboard.press(key);
}

/** Any open dialog, alert dialog or side sheet. */
export function anyDialog(page: Page): Locator {
	return page.locator('[role="dialog"], [role="alertdialog"]');
}

/**
 * Records, for each Space keydown that reaches the document after every other
 * listener has run, whether its default action had been prevented.
 */
export async function recordSpaceDefaults(page: Page): Promise<void> {
	await page.evaluate(() => {
		const seen: boolean[] = [];
		(window as unknown as { __spaceSeen: boolean[] }).__spaceSeen = seen;
		document.addEventListener("keydown", (event) => {
			if (event.code === "Space") {
				seen.push(event.defaultPrevented);
			}
		});
	});
}

export async function spaceDefaultsSeen(page: Page): Promise<boolean[]> {
	return await page.evaluate(
		() => (window as unknown as { __spaceSeen: boolean[] }).__spaceSeen
	);
}

/** A short, stable description of the focused element. */
export async function focusedLabel(page: Page): Promise<string> {
	return await page.evaluate(() => {
		const el = document.activeElement as HTMLElement | null;
		if (!el || el === document.body) {
			return "BODY";
		}
		const name =
			el.getAttribute("aria-label") ||
			el.getAttribute("name") ||
			(el.textContent || "").trim().slice(0, 40);
		return `${el.tagName.toLowerCase()}:${name}`;
	});
}

/** Presses a key repeatedly and returns what had focus after each press. */
export async function walkFocus(
	page: Page,
	key: string,
	count: number
): Promise<string[]> {
	const stops: string[] = [];
	for (let i = 0; i < count; i++) {
		await page.keyboard.press(key);
		stops.push(await focusedLabel(page));
	}
	return stops;
}

/** The smallest valid PNG, for feeding the image upload. */
export const TINY_PNG = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
	"base64"
);

/** The canvas wrapper of the seeded top-level goal. */
export function goalNode(page: Page): Locator {
	return page.locator(".react-flow__node", { hasText: "G1" });
}

/** Opens the goal's edit dialog with the pointer. */
export async function openGoalDialog(page: Page): Promise<void> {
	await goalNode(page)
		.getByRole("button", { name: "Edit element", exact: true })
		.click();
	await expect(page.getByRole("dialog")).toContainText("Editing G1");
}
