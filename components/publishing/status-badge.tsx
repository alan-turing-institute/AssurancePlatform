"use client";

import { Badge } from "@/components/ui/badge";
import type { PublishStatusType } from "@/lib/services/case-response-types";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
	className?: string;
	hasChanges?: boolean;
	status: PublishStatusType;
}

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
					className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-warning"
					title="Changes pending"
				/>
			)}
			{config.label}
		</Badge>
	);
}
