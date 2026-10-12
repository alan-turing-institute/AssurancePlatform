import { waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { server } from "@/src/__tests__/mocks/server";
import {
	renderWithoutProviders,
	screen,
} from "@/src/__tests__/utils/test-utils";
import { installModelRoutes } from "../ai-models/__tests__/model-routes-fake";
import { PluginsSection } from "../plugins-section";

const ASSISTANT_PLUGIN = {
	pluginId: "tea.assistant",
	name: "Case Assistant",
	version: "0.1.0",
	description: "A chat panel beside the case canvas.",
	surfaces: ["case-panel", "settings-section"],
	available: true,
	enabled: true,
	pinnedAt: null,
	settings: null,
};

const HEALTH_PLUGIN = {
	pluginId: "tea.health",
	name: "Claim/Evidence Health",
	version: "0.1.0",
	description:
		"Shows whether the evidence behind each property claim is still holding.",
	docsPath: "/docs/technical-guide/architecture/plugin-ecosystem",
	surfaces: ["element-badge", "element-panel", "settings-section"],
	available: true,
	enabled: true,
	pinnedAt: null,
	settings: null,
};

const CONSEQUENCES_URL = "/api/user/plugins/tea.health/consequences";
const EMPTY_CONSEQUENCES = {
	evidenceRecordCount: 0,
	caseCount: 0,
	activeIntegrations: [],
};

afterEach(() => {
	vi.restoreAllMocks();
});

describe("PluginsSection", () => {
	it("shows a loading state before the list resolves, then renders the plugin's card", async () => {
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
		expect(screen.getByText(HEALTH_PLUGIN.description)).toBeInTheDocument();
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

	it("shows the AI models block after the cards when a plugin that uses models is on", async () => {
		installModelRoutes();
		server.use(
			http.get("/api/user/plugins", () =>
				HttpResponse.json({ plugins: [HEALTH_PLUGIN, ASSISTANT_PLUGIN] })
			)
		);

		renderWithoutProviders(<PluginsSection />);

		const heading = await screen.findByRole("heading", { name: "AI models" });
		const section = heading.closest("section");
		expect(section).toHaveAttribute("id", "ai-models");
		// The block follows the column that holds the plugin cards.
		expect(section?.previousElementSibling).toContainElement(
			screen.getByText("Case Assistant")
		);
	});

	it("shows no AI models block, and asks for no models, when no plugin that uses models is on", async () => {
		const modelRoutes = installModelRoutes();
		server.use(
			http.get("/api/user/plugins", () =>
				HttpResponse.json({
					plugins: [HEALTH_PLUGIN, { ...ASSISTANT_PLUGIN, enabled: false }],
				})
			)
		);

		renderWithoutProviders(<PluginsSection />);

		await waitFor(() =>
			expect(screen.getByText("Claim/Evidence Health")).toBeInTheDocument()
		);
		expect(
			screen.queryByRole("heading", { name: "AI models" })
		).not.toBeInTheDocument();
		expect(modelRoutes.requests).toEqual([]);
	});

	it("leaves the Claim/Evidence Health card as it was, with no AI models block, when it is the only plugin", async () => {
		server.use(
			http.get("/api/user/plugins", () =>
				HttpResponse.json({ plugins: [HEALTH_PLUGIN] })
			)
		);

		renderWithoutProviders(<PluginsSection />);

		await waitFor(() =>
			expect(screen.getByText(HEALTH_PLUGIN.description)).toBeInTheDocument()
		);
		expect(screen.getAllByRole("switch")).toHaveLength(1);
		expect(
			screen.queryByRole("heading", { name: "AI models" })
		).not.toBeInTheDocument();
		expect(
			screen.getByText("This plugin has no settings.")
		).toBeInTheDocument();
	});

	it("turns a plugin off through the confirmation dialog, sends the PATCH, and reflects the refetched state", async () => {
		const user = userEvent.setup();
		let currentlyEnabled = true;

		server.use(
			http.get("/api/user/plugins", () =>
				HttpResponse.json({
					plugins: [{ ...HEALTH_PLUGIN, enabled: currentlyEnabled }],
				})
			),
			http.get(CONSEQUENCES_URL, () => HttpResponse.json(EMPTY_CONSEQUENCES)),
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

		const dialog = await screen.findByRole("alertdialog");
		expect(dialog).toHaveTextContent(
			"Turn off Claim/Evidence Health for your account?"
		);
		// Turning off must not have gone through yet — only confirming does.
		expect(currentlyEnabled).toBe(true);

		await user.click(screen.getByRole("button", { name: "Turn off" }));

		await waitFor(() => expect(screen.getByRole("switch")).not.toBeChecked());
		expect(currentlyEnabled).toBe(false);
	});
});

describe("PluginsSection: opening at the AI models anchor", () => {
	const withAssistant = (enabled: () => boolean) =>
		server.use(
			http.get("/api/user/plugins", () =>
				HttpResponse.json({
					plugins: [{ ...ASSISTANT_PLUGIN, enabled: enabled() }],
				})
			)
		);

	afterEach(() => {
		window.location.hash = "";
	});

	it("scrolls to the block once it shows when the page was opened at #ai-models", async () => {
		const scroll = vi.spyOn(Element.prototype, "scrollIntoView");
		scroll.mockClear();
		window.location.hash = "#ai-models";
		installModelRoutes();
		withAssistant(() => true);

		renderWithoutProviders(<PluginsSection />);
		await screen.findByRole("heading", { name: "AI models" });

		await waitFor(() => expect(scroll).toHaveBeenCalledTimes(1));
		expect(scroll.mock.contexts[0]).toHaveAttribute("id", "ai-models");
	});

	it("does not scroll without the anchor", async () => {
		const scroll = vi.spyOn(Element.prototype, "scrollIntoView");
		scroll.mockClear();
		window.location.hash = "";
		installModelRoutes();
		withAssistant(() => true);

		renderWithoutProviders(<PluginsSection />);
		await screen.findByRole("heading", { name: "AI models" });

		expect(scroll).not.toHaveBeenCalled();
	});

	it("does not scroll again when the block comes back after the plugin is turned off and on", async () => {
		const user = userEvent.setup();
		const scroll = vi.spyOn(Element.prototype, "scrollIntoView");
		scroll.mockClear();
		window.location.hash = "#ai-models";
		installModelRoutes();
		let enabled = true;
		withAssistant(() => enabled);
		server.use(
			http.get("/api/user/plugins/tea.assistant/consequences", () =>
				HttpResponse.json(EMPTY_CONSEQUENCES)
			),
			http.patch("/api/user/plugins", async ({ request }) => {
				const body = (await request.json()) as { enabled: boolean };
				enabled = body.enabled;
				return HttpResponse.json({
					pluginId: "tea.assistant",
					enabled,
					settings: null,
				});
			})
		);

		renderWithoutProviders(<PluginsSection />);
		await screen.findByRole("heading", { name: "AI models" });
		await waitFor(() => expect(scroll).toHaveBeenCalledTimes(1));

		await user.click(screen.getByRole("switch"));
		await user.click(await screen.findByRole("button", { name: "Turn off" }));
		await waitFor(() =>
			expect(
				screen.queryByRole("heading", { name: "AI models" })
			).not.toBeInTheDocument()
		);
		await user.click(screen.getByRole("switch"));
		await screen.findByRole("heading", { name: "AI models" });

		expect(scroll).toHaveBeenCalledTimes(1);
	});
});
