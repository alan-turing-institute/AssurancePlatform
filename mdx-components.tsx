import type { ImageProps } from "next/image";
import Image from "next/image";
import { useMDXComponents as getThemeComponents } from "nextra-theme-docs";

// Use nextra's MDXComponents type for compatibility
type MDXComponents = ReturnType<typeof getThemeComponents>;

/**
 * Custom image component that renders images without the zoom/expand behaviour.
 * Uses Next.js Image for optimisation.
 */
function MdxImage({ src, alt, title }: ImageProps) {
	if (!src) {
		return null;
	}

	// Determine if the image should be optimised
	// Only optimise local images (starting with "/")
	// src can be a string or a StaticImport object
	const srcString = typeof src === "string" ? src : "";
	const isLocalImage = srcString.startsWith("/");

	// Use Next.js Image component for all images
	return (
		<Image
			alt={alt || ""}
			className="h-auto max-w-full rounded-lg"
			height={400}
			src={src}
			style={{ width: "auto", height: "auto", maxWidth: "100%" }}
			title={title}
			unoptimized={!isLocalImage}
			width={800}
		/>
	);
}

/**
 * MDX components for the documentation.
 * This file is required by Nextra 4.x for App Router integration.
 *
 * Uses nextra-theme-docs components for full theme support including
 * callouts, cards, tabs, and other built-in components.
 *
 * Note: Curriculum components with client-side functionality (React hooks, contexts)
 * should be imported directly in MDX files rather than registered here,
 * as they require "use client" directive and can't be used in server components.
 */
export function useMDXComponents(components?: MDXComponents): MDXComponents {
	const themeComponents = getThemeComponents(components ?? {});
	return {
		...themeComponents,
		// Override the default img component to disable zoom behaviour
		img: MdxImage,
	};
}

/**
 * Alias for useMDXComponents that avoids linter warnings about hooks.
 * Use this in non-component contexts.
 */
export const getMDXComponents = useMDXComponents;
