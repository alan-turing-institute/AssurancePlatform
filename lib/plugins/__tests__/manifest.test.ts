import { existsSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	getManifestEntry,
	isPluginAvailableForDeployment,
	PLUGIN_MANIFEST,
} from "@/lib/plugins/manifest";

const CONTENT_DIR = path.resolve(import.meta.dirname, "../../../content");
const DOCS_PREFIX = "/docs/";

/** The file in `content/` that serves a site-relative docs URL, or `undefined` when there is none. */
function docsSourceFor(docsPath: string): string | undefined {
	const slug = docsPath.slice(DOCS_PREFIX.length);
	return [`${slug}.mdx`, `${slug}/index.mdx`]
		.map((file) => path.join(CONTENT_DIR, file))
		.find((file) => existsSync(file));
}

/**
 * No dedicated manifest test file existed before TEA — Plugin management
 * surface (D2): `bootstrap.test.tsx` exercises the manifest only indirectly,
 * through the slot registries. This file covers the manifest's own data
 * contract — the fields the Plugins page card reads directly.
 */
describe("PLUGIN_MANIFEST — card data contract", () => {
	it("gives every entry a non-empty description, and a docsPath under /docs/ when set", () => {
		expect(PLUGIN_MANIFEST.length).toBeGreaterThan(0);
		for (const entry of PLUGIN_MANIFEST) {
			expect(entry.description.trim().length).toBeGreaterThan(0);
			// The type allows docsPath to be absent, so its form is checked only where
			// it is set; the docs links tests below require it on every official plugin.
			if (entry.docsPath !== undefined) {
				expect(entry.docsPath.startsWith("/docs/")).toBe(true);
			}
		}
	});
});

describe("PLUGIN_MANIFEST — docs links", () => {
	it("gives every official plugin a docsPath that names a page under content/", () => {
		for (const entry of PLUGIN_MANIFEST) {
			expect(entry.docsPath, `${entry.id} has no docsPath`).toBeDefined();
			expect(
				docsSourceFor(entry.docsPath ?? ""),
				`${entry.id} links to ${entry.docsPath}, which has no page`
			).toBeDefined();
		}
	});
});

describe("PLUGIN_MANIFEST — identity fields", () => {
	it("gives every entry a non-empty id, name and version, distinct from every other entry's", () => {
		for (const entry of PLUGIN_MANIFEST) {
			expect(entry.id.trim().length).toBeGreaterThan(0);
			expect(entry.name.trim().length).toBeGreaterThan(0);
			expect(entry.version.trim().length).toBeGreaterThan(0);
		}
		expect(new Set(PLUGIN_MANIFEST.map((e) => e.id)).size).toBe(
			PLUGIN_MANIFEST.length
		);
		expect(new Set(PLUGIN_MANIFEST.map((e) => e.name)).size).toBe(
			PLUGIN_MANIFEST.length
		);
	});
});

describe("PLUGIN_MANIFEST — flags and surfaces read by services and slots", () => {
	it("keeps every official plugin off until the user turns it on", () => {
		for (const entry of PLUGIN_MANIFEST) {
			expect(entry.defaultEnabled, entry.id).toBe(false);
		}
	});

	it("marks only the assistant as using models", () => {
		expect(getManifestEntry("tea.assistant")?.usesModels).toBe(true);
		expect(getManifestEntry("tea.health")?.usesModels).not.toBe(true);
	});

	it.each([
		[
			"tea.health",
			[
				"case-panel",
				"element-appearance",
				"element-badge",
				"element-panel",
				"events",
				"extension-data",
				"machine-endpoints",
				"plugin-tables",
				"settings-section",
			],
		],
		["tea.assistant", ["case-panel", "settings-section"]],
	])("lists exactly these surfaces for %s", (id, expected) => {
		expect([...(getManifestEntry(id)?.surfaces ?? [])].sort()).toStrictEqual(
			expected
		);
	});
});

describe("isPluginAvailableForDeployment", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("offers every manifest plugin when nothing is withheld", () => {
		vi.stubEnv("TEA_PLUGINS_DISABLED", undefined);

		for (const entry of PLUGIN_MANIFEST) {
			expect(isPluginAvailableForDeployment(entry.id)).toBe(true);
		}
	});

	it("offers every manifest plugin when the setting is an empty string", () => {
		vi.stubEnv("TEA_PLUGINS_DISABLED", "");

		expect(isPluginAvailableForDeployment("tea.health")).toBe(true);
		expect(isPluginAvailableForDeployment("tea.assistant")).toBe(true);
	});

	it("never offers an id the manifest does not list, whatever the setting says", () => {
		vi.stubEnv("TEA_PLUGINS_DISABLED", undefined);
		expect(isPluginAvailableForDeployment("tea.unknown")).toBe(false);

		vi.stubEnv("TEA_PLUGINS_DISABLED", "tea.health");
		expect(isPluginAvailableForDeployment("tea.unknown")).toBe(false);
	});

	it("withholds only the plugin named in the setting", () => {
		vi.stubEnv("TEA_PLUGINS_DISABLED", "tea.health");

		expect(isPluginAvailableForDeployment("tea.health")).toBe(false);
		expect(isPluginAvailableForDeployment("tea.assistant")).toBe(true);
	});

	it("withholds every plugin in a comma-separated list, ignoring spaces and empty items", () => {
		vi.stubEnv("TEA_PLUGINS_DISABLED", " tea.health , ,tea.assistant,");

		expect(isPluginAvailableForDeployment("tea.health")).toBe(false);
		expect(isPluginAvailableForDeployment("tea.assistant")).toBe(false);
	});

	it("ignores an unknown id in the setting", () => {
		vi.stubEnv("TEA_PLUGINS_DISABLED", "tea.other");

		expect(isPluginAvailableForDeployment("tea.health")).toBe(true);
		expect(isPluginAvailableForDeployment("tea.assistant")).toBe(true);
	});

	it("reads the setting on every call", () => {
		vi.stubEnv("TEA_PLUGINS_DISABLED", "tea.health");
		expect(isPluginAvailableForDeployment("tea.health")).toBe(false);

		vi.stubEnv("TEA_PLUGINS_DISABLED", "");
		expect(isPluginAvailableForDeployment("tea.health")).toBe(true);
	});
});

describe("PLUGIN_MANIFEST — tea.health surfaces", () => {
	it("declares element-appearance, without which its registration into that slot throws", () => {
		expect(getManifestEntry("tea.health")?.surfaces).toContain(
			"element-appearance"
		);
	});

	it("does not declare element-appearance for the assistant", () => {
		expect(getManifestEntry("tea.assistant")?.surfaces).not.toContain(
			"element-appearance"
		);
	});
});
