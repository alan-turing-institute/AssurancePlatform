import { expect, test } from "@playwright/test";

// Regression test for issue "TEA — Settings tabs must resolve to real pages
// (guard against dead navigation links)": the settings tab strip shipped for
// months with two placeholder tabs (Notifications, Billing) that had no page
// behind them, and three links pointed at `/settings/*` instead of the real
// `/dashboard/settings/*` routes — every tab except the one you landed on
// 404'd. PR #974 fixed the list; this spec walks every tab in the live strip
// and proves each one actually resolves, rather than pinning the list alone.
// Expected h1 per tab, read from each page.tsx: Account's sr-only heading is
// "Account Settings"; the rest just use the tab name.
const tabs = [
	{ name: "Account", href: "/dashboard/settings", h1: "Account Settings" },
	{ name: "Teams", href: "/dashboard/settings/teams", h1: "Teams" },
	{
		name: "Integrations",
		href: "/dashboard/settings/integrations",
		h1: "Integrations",
	},
	{ name: "Plugins", href: "/dashboard/settings/plugins", h1: "Plugins" },
];

test.describe("settings tab strip resolves to real pages", () => {
	test("every tab navigates to a working page with no 404 and the right heading", async ({
		page,
	}) => {
		const pageErrors: string[] = [];
		page.on("pageerror", (err) => pageErrors.push(err.message));

		await page.goto("/dashboard/settings");
		// The dashboard sidebar also has a "Teams" link, so scope to the
		// settings tab strip's own <nav> rather than the whole page.
		const settingsNav = page.locator("nav").filter({ hasText: "Account" });

		for (const tab of tabs) {
			// Tabs in settings-nav.tsx are plain <a href> (full navigations),
			// so a click always fires a document response we can wait for and
			// check for a 404. If that component ever moves to next/link
			// (soft navigation, no document response), this wait will hang to
			// the test timeout and this spec must change with it.
			const response = await Promise.all([
				page.waitForResponse(
					(res) =>
						res.request().resourceType() === "document" &&
						new URL(res.url()).pathname === tab.href
				),
				settingsNav.getByRole("link", { name: tab.name, exact: true }).click(),
			]).then(([res]) => res);

			await expect(page).toHaveURL(new RegExp(`${tab.href}$`));
			expect(
				response.status(),
				`${tab.name} (${tab.href}) responded ${response.status()}`
			).not.toBe(404);
			await expect(page.getByText("This page could not be found")).toHaveCount(
				0
			);
			await expect(page.locator("h1")).toHaveText(tab.h1);
		}

		expect(pageErrors, "page errors while walking the settings tabs").toEqual(
			[]
		);
	});
});
