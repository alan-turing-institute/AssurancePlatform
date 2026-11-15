/**
 * E2E tests for the dynamic Case Studies index page.
 *
 * These tests verify:
 *  - All 10 case studies appear in the summary table
 *  - Every case-study link is absolute and resolves (no 404s)
 *  - Domain/Assurance-Goal columns match the authored frontmatter
 *  - Excluded entries (index, _meta, underscore-prefixed) do NOT appear
 *
 * Docs pages are publicly accessible — no auth fixture required.
 */

import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

const INDEX_URL = "/docs/curriculum/case-studies";

// Top-level regex constants (Biome useTopLevelRegex)
const RE_ABSOLUTE_CASE_STUDIES_HREF = /^\/docs\/curriculum\/case-studies\//;
const RE_RELATIVE_PATH = /^\.\./;
const RE_INDEX_HREF = /\/index$/;
const RE_TEMPLATE_HREF = /_TEMPLATE/;
const RE_WORKSHOP_HREF = /_workshop-evidence-mining/;
const RE_TEMPLATE_TEXT = /template/i;
const RE_WORKSHOP_TEXT = /workshop/i;
const RE_CASE_STUDIES_TITLE = /Case Studies/;
const RE_DIABETIC_HEADING = /Diabetic Retinopathy/i;
const RE_ATC_HEADING = /Air Traffic Control/i;
const RE_CENSUS_HEADING = /Census/i;

/**
 * The link in the summary table. The docs sidebar lists the same titles, and
 * its auto-scroll moves them between press and release, so clicks target the
 * table copy only.
 */
const summaryTableLink = (page: Page, title: string) =>
	page.getByRole("table").getByRole("link", { name: title, exact: true });

/** Authoritative expected case studies from the issue acceptance criteria */
const EXPECTED_CASE_STUDIES: Array<{
	slug: string;
	title: string;
	domain: string;
	assurance_goal: string;
}> = [
	{
		slug: "diabetic-retinopathy-screening",
		title: "Explainable Diabetic Retinopathy Screening System",
		domain: "Healthcare",
		assurance_goal: "Explainability",
	},
	{
		slug: "crop-damage-assessment",
		title: "Fair Crop Damage Assessment System",
		domain: "Agriculture",
		assurance_goal: "Fairness",
	},
	{
		slug: "flood-risk-assessment",
		title: "Equitable Flood Risk Assessment System",
		domain: "Environmental",
		assurance_goal: "Fairness",
	},
	{
		slug: "student-learning-assessment",
		title: "Explainable Student Learning Assessment System",
		domain: "Education",
		assurance_goal: "Explainability",
	},
	{
		slug: "personalised-pharmaceutical-formulations",
		title: "Equitable Personalised Pharmaceutical Formulation System",
		domain: "Pharmaceutical",
		assurance_goal: "Fairness",
	},
	{
		slug: "clinical-genai-data-governance",
		title: "Transparent Clinical GenAI System with Legacy Data",
		domain: "Healthcare",
		assurance_goal: "Transparency",
	},
	{
		slug: "explainable-atc-rl-agent",
		title: "Explainable Reinforcement Learning Agent for Air Traffic Control",
		domain: "Aviation",
		assurance_goal: "Explainability",
	},
	{
		slug: "adaptive-clinical-trial-allocation",
		title: "Safe Adaptive Allocation in a Bayesian Platform Clinical Trial",
		domain: "Healthcare",
		assurance_goal: "Safety",
	},
	{
		slug: "census-disclosure-control",
		title: "Balancing Privacy and Utility in Census Disclosure Control",
		domain: "Public Sector",
		assurance_goal: "Privacy",
	},
	{
		slug: "aerial-facial-recognition",
		title: "Equitable Identification in Aerial Facial Recognition",
		domain: "Security and Defence",
		assurance_goal: "Fairness",
	},
];

