/**
 * Theme Preset Type Definitions
 *
 * Defines the shape of colour presets used by ThemePresetProvider.
 * Each preset contains OKLCH colour values for both light and dark modes.
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
	| "--chart-1"
	| "--chart-2"
	| "--chart-3"
	| "--chart-4"
	| "--chart-5"
	| "--sidebar"
	| "--sidebar-foreground"
	| "--sidebar-primary"
	| "--sidebar-primary-foreground"
	| "--sidebar-accent"
	| "--sidebar-accent-foreground"
	| "--sidebar-border"
	| "--sidebar-ring"
	| "--sidebar-muted"
	| "--radius"
	| "--font-sans"
	| "--font-serif"
	| "--font-mono"
	| "--shadow-2xs"
	| "--shadow-xs"
	| "--shadow-sm"
	| "--shadow"
	| "--shadow-md"
	| "--shadow-lg"
	| "--shadow-xl"
	| "--shadow-2xl"
	| "--tracking-normal"
	| "--spacing";

/** OKLCH colour values for a single mode (e.g. "oklch(0.205 0 0)") */
export type ThemeVariableSet = Partial<Record<ThemeVariable, string>>;

/** A complete colour preset with light and dark variable sets */
export type ThemePreset = {
	id: string;
	name: string;
	light: ThemeVariableSet;
	dark: ThemeVariableSet;
};
