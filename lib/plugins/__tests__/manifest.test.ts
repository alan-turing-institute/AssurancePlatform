import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getManifestEntry, PLUGIN_MANIFEST } from "@/lib/plugins/manifest";

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
