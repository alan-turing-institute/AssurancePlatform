import { describe, expect, it } from "vitest";
import { buildGoogleFontsUrl } from "../build-google-fonts-url";
import type { GoogleFontConfig } from "../google-font-config";

describe("buildGoogleFontsUrl", () => {
	it("should return empty string for empty array", () => {
		expect(buildGoogleFontsUrl([])).toBe("");
	});

	it("should build URL for a single font with weights", () => {
		const fonts: GoogleFontConfig[] = [
			{ family: "Montserrat", weights: [400, 700] },
		];
		const url = buildGoogleFontsUrl(fonts);

		expect(url).toBe(
			"https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700&display=swap",
		);
	});

	it("should encode spaces in font family names", () => {
		const fonts: GoogleFontConfig[] = [
			{ family: "JetBrains Mono", weights: [400, 500, 700] },
		];
		const url = buildGoogleFontsUrl(fonts);

		expect(url).toContain("family=JetBrains%20Mono");
		expect(url).toContain("wght@400;500;700");
		expect(url).toMatch(/&display=swap$/);
	});

	it("should handle italic fonts with ital,wght axis", () => {
		const fonts: GoogleFontConfig[] = [
			{ family: "Source Serif 4", weights: [400, 600, 700], italic: true },
		];
		const url = buildGoogleFontsUrl(fonts);

		expect(url).toContain("family=Source%20Serif%204:ital,wght@");
		expect(url).toContain("0,400;0,600;0,700;1,400;1,600;1,700");
	});

	it("should combine multiple font families", () => {
		const fonts: GoogleFontConfig[] = [
			{ family: "Quicksand", weights: [400, 500, 600, 700] },
			{ family: "Ga Maamli", weights: [400] },
			{ family: "JetBrains Mono", weights: [400, 500, 700] },
		];
		const url = buildGoogleFontsUrl(fonts);

		expect(url).toContain("family=Quicksand:wght@400;500;600;700");
		expect(url).toContain("family=Ga%20Maamli:wght@400");
		expect(url).toContain("family=JetBrains%20Mono:wght@400;500;700");
		// display=swap should appear once at the end
		expect(url).toMatch(/&display=swap$/);
	});

	it("should always include display=swap", () => {
		const fonts: GoogleFontConfig[] = [
			{ family: "Outfit", weights: [400] },
		];
		const url = buildGoogleFontsUrl(fonts);

		expect(url).toContain("display=swap");
	});
});
