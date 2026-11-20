export type Rgb = [number, number, number];

const OKLCH_PATTERN = /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/;

/** Browsers paint 8-bit channels, so ratios are computed from rounded values. */
export function toEightBit(channel: number): number {
	return Math.round(channel * 255) / 255;
}

export function oklchToRgb(value: string): Rgb {
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

export function ratio(foreground: Rgb, background: Rgb): number {
	const [x, y] = [luminance(foreground), luminance(background)];
	return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
