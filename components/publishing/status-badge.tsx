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
			"bg-muted-foreground/10 text-muted-foreground ring-muted-foreground/20 hover:bg-muted-foreground/20",
	},
	READY_TO_PUBLISH: {
		label: "Ready to Publish",
		className: "bg-warning/10 text-warning ring-warning/20 hover:bg-warning/20",
	},
	PUBLISHED: {
		label: "Published",
		className: "bg-success/10 text-success ring-success/20 hover:bg-success/20",
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
					className="-right-1 -top-1 absolute h-2.5 w-2.5 rounded-full bg-warning"
					title="Changes pending"
				/>
			)}
			{config.label}
		</Badge>
	);
}
