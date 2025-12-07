"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type PublishStatusType = "DRAFT" | "READY_TO_PUBLISH" | "PUBLISHED";

type StatusBadgeProps = {
	status: PublishStatusType;
	hasChanges?: boolean;
	className?: string;
};

const statusConfig: Record<
	PublishStatusType,
	{ label: string; className: string }
> = {
	DRAFT: {
		label: "Draft",
		className:
			"bg-gray-500/10 text-gray-400 ring-gray-500/20 hover:bg-gray-500/20",
	},
	READY_TO_PUBLISH: {
		label: "Ready to Publish",
		className:
			"bg-amber-500/10 text-amber-500 ring-amber-500/20 hover:bg-amber-500/20",
	},
	PUBLISHED: {
		label: "Published",
		className:
			"bg-green-500/10 text-green-400 ring-green-500/20 hover:bg-green-500/20",
	},
};

/**
 * A visual badge showing the current publish status of an assurance case.
 *
 * Status colours:
 * - Draft: Grey
 * - Ready to Publish: Amber
 * - Published: Green (with amber dot if hasChanges)
 */
export function StatusBadge({
	status,
	hasChanges = false,
	className,
}: StatusBadgeProps) {
	const config = statusConfig[status];

	return (
		<Badge
			className={cn(
				"relative inline-flex items-center rounded-md border-none px-3 py-1 font-medium text-xs ring-1 ring-inset",
				config.className,
				className
			)}
			variant="outline"
		>
			{hasChanges && status === "PUBLISHED" && (
				<span
					aria-hidden="true"
					className="-right-1 -top-1 absolute h-2.5 w-2.5 rounded-full bg-amber-500"
					title="Changes pending"
				/>
			)}
			{config.label}
		</Badge>
	);
}
