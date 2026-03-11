import { describe, expect, it } from "vitest";
import type { ThemeVariableSet } from "@/types/theme-preset";
import {
	extractPrimaryFontFamily,
	getRequiredGoogleFonts,
} from "../parse-font-families";

describe("extractPrimaryFontFamily", () => {
	it("should extract unquoted font name", () => {
		expect(extractPrimaryFontFamily("Montserrat, sans-serif")).toBe(
			"Montserrat"
		);
	});

	it("should extract double-quoted font name", () => {
		expect(extractPrimaryFontFamily('"Source Serif 4", Georgia, serif')).toBe(
			"Source Serif 4"
		);
	});

	it("should extract single-quoted font name", () => {
		expect(extractPrimaryFontFamily("'JetBrains Mono', monospace")).toBe(
			"JetBrains Mono"
		);
	});

	it("should handle font name with no fallbacks", () => {
		expect(extractPrimaryFontFamily("Inter")).toBe("Inter");
	});

	it("should handle generic family names", () => {
		expect(extractPrimaryFontFamily("sans-serif")).toBe("sans-serif");
	});

	it("should trim whitespace", () => {
		expect(extractPrimaryFontFamily("  Quicksand , sans-serif")).toBe(
			"Quicksand"
		);
	});
});

describe("getRequiredGoogleFonts", () => {
	it("should return matching Google Font configs", () => {
		const variables: ThemeVariableSet = {
			"--font-sans": "Quicksand, Inter, sans-serif",
			"--font-serif": "Ga Maamli, Georgia, serif",
			"--font-mono": "JetBrains Mono, monospace",
		};

		const fonts = getRequiredGoogleFonts(variables);

		expect(fonts).toHaveLength(3);
		expect(fonts.map((f) => f.family)).toEqual([
			"Quicksand",
			"Ga Maamli",
			"JetBrains Mono",
		]);
	});

	it("should skip fonts not in the registry (e.g. Inter, Georgia)", () => {
		const variables: ThemeVariableSet = {
			"--font-sans": "Inter, sans-serif",
			"--font-serif": "Georgia, serif",
			"--font-mono": "Geist Mono, monospace",
		};

		const fonts = getRequiredGoogleFonts(variables);
		expect(fonts).toHaveLength(0);
	});

	it("should deduplicate fonts used in multiple variables", () => {
		const variables: ThemeVariableSet = {
			"--font-sans": "JetBrains Mono, monospace",
			"--font-mono": "JetBrains Mono, monospace",
		};

		const fonts = getRequiredGoogleFonts(variables);
		expect(fonts).toHaveLength(1);
		expect(fonts[0]!.family).toBe("JetBrains Mono");
	});

	it("should return empty array for preset with no font variables", () => {
		const variables: ThemeVariableSet = {
			"--background": "oklch(0 0 0)",
			"--foreground": "oklch(1 0 0)",
		};

		const fonts = getRequiredGoogleFonts(variables);
		expect(fonts).toHaveLength(0);
	});

	it("should return empty array for empty variable set", () => {
		const fonts = getRequiredGoogleFonts({});
		expect(fonts).toHaveLength(0);
	});
});
