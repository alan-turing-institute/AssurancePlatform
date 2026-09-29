import { expect, test } from "./helpers/auth";
import { DashboardPage } from "./pages/dashboard-page";

/**
 * The import dialog's error surfacing (walkthrough finding 16): a
 * schema-rejected file must name the offending field and reason, not only
 * "not a valid case". The fixture below is a minimal, otherwise-valid
 * nested (v1.0) export with one malformed `defeatsElementId` — verified
 * directly against `detectAndValidate` (`lib/schemas/version-detection.ts`)
 * to produce exactly the path/message asserted here, so this test doesn't
 * depend on guessing Zod's own wording.
 */
const MALFORMED_UUID_EXPORT = {
	version: "1.0",
	exportedAt: "2026-09-15T00:00:00.000Z",
	case: { name: "Malformed UUID Import", description: "e2e fixture" },
	tree: {
		id: "11111111-1111-4111-8111-111111111111",
		type: "GOAL",
		name: "G1",
		description: "Root goal",
		inSandbox: false,
		children: [
			{
				id: "22222222-2222-4222-8222-222222222222",
				type: "PROPERTY_CLAIM",
				name: "P1",
				description: "A defeater",
				inSandbox: false,
				children: [],
				isDefeater: true,
				defeatsElementId: "not-a-uuid",
			},
		],
	},
};

test.describe("Case import — validation error surfacing", () => {
	test("names the offending field and reason for a schema-rejected file", async ({
		page,
	}) => {
		const dashboard = new DashboardPage(page);
		await dashboard.goto();

		await page.getByRole("button", { name: "Import File" }).click();
		const dialog = page.getByRole("dialog");
		await expect(dialog).toBeVisible();

		await dialog.getByLabel("JSON File").setInputFiles({
			name: "malformed-uuid.json",
			mimeType: "application/json",
			buffer: Buffer.from(JSON.stringify(MALFORMED_UUID_EXPORT)),
		});
		await dialog.getByRole("button", { name: "Import File" }).click();

		// Not just "not a valid case" — the path and reason, verbatim.
		await expect(
			page.getByText("tree.children.0.defeatsElementId: Invalid UUID")
		).toBeVisible();
	});
});
