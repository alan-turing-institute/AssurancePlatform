/**
 * The UI extension slot registry — public surface (ADR 0002 v2 §2.3).
 *
 * Core components import from here only, never from a plugin module
 * directly (the one-way dependency rule, ADR §1) — there is no plugin
 * module to import from in 1.0 regardless; this barrel is what makes that
 * structurally true rather than merely coincidental.
 *
 * Client-side only — see `./registry`'s module docstring for why a server
 * import would silently desync from the client's registry instead of erroring.
 */

export {
	elementBadgeSlot,
	elementPanelSlot,
	settingsSectionSlot,
} from "./registry";
export type {
	// Staged re-exports (ADR 0002 v2 §2.3): no consumer imports these four
	// yet in 1.0 — they exist for the health plugin (1.0's only official
	// plugin) to register `element-badge`/`settings-section` slots against,
	// and for the `element-panel`/`case-panel`/`canvas-decorator` id space
	// `SlotId` already spans. `ElementPanelRegistration` and
	// `ElementSlotContext` below have real consumers today, so they're
	// unmarked; these four are dead by fallow's count only because the thing
	// that will use them hasn't shipped.
	// fallow-ignore-next-line unused-type
	ElementBadgeRegistration,
	ElementPanelRegistration,
	ElementSlotContext,
	// fallow-ignore-next-line unused-type
	ElementType,
	// fallow-ignore-next-line unused-type
	SettingsSectionRegistration,
	// fallow-ignore-next-line unused-type
	SlotId,
} from "./types";
