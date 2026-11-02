/**
 * E2E coverage for "Use this pattern" on a published pattern's Discover page:
 * signed in, it opens the new-case dialog with the pattern chosen and creates
 * a case that opens in the editor; signed out, it goes through sign-in and
 * back to the page with the dialog open, creating nothing until the dialog is
 * submitted. A published case's page has no such button.
 *
 * Publishing a pattern from the UI is not part of this journey, so the
 * published row is written straight to the database, with a minimal pattern
 * file as its frozen content.
 */
import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import prisma from "@/lib/prisma";
import { expect, test } from "./helpers/auth";
import { CASE_URL_PATTERN } from "./helpers/constants";
import { LoginPage } from "./pages/login-page";

const UNIQUE_SUFFIX = Date.now();
const PATTERN_SLUG = `e2e-published-pattern-${UNIQUE_SUFFIX}`;
const PATTERN_TITLE = `E2E Published Pattern ${UNIQUE_SUFFIX}`;
const PATTERN_DESCRIPTION = "A reusable argument for end-to-end coverage.";
const GOAL_DESCRIPTION = "The pattern's top-level goal for end-to-end coverage";
const CASE_NAME_PREFIX = `E2E Pattern Case ${UNIQUE_SUFFIX}`;

// "Medium Case" is seeded PUBLISHED as an assurance case (prisma/seed/dev-seed.ts).
const PUBLISHED_CASE_SLUG = "medium-case";

const USE_BUTTON = { name: "Use this pattern" };
const DIALOG_NAME = "Create New Assurance Case";
const A_PATTERN = /^A pattern/;
const PATTERN_PICKER = { name: "Pattern" };
const SIGN_IN_PATH = /\/login/;
const OPEN_DIALOG_FLAG = /[?&]use=1/;

function patternFile() {
	return {
		version: "1.1",
		exportedAt: new Date().toISOString(),
		case: {
			name: PATTERN_TITLE,
			description: PATTERN_DESCRIPTION,
			kind: "PATTERN",
		},
		caseInformation: { description: PATTERN_DESCRIPTION },
		tree: {
			id: randomUUID(),
			type: "GOAL",
			name: "G1",
			description: GOAL_DESCRIPTION,
			role: "TOP_LEVEL",
			inSandbox: false,
			children: [
				{
					id: randomUUID(),
					type: "STRATEGY",
					name: "S1",
					description: "The pattern's strategy",
					inSandbox: false,
					children: [],
				},
			],
		},
	};
}

/** How many cases this spec has made so far. */
function countCreatedCases() {
	return prisma.assuranceCase.count({
		where: { name: { startsWith: CASE_NAME_PREFIX } },
	});
}

function newDialog(page: Page) {
	return page.getByRole("dialog", { name: DIALOG_NAME });
}

/** Checks the open dialog starts from the published pattern, then submits it. */
async function createCaseFromChosenPattern(page: Page, caseName: string) {
	const dialog = newDialog(page);
	await expect(dialog).toBeVisible();
	await expect(dialog.getByRole("radio", { name: A_PATTERN })).toBeChecked();
	await expect(dialog.getByRole("combobox", PATTERN_PICKER)).toContainText(
		PATTERN_TITLE
	);

	await dialog.getByLabel("Name").fill(caseName);
	await dialog
		.getByLabel("Description")
		.fill("Started from a published pattern");
	await dialog.getByRole("button", { name: "Submit" }).click();
	await page.waitForURL(CASE_URL_PATTERN);
	await expect(page.getByText(GOAL_DESCRIPTION).first()).toBeVisible();
}

test.describe("Use this pattern", () => {
	// One published row is shared by every test, so they run in one worker:
	// the row is written once before them and removed once after them.
	test.describe.configure({ mode: "serial" });

	test.beforeAll(async () => {
		await prisma.publishedAssuranceCase.create({
			data: {
				type: "ARGUMENT_PATTERN",
				slug: PATTERN_SLUG,
				title: PATTERN_TITLE,
				description: PATTERN_DESCRIPTION,
				isCurrent: true,
				content: patternFile(),
			},
		});
	});

	test.afterAll(async () => {
		await prisma.assuranceCase.deleteMany({
			where: { name: { startsWith: CASE_NAME_PREFIX } },
		});
		await prisma.publishedAssuranceCase.deleteMany({
			where: { slug: PATTERN_SLUG },
		});
	});

	test("signed in: opens the dialog with the pattern chosen and creates a case in the editor", async ({
		page,
	}) => {
		await page.goto(`/discover/${PATTERN_SLUG}`);
		await expect(
			page.getByRole("heading", { name: PATTERN_TITLE })
		).toBeVisible();

		await page.getByRole("button", USE_BUTTON).click();

		await createCaseFromChosenPattern(page, `${CASE_NAME_PREFIX} signed in`);
	});

	test("a published case's page has no Use this pattern button", async ({
		page,
	}) => {
		await page.goto(`/discover/${PUBLISHED_CASE_SLUG}`);

		await expect(
			page.getByRole("button", { name: "Download JSON" })
		).toBeVisible();
		await expect(page.getByRole("button", USE_BUTTON)).toHaveCount(0);
	});

	test.describe("signed out", () => {
		test.use({ storageState: { cookies: [], origins: [] } });

		test("goes through sign-in, returns with the dialog open and creates nothing until it is submitted", async ({
			page,
			seedPassword,
		}) => {
			const casesBefore = await countCreatedCases();
			await page.goto(`/discover/${PATTERN_SLUG}`);

			await page.getByRole("button", USE_BUTTON).click();
			await page.waitForURL(SIGN_IN_PATH);
			await new LoginPage(page).signIn("chris", seedPassword);

			await page.waitForURL(
				(url) => url.pathname === `/discover/${PATTERN_SLUG}`
			);
			await expect(newDialog(page)).toBeVisible();
			// The flag that opened the dialog is gone from the address.
			await expect(page).not.toHaveURL(OPEN_DIALOG_FLAG);
			expect(await countCreatedCases()).toBe(casesBefore);

			await createCaseFromChosenPattern(page, `${CASE_NAME_PREFIX} signed out`);
			expect(await countCreatedCases()).toBe(casesBefore + 1);
		});
	});
});
