"use client";

import { buttonVariants } from "fumadocs-ui/components/ui/button";
import { useCopyButton } from "fumadocs-ui/utils/use-copy-button";
import { CopyCheckIcon, LinkIcon } from "lucide-react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { Children, isValidElement } from "react";
import { cn } from "@/lib/utils";

type Types = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
type SafeHeadingProps<T extends Types> = Omit<
	ComponentPropsWithoutRef<T>,
	"as"
> & {
	as?: T;
};

/**
 * Detects whether `node` already contains a link (anything with an `href`
 * prop), at any depth.
 *
 * Fumadocs' own `Heading` component (`fumadocs-ui/components/heading`)
 * unconditionally wraps heading text in `<a href="#id">`, for the
 * click-to-copy-anchor feature. That collides with headings whose own text
 * is itself a markdown link — e.g. this project's changelog, where
 * semantic-release generates headings shaped like
 * `## [0.6.1](https://.../compare/...) (2026-09-08)`. Nesting an `<a>`
 * inside an `<a>` is invalid HTML: the browser's parser closes the outer
 * tag early, producing a DOM the server didn't render, which is a React
 * hydration mismatch (error #418) — not a cosmetic issue, the whole page
 * re-renders client-side.
 */
function hasNestedLink(node: ReactNode): boolean {
	let found = false;
	Children.forEach(node, (child) => {
		if (found || !isValidElement(child)) {
			return;
		}
		const props = child.props as { href?: unknown; children?: ReactNode };
		if (typeof props.href === "string") {
			found = true;
			return;
		}
		if (hasNestedLink(props.children)) {
			found = true;
		}
	});
	return found;
}

/**
 * Drop-in replacement for `fumadocs-ui/components/heading`'s `Heading`,
 * used for every `h1`-`h6` in MDX content. Keeps the "copy anchor link"
 * button; only wraps the heading text in a clickable anchor when that text
 * has no link of its own (see `hasNestedLink`).
 */
export function SafeHeading<T extends Types = "h1">({
	as,
	...props
}: SafeHeadingProps<T>) {
	const As = as ?? "h1";
	const [isChecked, onCopy] = useCopyButton(() => {
		if (!props.id) {
			return;
		}
		const url = new URL(window.location.href);
		url.hash = props.id;
		return navigator.clipboard.writeText(url.href);
	});

	if (!props.id) {
		return <As {...props} />;
	}

	const linkable = !hasNestedLink(props.children);

	return (
		<As
			{...props}
			className={cn(
				"group/heading flex scroll-m-28 flex-row items-center gap-1",
				props.className
			)}
		>
			{linkable ? (
				<a data-card="" href={`#${props.id}`}>
					{props.children}
				</a>
			) : (
				props.children
			)}
			<button
				aria-live="polite"
				className={cn(
					buttonVariants({ variant: "ghost", size: "icon-xs" }),
					"not-prose shrink-0 text-fd-muted-foreground opacity-0 transition-opacity group-hover/heading:opacity-100"
				)}
				onClick={onCopy}
				type="button"
			>
				{isChecked ? <CopyCheckIcon /> : <LinkIcon />}
				<span className="sr-only">
					{isChecked ? "Copied Anchor Link" : "Copy Anchor Link"}
				</span>
			</button>
		</As>
	);
}
