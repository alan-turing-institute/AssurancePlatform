import type { Request, Response } from "@playwright/test";
import { expect, test } from "./helpers/auth";
import { CASE_URL_PATTERN, LOGIN_PATTERN } from "./helpers/constants";
import { CaseEditorPage } from "./pages/case-editor-page";

// Matches the case-status endpoint's path so the waitForResponse predicate in
// the published-modal spec below can identify it regardless of query string.
const STATUS_ENDPOINT_PATTERN = /\/api\/cases\/[^/]+\/status$/;

// ADR 0003 §2 retired the READY_TO_PUBLISH intermediate state — a case is
// now either DRAFT or PUBLISHED, with no "mark as ready" step in between.
// These specs pin the current interim behaviour: a draft case shows an
// informational status modal with no publish control, and a published case
// shows the green "Published" badge. The guided single-action Publish flow
// that replaces the old "mark as ready" journey is not built yet — its e2e
// coverage lands with [[TEA — Retire case studies and land the publish
// journey e2e (ADR 0003)]], the next issue in the chain.

test.describe("Publishing", () => {
	test("discover page loads with community heading", async ({ page }) => {
		// Public route — uses chris's saved auth state but that's fine
		await page.goto("/discover");
		await expect(page.getByText("Community Case Studies")).toBeVisible();
	});

	test("status button shows Draft for a draft case", async ({ page }) => {
		await page.goto("/dashboard");
		await page.getByText("Simple Case").click();
		await page.waitForURL(CASE_URL_PATTERN);

		const editor = new CaseEditorPage(page);
		await expect(editor.statusButton).toBeVisible();
		await expect(editor.statusButton).toHaveText("Draft");
	});

	test("status modal opens with Draft content and no publish control", async ({
		page,
	}) => {
		await page.goto("/dashboard");
		await page.getByText("Simple Case").click();
		await page.waitForURL(CASE_URL_PATTERN);

		const editor = new CaseEditorPage(page);
		await editor.statusButton.click();

		await expect(editor.statusModalTitle).toBeVisible();
		await expect(page.getByText("Case Status: Draft")).toBeVisible();
		await expect(
			page.getByText(
				"Draft cases are only visible to you and collaborators with edit permissions."
			)
		).toBeVisible();
		// The retired "mark as ready" control must not be present.
		await expect(
			page.getByRole("button", { name: "Mark as Ready to Publish" })
		).toHaveCount(0);
	});

	test("status button shows Published for a published case", async ({
		page,
	}) => {
		// "Medium Case" is seeded as PUBLISHED (prisma/seed/dev-seed.ts).
		await page.goto("/dashboard");
		await page.getByText("Medium Case").click();
		await page.waitForURL(CASE_URL_PATTERN);

		const editor = new CaseEditorPage(page);
		await expect(editor.statusButton).toBeVisible();
		await expect(editor.statusButton).toHaveText("Published");
	});

	// Skipped 2026-07-17 — GET /api/cases/[id]/status can hang indefinitely
	// for published cases on constrained runners (request fires, no response;
	// evidenced in the tracked investigation). Re-enable when that lands. The
	// diagnostics below are kept intact as the regression tripwire for that
	// re-enable.
	// biome-ignore lint/suspicious/noSkippedTests: intentional, tracked skip — see comment above.
	test.skip("status modal opens with Published content for a published case", async ({
		page,
	}, testInfo) => {
		await page.goto("/dashboard");
		await page.getByText("Medium Case").click();
		await page.waitForURL(CASE_URL_PATTERN);

		const editor = new CaseEditorPage(page);

		// CI diagnostics (2026-07): this spec flakes in CI — the status endpoint
		// appears never to resolve with 200 inside the 20s window below, though
		// it's ~185ms locally. The listeners and trace here don't change the
		// wait itself; they exist so the next CI failure names the actual
		// outcome — a non-200 status, a network-level failure, or genuinely no
		// request/response at all — instead of a bare timeout.
		const startedAt = Date.now();
		const elapsed = () => `${Date.now() - startedAt}ms`;
		const trace: string[] = [];

		const isStatusEndpoint = (url: string) =>
			STATUS_ENDPOINT_PATTERN.test(new URL(url).pathname);

		const onRequest = (request: Request) => {
			if (isStatusEndpoint(request.url())) {
				trace.push(
					`[+${elapsed()}] request: ${request.method()} ${request.url()}`
				);
			}
		};
		const onRequestFailed = (request: Request) => {
			if (isStatusEndpoint(request.url())) {
				trace.push(
					`[+${elapsed()}] requestfailed: ${request.url()} — ${
						request.failure()?.errorText ?? "no failure text"
					}`
				);
			}
		};
		const onResponse = (response: Response) => {
			if (isStatusEndpoint(response.url())) {
				trace.push(
					`[+${elapsed()}] response: ${response.status()} ${response.url()}`
				);
			}
		};

		page.on("request", onRequest);
		page.on("requestfailed", onRequestFailed);
		page.on("response", onResponse);

		try {
			// For a case with a current published snapshot, GET /api/cases/[id]/status
			// synchronously runs full export + change-detection (getFullPublishStatus's
			// expensive path) before the modal is allowed to open — see
			// handleStatusButtonClick in components/cases/header.tsx. That can be slow
			// on CI runners; arming this wait BEFORE the click means a slow/hung fetch
			// fails here, naming the endpoint, instead of surfacing 5s later as a mute
			// "element not found" on the modal assertions below. Making the open itself
			// fast is tracked separately: [[TEA — Publish flow — validate, publish,
			// republish, unpublish (ADR 0003)]].
			//
			// The predicate below accepts ANY response for the endpoint (not just
			// 200) so a non-200 status surfaces as an assertion failure naming the
			// code, rather than as a timeout with no diagnostic content.
			const statusResponsePromise = page.waitForResponse(
				(response) => isStatusEndpoint(response.url()),
				{ timeout: 20_000 }
			);
			await editor.statusButton.click();
			const statusResponse = await statusResponsePromise;

			if (statusResponse.status() !== 200) {
				const body = (await statusResponse.text()).slice(0, 500);
				expect(
					statusResponse.status(),
					`expected 200 from ${statusResponse.url()}, got ${statusResponse.status()}. Body (truncated to 500 chars): ${body}`
				).toBe(200);
			}

			// Extra headroom on the first assertion for render-after-response on slow
			// runners; the response above already absorbed the expensive-path wait.
			await expect(editor.statusModalTitle).toBeVisible({ timeout: 10_000 });
			await expect(page.getByText("Case Status: Published")).toBeVisible();
			await expect(
				page.getByText("This case is published and visible in case studies.")
			).toBeVisible();
		} finally {
			page.off("request", onRequest);
			page.off("requestfailed", onRequestFailed);
			page.off("response", onResponse);
			await testInfo.attach("status-endpoint-trace", {
				body:
					trace.length > 0
						? trace.join("\n")
						: `(no request/response/requestfailed events observed for ${STATUS_ENDPOINT_PATTERN} in ${elapsed()})`,
				contentType: "text/plain",
			});
		}
	});

	test("case studies page is accessible", async ({ page }) => {
		await page.goto("/dashboard/case-studies");

		// Should not redirect to login (authenticated via saved state)
		await expect(page).not.toHaveURL(LOGIN_PATTERN);
	});
});
