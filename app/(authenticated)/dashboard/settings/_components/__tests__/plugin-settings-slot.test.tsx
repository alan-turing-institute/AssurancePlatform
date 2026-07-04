import { describe, expect, it } from "vitest";
import { renderWithoutProviders } from "@/src/__tests__/utils/test-utils";
import { PluginSettingsSlot } from "../plugin-settings-slot";

describe("PluginSettingsSlot", () => {
	it("renders nothing when no plugin has registered into the slot (1.0 has no consumers yet)", () => {
		const { container } = renderWithoutProviders(
			<PluginSettingsSlot pluginId="tea.health" />
		);

		expect(container).toBeEmptyDOMElement();
	});

	it("renders nothing regardless of which pluginId is passed", () => {
		const { container } = renderWithoutProviders(
			<PluginSettingsSlot pluginId="tea.does-not-exist" />
		);

		expect(container).toBeEmptyDOMElement();
	});
});
