/**
 * E2E coverage for the Discover pages rebuilt on frozen publish snapshots
 * (ADR 0003 §4/§6): slug-addressed routes, anonymous access to the page and
 * public API, and the retirement of the numeric `/discover/[id]` route.
 *
 * Fully anonymous — no saved auth state — to prove the public journey works
 * with no session at all, not merely that it doesn't require one.
 */

import { expect, test } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

// "Medium Case" is seeded PUBLISHED with curated case information
// (prisma/seed/dev-seed.ts) — its slug is deterministic from `slugify()`.
const SEEDED_SLUG = "medium-case";
const SEEDED_TITLE = "Medium Case";
const DOWNLOAD_BUTTON_PATTERN = /Download JSON/i;

test.describe("Discover — slug-addressed published items", () => {
	test("Discover index is reachable and lists the seeded published item", async ({
		page,
	}) => {
		await page.goto("/discover");
		await expect(page.getByText("Community Case Studies")).toBeVisible();
		// Each card renders two links to the same item (image + title), both
		// with an accessible name containing the title — .first() avoids a
		// Playwright strict-mode violation from matching both.
		await expect(
			page.getByRole("link", { name: SEEDED_TITLE }).first()
		).toBeVisible();
	});

	test("clicking a published item from Discover opens it at /discover/<slug>", async ({
		page,
	}) => {
		await page.goto("/discover");
		await page.getByRole("link", { name: SEEDED_TITLE }).first().click();
		await page.waitForURL(`**/discover/${SEEDED_SLUG}`);
		await expect(
			page.getByRole("heading", { name: SEEDED_TITLE })
		).toBeVisible();
	});

	test("the detail page renders only frozen snapshot data and offers the JSON download", async ({
		page,
	}) => {
		await page.goto(`/discover/${SEEDED_SLUG}`);
		await expect(
			page.getByRole("heading", { name: SEEDED_TITLE })
		).toBeVisible();
		await expect(
			page.getByRole("button", { name: DOWNLOAD_BUTTON_PATTERN })
		).toBeVisible();
	});

	test("the public API returns the snapshot JSON by slug, anonymously", async ({
		request,
	}) => {
		const response = await request.get(`/api/public/discover/${SEEDED_SLUG}`);
		expect(response.status()).toBe(200);
		const body = await response.json();
		expect(body.slug).toBe(SEEDED_SLUG);
		expect(body.title).toBe(SEEDED_TITLE);
		expect(body.type).toBe("ASSURANCE_CASE");
		expect(body.content).toBeTruthy();
	});

	test("a legacy numeric /discover/[id] path 404s — no redirect", async ({
		page,
	}) => {
		const response = await page.goto("/discover/1");
		expect(response?.status()).toBe(404);
		await expect(page.getByText("Page not found")).toBeVisible();
		// No redirect happened — the URL is still the numeric path requested.
		expect(page.url()).toContain("/discover/1");
	});

	test("an unknown slug 404s the same way", async ({ page }) => {
		const response = await page.goto("/discover/no-such-published-item");
		expect(response?.status()).toBe(404);
		await expect(page.getByText("Page not found")).toBeVisible();
	});
});
