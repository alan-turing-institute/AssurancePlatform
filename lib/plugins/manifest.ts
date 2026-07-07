/**
 * Static registry of official plugins (ADR 0002 v2 §2.2). An official plugin
 * is first-party code compiled into the platform — this manifest is what
 * makes it "known" at all: the enablement service refuses to resolve a
 * plugin id absent here, and deployment availability (below) can only
 * withhold a manifest entry, never invent one out of thin air.
 *
 * This list is deliberately closed and hand-edited — extend it only when a
 * new official plugin actually ships (1.1: `tea.techniques`, `tea.gsn-ui`),
 * never ad hoc at a call site.
 */

/** The four extension surfaces a plugin may use (ADR 0002 v2 §2.2/§2.3). */
export type PluginSurface =
	| "extension-data" // tier-1 PluginData
	| "plugin-tables" // tier-2 plugin-owned tables
	| "machine-endpoints" // /api/machine/* routes this plugin exposes
	| "element-badge"
	| "element-panel"
	| "case-panel"
	| "canvas-decorator"
	| "settings-section"
	| "events"; // namespaced SSE event types

export interface PluginManifestEntry {
	/** Namespace, e.g. "tea.health" — matches `PluginData.pluginId` / `PluginState.pluginId`. */
	readonly id: string;
	readonly name: string;
	readonly surfaces: readonly PluginSurface[];
	readonly version: string;
}

/**
 * 1.0 ships one official plugin: claim/evidence health (ADR 0002 v2 §3).
 * Its implementation (storage, scoring, machine endpoints) is a later issue —
 * this entry is metadata only, enough for the lifecycle/enablement/PluginData
 * plumbing to have a real namespace to prove itself against.
 *
 * No external callers yet (fallow dead-export finding) — staged for the
 * settings pane, a later work item. Not dead code; do not remove.
 */
export const PLUGIN_MANIFEST: readonly PluginManifestEntry[] = [
	{
		id: "tea.health",
		name: "Claim/Evidence Health",
		version: "0.1.0",
		surfaces: [
			"extension-data",
			"plugin-tables",
			"machine-endpoints",
			"element-badge",
			"element-panel",
			"settings-section",
			"events",
		],
	},
];

const MANIFEST_BY_ID: ReadonlyMap<string, PluginManifestEntry> = new Map(
	PLUGIN_MANIFEST.map((entry) => [entry.id, entry])
);

/** Looks up a manifest entry by plugin id. `undefined` means the id is not an official plugin at all. */
export function getManifestEntry(
	pluginId: string
): PluginManifestEntry | undefined {
	return MANIFEST_BY_ID.get(pluginId);
}

/**
 * All plugin ids known to this build, in manifest order.
 *
 * No external callers yet (fallow dead-export finding) — staged for the
 * settings pane, a later work item. Not dead code; do not remove.
 */
export function listManifestPluginIds(): string[] {
	return PLUGIN_MANIFEST.map((entry) => entry.id);
}

/**
 * Deployment availability (ADR 0002 v2 §2.2: "a deployment concern —
 * config/env: which official plugins this instance offers"). Every manifest
 * plugin is available by default, so a fresh deployment (or the DARTER
 * keystone demo) gets the full architecture with zero configuration; an
 * operator withholds a plugin entirely by listing its id in
 * `TEA_PLUGINS_DISABLED` (comma-separated). Withholding an id that isn't in
 * the manifest is a no-op — deployment config can only narrow what's
 * compiled in, never widen it.
 *
 * Read from `process.env` on every call (not cached at module load) so
 * tests can flip it per-case without a module reset.
 */
function disabledPluginIdsFromEnv(): ReadonlySet<string> {
	const raw = process.env.TEA_PLUGINS_DISABLED;
	if (!raw) {
		return new Set();
	}
	return new Set(
		raw
			.split(",")
			.map((id) => id.trim())
			.filter(Boolean)
	);
}

/** Is `pluginId` a manifest entry this deployment currently offers at all? */
export function isPluginAvailableForDeployment(pluginId: string): boolean {
	if (!getManifestEntry(pluginId)) {
		return false;
	}
	return !disabledPluginIdsFromEnv().has(pluginId);
}
