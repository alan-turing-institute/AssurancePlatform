import type { PublishableItemTypeResponse } from "@/lib/schemas/publishable-item";

/**
 * Human-readable labels for a publishable item's type (ADR 0003 §5) — the
 * single place the Discover UI's type badge and any future item listing
 * translate the discriminator into copy. A published case is a "Worked
 * example"; a published pattern is a "Reusable template".
 */
export const PUBLISHABLE_ITEM_TYPE_LABELS: Record<
	PublishableItemTypeResponse,
	string
> = {
	ASSURANCE_CASE: "Worked example",
	ARGUMENT_PATTERN: "Reusable template",
};
