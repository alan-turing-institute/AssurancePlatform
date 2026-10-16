import { describe, expect, it } from "vitest";
import type { PluginSurface } from "@/lib/plugins/manifest";
import { whatItAddsCopy } from "../plugin-surface-copy";

describe("whatItAddsCopy", () => {
	it("maps every user-visible surface to its copy, in surface order", () => {
		const surfaces: PluginSurface[] = [
			"element-badge",
			"element-appearance",
			"element-panel",
			"case-panel",
			"canvas-decorator",
			"machine-endpoints",
			"events",
		];

		expect(whatItAddsCopy(surfaces)).toEqual([
			"A health badge on property claims and on the evidence nodes that show a claim's result",
			"A tint on those evidence nodes, and a colour on the line from the claim to each one",
			"An Evidence tab in the element dialog",
			"A panel on the case page",
			"Extra markings on the canvas",
			"Endpoints that integrations write evidence to",
			"Live updates when new evidence arrives",
		]);
	});

	it("omits extension-data, plugin-tables and settings-section — storage/settings plumbing, not user-visible", () => {
		const surfaces: PluginSurface[] = [
			"extension-data",
			"plugin-tables",
			"settings-section",
		];

		expect(whatItAddsCopy(surfaces)).toEqual([]);
	});

	it("returns only the visible lines when hidden and visible surfaces are mixed", () => {
		const surfaces: PluginSurface[] = [
			"extension-data",
			"element-badge",
			"plugin-tables",
			"events",
			"settings-section",
		];

		expect(whatItAddsCopy(surfaces)).toEqual([
			"A health badge on property claims and on the evidence nodes that show a claim's result",
			"Live updates when new evidence arrives",
		]);
	});

	it("returns an empty list for a plugin with no surfaces", () => {
		expect(whatItAddsCopy([])).toEqual([]);
	});
});
