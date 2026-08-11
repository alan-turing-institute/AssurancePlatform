/**
 * Discover / Publishable Item Transform Utilities
 *
 * Pure transformation functions for converting the discover-service's
 * Prisma-derived shapes into API response formats. Kept separate from
 * `actions/discover.ts` to avoid that file's "use server" requirement that
 * every exported function be async — same rationale as
 * `case-study-transforms.ts`.
 */

import type { PublishableItemTypeResponse } from "@/lib/schemas/publishable-item";
import type {
	PublishableItemDetail,
	PublishableItemSummary,
} from "@/lib/services/discover-service";

export interface PublishableItemSummaryResponse {
	authors: string | null;
	description: string | null;
	featureImageUrl: string | null;
	id: string;
	publishedAt: string;
	sector: string | null;
	slug: string;
	title: string;
	type: PublishableItemTypeResponse;
}

export interface PublishableItemDetailResponse
	extends PublishableItemSummaryResponse {
	/** The full frozen snapshot (case tree, plugin data, case information) as stored — for the public JSON API and the detail page's download button. */
	content: unknown;
}

/** Transform a single published item summary for API response. */
export function transformPublishableItemForApi(
	item: PublishableItemSummary
): PublishableItemSummaryResponse {
	return {
		id: item.id,
		type: item.type,
		slug: item.slug,
		title: item.title,
		description: item.description,
		sector: item.sector,
		authors: item.authors,
		featureImageUrl: item.featureImageUrl,
		publishedAt: item.publishedAt.toISOString(),
	};
}

/** Transform published items for API response. */
export function transformPublishableItemsForApi(
	items: PublishableItemSummary[]
): PublishableItemSummaryResponse[] {
	return items.map(transformPublishableItemForApi);
}

/** Transform a published item's full detail (summary + frozen content) for API response. */
export function transformPublishableItemDetailForApi(
	item: PublishableItemDetail
): PublishableItemDetailResponse {
	return {
		...transformPublishableItemForApi(item),
		content: item.content,
	};
}
