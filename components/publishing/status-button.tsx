"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { PublishStatusType } from "./status-badge";

type StatusButtonProps = {
	status: PublishStatusType;
	hasChanges?: boolean;
	loading?: boolean;
	disabled?: boolean;
	publishedAt?: Date | string | null;
	onClick?: () => void;
	className?: string;
};

const statusConfig: Record<
	PublishStatusType,
	{ label: string; className: string; tooltip: string }
> = {
	DRAFT: {
		label: "Draft",
		className:
			"bg-gray-500/10 text-gray-400 ring-gray-500/20 hover:bg-gray-500/20",
		tooltip: "Click to manage publish status",
	},
	READY_TO_PUBLISH: {
		label: "Ready to Publish",
		className:
			"bg-amber-500/10 text-amber-500 ring-amber-500/20 hover:bg-amber-500/20",
		tooltip: "Ready to link to case studies - click to manage",
	},
	PUBLISHED: {
		label: "Published",
		className:
			"bg-green-500/10 text-green-400 ring-green-500/20 hover:bg-green-500/20",
		tooltip: "Click to manage publish status",
	},
};

/**
 * A clickable button showing the current publish status.
 * Opens the status modal when clicked.
 *
 * Status colours:
 * - Draft: Grey
 * - Ready to Publish: Amber
 * - Published: Green (with amber dot if hasChanges)
 */
export function StatusButton({
	status,
	hasChanges = false,
	loading = false,
	disabled = false,
	publishedAt,
	onClick,
	className,
}: StatusButtonProps) {
	const config = statusConfig[status];

	const formattedDate = publishedAt
		? new Date(publishedAt).toLocaleDateString("en-GB", {
				day: "2-digit",
				month: "2-digit",
				year: "numeric",
				hour: "2-digit",
				minute: "2-digit",
			})
		: null;

	const tooltipContent =
		status === "PUBLISHED" && formattedDate
			? `${config.tooltip} (published ${formattedDate})`
			: config.tooltip;

	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						className={cn(
							"relative inline-flex cursor-pointer items-center rounded-md border-none px-3 py-2 font-medium text-xs ring-1 ring-inset transition-colors",
							config.className,
							"disabled:cursor-not-allowed disabled:opacity-50",
							className
						)}
						disabled={disabled || loading}
						onClick={onClick}
						size="sm"
						type="button"
						variant={null}
					>
						{loading && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
						{hasChanges && status === "PUBLISHED" && (
							<span
								aria-hidden="true"
								className="-right-1 -top-1 absolute h-2.5 w-2.5 rounded-full bg-amber-500"
								title="Changes pending"
							/>
						)}
						{config.label}
					</Button>
				</TooltipTrigger>
				<TooltipContent>
					<p className="text-xs">{tooltipContent}</p>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}
