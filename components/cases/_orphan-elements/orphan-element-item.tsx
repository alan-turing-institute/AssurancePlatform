"use client";

import {
	BookOpenText,
	Database,
	FolderOpenDot,
	Route,
	Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { OrphanElement } from "./use-orphan-actions";

export type OrphanElementItemProps = {
	orphan: OrphanElement;
	onSelect: (orphan: OrphanElement) => void;
	onDelete: (orphan: OrphanElement) => void;
	loading: boolean;
	className?: string;
};

export function OrphanElementItem({
	orphan,
	onSelect,
	onDelete,
	loading,
	className,
}: OrphanElementItemProps) {
	const description =
		"short_description" in orphan && orphan.short_description
			? orphan.short_description
			: "No description";

	return (
		<div className={cn("group flex items-center gap-1", className)}>
			<button
				aria-label={
					("short_description" in orphan && orphan.short_description) ||
					orphan.name ||
					`${orphan.type} element`
				}
				className="flex flex-1 items-center rounded-md p-2 text-sm hover:cursor-pointer hover:bg-primary/80"
				onClick={() => onSelect(orphan)}
				type="button"
			>
				{orphan.type === "Evidence" && (
					<Database className="h-5 w-5 shrink-0" />
				)}
				{orphan.type === "Strategy" && <Route className="h-5 w-5 shrink-0" />}
				{orphan.type === "PropertyClaim" && (
					<FolderOpenDot className="h-5 w-5 shrink-0" />
				)}
				{orphan.type === "Context" && (
					<BookOpenText className="h-5 w-5 shrink-0" />
				)}
				{orphan.name && (
					<span className="ml-2 font-semibold text-primary">{orphan.name}</span>
				)}
				{/* Separator dot */}
				<svg
					aria-hidden="true"
					className="mx-2 inline h-0.5 w-0.5 shrink-0 fill-current"
					viewBox="0 0 2 2"
				>
					<circle cx={1} cy={1} r={1} />
				</svg>
				<span className="truncate text-left">{description}</span>
			</button>
			<button
				aria-label={`Delete ${orphan.name || orphan.type}`}
				className="rounded-md p-2 text-rose-500 opacity-0 transition-opacity hover:bg-rose-500/10 group-hover:opacity-100"
				disabled={loading}
				onClick={(e) => {
					e.stopPropagation();
					onDelete(orphan);
				}}
				type="button"
			>
				<Trash2 className="h-4 w-4" />
			</button>
		</div>
	);
}
