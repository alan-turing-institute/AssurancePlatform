/**
 * Static registry of official plugins (ADR 0002 v2 §2.2). An official plugin
 * is first-party code compiled into the platform — this manifest is what
 * makes it "known" at all: the enablement service refuses to resolve a
 * plugin id absent here, and deployment availability (below) can only
 * withhold a manifest entry, never invent one out of thin air.
 *
 * This is more than lifecycle metadata: `description` and `docsPath` are the
 * copy the Plugins management page renders on each plugin's card, so the card
 * and its docs link stay with what the enablement and lifecycle code already
 * know about a plugin.
 *
 * This list is deliberately closed and hand-edited: extend it only when a new
 * official plugin ships, never ad hoc at a call site.
 */

/** The four extension surfaces a plugin may use (ADR 0002 v2 §2.2/§2.3). */
export type PluginSurface =
	| "extension-data" // tier-1 PluginData
	| "plugin-tables" // tier-2 plugin-owned tables
	| "machine-endpoints" // /api/machine/* routes this plugin exposes
	| "element-appearance"
	| "element-badge"
	| "element-panel"
	| "case-panel"
	| "canvas-decorator"
	| "settings-section"
	| "events"; // namespaced SSE event types

export interface PluginManifestEntry {
	/**
	 * Whether a user who has never set this plugin gets it on. Absent means
	 * on. When `false`, the plugin is off until the user's own USER-scope row
	 * turns it on; an off row at any higher scope still wins. For a plugin
	 * that lists the `machine-endpoints` surface, an integration's machine
	 * account is treated as having turned it on, so pipelines keep working; a
	 * row turning it off, or the deployment withholding it, still applies to
	 * that account. A plugin without that surface gets no such exception.
	 */
	readonly defaultEnabled?: boolean;
	/**
	 * Two or three plain sentences for the Plugins page card (TEA — Plugin
	 * management surface D2). Written for the person deciding whether to turn
	 * the plugin on or off, not for a developer.
	 */
	readonly description: string;
	/**
	 * Site-relative docs URL for the card's "Learn more" link, e.g.
	 * `/docs/technical-guide/architecture/plugin-ecosystem`. The card shows the
	 * link when this is set and omits it when it is absent.
	 */
	readonly docsPath?: string;
	/** Namespace, e.g. "tea.health" — matches `PluginData.pluginId` / `PluginState.pluginId`. */
	readonly id: string;
	readonly name: string;
	readonly surfaces: readonly PluginSurface[];
	/**
	 * Whether the plugin calls the model providers a user connects in their
	 * settings. The model routes under `/api/user/models` work for a user who
	 * has at least one such plugin on, and for no one else. Absent means no.
	 */
	readonly usesModels?: boolean;
	readonly version: string;
}

/**
 * The official plugins: claim/evidence health (`tea.health`) and the Case
 * Assistant (`tea.assistant`). An entry is metadata only. It gives the
 * lifecycle, enablement and PluginData code a namespace, and each plugin's own
 * code registers its UI through the slot registries.
 */
export const PLUGIN_MANIFEST: readonly PluginManifestEntry[] = [
	{
		id: "tea.health",
		name: "Claim/Evidence Health",
		version: "0.1.0",
		defaultEnabled: false,
		surfaces: [
			"extension-data",
			"plugin-tables",
			"machine-endpoints",
			"element-badge",
			"element-appearance",
			"element-panel",
			"case-panel",
			"settings-section",
			"events",
		],
		description:
			"Shows whether the evidence behind each property claim is still holding. Automated checks — for example a monitoring pipeline running against a digital twin — send results to TEA; the plugin turns them into a badge on the claim and a log you can inspect. Results never change your case: it changes only when you accept a check for a claim, which can add one evidence node under the claim that shows its current result.",
		docsPath: "/docs/technical-guide/architecture/health-plugin",
	},
	{
		id: "tea.assistant",
		name: "Case Assistant",
		version: "0.1.0",
		defaultEnabled: false,
		usesModels: true,
		surfaces: ["case-panel", "settings-section"],
		description:
			"A chat panel beside the case canvas. Ask questions about the open case and the assistant reads it to answer. It never changes the case itself: when you ask for a change, it suggests one and you choose whether to apply it. You choose the models it uses in the AI models section of these settings.",
		docsPath: "/docs/platform-guide/case-assistant",
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
