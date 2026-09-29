import { waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { server } from "@/src/__tests__/mocks/server";
import {
	renderWithoutProviders,
	screen,
} from "@/src/__tests__/utils/test-utils";
import { PluginsLinkSection } from "../plugins-link-section";

const HEALTH_PLUGIN = {
	pluginId: "tea.health",
	name: "Claim/Evidence Health",
	version: "0.1.0",
	description: "Test plugin description.",
	docsPath: "/docs/technical-guide/architecture/plugin-ecosystem",
	surfaces: [],
	available: true,
	enabled: true,
	pinnedAt: null,
	settings: null,
};

afterEach(() => {
	vi.restoreAllMocks();
});

describe("PluginsLinkSection", () => {
	it("counts only plugins that are both available and enabled", async () => {
		server.use(
			http.get("/api/user/plugins", () =>
				HttpResponse.json({
					plugins: [
						HEALTH_PLUGIN,
						{ ...HEALTH_PLUGIN, pluginId: "tea.off", enabled: false },
						{
							...HEALTH_PLUGIN,
							pluginId: "tea.unavailable",
							available: false,
							enabled: true,
						},
					],
				})
			)
		);

		renderWithoutProviders(<PluginsLinkSection />);

		await waitFor(() =>
			expect(screen.getByText("1 plugin on")).toBeInTheDocument()
		);
	});

	it("pluralises the count for more than one plugin on", async () => {
		server.use(
			http.get("/api/user/plugins", () =>
				HttpResponse.json({
					plugins: [HEALTH_PLUGIN, { ...HEALTH_PLUGIN, pluginId: "tea.other" }],
				})
			)
		);

		renderWithoutProviders(<PluginsLinkSection />);

		await waitFor(() =>
			expect(screen.getByText("2 plugins on")).toBeInTheDocument()
		);
	});

	it("links to the Plugins settings page", () => {
		server.use(
			http.get("/api/user/plugins", () =>
				HttpResponse.json({ plugins: [HEALTH_PLUGIN] })
			)
		);

		renderWithoutProviders(<PluginsLinkSection />);

		const link = screen.getByRole("link", { name: "Manage plugins →" });
		expect(link).toHaveAttribute("href", "/dashboard/settings/plugins");
	});
});
