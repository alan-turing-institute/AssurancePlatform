import { afterEach, describe, expect, it } from "vitest";
import { settingsSectionSlot } from "@/lib/plugins/slots";
import {
	renderWithoutProviders,
	screen,
} from "@/src/__tests__/utils/test-utils";
import { PluginSettingsSlot } from "../plugin-settings-slot";

function FakeSettings({ pluginId }: { pluginId: string }) {
	return <div data-testid="fake-settings">{`settings for ${pluginId}`}</div>;
}

afterEach(() => {
	settingsSectionSlot.resetForTests();
});

describe("PluginSettingsSlot — registry wiring ([[TEA — UI extension slots]])", () => {
	it("still renders nothing for a pluginId with no registration (registry empty by default in 1.0)", () => {
		const { container } = renderWithoutProviders(
			<PluginSettingsSlot pluginId="tea.health" />
		);

		expect(container).toBeEmptyDOMElement();
	});

	it("renders a registered plugin's own settings component", () => {
		settingsSectionSlot.register({
			pluginId: "tea.health",
			Component: FakeSettings,
		});

		renderWithoutProviders(<PluginSettingsSlot pluginId="tea.health" />);

		expect(screen.getByTestId("fake-settings")).toHaveTextContent(
			"settings for tea.health"
		);
	});

	it("does not render another plugin's registration", () => {
		settingsSectionSlot.register({
			pluginId: "tea.health",
			Component: FakeSettings,
		});

		const { container } = renderWithoutProviders(
			<PluginSettingsSlot pluginId="tea.other" />
		);

		expect(container).toBeEmptyDOMElement();
	});
});
