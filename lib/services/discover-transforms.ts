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
import { getSectorDisplayName } from "@/lib/sectors";
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

/**
 * Resolves `content.caseInformation.sector` to the full canonical display
 * name before a frozen snapshot's `content` is ever served (Chris's hard
 * constraint, 2026-08-18 — the stable ID is a storage detail, never
 * UI/API surface). `discover-service.ts`'s `toSummary` already does this
 * for the top-level summary `sector` field via `getSectorDisplayName`; this
 * is the equivalent choke point for the embedded snapshot `content` that
 * `transformPublishableItemDetailForApi` passes through — otherwise a
 * post-migration snapshot serves the bare stable ID (e.g. `"15"`) inside
 * `content.caseInformation.sector` even though the top-level `sector` field
 * next to it is already resolved.
 *
 * Handles both stored shapes via `getSectorDisplayName` itself: a
 * post-migration stable ID resolves to its `Name`; a pre-migration snapshot
 * that already stored a display name, or genuinely unmappable legacy free
 * text, passes through verbatim (there is nothing to resolve it to).
 *
 * Non-destructive and defensive, matching `readSnapshotMeta` in
 * `discover-service.ts`: never mutates the stored snapshot, and any shape
 * that doesn't match `{ caseInformation: { sector } }` (missing, malformed,
 * non-object) is returned unchanged rather than throwing.
 */
function resolveSectorInContent(content: unknown): unknown {
	if (
		content === null ||
		typeof content !== "object" ||
		Array.isArray(content)
	) {
		return content;
	}
	const record = content as Record<string, unknown>;
	const caseInformation = record.caseInformation;
	if (
		caseInformation === null ||
		typeof caseInformation !== "object" ||
		Array.isArray(caseInformation)
	) {
		return content;
	}
	const caseInfoRecord = caseInformation as Record<string, unknown>;
	if (!("sector" in caseInfoRecord)) {
		return content;
	}
	const sector = caseInfoRecord.sector;
	if (sector !== null && typeof sector !== "string") {
		return content;
	}
	return {
		...record,
		caseInformation: {
			...caseInfoRecord,
			sector: getSectorDisplayName(sector),
		},
	};
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
 * API response. `content` is stripped of comments (`stripComments`) and has
 * its embedded `caseInformation.sector` resolved to the full display name
 * (`resolveSectorInContent`) here — the single choke point both the public
 * JSON API (`GET /api/public/discover/[slug]`) and the Discover detail
 * page's Download JSON button (via `actions/discover.ts`'s
 * `fetchPublishedItemBySlug`) pass through, so both surfaces get both fixes
 * for free.
 */
export function transformPublishableItemDetailForApi(
	item: PublishableItemDetail
): PublishableItemDetailResponse {
	return {
		...transformPublishableItemForApi(item),
		content: stripComments(resolveSectorInContent(item.content)),
	};
}
