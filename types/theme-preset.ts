/**
 * Theme Preset Type Definitions
 *
 * Defines the shape of colour presets used by ThemePresetProvider.
 * Each preset contains HSL bare triplets for both light and dark modes.
 */

/** CSS variable names that can be overridden by a preset */
export type ThemeVariable =
	| "--background"
	| "--foreground"
	| "--card"
	| "--card-foreground"
	| "--popover"
	| "--popover-foreground"
	| "--primary"
	| "--primary-foreground"
	| "--secondary"
	| "--secondary-foreground"
	| "--muted"
	| "--muted-foreground"
	| "--accent"
	| "--accent-foreground"
	| "--destructive"
	| "--destructive-foreground"
	| "--border"
	| "--input"
	| "--ring"
	| "--sidebar"
	| "--sidebar-foreground"
	| "--sidebar-accent"
	| "--sidebar-accent-foreground"
	| "--sidebar-border"
	| "--sidebar-muted";

/** HSL bare triplet values for a single mode (e.g. "210 40% 98%") */
export type ThemeVariableSet = Partial<Record<ThemeVariable, string>>;

/** A complete colour preset with light and dark variable sets */
export type ThemePreset = {
	id: string;
	name: string;
	light: ThemeVariableSet;
	dark: ThemeVariableSet;
};
