import type { Page } from "@playwright/test";
import { expect, test } from "./helpers/auth";
import { CASE_URL_PATTERN } from "./helpers/constants";
import { DashboardPage } from "./pages/dashboard-page";

/**
 * ADR 0005 — side-attached elements on the case canvas.
 *
 * Fixture setup here goes through the canvas's own creation flow ("Add
 * away goal" / "Add defeater", D7) rather than JSON import: a known,
 * separately-tracked bug drops isDefeater/defeatsElementId on both import
 * formats ([[TEA — Case import drops defeaters (isDefeater and
 * defeatsElementId) in both formats]]), so an imported defeater fixture
 * would fail for a reason unrelated to this slice. The ADR itself notes
 * defeaters reach the canvas by API/UI rather than import until that bug
 * is fixed.
 */

const G1_ADD_CHILD_LABEL = "Add child element";
const CITED_CASE_NAME_PATTERN = /^Cited Case/;
const CHALLENGES_EDGE_PATH_SELECTOR =
	".react-flow__edge path[stroke-dasharray]";

function g1Node(page: Page) {
	return page.locator(".react-flow__node", { hasText: "G1" });
}

async function openAddChildMenu(page: Page) {
	await g1Node(page).getByRole("button", { name: G1_ADD_CHILD_LABEL }).click();
}

async function createCaseViaModal(page: Page, name: string): Promise<void> {
	const dashboard = new DashboardPage(page);
	await dashboard.goto();
	await dashboard.createCaseButton.click();
	await page.getByLabel("Name").waitFor({ state: "visible" });
	await page.getByLabel("Name").fill(name);
	await page.getByLabel("Description").fill(`${name} — e2e fixture`);
	await page.getByRole("button", { name: "Submit" }).click();
	await page.waitForURL(CASE_URL_PATTERN);
}

/**
 * Adds a defeater on G1 via the canvas and returns a locator scoped to the
 * new defeater's own card — scoped by its (unique) description text rather
 * than its auto-generated identifier, which this test can't predict.
 */
async function addDefeaterOnG1(page: Page, description: string) {
	await openAddChildMenu(page);
	await page.getByRole("button", { name: "Add Defeater" }).click();
	await page.getByPlaceholder("Type your description here.").fill(description);
	await page.getByRole("button", { name: "Add", exact: true }).click();

	return page.locator(".react-flow__node", { hasText: description });
}

test.describe("Side-attached elements (ADR 0005)", () => {
	test("renders an away goal and a defeater added from the canvas, with the challenges edge", async ({
		page,
	}) => {
		// A second case to cite from the away goal — a fresh case always
		// seeds one top-level goal named G1.
		await createCaseViaModal(page, `Cited Case ${Date.now()}`);

		await createCaseViaModal(page, `Side Attachments Case ${Date.now()}`);

		// Add away goal, citing the case created above.
		await openAddChildMenu(page);
		await page.getByRole("button", { name: "Add Away Goal" }).click();
		const awayGoalDialog = page.getByRole("dialog");
		await awayGoalDialog.getByLabel("Case", { exact: true }).click();
		await page.getByRole("option", { name: CITED_CASE_NAME_PATTERN }).click();
		await awayGoalDialog.getByLabel("Goal", { exact: true }).click();
		await page.getByRole("option", { name: "G1" }).click();
		await awayGoalDialog.getByRole("button", { name: "Add Away Goal" }).click();

		await expect(page.getByText("Cites")).toBeVisible();

		// Add a defeater challenging G1.
		const defeaterCard = await addDefeaterOnG1(
			page,
			"This challenges G1's assertion."
		);
		await expect(
			defeaterCard.getByText("Defeater", { exact: true })
		).toBeVisible();

		// The challenges edge: dashed, destructive-token stroke — exactly one,
		// for the one defeater added. `toBeVisible` on a zero-height
		// horizontal <path> is unreliable; count is the stable assertion.
		await expect(page.locator(CHALLENGES_EDGE_PATH_SELECTOR)).toHaveCount(1);
	});

	test("adding a defeater from the canvas shows the chip and dashed edge", async ({
		page,
	}) => {
		await createCaseViaModal(page, `Defeater Case ${Date.now()}`);

		const defeaterCard = await addDefeaterOnG1(
			page,
			"A counter-claim against G1."
		);

		// The new defeater card carries the "Defeater" chip.
		await expect(
			defeaterCard.getByText("Defeater", { exact: true })
		).toBeVisible();

		// A dashed edge (the `challenges` edge, ADR 0005 D4) is drawn.
		await expect(page.locator(CHALLENGES_EDGE_PATH_SELECTOR)).toHaveCount(1);
	});
});
