import { describe, expect, it } from "vitest";
import { settingsNavigation } from "@/config";

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
});
