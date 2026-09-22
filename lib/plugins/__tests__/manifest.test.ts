import { describe, expect, it } from "vitest";
import { PLUGIN_MANIFEST } from "@/lib/plugins/manifest";

/**
 * No dedicated manifest test file existed before TEA — Plugin management
 * surface (D2): `bootstrap.test.tsx` exercises the manifest only indirectly,
 * through the slot registries. This file covers the manifest's own data
 * contract — the fields the Plugins page card reads directly.
 */
describe("PLUGIN_MANIFEST — card data contract", () => {
	it("gives every entry a non-empty description and a docsPath under /docs/", () => {
		expect(PLUGIN_MANIFEST.length).toBeGreaterThan(0);
		for (const entry of PLUGIN_MANIFEST) {
			expect(entry.description.trim().length).toBeGreaterThan(0);
			expect(entry.docsPath.startsWith("/docs/")).toBe(true);
		}
	});
});
