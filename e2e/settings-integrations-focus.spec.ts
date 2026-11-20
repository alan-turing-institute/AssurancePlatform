import { expect, type Locator, type Page, test } from "@playwright/test";
import {
	activeDescription,
	cardOf,
	failWith500,
	INTEGRATIONS_URL,
	removeSeededData,
	type SeededIntegration,
	seedIntegration,
} from "./helpers/integration-fixtures";

// Where keyboard focus lands after each dialog on Settings, Integrations
// closes: by Escape, by Cancel, by confirming, and when the request fails.
// Focus is the browser's behaviour, so it is read from document.activeElement
// on a production build.

test.afterAll(removeSeededData);

const REGISTER = "Register integration";
const DONE = "Done — I have stored it";

function registerButton(page: Page): Locator {
	// Matched by CSS so the dialog's own submit button, and the page being
	// hidden from the accessibility tree while a dialog is open, cannot
	// change which element this is. The page's button comes first.
	return page.locator(`button:text-is("${REGISTER}")`).first();
}

async function expectFocusOn(page: Page, expected: string) {
	await expect
		.poll(() => activeDescription(page), { timeout: 5000 })
		.toBe(expected);
}

async function open(page: Page, integration: SeededIntegration) {
	await page.goto(INTEGRATIONS_URL);
	await expect(cardOf(page, integration)).toBeVisible();
	return cardOf(page, integration);
}

// The delete confirmation is an alert dialog; the others are plain dialogs.
function anyDialog(page: Page): Locator {
	return page.locator('[role="dialog"], [role="alertdialog"]');
}

function confirmation(page: Page) {
	return page.getByRole("dialog", { name: "Are you sure?" });
}

async function closeDialog(page: Page, how: "Cancel" | "Escape") {
	if (how === "Escape") {
		await page.keyboard.press("Escape");
	} else {
		await anyDialog(page)
			.getByRole("button", { name: "Cancel", exact: true })
			.click();
	}
	await expect(anyDialog(page)).toHaveCount(0);
}

test.describe("Register dialog", () => {
	for (const how of ["Escape", "Cancel"] as const) {
		test(`${how} leaves focus on Register integration`, async ({ page }) => {
			await page.goto(INTEGRATIONS_URL);
			await registerButton(page).focus();
			await page.keyboard.press("Enter");
			await expect(anyDialog(page)).toBeVisible();
			await closeDialog(page, how);
			await expect(registerButton(page)).toBeFocused();
		});
	}

	test("a refused submit keeps the dialog, and Escape then returns focus", async ({
		page,
	}) => {
		await page.route("**/api/integrations", (route) =>
			route.request().method() === "POST"
				? failWith500(route)
				: route.fallback()
		);
		await page.goto(INTEGRATIONS_URL);
		await registerButton(page).click();
		const dialog = anyDialog(page);
		await dialog.getByLabel("Name").fill(`e2e-kb-refused-${Date.now()}`);
		await dialog.locator('[id="integration-scope-case:read"]').click();
		await dialog.getByRole("button", { name: REGISTER, exact: true }).click();
		await expect(dialog).toBeVisible();
		await closeDialog(page, "Escape");
		await expect(registerButton(page)).toBeFocused();
	});

	test("a successful register leaves focus on Register integration", async ({
		page,
	}) => {
		await page.goto(INTEGRATIONS_URL);
		await registerButton(page).click();
		const dialog = anyDialog(page);
		await dialog.getByLabel("Name").fill(`e2e-kb-registered-${Date.now()}`);
		await dialog.locator('[id="integration-scope-case:read"]').click();
		await dialog.getByRole("button", { name: REGISTER, exact: true }).click();
		await expect(anyDialog(page)).toHaveCount(0);
		await expect(registerButton(page)).toBeFocused();
	});

	test("open and close five times, focus always comes back", async ({
		page,
	}) => {
		await page.goto(INTEGRATIONS_URL);
		for (let i = 0; i < 5; i++) {
			await registerButton(page).click();
			await expect(anyDialog(page)).toBeVisible();
			await closeDialog(page, i % 2 === 0 ? "Escape" : "Cancel");
			await expect(registerButton(page)).toBeFocused();
		}
	});
});

