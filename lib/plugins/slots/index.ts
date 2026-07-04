/**
 * The UI extension slot registry — public surface (ADR 0002 v2 §2.3).
 *
 * Core components import from here only, never from a plugin module
 * directly (the one-way dependency rule, ADR §1) — there is no plugin
 * module to import from in 1.0 regardless; this barrel is what makes that
 * structurally true rather than merely coincidental.
 */

export {
	elementBadgeSlot,
	elementPanelSlot,
	settingsSectionSlot,
} from "./registry";
export type {
	ElementBadgeRegistration,
	ElementPanelRegistration,
	ElementSlotContext,
	ElementType,
	SettingsSectionRegistration,
	SlotId,
} from "./types";
