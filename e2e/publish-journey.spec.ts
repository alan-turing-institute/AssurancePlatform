/**
 * ADR 0003 end-to-end publish journey: draft -> fill case information ->
 * publish (validate + confirm) -> anonymous Discover render + snapshot JSON
 * fetch -> edit -> divergence indicator -> republish (atomic) -> unpublish
 * -> public record gone (404).
 *
 * This is the full-journey coverage `publishing.spec.ts`'s header comment
 * deferred to "the next issue in the chain, which retires case studies and
 * lands the publish journey e2e" — this file. `publishing.spec.ts` keeps
 * pinning the status dialog's own behaviour in isolation (draft/published
 * labels, the missing-fields gate); this file drives one case through the
 * whole publish/unpublish lifecycle end to end.
 *
 * The content-change step (edit -> divergence) goes through the elements
 * API directly rather than the React Flow canvas: the canvas node action
 * buttons (edit/add) have no accessible name in this codebase yet (icon-only,
 * tooltip content isn't an accessible name), so there is no established
 * Playwright pattern for driving them, and inventing a brittle CSS-icon
 * selector here isn't worth it for a single setup step. Every
 * publish/unpublish/anonymous-view step below still goes through the real
 * UI; only the structural edit is made via the same API route the canvas
 * "Add child element" action itself calls.
 *
 * Published payloads carry no comments (an existing strip layer handles
 * that, see `discover-comments-privacy.test.ts`) — this file doesn't
 * exercise or re-assert that; it isn't fighting or duplicating it. This file
 * does cover a related but distinct behaviour: a comment added after publish
 * must not trip the divergence indicator (the change-detection comparison
 * excludes comments from what counts as "content").
 */
import prisma from "@/lib/prisma";
import { expect, test } from "./helpers/auth";
import { CASE_URL_PATTERN } from "./helpers/constants";
import { CaseEditorPage } from "./pages/case-editor-page";
import { DashboardPage } from "./pages/dashboard-page";

const UNIQUE_SUFFIX = Date.now();
const CASE_NAME = `Publish Journey Case ${UNIQUE_SUFFIX}`;
const CASE_DESCRIPTION = "Created by the ADR 0003 publish-journey e2e test";
const CASE_INFO = {
	description:
		"A worked example built for end-to-end publish-journey coverage.",
	authors: "E2E Test Suite",
	sector: "Technology",
};
const NEW_STRATEGY_DESCRIPTION = "New strategy added for divergence coverage";

const DIVERGENCE_TEXT =
	"Changes have been made since this case was last published.";
const CASE_ID_FROM_URL_PATTERN = /\/case\/([a-f0-9-]+)/;

