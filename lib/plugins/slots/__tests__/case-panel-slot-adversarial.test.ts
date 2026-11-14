import { afterEach, describe, expect, it, vi } from "vitest";
import { casePanelSlot } from "../registry";
import type { CasePanelRegistration } from "../types";

vi.mock("@/lib/plugins/manifest", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@/lib/plugins/manifest")>();
	const withoutSurface = {
		id: "tea.no-case-panel",
		name: "No case panel",
		version: "0.0.1",
		description: "Declares no case-panel surface.",
		surfaces: ["element-badge"],
	} as const;
	return {
		...actual,
		getManifestEntry: (id: string) =>
			id === withoutSurface.id ? withoutSurface : actual.getManifestEntry(id),
	};
});

const FIRST: CasePanelRegistration = {
	pluginId: "tea.health",
	panelId: "tea.health",
	label: "First",
	Component: () => null,
};

afterEach(() => {
	casePanelSlot.resetForTests();
});

describe("the case-panel slot's registration rules", () => {
	it("starts empty and lists a registration once", () => {
		expect(casePanelSlot.list()).toEqual([]);
		casePanelSlot.register(FIRST);
		expect(casePanelSlot.list()).toEqual([FIRST]);
	});

	it("takes the same registration twice as one", () => {
		casePanelSlot.register(FIRST);
		casePanelSlot.register({ ...FIRST });
		expect(casePanelSlot.list()).toHaveLength(1);
	});

	it("refuses a different registration from a plugin that already has one", () => {
		casePanelSlot.register(FIRST);
		expect(() => casePanelSlot.register({ ...FIRST, label: "Second" })).toThrow(
			"conflicting registration"
		);
		expect(casePanelSlot.list()).toHaveLength(1);
	});

	it("refuses a plugin the manifest does not know", () => {
		expect(() =>
			casePanelSlot.register({ ...FIRST, pluginId: "tea.unknown" })
		).toThrow("unknown plugin");
	});

	it("refuses a plugin whose manifest entry does not declare the case-panel surface", () => {
		expect(() =>
			casePanelSlot.register({ ...FIRST, pluginId: "tea.no-case-panel" })
		).toThrow("does not declare this surface");
	});

	it("keeps registrations apart from the element-panel slot's", async () => {
		const { elementPanelSlot } = await import("../registry");
		casePanelSlot.register(FIRST);
		expect(elementPanelSlot.list()).not.toContain(FIRST);
	});
});
