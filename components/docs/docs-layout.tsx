"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { DocsSidebar, type PageMapItem } from "./docs-sidebar";

type DocsLayoutProps = {
	/** Child content (MDX page) */
	children: ReactNode;
	/** The page map from Nextra for sidebar navigation */
	pageMap: PageMapItem[];
	/** Optional className for the main content area */
	className?: string;
};

/**
 * DocsLayout - Main layout wrapper for documentation pages.
 *
 * Features:
 * - Responsive sidebar navigation
 * - Prose styling for MDX content
 * - Dark mode support
 * - Consistent with TEA Platform design system
 */
export function DocsLayout({ children, pageMap, className }: DocsLayoutProps) {
	return (
		<div className="flex min-h-screen">
			<DocsSidebar pageMap={pageMap} />
			<main
				className={cn("flex-1 overflow-auto", "px-8 py-10 lg:px-12", className)}
			>
				<article
					className={cn(
						"prose prose-slate dark:prose-invert max-w-4xl",
						// Headings
						"prose-headings:scroll-mt-20",
						"prose-h1:font-bold prose-h1:text-3xl prose-h1:tracking-tight",
						"prose-h2:border-border prose-h2:border-b prose-h2:pb-2 prose-h2:font-semibold prose-h2:text-2xl",
						"prose-h3:font-semibold prose-h3:text-xl",
						// Links
						"prose-a:text-primary prose-a:no-underline hover:prose-a:underline",
						// Code
						"prose-code:rounded prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:text-sm",
						"prose-code:before:content-none prose-code:after:content-none",
						"prose-pre:border prose-pre:border-border prose-pre:bg-muted",
						// Lists
						"prose-li:marker:text-muted-foreground",
						// Tables
						"prose-table:border prose-table:border-border",
						"prose-th:border prose-th:border-border prose-th:bg-muted prose-th:px-4 prose-th:py-2",
						"prose-td:border prose-td:border-border prose-td:px-4 prose-td:py-2",
						// Blockquotes
						"prose-blockquote:border-l-primary prose-blockquote:bg-muted/50 prose-blockquote:px-4 prose-blockquote:py-1"
					)}
				>
					{children}
				</article>
			</main>
		</div>
	);
}

export default DocsLayout;
