import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PluginSettingsListItem } from "@/hooks/use-plugin-settings";
import { PluginCard } from "../plugin-card";

function plugin(
	overrides: Partial<PluginSettingsListItem> = {}
): PluginSettingsListItem {
	return {
		pluginId: "tea.example",
		name: "Example",
		version: "1.0.0",
		description: "An example plugin.",
		docsPath: null,
		surfaces: [],
		available: true,
		enabled: true,
		pinnedAt: null,
		settings: null,
		...overrides,
	} as PluginSettingsListItem;
}

describe("plugin card status region", () => {
	it("is a single status region that says Saving while pending", () => {
		render(<PluginCard onToggle={vi.fn()} pending plugin={plugin()} />);
		const regions = screen.getAllByRole("status");
		expect(regions).toHaveLength(1);
		expect(regions[0]).toHaveTextContent("Saving…");
	});

	it("keeps the same region and shows the state once saving ends", () => {
		const { rerender } = render(
			<PluginCard onToggle={vi.fn()} pending plugin={plugin()} />
		);
		const before = screen.getByRole("status");
		rerender(<PluginCard onToggle={vi.fn()} plugin={plugin()} />);
		expect(screen.getByRole("status")).toBe(before);
		expect(before).toHaveTextContent("On");
	});

	it("announces an organisation block through the region", () => {
		render(
			<PluginCard
				onToggle={vi.fn()}
				plugin={plugin({ enabled: false, pinnedAt: "ORGANISATION" })}
			/>
		);
		expect(screen.getByRole("status")).toHaveTextContent(
			"Turned off by your organisation"
		);
	});
});
