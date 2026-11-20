import { describe, expect, it } from "vitest";
import type { ThemeVariable, ThemeVariableSet } from "@/types/theme-preset";
import { themePresets } from "../index";
import { modernMinimalPreset } from "../modern-minimal";

type Rgb = [number, number, number];

const OKLCH_PATTERN = /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/;
const MINIMUM_RATIO = 4.5;
const HOVER_OPACITY = 0.9;
const WHITE: Rgb = [1, 1, 1];

/** Browsers paint 8-bit channels, so ratios are computed from rounded values. */
function toEightBit(channel: number): number {
	return Math.round(channel * 255) / 255;
}

function oklchToRgb(value: string): Rgb {
	const match = value.match(OKLCH_PATTERN);
	if (!match) {
		throw new Error(`Not an OKLCH colour: ${value}`);
	}
	const [lightness, chroma, hue] = [
		Number(match[1]),
		Number(match[2]),
		Number(match[3]),
	];
	const a = chroma * Math.cos((hue * Math.PI) / 180);
	const b = chroma * Math.sin((hue * Math.PI) / 180);
	const l = (lightness + 0.396_337_777_4 * a + 0.215_803_757_3 * b) ** 3;
	const m = (lightness - 0.105_561_345_8 * a - 0.063_854_172_8 * b) ** 3;
	const s = (lightness - 0.089_484_177_5 * a - 1.291_485_548 * b) ** 3;
	const linear = [
		4.076_741_662_1 * l - 3.307_711_591_3 * m + 0.230_969_929_2 * s,
		-1.268_438_004_6 * l + 2.609_757_401_1 * m - 0.341_319_396_5 * s,
		-0.004_196_086_3 * l - 0.703_418_614_7 * m + 1.707_614_701 * s,
	];
	return linear.map((channel) => {
		const clamped = Math.min(1, Math.max(0, channel));
		const encoded =
			clamped <= 0.003_130_8
				? 12.92 * clamped
				: 1.055 * clamped ** (1 / 2.4) - 0.055;
		return toEightBit(encoded);
	}) as Rgb;
}

function luminance(rgb: Rgb): number {
	const [r, g, b] = rgb.map((channel) =>
		channel <= 0.040_45 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
	) as Rgb;
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(foreground: Rgb, background: Rgb): number {
	const [x, y] = [luminance(foreground), luminance(background)];
	return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

function colour(set: ThemeVariableSet, name: ThemeVariable): Rgb {
	const value = set[name];
	if (!value) {
		throw new Error(`Missing ${name}`);
	}
	return oklchToRgb(value);
}

function blend(top: Rgb, bottom: Rgb, opacity: number): Rgb {
	return top.map((channel, i) =>
		toEightBit(channel * opacity + (bottom[i] ?? 0) * (1 - opacity))
	) as Rgb;
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
					ratio(colour(set, "--primary-foreground"), colour(set, "--primary"))
				).toBeGreaterThanOrEqual(MINIMUM_RATIO);
			});

			it("destructive reaches 4.5:1 with its foreground, also at 90 per cent opacity", () => {
				const foreground = colour(set, "--destructive-foreground");
				const destructive = colour(set, "--destructive");
				const hover = blend(
					destructive,
					colour(set, "--background"),
					HOVER_OPACITY
				);
				expect(ratio(foreground, destructive)).toBeGreaterThanOrEqual(
					MINIMUM_RATIO
				);
				expect(ratio(foreground, hover)).toBeGreaterThanOrEqual(MINIMUM_RATIO);
			});

			it("muted text reaches 4.5:1 on background, card and muted", () => {
				const text = colour(set, "--muted-foreground");
				for (const surface of ["--background", "--card", "--muted"] as const) {
					expect(ratio(text, colour(set, surface))).toBeGreaterThanOrEqual(
						MINIMUM_RATIO
					);
				}
			});

			it("accent text reaches 4.5:1 on accent", () => {
				expect(
					ratio(colour(set, "--accent-foreground"), colour(set, "--accent"))
				).toBeGreaterThanOrEqual(MINIMUM_RATIO);
			});

			it("sidebar accent text reaches 4.5:1 on sidebar accent", () => {
				expect(
					ratio(
						colour(set, "--sidebar-accent-foreground"),
						colour(set, "--sidebar-accent")
					)
				).toBeGreaterThanOrEqual(MINIMUM_RATIO);
			});

			it("sidebar muted text reaches 4.5:1 on the sidebar", () => {
				expect(
					ratio(colour(set, "--sidebar-muted"), colour(set, "--sidebar"))
				).toBeGreaterThanOrEqual(MINIMUM_RATIO);
			});

			it("sidebar text at 70 per cent opacity reaches 4.5:1 on the sidebar", () => {
				const sidebar = colour(set, "--sidebar");
				const text = blend(colour(set, "--sidebar-foreground"), sidebar, 0.7);
				expect(ratio(text, sidebar)).toBeGreaterThanOrEqual(MINIMUM_RATIO);
			});

			it("body text reaches 4.5:1 at 70 per cent opacity on card and 80 per cent on background", () => {
				const foreground = colour(set, "--foreground");
				const card = colour(set, "--card");
				const background = colour(set, "--background");
				expect(
					ratio(blend(foreground, card, 0.7), card)
				).toBeGreaterThanOrEqual(MINIMUM_RATIO);
				expect(
					ratio(blend(foreground, background, 0.8), background)
				).toBeGreaterThanOrEqual(MINIMUM_RATIO);
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
