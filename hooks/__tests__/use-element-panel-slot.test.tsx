import { renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ElementSlotContext } from "@/lib/plugins/slots";
import { elementPanelSlot } from "@/lib/plugins/slots";
import type { PluginSettingsListItem } from "@/lib/schemas/plugin";
import { server } from "@/src/__tests__/mocks/server";
import { useElementPanelSlot } from "../use-element-panel-slot";

function FakePanel(_props: ElementSlotContext) {
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

afterEach(() => {
	elementPanelSlot.resetForTests();
	vi.restoreAllMocks();
});

describe("useElementPanelSlot", () => {
	it("returns no registrations when the registry is empty", async () => {
		mockPluginsResponse(true);

		const { result } = renderHook(() => useElementPanelSlot());

		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(result.current.registrations).toEqual([]);
	});

	it("returns the registration when its plugin is enabled", async () => {
		elementPanelSlot.register({
			pluginId: "tea.health",
			tabId: "tea.health",
			label: "Evidence",
			Component: FakePanel,
		});
		mockPluginsResponse(true);

		const { result } = renderHook(() => useElementPanelSlot());

		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(result.current.registrations).toHaveLength(1);
		expect(result.current.registrations[0]?.tabId).toBe("tea.health");
	});

	it("omits the registration when its plugin is disabled — off as if never registered", async () => {
		elementPanelSlot.register({
			pluginId: "tea.health",
			tabId: "tea.health",
			label: "Evidence",
			Component: FakePanel,
		});
		mockPluginsResponse(false);

		const { result } = renderHook(() => useElementPanelSlot());

		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(result.current.registrations).toEqual([]);
	});
});
