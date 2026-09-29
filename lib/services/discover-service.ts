import { logger } from "@/lib/logger";
import { toMediaKey } from "@/lib/media-key";
import { type MediaFetchResult, mediaEtag } from "@/lib/media-response";
import { resolvePublicFeatureImageAddress } from "@/lib/media-routes";
import { prisma } from "@/lib/prisma";
import {
	type PublishedSnapshotMeta,
	publishedSnapshotMetaSchema,
} from "@/lib/schemas/publishable-item";
import { getSectorDisplayName } from "@/lib/sectors";
import { readMedia } from "@/lib/services/file-storage-service";
import type { PublishableItemType } from "@/src/generated/prisma";
import type { ServiceResult } from "@/types/service";

const log = logger.child({ component: "discover-service" });

/**
 * Discover data access (ADR 0003 §4/§6) — reads exclusively from the frozen
 * `PublishedAssuranceCase` snapshot, never the live `AssuranceCase`. This is
 * the "no reach-back into live cases" rule: a published item's public page
 * must render identically regardless of what happens to the source case
 * afterwards.
 */

/**
 * A publishable item's public-facing summary — generic over `type` (ADR
 * 0003 §5) so Discover can list assurance cases (v1.0) and, later, argument
 * patterns with no shape change.
 */
export interface PublishableItemSummary {
	archivedAt: Date | null;
	authors: string | null;
	description: string | null;
	featureImageUrl: string | null;
	id: string;
	publishedAt: Date;
	sector: string | null;
	slug: string;
	title: string;
	type: PublishableItemType;
}

/** A single item's full detail — the summary plus the raw frozen snapshot (for the public JSON API / download). */
export interface PublishableItemDetail extends PublishableItemSummary {
	content: unknown;
}

interface PublishedRecord {
	archivedAt: Date | null;
	content: unknown;
	createdAt: Date;
	description: string | null;
	id: string;
	slug: string;
	title: string;
	type: PublishableItemType;
}

/**
 * Extracts the curated case-information fields (and the source case's own
 * name/description as a fallback) that Discover renders from a snapshot's
 * raw JSON `content`. Never throws on a malformed or legacy-shaped snapshot
 * — a failed parse just yields no metadata, matching
 * `captureCaseInformationForSnapshot`'s "absent, not all-nulls" discipline.
 */
function readSnapshotMeta(content: unknown): PublishedSnapshotMeta {
	const parsed = publishedSnapshotMetaSchema.safeParse(content);
	return parsed.success ? parsed.data : {};
}

function toSummary(record: PublishedRecord): PublishableItemSummary {
	const meta = readSnapshotMeta(record.content);
	return {
		id: record.id,
		type: record.type,
		slug: record.slug,
		title: record.title,
		description:
			meta.caseInformation?.description ??
			record.description ??
			meta.case?.description ??
			null,
		// The frozen snapshot's `sector` may hold a stable ID (post-migration
		// publishes) or a pre-migration display-name string (older, never
		// rewritten, snapshots) — this single choke point resolves either
		// shape to the full sector name every Discover surface renders, so
		// no downstream component needs to know the storage detail (Chris's
		// hard constraint, 2026-08-18: the user must always see the full
		// name).
		sector: getSectorDisplayName(meta.caseInformation?.sector),
		authors: meta.caseInformation?.authors ?? null,
		// The snapshot's raw stored value never leaves the server: an internal
		// key (or a legacy `/uploads/...`/blob address from before publish-time
		// copies existed) is projected to the public, version-scoped route
		// address; a genuine external address and an empty value pass through
		// unchanged.
		featureImageUrl: resolvePublicFeatureImageAddress(
			record.slug,
			record.id,
			meta.caseInformation?.featureImageUrl ?? null
		),
		publishedAt: record.createdAt,
		archivedAt: record.archivedAt,
	};
}

/**
 * Lists every currently-published item for the Discover index. Scoped to
 * `isCurrent: true` — the invariant `publish-service.ts` maintains of
 * exactly one live version per source case — so this is precisely
 * Discover's public set.
 */
export async function getPublishedItems(): ServiceResult<
	PublishableItemSummary[]
> {
	try {
		const records = await prisma.publishedAssuranceCase.findMany({
			where: { isCurrent: true },
			orderBy: { createdAt: "desc" },
		});
		return { data: records.map(toSummary) };
	} catch (error) {
		log.error("Failed to list published items", { error });
		return { error: "Failed to fetch published items" };
	}
}

/**
 * Reads a single published item by its public slug (ADR 0003 §6), scoped to
 * `isCurrent: true` — the same uniqueness domain `generateUniqueSlug`
 * enforces, so a slug always resolves to the one version Discover serves.
 * Returns the full frozen content alongside the summary for the public JSON
 * API and the detail page's download button.
 */
export async function getPublishedItemBySlug(
	slug: string
): ServiceResult<PublishableItemDetail> {
	try {
		const record = await prisma.publishedAssuranceCase.findFirst({
			where: { slug, isCurrent: true },
		});

		if (!record) {
			return { error: "Published item not found" };
		}

		return { data: { ...toSummary(record), content: record.content } };
	} catch (error) {
		log.error("Failed to fetch published item by slug", { error });
		return { error: "Failed to fetch published item" };
	}
}

/**
 * Fetches a published item's feature-image bytes for the public,
 * version-scoped media route — anonymous, no access check, but scoped
 * to exactly the row Discover currently serves for `slug` (`isCurrent:
 * true`, which an archived copy stays until its case is permanently
 * deleted). `versionId` must match that row's own id: a superseded version's
 * address, or any id that isn't the current row, resolves to `not-found`
 * rather than serving stale content — so republishing changes the address
 * and the old one stops working immediately, not just once caches expire.
 */
export async function getPublishedItemMedia(
	slug: string,
	versionId: string
): Promise<MediaFetchResult> {
	const record = await prisma.publishedAssuranceCase.findFirst({
		where: { slug, isCurrent: true },
		select: { id: true, content: true },
	});
	if (!record || record.id !== versionId) {
		return { status: "not-found" };
	}

	const meta = readSnapshotMeta(record.content);
	const stored = meta.caseInformation?.featureImageUrl;
	if (!stored) {
		return { status: "not-found" };
	}

	const key = toMediaKey(stored);
	const media = await readMedia(key);
	if (!media) {
		return { status: "not-found" };
	}

	return {
		status: "ok",
		data: media.data,
		contentType: media.contentType,
		etag: mediaEtag(key),
	};
}
