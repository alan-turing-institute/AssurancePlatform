import { canAccessCase } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import type { CaseInformation } from "@/src/generated/prisma";
import type { ServiceResult } from "@/types/service";

/**
 * Case information CRUD (ADR 0003 §1) — the canonical, curatorial record on
 * an assurance case (description, authors, sector, feature image), editable
 * at any time under the case's normal edit permissions. This service owns
 * only the record itself; the publish-time freeze into a snapshot lives in
 * `captureCaseInformationForSnapshot` below and is consumed by
 * `publish-service.ts`, not by callers of the CRUD functions.
 */

export interface CaseInformationInput {
	authors?: string;
	description?: string;
	featureImageUrl?: string;
	sector?: string;
}

/**
 * Reads the case information record for a case. Requires VIEW.
 *
 * Returns `{ data: null }` — not an error — when no record exists yet: a
 * case with no curated information is a normal, common state, not a
 * not-found condition. Returns the same "Permission denied" error for a
 * non-existent case as for an inaccessible one (repo convention — prevents
 * resource-enumeration via this surface).
 */
export async function getCaseInformation(
	userId: string,
	caseId: string
): ServiceResult<CaseInformation | null> {
	const hasAccess = await canAccessCase({ userId, caseId }, "VIEW");
	if (!hasAccess) {
		return { error: "Permission denied" };
	}

	try {
		const record = await prisma.caseInformation.findUnique({
			where: { caseId },
		});
		return { data: record };
	} catch (error) {
		console.error("Failed to get case information:", error);
		return { error: "Failed to fetch case information" };
	}
}

/**
 * Creates or updates the case information record for a case. Requires EDIT.
 * A single upsert, not separate create/update entry points: the record is a
 * 1:1 "save whatever fields are provided" resource (ADR §1 — "editable any
 * time"), so there is no meaningful distinction between "first save" and
 * "later save" for a caller to get right or wrong. Fields left `undefined`
 * are only defaulted to `null` on first creation; on an existing record they
 * are left untouched (only the keys actually provided are written).
 */
export async function upsertCaseInformation(
	userId: string,
	caseId: string,
	data: CaseInformationInput
): ServiceResult<CaseInformation> {
	const hasAccess = await canAccessCase({ userId, caseId }, "EDIT");
	if (!hasAccess) {
		return { error: "Permission denied" };
	}

	try {
		const record = await prisma.caseInformation.upsert({
			where: { caseId },
			create: {
				caseId,
				description: data.description ?? null,
				authors: data.authors ?? null,
				sector: data.sector ?? null,
				featureImageUrl: data.featureImageUrl ?? null,
			},
			update: {
				...(data.description !== undefined && {
					description: data.description,
				}),
				...(data.authors !== undefined && { authors: data.authors }),
				...(data.sector !== undefined && { sector: data.sector }),
				...(data.featureImageUrl !== undefined && {
					featureImageUrl: data.featureImageUrl,
				}),
			},
		});
		return { data: record };
	} catch (error) {
		console.error("Failed to upsert case information:", error);
		return { error: "Failed to save case information" };
	}
}

/**
 * Deletes the case information record for a case, if any. Requires EDIT.
 * A no-op success (not an error) when no record exists — deleting an
 * already-absent record is not a failure condition.
 */
export async function deleteCaseInformation(
	userId: string,
	caseId: string
): ServiceResult<true> {
	const hasAccess = await canAccessCase({ userId, caseId }, "EDIT");
	if (!hasAccess) {
		return { error: "Permission denied" };
	}

	try {
		await prisma.caseInformation.deleteMany({ where: { caseId } });
		return { data: true };
	} catch (error) {
		console.error("Failed to delete case information:", error);
		return { error: "Failed to delete case information" };
	}
}

/** Case-information fields frozen verbatim into a publish snapshot. */
export interface CaseInformationSnapshot {
	authors: string | null;
	description: string | null;
	featureImageUrl: string | null;
	sector: string | null;
}

/**
 * Reads the case information row verbatim for embedding in a publish
 * snapshot (ADR 0003 §3 — "the snapshot freezes metadata as well as
 * content"). Mirrors `capturePluginDataForSnapshot`'s deliberate bypass of
 * the per-call permission guard: the caller (`publish-service.ts`) has
 * already verified case-level EDIT access before calling this, so there is
 * no additional permission check to perform here.
 *
 * Returns `undefined` — never a record of all-nulls — when no case
 * information exists yet, so a snapshot never gains a
 * `caseInformation: { authors: null, ... }` section for a case that was
 * never curated. Same "present data, not undefined key" discipline as
 * `capturePluginDataForSnapshot`.
 */
export async function captureCaseInformationForSnapshot(
	caseId: string
): Promise<CaseInformationSnapshot | undefined> {
	const record = await prisma.caseInformation.findUnique({
		where: { caseId },
		select: {
			description: true,
			authors: true,
			sector: true,
			featureImageUrl: true,
		},
	});
	return record ?? undefined;
}
