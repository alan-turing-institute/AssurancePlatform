import { prisma } from "@/lib/prisma";
import {
	type PublishedSnapshotMeta,
	publishedSnapshotMetaSchema,
} from "@/lib/schemas/publishable-item";
import { getSectorDisplayName } from "@/lib/sectors";
import type { PublishableItemType } from "@/src/generated/prisma";
import type { ServiceResult } from "@/types/service";

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
		featureImageUrl: meta.caseInformation?.featureImageUrl ?? null,
		publishedAt: record.createdAt,
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
		console.error("Failed to list published items:", error);
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
		console.error("Failed to fetch published item by slug:", error);
		return { error: "Failed to fetch published item" };
	}
}
