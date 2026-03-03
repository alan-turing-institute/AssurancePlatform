"use client";

import { useEffect, useState } from "react";

const DARK_LOGO = "/images/logos/tea-logo-full-dark.png";
const LIGHT_LOGO = "/images/logos/tea-logo-full-light.png";
const OKLCH_LIGHTNESS_RE = /oklch\(\s*([\d.]+)/;

/**
 * Returns the correct logo path based on sidebar background lightness.
 *
 * Reads the computed `--sidebar` CSS variable (OKLCH format), parses the
 * lightness value (first number), and returns:
 * - LIGHT_LOGO (dark text) for light sidebars (L > 0.5)
 * - DARK_LOGO (white text) for dark sidebars (L <= 0.5)
 */
export function useSidebarLogo(): string {
	const [logo, setLogo] = useState(DARK_LOGO);

	useEffect(() => {
		function updateLogo() {
			const raw = getComputedStyle(document.documentElement)
				.getPropertyValue("--sidebar")
				.trim();

			if (!raw) {
				setLogo(DARK_LOGO);
				return;
			}

			// Extract lightness from oklch(L C H) — L is the first number
			const match = raw.match(OKLCH_LIGHTNESS_RE);
			if (match) {
				const lightness = Number.parseFloat(match[1] ?? "0");
				setLogo(lightness > 0.5 ? LIGHT_LOGO : DARK_LOGO);
			}
		}

		updateLogo();

		// Re-check when theme changes via class mutation on <html>
		const observer = new MutationObserver(updateLogo);
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class", "style"],
		});

		return () => observer.disconnect();
	}, []);

	return logo;
}
