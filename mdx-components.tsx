import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";
import Image from "next/image";
import type { ComponentProps } from "react";

/**
 * Custom image component that renders images without the zoom/expand behaviour.
 * Uses Next.js Image for optimisation.
 *
 * Typed against the plain `<img>` element (the shape the MDX `img` slot
 * expects), not `next/image`'s `ImageProps` — content supplies `src` as a
 * literal string (see `remarkImageOptions.useImport: false` in
 * `source.config.ts`), never a `StaticImport`.
 */
function MdxImage({ src, alt, title }: ComponentProps<"img">) {
	if (!src || typeof src !== "string") {
		return null;
	}

	// Only optimise local images (starting with "/")
	const isLocalImage = src.startsWith("/");

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
 *
 * `defaultMdxComponents` already registers Callout and Card/Cards; Tabs/Tab
 * are added on top. Deliberately nothing else from Fumadocs is registered
 * here (no Steps, Accordion, TypeTable, Banner, Files) — a simpler component
 * set, consistent with the TEA canvas.
 *
 * Note: Curriculum components with client-side functionality (React hooks, contexts)
 * should be imported directly in MDX files rather than registered here,
 * as they require "use client" directive and can't be used in server components.
 */
export function getMDXComponents(components?: MDXComponents): MDXComponents {
	return {
		...defaultMdxComponents,
		Tab,
		Tabs,
		...components,
		// Override the default img component to disable zoom behaviour
		img: MdxImage,
	};
}
