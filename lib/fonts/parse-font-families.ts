import type { ThemeVariableSet } from "@/types/theme-preset";
import type { GoogleFontConfig } from "./google-font-config";
import { GOOGLE_FONT_REGISTRY } from "./google-font-config";

/** Font-related CSS variable names */
const FONT_VARIABLES = ["--font-sans", "--font-serif", "--font-mono"] as const;

/**
 * Extracts the primary (first) font family name from a CSS font-family value.
 * Strips surrounding quotes if present.
 *
 * @example
 * extractPrimaryFontFamily("Montserrat, sans-serif") // "Montserrat"
 * extractPrimaryFontFamily('"Source Serif 4", serif') // "Source Serif 4"
 */
export function extractPrimaryFontFamily(fontValue: string): string {
	const first = fontValue.split(",")[0].trim();
	// Strip matching quotes
	if (
		(first.startsWith('"') && first.endsWith('"')) ||
		(first.startsWith("'") && first.endsWith("'"))
	) {
		return first.slice(1, -1);
	}
	return first;
}

/**
 * Examines font CSS variables in a theme variable set and returns
 * the Google Font configurations needed to load them.
 * Deduplicates by family name.
 */
export function getRequiredGoogleFonts(
	variableSet: ThemeVariableSet
): GoogleFontConfig[] {
	const seen = new Set<string>();
	const result: GoogleFontConfig[] = [];

	for (const variable of FONT_VARIABLES) {
		const value = variableSet[variable];
		if (!value) {
			continue;
		}

		const family = extractPrimaryFontFamily(value);
		if (seen.has(family)) {
			continue;
		}
		seen.add(family);

		const config = GOOGLE_FONT_REGISTRY.get(family);
		if (config) {
			result.push(config);
		}
	}

	return result;
}