test.describe("ADR 0003 — publish journey", () => {
	let caseId: string | undefined;

	test.afterAll(async () => {
		// The unpublish step already removes the published row(s); the draft
		// case itself is cleaned up here so repeated runs don't accumulate in
		// a shared dev DB (mirrors machine-whoami.spec.ts's afterAll).
		if (caseId) {
			await prisma.assuranceCase.deleteMany({ where: { id: caseId } });
		}
	});

	test("draft -> case information -> publish -> discover -> edit -> republish -> unpublish", async ({
		page,
	}) => {
		const dashboard = new DashboardPage(page);
		const editor = new CaseEditorPage(page);

		// ---- Draft: create a new case ----
		await dashboard.goto();
		await dashboard.createCaseButton.click();
		await page.getByLabel("Name").waitFor({ state: "visible" });
		await page.getByLabel("Name").fill(CASE_NAME);
		await page.getByLabel("Description").fill(CASE_DESCRIPTION);
		await page.getByRole("button", { name: "Submit" }).click();
		await page.waitForURL(CASE_URL_PATTERN);

		caseId = page.url().match(CASE_ID_FROM_URL_PATTERN)?.[1];
		expect(caseId).toBeTruthy();

		await expect(editor.statusButton).toHaveText("Draft");

		// ---- Fill case information: description, authors, sector all
		// required to publish (ADR 0003 §4 — widened 2026-08-11) ----
		await editor.caseInformationButton.click();
		await expect(
			page.getByRole("heading", { name: "Case Information" })
		).toBeVisible();

		// Scoped to the case-information form specifically — the same sheet
		// also renders the case's own name/description edit form, which has
		// its own "Description" label.
		const infoForm = page.getByTestId("case-information-form");
		await infoForm.getByLabel("Description").fill(CASE_INFO.description);
		await infoForm.getByLabel("Authors").fill(CASE_INFO.authors);
		await infoForm.getByLabel("Sector").fill(CASE_INFO.sector);

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
		await expect(
			page.getByRole("heading", { name: "Case Information" })
		).toBeHidden();

		// ---- Publish: validate (already complete) + confirm ----
		await editor.statusButton.click();
		await expect(page.getByTestId("publish-content-ready")).toBeVisible();

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

		// ---- Anonymous Discover: page render + snapshot JSON fetch ----
		const published = await prisma.publishedAssuranceCase.findFirst({
			where: { assuranceCaseId: caseId, isCurrent: true },
		});
		expect(published?.slug).toBeTruthy();
		const slug = published?.slug as string;

		await page.goto(`/discover/${slug}`);
		await expect(page.getByRole("heading", { name: CASE_NAME })).toBeVisible();

		// `page.request` shares the signed-in browser context's cookies, but
		// `/api/public/*` is exempted from session auth entirely (middleware.ts)
		// — this proves the snapshot resolves by slug, not that no session was
		// present; full anonymous-access coverage lives in `discover.spec.ts`.
		const snapshotResponse = await page.request.get(
			`/api/public/discover/${slug}`
		);
		expect(snapshotResponse.status()).toBe(200);
		const snapshotBody = await snapshotResponse.json();
		expect(snapshotBody.slug).toBe(slug);
		expect(snapshotBody.title).toBe(CASE_NAME);
		expect(snapshotBody.content).toBeTruthy();

		// ---- Comment immunity: a comment is not case content, so adding one
		// must not trip the published-version-behind indicator (human-verified
		// in the 2026-08-12 staging walkthrough, finding 6). Distinct from
		// `discover-comments-privacy.test.ts`, which covers comments being
		// stripped from the published payload — this covers the divergence
		// check excluding comments from what it compares. ----
		const commentResponse = await page.request.post(
			`/api/cases/${caseId}/comments`,
			{ data: { content: "A comment left after publishing." } }
		);
		expect(commentResponse.status()).toBe(201);

		await page.reload();
		await editor.statusButton.click();
		await expect(editor.statusModalTitle).toBeVisible();
		await expect(page.getByText(DIVERGENCE_TEXT)).toBeHidden();
		await page.keyboard.press("Escape");
		await expect(editor.statusModalTitle).toBeHidden();

		// ---- Edit: a real structural change via the elements API (the same
		// route the canvas "Add child element" action calls) ----
		await page.goto(`/case/${caseId}`);
		const caseResponse = await page.request.get(`/api/cases/${caseId}`);
		const caseBody = await caseResponse.json();
		const goalId = caseBody.goals?.[0]?.id;
		expect(goalId).toBeTruthy();

		const addElementResponse = await page.request.post(
			`/api/cases/${caseId}/elements`,
			{
				data: {
					type: "STRATEGY",
					parentId: goalId,
					description: NEW_STRATEGY_DESCRIPTION,
				},
			}
		);
		expect(addElementResponse.status()).toBe(201);

		// ---- Divergence indicator ----
		await page.reload();
		await editor.statusButton.click();
		await expect(page.getByText(DIVERGENCE_TEXT)).toBeVisible();

		// ---- Republish: atomic — fresh snapshot row, same slug ----
		await Promise.all([
			page.waitForResponse(
				(resp) =>
					resp.url().includes(`/api/cases/${caseId}/status`) &&
					resp.request().method() === "PATCH" &&
					resp.ok()
			),
			page.getByRole("button", { name: "Update Published" }).click(),
		]);

		const republished = await prisma.publishedAssuranceCase.findFirst({
			where: { assuranceCaseId: caseId, isCurrent: true },
		});
		// Same slug carried forward verbatim (ADR 0003 §6 — stable across
		// republish), but a genuinely new row (republish inserts, not updates).
		expect(republished?.slug).toBe(slug);
		expect(republished?.id).not.toBe(published?.id);

		const republishedSnapshot = await page.request.get(
			`/api/public/discover/${slug}`
		);
		const republishedBody = await republishedSnapshot.json();
		expect(JSON.stringify(republishedBody.content)).toContain(
			NEW_STRATEGY_DESCRIPTION
		);

		// ---- Unpublish: public record removed ----
		await editor.statusButton.click();
		await page.getByRole("button", { name: "Unpublish" }).click();

		await Promise.all([
			page.waitForResponse(
				(resp) =>
					resp.url().includes(`/api/cases/${caseId}/status`) &&
					resp.request().method() === "PATCH" &&
					resp.ok()
			),
			page.getByRole("button", { name: "Yes, unpublish" }).click(),
		]);

		await expect(editor.statusButton).toHaveText("Draft");

		const goneResponse = await page.request.get(`/api/public/discover/${slug}`);
		expect(goneResponse.status()).toBe(404);

		const gonePage = await page.goto(`/discover/${slug}`);
		expect(gonePage?.status()).toBe(404);
		await expect(page.getByText("Page not found")).toBeVisible();
	});
});
