import { describe, expect, it } from "vitest";
import { issuesOf } from "@/src/__tests__/utils/schema-issues-kit";
import { pluginToggleSchema } from "../plugin";

const toggle = (fields: Record<string, unknown>) => ({
	pluginId: "tea.health",
	enabled: true,
	...fields,
});
const withSettings = (settings: unknown) => toggle({ settings });

/** Settings that serialise to exactly `bytes` bytes, within every per-value limit. */
function settingsOfBytes(bytes: number): Record<string, string> {
	const settings: Record<string, string> = {};
	for (let i = 0; i < 8; i++) {
		settings[`k${i}`] = "x".repeat(500);
	}
	settings.z = "";
	const base = JSON.stringify(settings).length;
	settings.z = "x".repeat(bytes - base);
	return settings;
}

function nested(levels: number): unknown {
	return levels === 0 ? 1 : { a: nested(levels - 1) };
}

describe("pluginToggleSchema: plugin id and flag", () => {
	it("accepts a plugin that exists", () => {
		expect(issuesOf(pluginToggleSchema, toggle({}))).toEqual([]);
	});

	it("refuses a plugin id that does not exist", () => {
		expect(
			issuesOf(pluginToggleSchema, toggle({ pluginId: "tea.nope" }))
		).toEqual(["pluginId: Unknown plugin id"]);
	});

	it("asks for a plugin id", () => {
		expect(issuesOf(pluginToggleSchema, toggle({ pluginId: "" }))).toContain(
			"pluginId: pluginId is required"
		);
	});

	it("refuses a plugin id of 101 characters with a message", () => {
		expect(
			issuesOf(pluginToggleSchema, toggle({ pluginId: "p".repeat(101) }))
		).toContain("pluginId: pluginId must be less than 100 characters");
	});

	it("refuses an enabled flag that is not a boolean", () => {
		expect(issuesOf(pluginToggleSchema, toggle({ enabled: "yes" }))).toEqual([
			"enabled: enabled must be a boolean",
		]);
	});
});

describe("pluginToggleSchema: settings", () => {
	it("accepts four levels of nesting and refuses five", () => {
		expect(issuesOf(pluginToggleSchema, withSettings(nested(4)))).toEqual([]);
		expect(issuesOf(pluginToggleSchema, withSettings(nested(5)))).not.toEqual(
			[]
		);
	});

	it("accepts 20 top-level keys and refuses 21 with a message", () => {
		const keys = (n: number) =>
			Object.fromEntries(Array.from({ length: n }, (_, i) => [`k${i}`, 1]));
		expect(issuesOf(pluginToggleSchema, withSettings(keys(20)))).toEqual([]);
		expect(issuesOf(pluginToggleSchema, withSettings(keys(21)))).toEqual([
			"settings: settings must have at most 20 top-level keys",
		]);
	});

	it("accepts 4096 serialised bytes and refuses 4097 with a message", () => {
		expect(
			issuesOf(pluginToggleSchema, withSettings(settingsOfBytes(4096)))
		).toEqual([]);
		expect(
			issuesOf(pluginToggleSchema, withSettings(settingsOfBytes(4097)))
		).toEqual(["settings: settings must serialize to at most 4096 bytes"]);
	});
});
