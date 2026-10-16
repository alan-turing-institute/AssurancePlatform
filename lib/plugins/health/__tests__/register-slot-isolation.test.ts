import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	casePanelSlot,
	elementAppearanceSlot,
	elementBadgeSlot,
	elementPanelSlot,
} from "@/lib/plugins/slots";
import { registerHealthPlugin } from "../register";

vi.mock("@/lib/logger", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/logger")>();
	return {
		...actual,
		logger: {
			...actual.logger,
			error: vi.fn(),
			child: () => ({ ...actual.logger, error: vi.fn() }),
		},
	};
});

const IDS = ["tea.health"];

function holders() {
	return {
		appearance: elementAppearanceSlot.list().map((entry) => entry.pluginId),
		badge: elementBadgeSlot.list().map((entry) => entry.pluginId),
		panel: elementPanelSlot.list().map((entry) => entry.pluginId),
		casePanel: casePanelSlot.list().map((entry) => entry.pluginId),
	};
}

beforeEach(() => {
	casePanelSlot.resetForTests();
	elementAppearanceSlot.resetForTests();
	elementBadgeSlot.resetForTests();
	elementPanelSlot.resetForTests();
});

describe("the health plugin's slot registration", () => {
	it("fills the appearance slot with the badge and the panels", () => {
		registerHealthPlugin();

		expect(holders()).toEqual({
			appearance: IDS,
			badge: IDS,
			panel: IDS,
			casePanel: IDS,
		});
	});

	it("is harmless to run twice", () => {
		registerHealthPlugin();
		registerHealthPlugin();

		expect(holders()).toEqual({
			appearance: IDS,
			badge: IDS,
			panel: IDS,
			casePanel: IDS,
		});
	});

	it("still registers the badge and the panels when the appearance slot refuses the plugin", () => {
		elementAppearanceSlot.register({
			pluginId: "tea.health",
			useAppearance: () => null,
		});

		expect(() => registerHealthPlugin()).not.toThrow();

		expect(holders()).toEqual({
			appearance: IDS,
			badge: IDS,
			panel: IDS,
			casePanel: IDS,
		});
	});

	it("still registers the appearance when the badge slot refuses the plugin", () => {
		elementBadgeSlot.register({
			pluginId: "tea.health",
			Component: () => null,
		});

		expect(() => registerHealthPlugin()).not.toThrow();

		const seen = holders();
		expect(seen.appearance).toEqual(IDS);
		expect(seen.badge).toEqual(IDS);
	});
});

describe("who may register into the appearance slot", () => {
	it("refuses a plugin whose manifest does not declare the surface", () => {
		expect(() =>
			elementAppearanceSlot.register({
				pluginId: "tea.assistant",
				useAppearance: () => null,
			})
		).toThrow("does not declare this surface");
	});

	it("refuses a plugin that is not in the manifest", () => {
		expect(() =>
			elementAppearanceSlot.register({
				pluginId: "not.a.plugin",
				useAppearance: () => null,
			})
		).toThrow("unknown plugin");
	});
});
