import { afterEach, describe, expect, it, vi } from "vitest";
import { elementBadgeSlot, elementPanelSlot } from "@/lib/plugins/slots";
import { HealthBadge } from "../health-badge";
import { HealthPanel } from "../health-panel";
import { registerHealthPlugin } from "../register";

const PLUGIN_ID = "tea.health";

afterEach(() => {
	elementBadgeSlot.resetForTests();
	elementPanelSlot.resetForTests();
	vi.restoreAllMocks();
});

describe("registerHealthPlugin — wiring", () => {
	it("registers HealthBadge into elementBadgeSlot", () => {
		elementBadgeSlot.resetForTests();
		elementPanelSlot.resetForTests();

		registerHealthPlugin();

		const registrations = elementBadgeSlot.list();
		expect(registrations).toHaveLength(1);
		expect(registrations[0]).toEqual({
			pluginId: PLUGIN_ID,
			Component: HealthBadge,
		});
	});

	it("registers HealthPanel into elementPanelSlot as the 'Evidence' tab", () => {
		elementBadgeSlot.resetForTests();
		elementPanelSlot.resetForTests();

		registerHealthPlugin();

		const registrations = elementPanelSlot.list();
		expect(registrations).toHaveLength(1);
		expect(registrations[0]).toEqual({
			pluginId: PLUGIN_ID,
			tabId: PLUGIN_ID,
			label: "Evidence",
			Component: HealthPanel,
		});
	});
});

describe("registerHealthPlugin — bootstrap safety (review forward-note v4)", () => {
	it("catches a throwing registration instead of propagating — degrades to unregistered", () => {
		elementBadgeSlot.resetForTests();
		elementPanelSlot.resetForTests();
		const consoleErrorSpy = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		vi.spyOn(elementBadgeSlot, "register").mockImplementation(() => {
			throw new Error("simulated registration failure");
		});

		expect(() => registerHealthPlugin()).not.toThrow();

		expect(consoleErrorSpy).toHaveBeenCalledWith(
			expect.stringContaining("[tea.health]"),
			expect.any(Error)
		);
		// The badge registration threw before it could be recorded, and the
		// panel registration never ran (the try/catch wraps both calls) —
		// both slots end up exactly as unregistered as a disabled plugin.
		expect(elementBadgeSlot.list()).toEqual([]);
		expect(elementPanelSlot.list()).toEqual([]);
	});
});
