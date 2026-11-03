/**
 * Publishing a pattern end to end: a blank pattern is made from the new-case
 * dialog, completed and published from the editor; Discover then lists it as
 * a reusable template under the Patterns filter (and not under Cases), its
 * page offers "Use this pattern", and the public API reports its type.
 * "Medium Case", seeded as a published case, stands for the other type.
 */
import prisma from "@/lib/prisma";
import { expect, test } from "./helpers/auth";
import { CASE_URL_PATTERN } from "./helpers/constants";
import { CaseEditorPage } from "./pages/case-editor-page";
import { DashboardPage } from "./pages/dashboard-page";

const UNIQUE_SUFFIX = Date.now();
const PATTERN_NAME = `Publish Pattern ${UNIQUE_SUFFIX}`;
const CASE_INFO = {
	description: "A reusable argument built for end-to-end publishing coverage.",
	authors: "E2E Test Suite",
	sector: "Information, Communication & Media",
};
const SEEDED_CASE_TITLE = "Medium Case";
const CASE_ID_FROM_URL_PATTERN = /\/case\/([a-f0-9-]+)/;
const A_BLANK_PATTERN = /^A blank pattern/;

test.describe("Publishing a pattern", () => {
	let caseId: string | undefined;

	test.afterAll(async () => {
		if (caseId) {
			await prisma.publishedAssuranceCase.deleteMany({
				where: { assuranceCaseId: caseId },
			});
			await prisma.assuranceCase.deleteMany({ where: { id: caseId } });
		}
	});

	test("a published pattern is a reusable template on Discover", async ({
		page,
	}) => {
		const dashboard = new DashboardPage(page);
		const editor = new CaseEditorPage(page);

		await dashboard.goto();
		await dashboard.createCaseButton.click();
		const dialog = page.getByRole("dialog", {
			name: "Create New Assurance Case",
		});
		await dialog.getByRole("radio", { name: A_BLANK_PATTERN }).click();
		await dialog.getByLabel("Name").fill(PATTERN_NAME);
		await dialog
			.getByLabel("Description")
			.fill("A pattern made by an e2e test");
		await dialog.getByRole("button", { name: "Submit" }).click();
		await page.waitForURL(CASE_URL_PATTERN);
		caseId = page.url().match(CASE_ID_FROM_URL_PATTERN)?.[1];
		expect(caseId).toBeTruthy();
		await expect(page.getByTestId("pattern-banner")).toBeVisible();

		await editor.caseInformationButton.click();
		const infoForm = page.getByTestId("case-information-form");
		await infoForm.getByLabel("Description").fill(CASE_INFO.description);
		await infoForm.getByLabel("Authors").fill(CASE_INFO.authors);
		await infoForm.getByLabel("Authors").press("Enter");
		await infoForm.getByLabel("Sector").click();
		await page.getByRole("option", { name: CASE_INFO.sector }).click();
		await Promise.all([
			page.waitForResponse(
				(resp) =>
					resp.url().includes(`/api/cases/${caseId}/information`) &&
					resp.request().method() === "PUT" &&
					resp.ok()
			),
			page.getByRole("button", { name: "Save case information" }).click(),
		]);
		await page.keyboard.press("Escape");

		await editor.statusButton.click();
		await Promise.all([
			page.waitForResponse(
				(resp) =>
					resp.url().includes(`/api/cases/${caseId}/publish`) &&
					resp.request().method() === "POST" &&
					resp.ok()
			),
			page.getByRole("button", { name: "Publish", exact: true }).click(),
		]);
		await expect(editor.statusButton).toHaveText("Published");

		const published = await prisma.publishedAssuranceCase.findFirst({
			where: { assuranceCaseId: caseId, isCurrent: true },
		});
		expect(published?.type).toBe("ARGUMENT_PATTERN");
		const slug = published?.slug as string;

		// Discover: the card is badged, and the type filter separates the two.
		await page.goto("/discover");
		const patternCard = page
			.getByRole("article")
			.filter({ hasText: PATTERN_NAME });
		const caseCard = page
			.getByRole("article")
			.filter({ hasText: SEEDED_CASE_TITLE });
		await expect(
			patternCard.getByText("Reusable template", { exact: true })
		).toBeVisible();
		await expect(
			caseCard.getByText("Worked example", { exact: true })
		).toBeVisible();

		const typeFilter = page.getByRole("combobox", { name: "Filter by type" });
		await typeFilter.click();
		await page.getByRole("option", { name: "Patterns" }).click();
		await expect(patternCard).toBeVisible();
		await expect(caseCard).toBeHidden();

		await typeFilter.click();
		await page.getByRole("option", { name: "Cases" }).click();
		await expect(caseCard).toBeVisible();
		await expect(patternCard).toBeHidden();

		// The pattern's own page offers to start a case from it.
		await page.goto(`/discover/${slug}`);
		await expect(
			page.getByRole("heading", { name: PATTERN_NAME })
		).toBeVisible();
		await expect(
			page.getByText("Reusable template", { exact: true })
		).toBeVisible();
		await expect(
			page.getByRole("button", { name: "Use this pattern" })
		).toBeVisible();

		const response = await page.request.get(`/api/public/discover/${slug}`);
		expect(response.status()).toBe(200);
		const body = await response.json();
		expect(body.type).toBe("ARGUMENT_PATTERN");
		expect(body.content.case.kind).toBe("PATTERN");
	});
});
