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

/**
 * Recursively strips any `comments` key (and, with it, every commenter
 * identity field the comment entries carry — author, which may be a
 * username or an email) from a snapshot's `content` before it ever reaches
 * a public response.
 *
 * Defence in depth (privacy fix, Chris's ruling 2026-08-11 — BOTH layers):
 * `publish-service.ts`'s `composeSnapshotContent` no longer captures
 * comments into new snapshots at all, but snapshots published before that
 * fix still have them embedded in stored `content`. Walking the whole value
 * generically (rather than assuming today's `tree`/`children`/
 * `evidenceLinksTo` shape) means this strips comments wherever they sit —
 * current tree nodes, legacy shapes, or a future nested location — without
 * needing to track every place `comments` could appear.
 */
function stripComments(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map(stripComments);
	}
	if (value !== null && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>)
				.filter(([key]) => key !== "comments")
				.map(([key, nested]) => [key, stripComments(nested)])
		);
	}
	return value;
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

/**
 * Transform a published item's full detail (summary + frozen content) for
 * API response. `content` is stripped of comments (`stripComments`) here —
 * the single choke point both the public JSON API
 * (`GET /api/public/discover/[slug]`) and the Discover detail page's
 * Download JSON button (via `actions/discover.ts`'s `fetchPublishedItemBySlug`)
 * pass through, so both surfaces get the strip for free.
 */
export function transformPublishableItemDetailForApi(
	item: PublishableItemDetail
): PublishableItemDetailResponse {
	return {
		...transformPublishableItemForApi(item),
		content: stripComments(item.content),
	};
}
