import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// The settings landing page is an async server component that fetches the
// current user + connected accounts and composes six settings sections.
// Those sections have their own dedicated tests (and their own data
// dependencies — session, plugin API, etc.) so they're stubbed here: this
// suite exists only to pin the page's *wiring*, which is exactly what
// regressed in the source issue (the Integrations page existed and worked,
// but nothing on this page linked to it).
vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue({
		userId: "1",
		username: "chris",
		email: "chris@example.com",
	}),
}));
vi.mock("@/actions/users", () => ({
	fetchCurrentUser: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/actions/connected-accounts", () => ({
	fetchConnectedAccounts: vi.fn().mockResolvedValue(null),
}));
vi.mock("../_components/appearance-form", () => ({
	AppearanceForm: () => <div data-testid="appearance-form" />,
}));
vi.mock("../_components/personal-info-form", () => ({
	PersonalInfoForm: () => <div data-testid="personal-info-form" />,
}));
vi.mock("../_components/connected-accounts-form", () => ({
	ConnectedAccountsForm: () => <div data-testid="connected-accounts-form" />,
}));
vi.mock("../_components/plugins-section", () => ({
	PluginsSection: () => <div data-testid="plugins-section" />,
}));
vi.mock("../_components/password-form", () => ({
	PasswordForm: () => <div data-testid="password-form" />,
}));
vi.mock("../_components/delete-form", () => ({
	DeleteForm: () => <div data-testid="delete-form" />,
}));

import SettingsPage from "../page";

const INTEGRATIONS_LINK_NAME_REGEX = /integrations/i;

describe("SettingsPage", () => {
	it("renders a link to the Integrations settings page (regression: page existed but was unreachable)", async () => {
		render(await SettingsPage());

		const link = screen.getByRole("link", {
			name: INTEGRATIONS_LINK_NAME_REGEX,
		});
		expect(link).toHaveAttribute("href", "/dashboard/settings/integrations");
	});

	it("places the Integrations link section after Plugins and before the password form", async () => {
		const { container } = render(await SettingsPage());

		const testIds = Array.from(container.querySelectorAll("[data-testid]")).map(
			(el) => el.getAttribute("data-testid")
		);

		const pluginsIndex = testIds.indexOf("plugins-section");
		const integrationsIndex = testIds.indexOf("integrations-link-section");
		const passwordIndex = testIds.indexOf("password-form");

		expect(pluginsIndex).toBeGreaterThanOrEqual(0);
		expect(integrationsIndex).toBeGreaterThan(pluginsIndex);
		expect(passwordIndex).toBeGreaterThan(integrationsIndex);
	});
});
