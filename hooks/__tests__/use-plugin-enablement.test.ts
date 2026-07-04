import { renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PluginSettingsListItem } from "@/lib/schemas/plugin";
import { server } from "@/src/__tests__/mocks/server";
import {
	resetPluginFetchDedupeForTests,
	useEnabledPluginIds,
} from "../use-plugin-enablement";

afterEach(() => {
	resetPluginFetchDedupeForTests();
	vi.restoreAllMocks();
});

describe("useEnabledPluginIds", () => {
	it("starts loading, then resolves to only the enabled plugin ids", async () => {
		server.use(
			http.get("/api/user/plugins", () =>
				HttpResponse.json({
					plugins: [
						{
							pluginId: "tea.health",
							name: "Claim/Evidence Health",
							version: "0.1.0",
							available: true,
							enabled: true,
							pinnedAt: null,
							settings: null,
						},
						{
							pluginId: "tea.off",
							name: "Off Plugin",
							version: "0.1.0",
							available: true,
							enabled: false,
							pinnedAt: "USER",
							settings: null,
						},
					] satisfies PluginSettingsListItem[],
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

	it("de-dupes concurrent mounts onto a single in-flight network request", async () => {
		let hitCount = 0;
		server.use(
			http.get("/api/user/plugins", () => {
				hitCount += 1;
				return HttpResponse.json({
					plugins: [
						{
							pluginId: "tea.health",
							name: "Claim/Evidence Health",
							version: "0.1.0",
							available: true,
							enabled: true,
							pinnedAt: null,
							settings: null,
						},
					] satisfies PluginSettingsListItem[],
				});
			})
		);

		// Mount N hook instances back-to-back with no `await` between them —
		// this is the canvas's shape (N node components, each pulling
		// enablement through this hook) rather than a single caller. Every
		// instance's mount-time effect fires in this same synchronous stretch,
		// before the mocked fetch above has had a chance to settle, so they
		// must all observe (and share) the same in-flight promise if the
		// dedupe is doing its job.
		const instances = Array.from({ length: 5 }, () =>
			renderHook(() => useEnabledPluginIds())
		);

		await waitFor(() => {
			for (const { result } of instances) {
				expect(result.current.loading).toBe(false);
			}
		});

		for (const { result } of instances) {
			expect(result.current.enabledPluginIds.has("tea.health")).toBe(true);
		}
		expect(hitCount).toBe(1);
	});
});
