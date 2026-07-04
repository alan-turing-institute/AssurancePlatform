/**
 * Types for the build-time UI extension slot registry (ADR 0002 v2 §2.3).
 *
 * "Build-time" is the operative word: a slot is filled by an official
 * plugin's module calling `.register()` at import time (see `registry.ts`),
 * not by anything resolved per-request. Which registrations actually render
 * for a given user is a separate, later question answered by consulting
 * effective plugin enablement (`hooks/use-plugin-enablement.ts`) — this
 * module only knows "what could show up here", never "is it on right now".
 */

import type { ComponentType } from "react";
import type { PluginSurface } from "@/lib/plugins/manifest";

/**
 * Mirrors `DiagramNodeType` (`components/shared/nodes/node-config.ts`) as a
 * standalone literal union rather than importing it. `lib/` does not import
 * from `components/` anywhere else in this codebase — only the reverse
 * direction is established — and pulling a component-layer type in here
 * would be the first crack in that layering for a type that is,
 * structurally, just a string enum. The two unions are identical, so a
 * `DiagramNodeType` value passes through call sites with no cast needed.
 */
export type ElementType = "evidence" | "goal" | "property" | "strategy";

/**
 * The UI slot ids a plugin may register into — a subset of `PluginSurface`
 * (`extension-data` / `plugin-tables` / `machine-endpoints` / `events` are
 * non-UI surfaces with no registry here). ADR §2.3 also names `case-panel`
 * and `canvas-decorator` as 1.1 slots; they're included in this union so
 * their eventual registries slot in without a type redesign, but 1.0 builds
 * a live `SlotRegistry` instance only for the three below (`registry.ts`) —
 * there is no official plugin consuming the other two yet.
 */
export type SlotId = Extract<
	PluginSurface,
	| "canvas-decorator"
	| "case-panel"
	| "element-badge"
	| "element-panel"
	| "settings-section"
>;

/** Everything an element-scoped slot's render function needs to key its own data (tier-1 `PluginData` is namespaced by case + element). */
export interface ElementSlotContext {
	caseId: string;
	elementId: string;
	elementType: ElementType;
}

interface SlotRegistrationBase {
	/** Must name a `PluginManifestEntry.id` whose `surfaces` includes this slot's id — enforced at `.register()` time, not just documented. */
	pluginId: string;
}

/** A small status affordance rendered on a canvas node (ADR §2.3: "the state dot"). */
export interface ElementBadgeRegistration extends SlotRegistrationBase {
	Component: ComponentType<ElementSlotContext>;
}

/** A tab contributed to the element detail view (ADR §2.3: "the evidence log / trace view"). */
export interface ElementPanelRegistration extends SlotRegistrationBase {
	Component: ComponentType<ElementSlotContext>;
	/** Optional leading icon for the tab trigger. */
	icon?: ComponentType<{ className?: string }>;
	/** Tab trigger label, e.g. "Evidence". */
	label: string;
	/** Stable per registration — becomes the Radix `Tabs` value; must be unique among a given element's panel tabs. */
	tabId: string;
}

/** A plugin's own settings UI within its row in the plugins pane (ADR §2.3: "settings-section ... All"). */
export interface SettingsSectionRegistration extends SlotRegistrationBase {
	Component: ComponentType<{ pluginId: string }>;
}
