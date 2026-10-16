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
 * Extended for `awayGoal`/`module` (ADR 0005 D3) alongside `DiagramNodeType`
 * — no plugin registers against either kind, so this is purely keeping the
 * mirror faithful, not building D6's GSN plugin (explicitly out of scope).
 */
export type ElementType =
	| "evidence"
	| "goal"
	| "property"
	| "strategy"
	| "awayGoal"
	| "module";

/**
 * The UI slot ids a plugin may register into — a subset of `PluginSurface`
 * (`extension-data` / `plugin-tables` / `machine-endpoints` / `events` are
 * non-UI surfaces with no registry here). ADR §2.3 also names `case-panel`
 * and `canvas-decorator` as 1.1 slots; they're included in this union so
 * their eventual registries slot in without a type redesign. A live
 * `SlotRegistry` instance exists for `case-panel`, `element-appearance`,
 * `element-badge`, `element-panel` and `settings-section` (`registry.ts`); no
 * official plugin consumes `canvas-decorator` yet.
 */
export type SlotId = Extract<
	PluginSurface,
	| "canvas-decorator"
	| "case-panel"
	| "element-appearance"
	| "element-badge"
	| "element-panel"
	| "settings-section"
>;

/** Everything an element-scoped slot's render function needs to key its own data (tier-1 `PluginData` is namespaced by case + element). */
export interface ElementSlotContext {
	/** Whether the viewer may edit the case. Absent means view-only. The server enforces permission whatever a slot shows. */
	canEdit?: boolean;
	caseId: string;
	/** Whether the element's children are collapsed on the canvas, so none of them is drawn. Absent where the host has no canvas to ask. */
	childrenHidden?: boolean;
	elementId: string;
	/** The element's own text, as the details form holds it. Absent where the host has none to give. */
	elementText?: string;
	elementType: ElementType;
}

interface SlotRegistrationBase {
	/** Must name a `PluginManifestEntry.id` whose `surfaces` includes this slot's id — enforced at `.register()` time, not just documented. */
	pluginId: string;
}

/** Everything a case-scoped slot's render function needs. */
export interface CaseSlotContext {
	/** Whether the viewer may edit the case's elements. The server enforces permission whatever a slot shows. */
	canEdit: boolean;
	caseId: string;
	/** The id of the element currently selected on the canvas, if any. Browser-supplied: a hint for the UI, never an authorisation. */
	selectedElementId?: string;
	/** Display name of the selected element (e.g. "G1"), for headings. Absent when nothing is selected. */
	selectedElementLabel?: string;
}

/** A small status affordance rendered on a canvas node (ADR §2.3: "the state dot"). */
export interface ElementBadgeRegistration extends SlotRegistrationBase {
	Component: ComponentType<ElementSlotContext>;
}

/** How an element, or the line between two elements, is tinted. Core knows tones, never what they mean to a plugin. */
export type AppearanceTone = "caution" | "negative" | "neutral" | "positive";

/** A plugin's answer for one element or edge: its tone, and whether it is drawn faded. */
export interface ElementAppearance {
	/** Fills and lines are drawn at about a third of their strength. Text stays at full contrast. */
	faded: boolean;
	tone: AppearanceTone;
}

/** What an appearance is asked about: one element, or the line from one element to another. */
export type AppearanceSubject =
	| {
			caseId: string;
			elementId: string;
			elementType: ElementType;
			kind: "node";
	  }
	| {
			caseId: string;
			kind: "edge";
			sourceElementId: string;
			targetElementId: string;
	  };

/**
 * A plugin's answer source for how an element or edge is drawn. `useAppearance`
 * is a React hook, called on every render of every node and edge for every
 * registered plugin, whether or not the plugin is on, so the number of hooks a
 * component runs never changes once plugin enablement has loaded. It returns
 * the answer or `null` for "no opinion". `enabled` is false while the plugin is
 * off for the viewer, or on a canvas with no plugin data; the hook then must
 * make no request and return `null`.
 */
export interface ElementAppearanceRegistration extends SlotRegistrationBase {
	useAppearance: (
		subject: AppearanceSubject,
		enabled: boolean
	) => ElementAppearance | null;
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
	/** Whether the element dialog is wider while this tab is showing. */
	wide?: boolean;
}

/** A plugin's own settings UI within its row in the plugins pane (ADR §2.3: "settings-section ... All"). */
export interface SettingsSectionRegistration extends SlotRegistrationBase {
	Component: ComponentType<{ pluginId: string }>;
}

/** A panel contributed to the case toolbar: one button, opening a side sheet that holds the component. */
export interface CasePanelRegistration extends SlotRegistrationBase {
	Component: ComponentType<CaseSlotContext>;
	/** Optional icon for the toolbar button. */
	icon?: ComponentType<{ className?: string }>;
	/** The button's tooltip and accessible name, and the sheet's title. */
	label: string;
	/** `false` for a panel that sits beside the canvas without blocking it: no overlay, clicks outside do not close it, and the panel keeps any state it needs across close and reopen. Absent means a modal sheet. */
	modal?: false;
	/** Stable per registration; names the button's test id. */
	panelId: string;
}
