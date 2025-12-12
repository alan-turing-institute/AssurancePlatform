"use client";

import { ChevronDown, ChevronRight, FileText, FolderOpen } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

/**
 * Represents a single item in the documentation page map.
 */
export type PageMapItem = {
	/** The name/slug of the item */
	name: string;
	/** The route path for the item */
	route: string;
	/** Display title (from _meta.json or frontmatter) */
	title?: string;
	/** Type of item - page, folder, or separator */
	type?: "page" | "folder" | "separator";
	/** Child items for folders */
	children?: PageMapItem[];
};

type DocsSidebarProps = {
	/** The page map from Nextra */
	pageMap: PageMapItem[];
	/** Optional className for the container */
	className?: string;
};

type SidebarItemProps = {
	item: PageMapItem;
	depth?: number;
};

/**
 * Converts a slug/name to a human-readable title.
 */
function formatTitle(name: string | undefined): string {
	if (!name) {
		return "Untitled";
	}
	return name.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Renders a single sidebar item, handling both pages and folders.
 */
function SidebarItem({ item, depth = 0 }: SidebarItemProps) {
	const pathname = usePathname();
	const [isOpen, setIsOpen] = useState(() => {
		// Auto-expand if current path is within this folder
		if (item.children) {
			return pathname.startsWith(item.route);
		}
		return false;
	});

	const isActive = pathname === item.route;
	const hasChildren = item.children && item.children.length > 0;
	const displayTitle = item.title || formatTitle(item.name);

	// Handle separator type
	if (item.type === "separator") {
		return (
			<div className="my-2 px-3">
				<div className="h-px bg-border" />
			</div>
		);
	}

	// Handle folder with children
	if (hasChildren) {
		return (
			<div className="flex flex-col">
				<Button
					className={cn(
						"h-auto justify-start gap-2 px-3 py-2 font-normal",
						"hover:bg-accent hover:text-accent-foreground",
						depth > 0 && "pl-6"
					)}
					onClick={() => setIsOpen(!isOpen)}
					style={{
						paddingLeft: depth > 0 ? `${depth * 12 + 12}px` : undefined,
					}}
					variant="ghost"
				>
					{isOpen ? (
						<ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
					) : (
						<ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
					)}
					<FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
					<span className="truncate">{displayTitle}</span>
				</Button>
				{isOpen && (
					<div className="flex flex-col">
						{item.children?.map((child) => (
							<SidebarItem depth={depth + 1} item={child} key={child.route} />
						))}
					</div>
				)}
			</div>
		);
	}

	// Handle regular page
	return (
		<Link
			className={cn(
				"flex items-center gap-2 px-3 py-2 text-sm transition-colors",
				"rounded-md hover:bg-accent hover:text-accent-foreground",
				isActive && "bg-accent font-medium text-accent-foreground",
				!isActive && "text-muted-foreground",
				depth > 0 && "pl-6"
			)}
			href={item.route}
			style={{ paddingLeft: depth > 0 ? `${depth * 12 + 12}px` : undefined }}
		>
			<FileText className="h-4 w-4 shrink-0" />
			<span className="truncate">{displayTitle}</span>
		</Link>
	);
}

/**
 * DocsSidebar - Collapsible sidebar navigation for documentation pages.
 *
 * Features:
 * - Hierarchical navigation with collapsible folders
 * - Active page highlighting
 * - Auto-expansion of current section
 * - Smooth scrolling with ScrollArea
 * - Dark mode support
 */
export function DocsSidebar({ pageMap, className }: DocsSidebarProps) {
	return (
		<aside
			className={cn(
				"sticky top-16 h-[calc(100vh-4rem)] w-64 shrink-0",
				"border-border border-r bg-background",
				className
			)}
		>
			<ScrollArea className="h-full px-2 py-6">
				<nav className="flex flex-col gap-1">
					{pageMap.map((item) => (
						<SidebarItem item={item} key={item.route || item.name} />
					))}
				</nav>
			</ScrollArea>
		</aside>
	);
}

export default DocsSidebar;
