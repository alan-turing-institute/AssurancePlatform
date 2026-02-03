import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ThemePreset } from "@/types/theme-preset";
import { useGoogleFonts } from "../use-google-fonts";

const LINK_ATTR = "data-tea-preset-font";

/** Minimal preset with custom Google Fonts */
const ghibliPreset: ThemePreset = {
	id: "ghibli",
	name: "Ghibli",
	light: {
		"--font-sans": "Quicksand, Inter, sans-serif",
		"--font-serif": "Ga Maamli, Georgia, serif",
		"--font-mono": "JetBrains Mono, monospace",
	},
	dark: {
		"--font-sans": "Quicksand, Inter, sans-serif",
		"--font-serif": "Ga Maamli, Georgia, serif",
		"--font-mono": "JetBrains Mono, monospace",
	},
};

/** Preset with no Google Fonts needed */
const highContrastPreset: ThemePreset = {
	id: "high-contrast",
	name: "High Contrast",
	light: {
		"--background": "oklch(1 0 0)",
	},
	dark: {
		"--background": "oklch(0 0 0)",
	},
};

/** Another preset with different fonts */
const catpuccinPreset: ThemePreset = {
	id: "catpuccin",
	name: "Catppuccin",
	light: {
		"--font-sans": "Montserrat, sans-serif",
		"--font-serif": "Georgia, serif",
		"--font-mono": "Fira Code, monospace",
	},
	dark: {
		"--font-sans": "Montserrat, sans-serif",
		"--font-serif": "Georgia, serif",
		"--font-mono": "Fira Code, monospace",
	},
};

function getManagedLinks(): NodeListOf<Element> {
	return document.head.querySelectorAll(`link[${LINK_ATTR}]`);
}

describe("useGoogleFonts", () => {
	beforeEach(() => {
		// Clear any managed links from previous tests
		for (const el of document.head.querySelectorAll(`link[${LINK_ATTR}]`)) {
			el.remove();
		}
	});

	afterEach(() => {
		for (const el of document.head.querySelectorAll(`link[${LINK_ATTR}]`)) {
			el.remove();
		}
	});

	it("should inject a font link for a preset with Google Fonts", () => {
		renderHook(() => useGoogleFonts(ghibliPreset));

		const links = getManagedLinks();
		expect(links).toHaveLength(1);

		const link = links[0] as HTMLLinkElement;
		expect(link.rel).toBe("stylesheet");
		expect(link.href).toContain("fonts.googleapis.com/css2");
		expect(link.href).toContain("Quicksand");
		expect(link.href).toContain("Ga%20Maamli");
		expect(link.href).toContain("JetBrains%20Mono");
		expect(link.getAttribute(LINK_ATTR)).toBe("ghibli");
	});

	it("should not inject a link for a preset with no Google Fonts", () => {
		renderHook(() => useGoogleFonts(highContrastPreset));

		const links = getManagedLinks();
		expect(links).toHaveLength(0);
	});

	it("should replace the link when switching presets", () => {
		const { rerender } = renderHook(
			({ preset }) => useGoogleFonts(preset),
			{ initialProps: { preset: ghibliPreset } },
		);

		expect(getManagedLinks()).toHaveLength(1);
		const firstHref = (getManagedLinks()[0] as HTMLLinkElement).href;

		rerender({ preset: catpuccinPreset });

		const links = getManagedLinks();
		expect(links).toHaveLength(1);
		const secondHref = (links[0] as HTMLLinkElement).href;
		expect(secondHref).not.toBe(firstHref);
		expect(secondHref).toContain("Montserrat");
		expect(links[0].getAttribute(LINK_ATTR)).toBe("catpuccin");
	});

	it("should remove the link when switching to a preset with no custom fonts", () => {
		const { rerender } = renderHook(
			({ preset }) => useGoogleFonts(preset),
			{ initialProps: { preset: ghibliPreset } },
		);

		expect(getManagedLinks()).toHaveLength(1);

		rerender({ preset: highContrastPreset });

		expect(getManagedLinks()).toHaveLength(0);
	});

	it("should clean up the link on unmount", () => {
		const { unmount } = renderHook(() => useGoogleFonts(ghibliPreset));

		expect(getManagedLinks()).toHaveLength(1);

		unmount();

		expect(getManagedLinks()).toHaveLength(0);
	});

	it("should not re-inject when rerendered with the same preset", () => {
		const { rerender } = renderHook(
			({ preset }) => useGoogleFonts(preset),
			{ initialProps: { preset: ghibliPreset } },
		);

		const link = getManagedLinks()[0];

		rerender({ preset: ghibliPreset });

		// Same DOM element should still be there
		expect(getManagedLinks()[0]).toBe(link);
	});
});
