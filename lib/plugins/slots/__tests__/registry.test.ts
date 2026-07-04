import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PluginManifestEntry } from "@/lib/plugins/manifest";

const UNKNOWN_PLUGIN_MESSAGE = /unknown plugin/i;
const UNDECLARED_SURFACE_MESSAGE = /does not declare this surface/i;

const mockGetManifestEntry =
	vi.fn<(pluginId: string) => PluginManifestEntry | undefined>();

vi.mock("@/lib/plugins/manifest", () => ({
	getManifestEntry: (pluginId: string) => mockGetManifestEntry(pluginId),
}));

// Imported after the mock so the registry module picks up the mocked manifest.
const { SlotRegistry } = await import("../registry");

const FAKE_PLUGIN: PluginManifestEntry = {
	id: "tea.fake",
	name: "Fake Plugin",
	version: "0.0.1",
	surfaces: ["element-badge"],
};

describe("SlotRegistry", () => {
	beforeEach(() => {
		mockGetManifestEntry.mockReset();
	});

	it("registers a plugin whose manifest entry declares this slot's surface", () => {
		mockGetManifestEntry.mockReturnValue(FAKE_PLUGIN);
		const registry = new SlotRegistry<{ pluginId: string }>("element-badge");

		registry.register({ pluginId: "tea.fake" });

		expect(registry.list()).toEqual([{ pluginId: "tea.fake" }]);
	});

	it("rejects a pluginId absent from the manifest", () => {
		mockGetManifestEntry.mockReturnValue(undefined);
		const registry = new SlotRegistry<{ pluginId: string }>("element-badge");

		expect(() => registry.register({ pluginId: "tea.does-not-exist" })).toThrow(
			UNKNOWN_PLUGIN_MESSAGE
		);
		expect(registry.list()).toEqual([]);
	});

	it("rejects a registration into a slot the plugin's manifest entry does not declare", () => {
		mockGetManifestEntry.mockReturnValue({
			...FAKE_PLUGIN,
			surfaces: ["machine-endpoints"], // does not include "element-panel"
		});
		const registry = new SlotRegistry<{ pluginId: string }>("element-panel");

		expect(() => registry.register({ pluginId: "tea.fake" })).toThrow(
			UNDECLARED_SURFACE_MESSAGE
		);
		expect(registry.list()).toEqual([]);
	});

	it("keeps registrations in registration order", () => {
		mockGetManifestEntry.mockReturnValue(FAKE_PLUGIN);
		const registry = new SlotRegistry<{ pluginId: string }>("element-badge");

		registry.register({ pluginId: "tea.fake" });
		registry.register({ pluginId: "tea.fake" });

		expect(registry.list()).toHaveLength(2);
	});

	it("resetForTests clears every registration", () => {
		mockGetManifestEntry.mockReturnValue(FAKE_PLUGIN);
		const registry = new SlotRegistry<{ pluginId: string }>("element-badge");
		registry.register({ pluginId: "tea.fake" });

		registry.resetForTests();

		expect(registry.list()).toEqual([]);
	});

	it("keeps distinct slot instances independent of one another", async () => {
		mockGetManifestEntry.mockReturnValue({
			...FAKE_PLUGIN,
			surfaces: ["element-badge", "element-panel"],
		});
		const { elementBadgeSlot, elementPanelSlot } = await import("../registry");
		elementBadgeSlot.resetForTests();
		elementPanelSlot.resetForTests();

		elementBadgeSlot.register({
			pluginId: "tea.fake",
			Component: () => null,
		});

		expect(elementBadgeSlot.list()).toHaveLength(1);
		expect(elementPanelSlot.list()).toHaveLength(0);

		elementBadgeSlot.resetForTests();
	});
});
