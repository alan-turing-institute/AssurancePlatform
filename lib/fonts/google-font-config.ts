/** Weight values supported by Google Fonts API v2 */
type FontWeight = 400 | 500 | 600 | 700;

/** Configuration for a single Google Font family */
export interface GoogleFontConfig {
	/** Font family name exactly as listed on Google Fonts */
	family: string;
	/** Whether to include italic variants */
	italic?: boolean;
	/** Weight values to load */
	weights: readonly FontWeight[];
}

/**
 * Registry of font families that need loading from Google Fonts.
 * Keys are font family names as they appear in preset CSS values.
 * Fonts already available (Inter via next/font, Georgia, system generics) are omitted.
 */
export const GOOGLE_FONT_REGISTRY: ReadonlyMap<string, GoogleFontConfig> =
	new Map<string, GoogleFontConfig>([
		// Sans-serif
		["Montserrat", { family: "Montserrat", weights: [400, 500, 600, 700] }],
		["Quicksand", { family: "Quicksand", weights: [400, 500, 600, 700] }],
		["Outfit", { family: "Outfit", weights: [400, 500, 600, 700] }],

		// Serif
		[
			"Source Serif 4",
			{ family: "Source Serif 4", weights: [400, 600, 700], italic: true },
		],
		["Ga Maamli", { family: "Ga Maamli", weights: [400] }],
		["Merriweather", { family: "Merriweather", weights: [400, 700] }],

		// Monospace
		["JetBrains Mono", { family: "JetBrains Mono", weights: [400, 500, 700] }],
		["Fira Code", { family: "Fira Code", weights: [400, 500, 700] }],
		["Space Mono", { family: "Space Mono", weights: [400, 700] }],
		["Ubuntu Mono", { family: "Ubuntu Mono", weights: [400, 700] }],
	]);
