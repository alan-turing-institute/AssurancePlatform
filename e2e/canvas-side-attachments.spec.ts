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
const CHALLENGES_EDGE_PATH_SELECTOR =
	".react-flow__edge path[stroke-dasharray]";
// `.react-flow__edge-path` (not just any `<path>`) excludes React Flow's
// own invisible wider "interaction" hit-area path, which shares the same
// `d` but no `react-flow__edge-path` class.
const SUPPORT_EDGE_PATH_SELECTOR =
	".react-flow__edge path.react-flow__edge-path:not([stroke-dasharray])";
const NAME_LABEL_PATTERN = /^Name/i;
const AG_ID_PATTERN = /^AG\d+$/;

/**
 * The G1 card, anchored on its own identifier text rather than a bare
 * `hasText: "G1"` substring match — unanchored, that also matched S1's
 * card whenever its description happened to mention "G1" (nanaki, round
 * 2). `getByText("G1", { exact: true })` only matches an element whose
 * own full text is exactly "G1" — the header's identifier span — never a
 * sentence that merely contains the substring.
 */
function g1Node(page: Page) {
	return page
		.locator(".react-flow__node")
		.filter({ has: page.getByText("G1", { exact: true }) });
}

async function openAddChildMenu(page: Page) {
	await g1Node(page).getByRole("button", { name: G1_ADD_CHILD_LABEL }).click();
}

async function addStrategyOnG1(page: Page, description: string) {
	await openAddChildMenu(page);
	await page.getByRole("button", { name: "Add Strategy" }).click();
	await page.getByPlaceholder("Type your description here.").fill(description);
	await page.getByRole("button", { name: "Add", exact: true }).click();

	return page.locator(".react-flow__node", { hasText: description });
}

/** Adds evidence from a card's own add-child menu (property claims only). */
async function addEvidenceOn(
	page: Page,
	cardLocator: ReturnType<typeof g1Node>,
	description: string
) {
	await cardLocator.getByRole("button", { name: G1_ADD_CHILD_LABEL }).click();
	await page.getByRole("button", { name: "Add Evidence" }).click();
	await page.getByPlaceholder("Type your description here.").fill(description);
	await page.getByRole("button", { name: "Add", exact: true }).click();

	return page.locator(".react-flow__node", { hasText: description });
}

interface ScreenPoint {
	x: number;
	y: number;
}

/**
 * Samples an SVG `<path>`'s position in actual screen pixels at evenly
 * spaced points along its length — via `getPointAtLength` +
 * `getScreenCTM().matrixTransform`, the standard way to convert a path's
 * own local (flow-space) coordinates into the same viewport-pixel space
 * `boundingBox()` returns for the node cards. Reading the `d` attribute's
 * raw numbers directly would compare flow-space to pixel-space — wrong
 * whenever the canvas is panned or zoomed.
 */
async function sampleEdgePathScreenPoints(
	page: Page,
	selector: string,
	pathIndex: number,
	steps = 60
): Promise<ScreenPoint[]> {
	return await page.evaluate(
		([sel, index, stepCount]) => {
			const paths = document.querySelectorAll(sel as string);
			const pathEl = paths[index as number] as SVGPathElement;
			const ctm = pathEl.getScreenCTM();
			if (!ctm) {
				return [];
			}
			const length = pathEl.getTotalLength();
			const points: { x: number; y: number }[] = [];
			for (let i = 0; i <= (stepCount as number); i++) {
				const point = pathEl.getPointAtLength(
					(length * i) / (stepCount as number)
				);
				const screenPoint = point.matrixTransform(ctm);
				points.push({ x: screenPoint.x, y: screenPoint.y });
			}
			return points;
		},
		[selector, pathIndex, steps] as const
	);
}

/** Whether `point` falls within `box` (both edges inclusive). */
function isInsideBox(
	point: ScreenPoint,
	box: { height: number; width: number; x: number; y: number }
): boolean {
	return (
		point.x >= box.x &&
		point.x <= box.x + box.width &&
		point.y >= box.y &&
		point.y <= box.y + box.height
	);
}

/**
 * The y shared by the largest cluster of sampled points (rounded to the
 * nearest pixel) — the horizontal run of a smoothstep bend contributes far
 * more samples at a near-constant y than either short vertical leaving/
 * entering stub does, so this picks out the bend's own y without needing
 * to know which sample index it falls at.
 */
