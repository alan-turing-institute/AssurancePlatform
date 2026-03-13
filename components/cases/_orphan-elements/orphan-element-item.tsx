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

export interface OrphanElementItemProps {
	className?: string;
	loading: boolean;
	onDelete: (orphan: OrphanElement) => void;
	onSelect: (orphan: OrphanElement) => void;
	orphan: OrphanElement;
}

export function OrphanElementItem({
	orphan,
	onSelect,
	onDelete,
	loading,
	className,
}: OrphanElementItemProps) {
	const description =
		"description" in orphan && orphan.description
			? orphan.description
			: "No description";

	return (
		<div className={cn("group flex items-center gap-1", className)}>
			<button
				aria-label={
					("description" in orphan && orphan.description) ||
					orphan.name ||
					`${orphan.type} element`
				}
				className="flex flex-1 items-center rounded-md p-2 text-sm hover:cursor-pointer hover:bg-primary/80"
				onClick={() => onSelect(orphan)}
				type="button"
			>
				{orphan.type === "evidence" && (
					<Database className="h-5 w-5 shrink-0" />
				)}
				{orphan.type === "strategy" && <Route className="h-5 w-5 shrink-0" />}
				{orphan.type === "property_claim" && (
					<FolderOpenDot className="h-5 w-5 shrink-0" />
				)}
				{orphan.type === "context" && (
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
				className="rounded-md p-2 text-destructive opacity-0 transition-opacity hover:bg-destructive/10 group-hover:opacity-100"
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
