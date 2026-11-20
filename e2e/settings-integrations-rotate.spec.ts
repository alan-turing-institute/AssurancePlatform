import { expect, type Page, test } from "@playwright/test";
import {
	cardOf,
	INTEGRATIONS_URL,
	removeSeededData,
	type SeededIntegration,
	seedIntegration,
} from "./helpers/integration-fixtures";

// The Rotate button on a token of an integration that cannot rotate: it must
// be reachable by keyboard, say why it is inert, and send nothing.

const REASON = "Only an ACTIVE integration's tokens can be rotated";

test.afterAll(removeSeededData);

function trackRotateRequests(page: Page): () => number {
	let count = 0;
	page.on("request", (request) => {
		if (request.method() === "POST" && request.url().includes("/rotate")) {
			count++;
		}
	});
	return () => count;
}

async function openCard(page: Page, integration: SeededIntegration) {
	await page.goto(INTEGRATIONS_URL);
	const card = cardOf(page, integration);
	await expect(card).toBeVisible();
	return card;
}

for (const status of ["SUSPENDED", "REVOKED"] as const) {
	test.describe(`Rotate on a ${status} integration`, () => {
		test("is reached by Tab and described by the reason", async ({ page }) => {
			const integration = await seedIntegration(`rotate-${status}`, {
				status,
				tokens: 1,
			});
			const card = await openCard(page, integration);
			const rotate = card.getByRole("button", { name: "Rotate" });
			await card.getByRole("button", { name: "Issue new token" }).focus();
			await page.keyboard.press("Tab");
			await expect(rotate).toBeFocused();
			await expect(rotate).toHaveAttribute("aria-disabled", "true");
			expect(await rotate.evaluate((el) => el.hasAttribute("disabled"))).toBe(
				false
			);
			await expect(rotate).toHaveAccessibleDescription(REASON);
		});

		test("does nothing on Enter, Space or click", async ({ page }) => {
			const integration = await seedIntegration(`rotate-keys-${status}`, {
				status,
				tokens: 1,
			});
			const requests = trackRotateRequests(page);
			const card = await openCard(page, integration);
			const rotate = card.getByRole("button", { name: "Rotate" });
			await rotate.focus();
			await page.keyboard.press("Enter");
			await page.keyboard.press("Space");
			await page.waitForTimeout(500);
			await expect(rotate).toBeFocused();
			await rotate.click({ force: true });
			await page.waitForTimeout(300);
			expect(requests()).toBe(0);
			await expect(page.getByRole("dialog")).toHaveCount(0);
		});
	});
}

test.describe("Rotate on an active integration", () => {
	test("has no description, and a pending rotation sends only one request", async ({
		page,
	}) => {
		await page.route("**/api/integrations/*/tokens/*/rotate", async (route) => {
			await new Promise((resolve) => setTimeout(resolve, 1500));
			await route.continue();
		});
		const integration = await seedIntegration("rotate-active", { tokens: 1 });
		const requests = trackRotateRequests(page);
		const card = await openCard(page, integration);
		const rotate = card.getByRole("button", { name: "Rotate" });
		await expect(rotate).toHaveAccessibleDescription("");
		await rotate.click();
		const pending = card.getByRole("button", { name: "Rotating…" });
		await expect(pending).toBeVisible();
		await expect(pending).toHaveAttribute("aria-disabled", "true");
		await pending.focus();
		await page.keyboard.press("Enter");
		await page.keyboard.press("Space");
		await pending.click({ force: true });
		await expect(
			page.getByRole("dialog", { name: "Token secret" })
		).toBeVisible({
			timeout: 10_000,
		});
		expect(requests()).toBe(1);
	});
});