test.describe("Case Studies index page", () => {
	test("page loads and heading is present", async ({ page }) => {
		await page.goto(INDEX_URL);
		await expect(page).toHaveTitle(RE_CASE_STUDIES_TITLE);
		await expect(
			page.getByRole("heading", { name: "Case Studies", level: 1 })
		).toBeVisible();
	});

	test("summary table has correct column headers", async ({ page }) => {
		await page.goto(INDEX_URL);
		const table = page.locator("table").first();
		await expect(table).toBeVisible();
		await expect(
			table.getByRole("columnheader", { name: "Case Study" })
		).toBeVisible();
		await expect(
			table.getByRole("columnheader", { name: "Domain" })
		).toBeVisible();
		await expect(
			table.getByRole("columnheader", { name: "Assurance Goal" })
		).toBeVisible();
	});

	test("all 10 case studies appear in the summary table", async ({ page }) => {
		await page.goto(INDEX_URL);
		const table = page.locator("table").first();
		const rows = table.locator("tbody tr");
		await expect(rows).toHaveCount(10);
	});

	test("summary table entries match authoritative domain/assurance_goal values", async ({
		page,
	}) => {
		await page.goto(INDEX_URL);
		const table = page.locator("table").first();
		for (const cs of EXPECTED_CASE_STUDIES) {
			const row = table.locator("tbody tr").filter({ hasText: cs.title });
			await expect(row).toBeVisible({ timeout: 5000 });
			await expect(row.locator("td").nth(1)).toHaveText(cs.domain);
			await expect(row.locator("td").nth(2)).toHaveText(cs.assurance_goal);
		}
	});

	test("all case-study links in the summary table are absolute paths", async ({
		page,
	}) => {
		await page.goto(INDEX_URL);
		const table = page.locator("table").first();
		const links = table.locator("tbody tr td:first-child a");
		const count = await links.count();
		expect(count).toBe(10);

		for (let i = 0; i < count; i++) {
			const href = await links.nth(i).getAttribute("href");
			expect(href).toMatch(RE_ABSOLUTE_CASE_STUDIES_HREF);
			// Must not be a relative path (no "../" prefix)
			expect(href).not.toMatch(RE_RELATIVE_PATH);
		}
	});

	test("all case-study links resolve to 200 (no 404s)", async ({
		page,
		request,
	}) => {
		await page.goto(INDEX_URL);
		const table = page.locator("table").first();
		const links = table.locator("tbody tr td:first-child a");
		const count = await links.count();

		for (let i = 0; i < count; i++) {
			const href = await links.nth(i).getAttribute("href");
			expect(href).toBeTruthy();
			// biome-ignore lint/style/noNonNullAssertion: asserted truthy above
			const response = await request.get(href!);
			expect(response.status(), `${href} returned ${response.status()}`).toBe(
				200
			);
		}
	});

	test("clicking diabetic-retinopathy-screening link loads the case-study page", async ({
		page,
	}) => {
		await page.goto(INDEX_URL);
		await summaryTableLink(
			page,
			"Explainable Diabetic Retinopathy Screening System"
		).click();
		await page.waitForURL("**/case-studies/diabetic-retinopathy-screening");
		await expect(
			page.getByRole("heading", { name: RE_DIABETIC_HEADING }).first()
		).toBeVisible();
	});

	test("clicking explainable-atc-rl-agent link loads the case-study page", async ({
		page,
	}) => {
		await page.goto(INDEX_URL);
		await summaryTableLink(
			page,
			"Explainable Reinforcement Learning Agent for Air Traffic Control"
		).click();
		await page.waitForURL("**/case-studies/explainable-atc-rl-agent");
		await expect(
			page.getByRole("heading", { name: RE_ATC_HEADING }).first()
		).toBeVisible();
	});

	test("clicking census-disclosure-control link loads the case-study page", async ({
		page,
	}) => {
		await page.goto(INDEX_URL);
		await summaryTableLink(
			page,
			"Balancing Privacy and Utility in Census Disclosure Control"
		).click();
		await page.waitForURL("**/case-studies/census-disclosure-control");
		await expect(
			page.getByRole("heading", { name: RE_CENSUS_HEADING }).first()
		).toBeVisible();
	});

	test("excluded entries do not appear: index, _TEMPLATE, _workshop-evidence-mining", async ({
		page,
	}) => {
		await page.goto(INDEX_URL);
		// These should NOT appear as links in the table
		const allLinks = page.locator("table a");
		const hrefs = await allLinks.evaluateAll((els) =>
			els.map((el) => el.getAttribute("href") ?? "")
		);
		for (const href of hrefs) {
			expect(href).not.toMatch(RE_INDEX_HREF);
			expect(href).not.toMatch(RE_TEMPLATE_HREF);
			expect(href).not.toMatch(RE_WORKSHOP_HREF);
		}
		// Also confirm no link text mentions template or workshop
		const allLinkTexts = await allLinks.evaluateAll((els) =>
			els.map((el) => el.textContent ?? "")
		);
		for (const text of allLinkTexts) {
			expect(text).not.toMatch(RE_TEMPLATE_TEXT);
			expect(text).not.toMatch(RE_WORKSHOP_TEXT);
		}
	});
});
