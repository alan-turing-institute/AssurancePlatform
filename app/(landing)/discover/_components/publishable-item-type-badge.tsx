import { Badge } from "@/components/ui/badge";
import { PUBLISHABLE_ITEM_TYPE_LABELS } from "@/lib/publishable-item-labels";
import type { PublishableItemTypeResponse } from "@/lib/schemas/publishable-item";
import { cn } from "@/lib/utils";

interface PublishableItemTypeBadgeProps {
	className?: string;
	type: PublishableItemTypeResponse;
}

/**
 * Renders a publishable item's type as a badge (ADR 0003 §5 — "worked
 * example" for a published case, "reusable template" for a published
 * pattern).
 */
const PublishableItemTypeBadge = ({
	className,
	type,
}: PublishableItemTypeBadgeProps) => (
	<Badge className={cn("font-medium", className)} variant="secondary">
		{PUBLISHABLE_ITEM_TYPE_LABELS[type]}
	</Badge>
);

export default PublishableItemTypeBadge;
