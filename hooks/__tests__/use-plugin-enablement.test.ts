import { renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { server } from "@/src/__tests__/mocks/server";
import { useEnabledPluginIds } from "../use-plugin-enablement";

afterEach(() => {
	vi.restoreAllMocks();
});

describe("useEnabledPluginIds", () => {
	it("starts loading, then resolves to only the enabled plugin ids", async () => {
		server.use(
			http.get("/api/user/plugins", () =>
				HttpResponse.json({
					plugins: [
						{ pluginId: "tea.health", enabled: true },
						{ pluginId: "tea.off", enabled: false },
					],
				})
			)
		);

		const { result } = renderHook(() => useEnabledPluginIds());

		expect(result.current.loading).toBe(true);

		await waitFor(() => expect(result.current.loading).toBe(false));

		expect(result.current.enabledPluginIds.has("tea.health")).toBe(true);
		expect(result.current.enabledPluginIds.has("tea.off")).toBe(false);
	});

	it("degrades to an empty set (never throws) when the fetch fails", async () => {
		server.use(
			http.get("/api/user/plugins", () =>
				HttpResponse.json({ error: "boom" }, { status: 500 })
			)
		);

		const { result } = renderHook(() => useEnabledPluginIds());

		await waitFor(() => expect(result.current.loading).toBe(false));

		expect(result.current.enabledPluginIds.size).toBe(0);
	});
});