test.describe("Revoke integration", () => {
	for (const how of ["Escape", "Cancel"] as const) {
		test(`${how} leaves focus on Revoke`, async ({ page }) => {
			const integration = await seedIntegration(`revoke-${how}`);
			const card = await open(page, integration);
			const revoke = card.getByRole("button", {
				name: "Revoke this integration",
			});
			await revoke.focus();
			await page.keyboard.press("Enter");
			await expect(confirmation(page)).toBeVisible();
			await closeDialog(page, how);
			await expect(revoke).toBeFocused();
		});
	}

	test("confirming moves focus to the card's Delete button", async ({
		page,
	}) => {
		const integration = await seedIntegration("revoke-confirm");
		const card = await open(page, integration);
		await card.getByRole("button", { name: "Revoke this integration" }).click();
		await confirmation(page)
			.getByRole("button", { name: "Revoke integration", exact: true })
			.click();
		await expect(
			card.getByText("Revoked", { exact: true }).first()
		).toBeVisible();
		await expect(card.getByRole("button", { name: "Delete" })).toBeFocused();
	});

	test("a refused revoke leaves focus on the Revoke button, not the page body", async ({
		page,
	}) => {
		await page.route("**/api/integrations/*/revoke", failWith500);
		const integration = await seedIntegration("revoke-refused");
		const card = await open(page, integration);
		const revoke = card.getByRole("button", {
			name: "Revoke this integration",
		});
		await revoke.click();
		await confirmation(page)
			.getByRole("button", { name: "Revoke integration", exact: true })
			.click();
		await expect(anyDialog(page)).toHaveCount(0);
		await expect(revoke).toBeVisible();
		await expectFocusOn(page, "BUTTON:Revoke this integration");
	});
});

test.describe("Delete integration", () => {
	async function openDelete(page: Page, integration: SeededIntegration) {
		const card = await open(page, integration);
		const del = card.getByRole("button", { name: "Delete" });
		await del.focus();
		await page.keyboard.press("Enter");
		await expect(anyDialog(page)).toBeVisible();
		return { del };
	}

	for (const how of ["Escape", "Cancel"] as const) {
		test(`${how} leaves focus on Delete`, async ({ page }) => {
			const integration = await seedIntegration(`delete-${how}`, {
				status: "REVOKED",
			});
			const { del } = await openDelete(page, integration);
			await closeDialog(page, how);
			await expect(del).toBeFocused();
		});
	}

	test("confirming removes the card and leaves focus on Register integration", async ({
		page,
	}) => {
		const integration = await seedIntegration("delete-confirm", {
			status: "REVOKED",
		});
		await openDelete(page, integration);
		const dialog = anyDialog(page);
		await dialog.getByRole("textbox").fill(integration.name);
		await dialog
			.getByRole("button", { name: "Delete integration", exact: true })
			.click();
		await expect(cardOf(page, integration)).toHaveCount(0);
		await expect(registerButton(page)).toBeFocused();
	});

	test("a refused delete keeps the card and does not drop focus to the body", async ({
		page,
	}) => {
		await page.route("**/api/integrations/*", (route) =>
			route.request().method() === "DELETE"
				? failWith500(route)
				: route.fallback()
		);
		const integration = await seedIntegration("delete-refused", {
			status: "REVOKED",
		});
		const { del } = await openDelete(page, integration);
		const dialog = anyDialog(page);
		await dialog.getByRole("textbox").fill(integration.name);
		await dialog
			.getByRole("button", { name: "Delete integration", exact: true })
			.click();
		await expect(cardOf(page, integration)).toBeVisible();
		await expect.poll(() => activeDescription(page)).not.toBe("BODY");
		await expect(del).toBeVisible();
	});
});

