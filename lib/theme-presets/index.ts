/**
 * Theme Presets
 *
 * Curated colour presets in OKLCH format.
 * Catppuccin (Latte/Mocha) is the default — it matches the base
 * CSS variables in globals.css.
 *
 * To add a new preset: create a file in this directory, then add it to the
 * array below.
 */

import type { ThemePreset } from "@/types/theme-preset";
import { amberPreset } from "./amber";
import { caffeinePreset } from "./caffeine";
import { catpuccinPreset } from "./catpuccin";
import { darkmatterPreset } from "./darkmatter";
import { ghibliPreset } from "./ghibli";
import { highContrastPreset } from "./high-contrast";
import { modernMinimalPreset } from "./modern-minimal";
import { retroArcadePreset } from "./retro-arcade";
import { sunsetHorizonPreset } from "./sunset-horizon";

export const themePresets: ThemePreset[] = [
	catpuccinPreset,
	highContrastPreset,
	amberPreset,
	caffeinePreset,
	darkmatterPreset,
	ghibliPreset,
	modernMinimalPreset,
	retroArcadePreset,
	sunsetHorizonPreset,
];
