import { describe, expect, it, vi } from "vitest";
import type { PluginSettingsListItem } from "@/hooks/use-plugin-settings";
import {
	renderWithoutProviders,
	screen,
} from "@/src/__tests__/utils/test-utils";
import { PluginCard } from "../plugin-card";

const PLUGIN: PluginSettingsListItem = {
	pluginId: "tea.health",
	name: "Claim/Evidence Health",
	version: "0.1.0",
	description: "Shows whether the evidence behind each claim still holds.",
	surfaces: ["element-badge"],
	available: true,
	enabled: true,
	pinnedAt: null,
	settings: null,
};

describe("PluginCard switch while saving", () => {
	it("shows a not-allowed cursor while aria-disabled, without dimming the switch", () => {
		renderWithoutProviders(
			<PluginCard onToggle={vi.fn()} pending plugin={PLUGIN} />
		);

		const toggle = screen.getByRole("switch", {
			name: "Turn Claim/Evidence Health off",
		});

		expect(toggle).toHaveAttribute("aria-disabled", "true");
		expect(toggle).toHaveClass("aria-disabled:cursor-not-allowed");
		expect(toggle).not.toHaveClass("aria-disabled:opacity-50");
	});
});