test.describe("Tokens", () => {
	test("closing the secret dialog returns focus to Issue new token", async ({
		page,
	}) => {
		const integration = await seedIntegration("secret");
		const card = await open(page, integration);
		await card.getByRole("button", { name: "Issue new token" }).click();
		await page.getByLabel("End date (optional)").fill("2099-01-01");
		await page
			.getByRole("button", { name: "Issue token", exact: true })
			.click();
		const secret = page.getByRole("dialog", { name: "Token secret" });
		await expect(secret).toBeVisible();
		await secret.getByRole("button", { name: DONE }).click();
		await expect(anyDialog(page)).toHaveCount(0);
		await expect(
			card.getByRole("button", { name: "Issue new token" })
		).toBeFocused();
	});

	test("Escape on the secret dialog also returns focus to Issue new token", async ({
		page,
	}) => {
		const integration = await seedIntegration("secret-escape");
		const card = await open(page, integration);
		await card.getByRole("button", { name: "Issue new token" }).click();
		await page.getByLabel("End date (optional)").fill("2099-01-01");
		await page
			.getByRole("button", { name: "Issue token", exact: true })
			.click();
		await expect(
			page.getByRole("dialog", { name: "Token secret" })
		).toBeVisible();
		await page.keyboard.press("Escape");
		await expect(anyDialog(page)).toHaveCount(0);
		await expect(
			card.getByRole("button", { name: "Issue new token" })
		).toBeFocused();
	});

	test("the issue dialog closed while its request runs still ends on Issue new token after the secret is closed", async ({
		page,
	}) => {
		await page.route("**/api/integrations/*/tokens", async (route) => {
			if (route.request().method() === "POST") {
				await new Promise((resolve) => setTimeout(resolve, 1500));
			}
			await route.fallback();
		});
		const integration = await seedIntegration("issue-escape");
		const card = await open(page, integration);
		await card.getByRole("button", { name: "Issue new token" }).click();
		await page.getByLabel("End date (optional)").fill("2099-01-01");
		await page
			.getByRole("button", { name: "Issue token", exact: true })
			.click();
		await page.keyboard.press("Escape");
		const secret = page.getByRole("dialog", { name: "Token secret" });
		await expect(secret).toBeVisible({ timeout: 10_000 });
		await secret.getByRole("button", { name: DONE }).click();
		await expect(anyDialog(page)).toHaveCount(0);
		await expectFocusOn(page, "BUTTON:Issue new token");
	});

	test("confirming a token revoke leaves focus in the card, not on the body", async ({
		page,
	}) => {
		const integration = await seedIntegration("token-revoke", { tokens: 1 });
		const card = await open(page, integration);
		await card.getByRole("button", { name: "Revoke this token" }).click();
		await confirmation(page)
			.getByRole("button", { name: "Revoke token", exact: true })
			.click();
		await expect(anyDialog(page)).toHaveCount(0);
		await expect(
			card.getByRole("button", { name: "Revoke this token" })
		).toHaveCount(0);
		await expect(
			card.getByRole("button", { name: "Issue new token" })
		).toBeFocused();
	});

	test("Escape on the token revoke confirmation returns focus to that Revoke button", async ({
		page,
	}) => {
		const integration = await seedIntegration("token-escape", { tokens: 1 });
		const card = await open(page, integration);
		const revoke = card.getByRole("button", { name: "Revoke this token" });
		await revoke.focus();
		await page.keyboard.press("Enter");
		await expect(confirmation(page)).toBeVisible();
		await closeDialog(page, "Escape");
		await expect(revoke).toBeFocused();
	});

	test("a refused token revoke does not drop focus to the body", async ({
		page,
	}) => {
		await page.route("**/api/integrations/*/tokens/*", (route) =>
			route.request().method() === "DELETE"
				? failWith500(route)
				: route.fallback()
		);
		const integration = await seedIntegration("token-refused", { tokens: 1 });
		const card = await open(page, integration);
		await card.getByRole("button", { name: "Revoke this token" }).click();
		await confirmation(page)
			.getByRole("button", { name: "Revoke token", exact: true })
			.click();
		await expect(anyDialog(page)).toHaveCount(0);
		await expect(
			card.getByRole("button", { name: "Revoke this token" })
		).toBeVisible();
		await expect.poll(() => activeDescription(page)).not.toBe("BODY");
	});

	test("two token revokes in quick succession leave focus in the card", async ({
		page,
	}) => {
		await page.route("**/api/integrations/*/tokens/*", async (route) => {
			if (route.request().method() === "DELETE") {
				await new Promise((resolve) => setTimeout(resolve, 800));
			}
			await route.fallback();
		});
		const integration = await seedIntegration("token-two", { tokens: 2 });
		const card = await open(page, integration);
		for (let i = 0; i < 2; i++) {
			await card
				.getByRole("button", { name: "Revoke this token" })
				.first()
				.click();
			await confirmation(page)
				.getByRole("button", { name: "Revoke token", exact: true })
				.click();
		}
		await expect(
			card.getByRole("button", { name: "Revoke this token" })
		).toHaveCount(0, { timeout: 10_000 });
		await expect(anyDialog(page)).toHaveCount(0);
		await expectFocusOn(page, "BUTTON:Issue new token");
	});
});
