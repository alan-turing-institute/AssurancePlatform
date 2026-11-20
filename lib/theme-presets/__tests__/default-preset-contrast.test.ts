import { describe, expect, it } from "vitest";
import {
	oklchToRgb,
	type Rgb,
	ratio,
	toEightBit,
} from "@/src/__tests__/utils/colour-contrast-kit";
import type { ThemeVariable, ThemeVariableSet } from "@/types/theme-preset";
import { themePresets } from "../index";
import { modernMinimalPreset } from "../modern-minimal";

const MINIMUM_RATIO = 4.5;
const HOVER_OPACITY = 0.9;
const WHITE: Rgb = [1, 1, 1];
const LIGHTNESS_PATTERN = /oklch\(([\d.]+)/;

function colour(
	set: ThemeVariableSet,
	name: ThemeVariable,
	rounded = true
): Rgb {
	const value = set[name];
	if (!value) {
		throw new Error(`Missing ${name}`);
	}
	return oklchToRgb(value, rounded);
}

function blend(top: Rgb, bottom: Rgb, opacity: number, rounded = true): Rgb {
	return top.map((channel, i) => {
		const mixed = channel * opacity + (bottom[i] ?? 0) * (1 - opacity);
		return rounded ? toEightBit(mixed) : mixed;
	}) as Rgb;
}

/**
 * The lower of a pair's ratios taken with 8-bit channels and with the
 * unrounded colours a checker such as axe reads. Both must be above 4.5:1, so
 * tests assert on the lower one.
 */
function weakest(pair: (rounded: boolean) => [Rgb, Rgb]): number {
	return Math.min(
		...[true, false].map((rounded) => {
			const [text, surface] = pair(rounded);
			return ratio(text, surface);
		})
	);
}

/** Text at `opacity` over a named surface. */
function textOn(
	set: ThemeVariableSet,
	text: ThemeVariable,
	surface: ThemeVariable,
	opacity = 1
): number {
	return weakest((rounded) => {
		const base = colour(set, surface, rounded);
		const ink = colour(set, text, rounded);
		return [opacity < 1 ? blend(ink, base, opacity, rounded) : ink, base];
	});
}

const defaultPreset = themePresets[0];
if (!defaultPreset) {
	throw new Error("themePresets must not be empty");
}

const modes = [
	["light", defaultPreset.light],
	["dark", defaultPreset.dark],
] as const;

describe("default theme preset contrast", () => {
	for (const [mode, set] of modes) {
		describe(mode, () => {
			it("primary reaches 4.5:1 with its foreground", () => {
				expect(
					textOn(set, "--primary-foreground", "--primary")
				).toBeGreaterThan(MINIMUM_RATIO);
			});

			it("destructive reaches 4.5:1 with its foreground, also at 90 per cent opacity", () => {
				expect(
					textOn(set, "--destructive-foreground", "--destructive")
				).toBeGreaterThan(MINIMUM_RATIO);
				const hover = weakest((rounded) => [
					colour(set, "--destructive-foreground", rounded),
					blend(
						colour(set, "--destructive", rounded),
						colour(set, "--background", rounded),
						HOVER_OPACITY,
						rounded
					),
				]);
				expect(hover).toBeGreaterThan(MINIMUM_RATIO);
			});

			it("muted text reaches 4.5:1 on background, card, muted, popover and accent", () => {
				for (const surface of [
					"--background",
					"--card",
					"--muted",
					"--popover",
					"--accent",
				] as const) {
					expect(textOn(set, "--muted-foreground", surface)).toBeGreaterThan(
						MINIMUM_RATIO
					);
				}
			});

			it("accent and sidebar accent are a pale tint in light mode and a dark tone in dark mode", () => {
				for (const name of ["--accent", "--sidebar-accent"] as const) {
					const lightness = Number(set[name]?.match(LIGHTNESS_PATTERN)?.[1]);
					if (mode === "light") {
						expect(lightness).toBeGreaterThan(0.9);
					} else {
						expect(lightness).toBeLessThan(0.45);
					}
				}
			});

			it("accent text reaches 4.5:1 on accent", () => {
				expect(textOn(set, "--accent-foreground", "--accent")).toBeGreaterThan(
					MINIMUM_RATIO
				);
			});

			it("body text reaches 4.5:1 on accent, also at 70 per cent opacity", () => {
				expect(textOn(set, "--foreground", "--accent")).toBeGreaterThan(
					MINIMUM_RATIO
				);
				expect(textOn(set, "--foreground", "--accent", 0.7)).toBeGreaterThan(
					MINIMUM_RATIO
				);
			});

			it("destructive reaches 4.5:1 on accent", () => {
				expect(textOn(set, "--destructive", "--accent")).toBeGreaterThan(
					MINIMUM_RATIO
				);
			});

			it("sidebar accent text reaches 4.5:1 on sidebar accent", () => {
				expect(
					textOn(set, "--sidebar-accent-foreground", "--sidebar-accent")
				).toBeGreaterThan(MINIMUM_RATIO);
			});

			it("sidebar text reaches 4.5:1 on sidebar accent, also at 70 per cent opacity", () => {
				expect(
					textOn(set, "--sidebar-foreground", "--sidebar-accent")
				).toBeGreaterThan(MINIMUM_RATIO);
				expect(
					textOn(set, "--sidebar-foreground", "--sidebar-accent", 0.7)
				).toBeGreaterThan(MINIMUM_RATIO);
			});

			it("sidebar muted text reaches 4.5:1 on the sidebar", () => {
				expect(textOn(set, "--sidebar-muted", "--sidebar")).toBeGreaterThan(
					MINIMUM_RATIO
				);
			});

			it("sidebar text at 70 per cent opacity reaches 4.5:1 on the sidebar", () => {
				expect(
					textOn(set, "--sidebar-foreground", "--sidebar", 0.7)
				).toBeGreaterThan(MINIMUM_RATIO);
			});

			it("body text reaches 4.5:1 at 70 per cent opacity on card and background and 80 per cent on background", () => {
				expect(textOn(set, "--foreground", "--card", 0.7)).toBeGreaterThan(
					MINIMUM_RATIO
				);
				expect(
					textOn(set, "--foreground", "--background", 0.7)
				).toBeGreaterThan(MINIMUM_RATIO);
				expect(
					textOn(set, "--foreground", "--background", 0.8)
				).toBeGreaterThan(MINIMUM_RATIO);
			});
		});
	}

	it("sets no font variable, so the stylesheet's fonts stay in place", () => {
		for (const [, set] of modes) {
			const fontVariables = Object.keys(set).filter((name) =>
				name.startsWith("--font-")
			);
			expect(fontVariables).toEqual([]);
		}
	});
});

describe("Modern Minimal preset contrast", () => {
	it("keeps its dark primary, destructive and sidebar primary unchanged", () => {
		expect(modernMinimalPreset.dark["--primary"]).toBe(
			"oklch(0.6231 0.1880 259.8145)"
		);
		expect(modernMinimalPreset.dark["--destructive"]).toBe(
			"oklch(0.6368 0.2078 25.3313)"
		);
		expect(modernMinimalPreset.dark["--sidebar-primary"]).toBe(
			"oklch(0.6231 0.1880 259.8145)"
		);
	});

	for (const [mode, set] of [["light", modernMinimalPreset.light]] as const) {
		it(`primary reaches 4.5:1 with white in ${mode} mode`, () => {
			expect(ratio(WHITE, colour(set, "--primary"))).toBeGreaterThanOrEqual(
				MINIMUM_RATIO
			);
		});

		it(`sidebar primary reaches 4.5:1 with white in ${mode} mode`, () => {
			expect(
				ratio(WHITE, colour(set, "--sidebar-primary"))
			).toBeGreaterThanOrEqual(MINIMUM_RATIO);
		});

		it(`destructive reaches 4.5:1 with white in ${mode} mode, also at 90 per cent opacity`, () => {
			const destructive = colour(set, "--destructive");
			const hover = blend(
				destructive,
				colour(set, "--background"),
				HOVER_OPACITY
			);
			expect(ratio(WHITE, destructive)).toBeGreaterThanOrEqual(MINIMUM_RATIO);
			expect(ratio(WHITE, hover)).toBeGreaterThanOrEqual(MINIMUM_RATIO);
		});
	}
});
