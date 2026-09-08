import type { PublishableItemTypeResponse } from "@/lib/schemas/publishable-item";

/**
 * Human-readable labels for a publishable item's type (ADR 0003 §5) — the
 * single place the Discover UI's type badge and any future item listing
 * translate the discriminator into copy. Only `ASSURANCE_CASE` ships in
 * 1.0; `ARGUMENT_PATTERN` is included now so the fast-follow issue that
 * publishes reusable pattern templates needs no rework here.
 */
export const PUBLISHABLE_ITEM_TYPE_LABELS: Record<
	PublishableItemTypeResponse,
	string
> = {
	ASSURANCE_CASE: "Worked example",
	ARGUMENT_PATTERN: "Reusable template",
};
