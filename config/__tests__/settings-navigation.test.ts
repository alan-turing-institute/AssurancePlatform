import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { settingsNavigation } from "@/config";

// Repo root: this file lives at <root>/config/__tests__/, so climb two levels.
const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");

describe("settingsNavigation", () => {
	it("lists exactly Account, Teams, Integrations, Plugins under /dashboard/settings", () => {
		expect(settingsNavigation).toEqual([
			{ name: "Account", href: "/dashboard/settings" },
			{ name: "Teams", href: "/dashboard/settings/teams" },
			{ name: "Integrations", href: "/dashboard/settings/integrations" },
			{ name: "Plugins", href: "/dashboard/settings/plugins" },
		]);
	});

	it("has no Notifications or Billing entry (no page exists for either)", () => {
		const names = settingsNavigation.map((item) => item.name);
		expect(names).not.toContain("Notifications");
		expect(names).not.toContain("Billing");
	});

	it("every entry's href is absolute and under /dashboard/settings", () => {
		for (const item of settingsNavigation) {
			expect(item.href.startsWith("/dashboard/settings")).toBe(true);
		}
	});

	it("every entry's href resolves to a real page.tsx on disk", () => {
		for (const item of settingsNavigation) {
			const pagePath = path.join(
				REPO_ROOT,
				"app",
				"(authenticated)",
				...item.href.split("/").filter(Boolean),
				"page.tsx"
			);
			expect(
				existsSync(pagePath),
				`${item.name} (${item.href}) has no page.tsx at ${pagePath}`
			).toBe(true);
		}
	});
});
