"use client";

import { useEffect } from "react";
import { buildGoogleFontsUrl } from "@/lib/fonts/build-google-fonts-url";
import { getRequiredGoogleFonts } from "@/lib/fonts/parse-font-families";
import type { ThemePreset } from "@/types/theme-preset";

/** Attribute used to identify managed font `<link>` elements */
const LINK_ATTR = "data-tea-preset-font";

/**
 * Injects a Google Fonts `<link rel="stylesheet">` into `<head>` when
 * the active preset requires fonts not bundled with the app.
 *
 * Cleans up old links when the preset changes or on unmount.
 */
export function useGoogleFonts(preset: ThemePreset): void {
	useEffect(() => {
		// Use light set — fonts are the same in both light and dark
		const fonts = getRequiredGoogleFonts(preset.light);
		const url = buildGoogleFontsUrl(fonts);

		// Remove any previous managed link
		const existing = document.head.querySelector(`link[${LINK_ATTR}]`);
		if (existing) {
			existing.remove();
		}

		// Nothing to load for this preset
		if (!url) {
			return;
		}

		const link = document.createElement("link");
		link.rel = "stylesheet";
		link.href = url;
		link.setAttribute(LINK_ATTR, preset.id);
		document.head.appendChild(link);

		return () => {
			link.remove();
		};
	}, [preset.id, preset.light]);
}
