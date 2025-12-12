import { getPageMap } from "nextra/page-map";
import type { ReactNode } from "react";
import { DocsLayout, DocsNavbar, type PageMapItem } from "@/components/docs";

export const metadata = {
	title: {
		default: "TEA Documentation",
		template: "%s | TEA Documentation",
	},
	description: "Trustworthy and Ethical Assurance Platform Documentation",
};

type DocsLayoutPageProps = {
	children: ReactNode;
};

/**
 * Nextra page map item with optional data from _meta.ts
 */
type NextraPageMapItem = {
	name?: string;
	route?: string;
	title?: string;
	frontMatter?: Record<string, unknown>;
	children?: NextraPageMapItem[];
	data?: Record<string, { title?: string; display?: string }>;
};

/**
 * Process Nextra pageMap to:
 * 1. Filter out items with display: "hidden"
 * 2. Sort items according to _meta.ts order
 * 3. Remove the data objects from children
 * 4. Apply titles from _meta.ts
 */
function processPageMap(items: NextraPageMapItem[]): PageMapItem[] {
	// Find the data object (from _meta.ts) if it exists
	const dataItem = items.find((item) => "data" in item && !item.name);
	const metaData = dataItem?.data || {};

	// Get the ordered keys from metadata
	const orderedKeys = Object.keys(metaData);

	// Filter and transform items
	const processedItems = items
		.filter((item) => {
			// Skip the data object itself
			if ("data" in item && !item.name) {
				return false;
			}
			// Skip items marked as hidden
			if (item.name && metaData[item.name]?.display === "hidden") {
				return false;
			}
			// Skip items without a name (safety check)
			if (!item.name) {
				return false;
			}
			return true;
		})
		.map((item): PageMapItem => {
			const metaInfo = item.name ? metaData[item.name] : undefined;
			return {
				name: item.name || "",
				route: item.route || "",
				title: metaInfo?.title || item.title,
				children: item.children ? processPageMap(item.children) : undefined,
			};
		});

	// Sort items according to _meta.ts order
	processedItems.sort((a, b) => {
		const aIndex = orderedKeys.indexOf(a.name);
		const bIndex = orderedKeys.indexOf(b.name);

		// Items not in metadata go to the end, sorted alphabetically
		if (aIndex === -1 && bIndex === -1) {
			return a.name.localeCompare(b.name);
		}
		if (aIndex === -1) {
			return 1;
		}
		if (bIndex === -1) {
			return -1;
		}
		return aIndex - bIndex;
	});

	return processedItems;
}

/**
 * Find the docs folder entry from the page map and return its processed children.
 * This ensures we only show documentation content, not app routes.
 */
function extractDocsEntries(entries: NextraPageMapItem[]): PageMapItem[] {
	// Find the "docs" folder entry
	const docsFolder = entries.find(
		(entry) => entry.name === "docs" && entry.children
	);

	if (docsFolder?.children) {
		return processPageMap(docsFolder.children);
	}

	// Fallback: process entries directly
	return processPageMap(entries);
}

export default async function DocsLayoutPage({
	children,
}: DocsLayoutPageProps) {
	// Get pageMap and extract only docs content
	const fullPageMap = await getPageMap();
	const pageMap = extractDocsEntries(fullPageMap as NextraPageMapItem[]);

	return (
		<div className="min-h-screen bg-background">
			<DocsNavbar />
			<DocsLayout pageMap={pageMap}>{children}</DocsLayout>
		</div>
	);
}
