import { renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CaseSlotContext } from "@/lib/plugins/slots";
import { casePanelSlot } from "@/lib/plugins/slots";
import type { PluginSettingsListItem } from "@/lib/schemas/plugin";
import { server } from "@/src/__tests__/mocks/server";
import { useCasePanelSlot } from "../use-case-panel-slot";

function FakePanel(_props: CaseSlotContext) {
	return null;
}

function mockPluginsResponse(enabled: boolean) {
	server.use(
		http.get("/api/user/plugins", () =>
			HttpResponse.json({
				plugins: [
					{
						pluginId: "tea.health",
						name: "Claim/Evidence Health",
						version: "0.1.0",
						description: "Test plugin description.",
						docsPath: "/docs/technical-guide/architecture/plugin-ecosystem",
						surfaces: [],
						available: true,
						enabled,
						pinnedAt: enabled ? null : "USER",
						settings: null,
					},
				] satisfies PluginSettingsListItem[],
			})
		)
	);
}

function register() {
	casePanelSlot.register({
		pluginId: "tea.health",
		panelId: "tea.health",
		label: "Evidence health",
		Component: FakePanel,
	});
}

afterEach(() => {
	casePanelSlot.resetForTests();
	vi.restoreAllMocks();
});

describe("useCasePanelSlot", () => {
	it("returns no registrations when the registry is empty", async () => {
		mockPluginsResponse(true);

		const { result } = renderHook(() => useCasePanelSlot());

		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(result.current.registrations).toEqual([]);
	});

	it("returns the registration when its plugin is enabled", async () => {
		register();
		mockPluginsResponse(true);

		const { result } = renderHook(() => useCasePanelSlot());

		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(result.current.registrations).toHaveLength(1);
		expect(result.current.registrations[0]?.panelId).toBe("tea.health");
	});

	it("omits the registration when its plugin is disabled", async () => {
		register();
		mockPluginsResponse(false);

		const { result } = renderHook(() => useCasePanelSlot());

		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(result.current.registrations).toEqual([]);
	});
});
