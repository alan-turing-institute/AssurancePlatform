"use server";

import { notFound } from "next/navigation";
import { publishableItemSlugSchema } from "@/lib/schemas/publishable-item";
import { validateInput } from "@/lib/validation/input-validation";

/**
 * Discover page data access (ADR 0003 §4/§6). Public, anonymous — these
 * actions back the `/discover` index and `/discover/[slug]` detail pages,
 * reading only frozen `PublishedAssuranceCase` snapshots via
 * `discover-service.ts`, never the live case.
 */

/** Fetch every published item for the Discover index. */
export const fetchPublishedItems = async () => {
	const [{ getPublishedItems }, { transformPublishableItemsForApi }] =
		await Promise.all([
			import("@/lib/services/discover-service"),
			import("@/lib/services/discover-transforms"),
		]);

	const result = await getPublishedItems();
	if ("error" in result) {
		return [];
	}
	return transformPublishableItemsForApi(result.data);
};

/**
 * Fetch a single published item by its slug. Calls `notFound()` for an
 * invalid slug shape, an unknown slug, or (per Chris's G1 ruling,
 * 2026-08-11) any legacy numeric `/discover/[id]` path — none of those ever
 * match a real slug, so they all fall through to the same plain 404 with no
 * special-casing or redirect.
 */
export const fetchPublishedItemBySlug = async (slug: string) => {
	const validation = validateInput(slug, publishableItemSlugSchema);
	if (!validation.success) {
		notFound();
	}

	const [{ getPublishedItemBySlug }, { transformPublishableItemDetailForApi }] =
		await Promise.all([
			import("@/lib/services/discover-service"),
			import("@/lib/services/discover-transforms"),
		]);

	const result = await getPublishedItemBySlug(validation.data);
	if ("error" in result) {
		notFound();
	}

	return transformPublishableItemDetailForApi(result.data);
};
