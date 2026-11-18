import { expect, type Page, test } from "@playwright/test";
import prisma from "@/lib/prisma";
import { registerIntegration } from "@/lib/services/integration-registry-service";

// Keyboard focus in the "Issue a new token" dialog: the no-end-date
// confirmation is a second step inside the same dialog, so focus must never
// fall to the page body while the form is open.

const unique = `e2e-token-focus-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
let integrationId: string | undefined;

test.beforeAll(async () => {
	const owner = await prisma.user.findUniqueOrThrow({
		where: { username: "chris" },
		select: { id: true },
	});
	const registered = await registerIntegration(
		{ name: unique, scopes: ["case:read"] },
		owner.id
	);
	if ("error" in registered) {
		throw new Error(`Failed to seed test integration: ${registered.error}`);
	}
	integrationId = registered.data.integration.id;
});

test.afterAll(async () => {
	// Deleting the integration cascades its tokens.
	if (integrationId) {
		await prisma.integration.deleteMany({ where: { id: integrationId } });
	}
	await prisma.$disconnect();
});

async function openIssueDialog(page: Page) {
	await page.goto("/dashboard/settings/integrations");
	const card = page.getByTestId(`integration-card-${integrationId}`);
	await card
		.getByRole("button", { name: "Issue new token", exact: true })
		.click();
	const dialog = page.getByRole("dialog", { name: "Issue a new token" });
	await expect(dialog).toBeVisible();
	return dialog;
}

async function reachWarning(page: Page) {
	const dialog = await openIssueDialog(page);
	await dialog
		.getByRole("button", { name: "Issue token", exact: true })
		.click();
	const warning = page.getByRole("dialog", { name: "Are you sure?" });
	await expect(warning).toBeVisible();
	await expect(
		warning.getByRole("button", { name: "Go back", exact: true })
	).toBeFocused();
	return warning;
}

test("Go back from the no-end-date warning returns focus to Issue token", async ({
	page,
}) => {
	const warning = await reachWarning(page);
	await warning.getByRole("button", { name: "Go back", exact: true }).click();

	const dialog = page.getByRole("dialog", { name: "Issue a new token" });
	await expect(
		dialog.getByRole("button", { name: "Issue token", exact: true })
	).toBeFocused();
});

test("Escape from the no-end-date warning returns focus to Issue token", async ({
	page,
}) => {
	await reachWarning(page);
	await page.keyboard.press("Escape");

	const dialog = page.getByRole("dialog", { name: "Issue a new token" });
	await expect(dialog).toBeVisible();
	await expect(
		dialog.getByRole("button", { name: "Issue token", exact: true })
	).toBeFocused();
});

test("Escape on the form step closes the dialog and focuses Issue new token", async ({
	page,
}) => {
	await openIssueDialog(page);
	await page.keyboard.press("Escape");

	await expect(page.getByRole("dialog")).toHaveCount(0);
	await expect(
		page
			.getByTestId(`integration-card-${integrationId}`)
			.getByRole("button", { name: "Issue new token", exact: true })
	).toBeFocused();
});

test("a failed request returns focus to Issue token", async ({ page }) => {
	await page.route("**/api/integrations/*/tokens", (route) =>
		route.request().method() === "POST"
			? route.fulfill({
					status: 500,
					contentType: "application/json",
					body: JSON.stringify({ error: "Failed to issue token" }),
				})
			: route.continue()
	);
	const warning = await reachWarning(page);
	await warning
		.getByRole("button", {
			name: "Issue without an end date",
			exact: true,
		})
		.click();

	const dialog = page.getByRole("dialog", { name: "Issue a new token" });
	await expect(
		dialog.getByRole("button", { name: "Issue token", exact: true })
	).toBeFocused();
});

test("a successful issue moves focus into the secret dialog", async ({
	page,
}) => {
	const warning = await reachWarning(page);
	await warning
		.getByRole("button", {
			name: "Issue without an end date",
			exact: true,
		})
		.click();

	await expect(
		page.getByRole("dialog", { name: "Issue a new token" })
	).toHaveCount(0);
	const secret = page.getByRole("dialog", { name: "Token secret" });
	await expect(secret).toBeVisible();
	await expect
		.poll(() => secret.evaluate((el) => el.contains(document.activeElement)))
		.toBe(true);
});
