import { waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { server } from "@/src/__tests__/mocks/server";
import {
	renderWithoutProviders,
	screen,
} from "@/src/__tests__/utils/test-utils";
import { PluginsSection } from "../plugins-section";

const HEALTH_PLUGIN = {
	pluginId: "tea.health",
	name: "Claim/Evidence Health",
	version: "0.1.0",
	available: true,
	enabled: true,
	pinnedAt: null,
	settings: null,
};

afterEach(() => {
	vi.restoreAllMocks();
});

describe("PluginsSection", () => {
	it("shows a loading state before the list resolves, then renders the plugin", async () => {
		server.use(
			http.get("/api/user/plugins", () =>
				HttpResponse.json({ plugins: [HEALTH_PLUGIN] })
			)
		);

		renderWithoutProviders(<PluginsSection />);

		expect(screen.getByTestId("plugins-section-loading")).toBeInTheDocument();

		await waitFor(() =>
			expect(screen.getByText("Claim/Evidence Health")).toBeInTheDocument()
		);
		expect(
			screen.queryByTestId("plugins-section-loading")
		).not.toBeInTheDocument();
	});

	it("shows an error message when the GET route fails", async () => {
		server.use(
			http.get("/api/user/plugins", () =>
				HttpResponse.json(
					{ error: "Failed to resolve plugin state" },
					{
						status: 500,
					}
				)
			)
		);

		renderWithoutProviders(<PluginsSection />);

		await waitFor(() =>
			expect(
				screen.getByText("Failed to resolve plugin state")
			).toBeInTheDocument()
		);
	});

	it("shows an empty-deployment message when the manifest has no plugins", async () => {
		server.use(
			http.get("/api/user/plugins", () => HttpResponse.json({ plugins: [] }))
		);

		renderWithoutProviders(<PluginsSection />);

		await waitFor(() =>
			expect(
				screen.getByText("No plugins are registered for this deployment.")
			).toBeInTheDocument()
		);
	});

	it("toggles a plugin through PATCH and reflects the refetched state", async () => {
		const user = userEvent.setup();
		let currentlyEnabled = true;

		server.use(
			http.get("/api/user/plugins", () =>
				HttpResponse.json({
					plugins: [{ ...HEALTH_PLUGIN, enabled: currentlyEnabled }],
				})
			),
			http.patch("/api/user/plugins", async ({ request }) => {
				const body = (await request.json()) as {
					enabled: boolean;
					pluginId: string;
				};
				currentlyEnabled = body.enabled;
				return HttpResponse.json({
					pluginId: body.pluginId,
					enabled: currentlyEnabled,
					settings: null,
				});
			})
		);

		renderWithoutProviders(<PluginsSection />);

		await waitFor(() =>
			expect(screen.getByText("Claim/Evidence Health")).toBeInTheDocument()
		);

		const toggle = screen.getByRole("switch");
		expect(toggle).toBeChecked();

		await user.click(toggle);

		await waitFor(() => expect(screen.getByRole("switch")).not.toBeChecked());
		expect(currentlyEnabled).toBe(false);
	});
});
