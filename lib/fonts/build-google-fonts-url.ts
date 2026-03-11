import type { GoogleFontConfig } from "./google-font-config";

/**
 * Builds a Google Fonts CSS API v2 URL for the given font configurations.
 *
 * @example
 * buildGoogleFontsUrl([{ family: "Montserrat", weights: [400, 700] }])
 * // "https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700&display=swap"
 */
export function buildGoogleFontsUrl(fonts: GoogleFontConfig[]): string {
	if (fonts.length === 0) {
		return "";
	}

	const families = fonts.map((font) => {
		const encodedFamily = encodeURIComponent(font.family);

		if (font.italic) {
			const tuples = [
				...font.weights.map((w) => `0,${w}`),
				...font.weights.map((w) => `1,${w}`),
			].join(";");
			return `family=${encodedFamily}:ital,wght@${tuples}`;
		}

		const weightList = font.weights.join(";");
		return `family=${encodedFamily}:wght@${weightList}`;
	});

	return `https://fonts.googleapis.com/css2?${families.join("&")}&display=swap`;
}
