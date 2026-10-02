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
	casePanelSlot,
	elementBadgeSlot,
	elementPanelSlot,
	settingsSectionSlot,
} from "./registry";
export type {
	CasePanelRegistration,
	CaseSlotContext,
	// No consumer imports the three marked types from here: they describe the
	// `element-badge` and `settings-section` registrations and the id space
	// that every slot shares, and stay exported so the barrel covers each
	// slot. The other types have importers, so they carry no marker; the
	// three marked ones are unused by fallow's count alone.
	// fallow-ignore-next-line unused-type
	ElementBadgeRegistration,
	ElementPanelRegistration,
	ElementSlotContext,
	ElementType,
	// fallow-ignore-next-line unused-type
	SettingsSectionRegistration,
	// fallow-ignore-next-line unused-type
	SlotId,
} from "./types";