function modeY(points: ScreenPoint[]): number {
	const counts = new Map<number, number>();
	for (const point of points) {
		const bucket = Math.round(point.y);
		counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
	}
	let bestY = 0;
	let bestCount = -1;
	for (const [y, count] of counts) {
		if (count > bestCount) {
			bestCount = count;
			bestY = y;
		}
	}
	return bestY;
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
		// seeds one top-level goal named G1. Matched on its own exact,
		// timestamped name below — a shared "^Cited Case" prefix pattern
		// collides with earlier fixtures left on a long-lived DB (nanaki,
		// round 3).
		const citedCaseName = `Cited Case ${Date.now()}`;
		await createCaseViaModal(page, citedCaseName);

		await createCaseViaModal(page, `Side Attachments Case ${Date.now()}`);

		// Add away goal, citing the case created above.
		await openAddChildMenu(page);
		await page.getByRole("button", { name: "Add Away Goal" }).click();
		const awayGoalDialog = page.getByRole("dialog");
		await awayGoalDialog.getByLabel("Case", { exact: true }).click();
		await page
			.getByRole("option", { name: citedCaseName, exact: true })
			.click();
		await awayGoalDialog.getByLabel("Goal", { exact: true }).click();
		await page.getByRole("option", { name: "G1" }).click();

		// Identifiers are always assigned by the server — no name field
		// (Chris's ruling, 2026-09-15, walkthrough finding 7).
		await expect(
			awayGoalDialog.getByLabel(NAME_LABEL_PATTERN)
		).not.toBeVisible();

		await awayGoalDialog.getByRole("button", { name: "Add Away Goal" }).click();

		await expect(page.getByText("Cites")).toBeVisible();
		// The card shows the server-assigned identifier (AG<n>), never a
		// user-typed name. The identifier appears twice on an expanded card
		// (header + footer) — `.first()` (nanaki, round 2): either occurrence
		// proves the same thing.
		await expect(
			page
				.locator(".react-flow__node", { hasText: "Cites" })
				.getByText(AG_ID_PATTERN)
				.first()
		).toBeVisible();

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

	test("two defeaters with evidence: the connector to G1's children bends below the whole cell, not through the second defeater's card", async ({
		page,
	}) => {
		await createCaseViaModal(page, `Two Defeaters Case ${Date.now()}`);

		await addStrategyOnG1(page, "S1 — a strategy under G1.");
		await addDefeaterOnG1(page, "First defeater on G1.");
		const secondDefeater = await addDefeaterOnG1(
			page,
			"Second defeater on G1."
		);
		await addEvidenceOn(
			page,
			secondDefeater,
			"Evidence under the second defeater."
		);

		// Two defeaters -> two dashed challenges edges.
		await expect(page.locator(CHALLENGES_EDGE_PATH_SELECTOR)).toHaveCount(2);

		const g1Box = await g1Node(page).boundingBox();
		const firstDefeater = page.locator(".react-flow__node", {
			hasText: "First defeater on G1.",
		});
		const firstDefeaterBox = await firstDefeater.boundingBox();
		const secondDefeaterBox = await secondDefeater.boundingBox();
		expect(g1Box).toBeTruthy();
		expect(firstDefeaterBox).toBeTruthy();
		expect(secondDefeaterBox).toBeTruthy();

		const cellBottomPx = Math.max(
			(g1Box?.y ?? 0) + (g1Box?.height ?? 0),
			(firstDefeaterBox?.y ?? 0) + (firstDefeaterBox?.height ?? 0),
			(secondDefeaterBox?.y ?? 0) + (secondDefeaterBox?.height ?? 0)
		);

		const supportPaths = page.locator(SUPPORT_EDGE_PATH_SELECTOR);
		const count = await supportPaths.count();
		expect(count).toBeGreaterThan(0);
		for (let i = 0; i < count; i++) {
			const points = await sampleEdgePathScreenPoints(
				page,
				SUPPORT_EDGE_PATH_SELECTOR,
				i
			);
			expect(points.length).toBeGreaterThan(0);

			// The connector never passes THROUGH either defeater's card — a
			// point-in-rectangle check (x AND y). A y-only band check also
			// flags the short vertical segment leaving G1's own bottom (at
			// G1's x, nowhere near either card) as a false positive on an
			// otherwise-correct layout (nanaki, round 3).
			const passesThroughACard = points.some(
				(point) =>
					(!!firstDefeaterBox && isInsideBox(point, firstDefeaterBox)) ||
					(!!secondDefeaterBox && isInsideBox(point, secondDefeaterBox))
			);
			expect(passesThroughACard).toBe(false);

			// And the bend itself (the horizontal run) sits below the whole
			// cell, not at G1's own naive midpoint (walkthrough finding 4) —
			// "doesn't pass through a card" alone wouldn't catch a bend that
			// happened to route around them at the wrong height.
			expect(modeY(points)).toBeGreaterThan(cellBottomPx);
		}
	});
});
