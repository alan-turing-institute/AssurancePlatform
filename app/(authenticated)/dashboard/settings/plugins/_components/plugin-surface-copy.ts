import type { PluginSurface } from "@/lib/plugins/manifest";

/**
 * "What it adds" copy for a plugin's card (TEA — Plugin management surface
 * D2), one line per user-visible surface. This is the WHOLE mapping —
 * `extension-data`, `plugin-tables` and `settings-section` are storage and
 * settings plumbing, not something a user sees, so they produce no line and
 * are deliberately absent from this map rather than mapped to `undefined`.
 */
const SURFACE_COPY: Partial<Record<PluginSurface, string>> = {
	"element-badge": "A health badge on property claims on the canvas",
	"element-panel": "An Evidence tab in the element dialog",
	"case-panel": "A panel on the case page",
	"canvas-decorator": "Extra markings on the canvas",
	"machine-endpoints": "Endpoints that integrations write evidence to",
	events: "Live updates when new evidence arrives",
};

/**
 * Derives a plugin card's "what it adds" bullet list from its manifest
 * `surfaces`, in the surfaces' own order. A surface absent from
 * `SURFACE_COPY` (storage/settings plumbing) is silently omitted rather than
 * producing a blank bullet.
 */
export function whatItAddsCopy(surfaces: readonly PluginSurface[]): string[] {
	return surfaces
		.map((surface) => SURFACE_COPY[surface])
		.filter((line): line is string => Boolean(line));
}
