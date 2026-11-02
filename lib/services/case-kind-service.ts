import { logger } from "@/lib/logger";
import { canAccessCase } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import type { CaseKind } from "@/lib/schemas/case-export";
import {
	type AssuranceCaseSummary,
	listOwnAndDirectlySharedCases,
} from "@/lib/services/case-fetch-service";
import { emitSSEEvent } from "@/lib/services/sse-connection-manager";
import type { ServiceResult } from "@/types/service";

const log = logger.child({ component: "case-kind-service" });

const PERMISSION_DENIED = "Permission denied";
const CHANGED_MEANWHILE = "The case changed while converting it. Try again";

/** What the confirmation dialog tells the person converting a case. */
export interface ConversionConsequences {
	/** Other cases that cite this one through an away goal or a module. */
	citingCases: number;
	/**
	 * Other people it is shared with directly: not the person asking, and not
	 * integration accounts.
	 */
	people: number;
	/** Teams it is shared with. */
	teams: number;
}

function noun(kind: CaseKind): string {
	return kind === "PATTERN" ? "pattern" : "case";
}

/**
 * Why a conversion changed no row, read after the fact so the message names
 * the cause. A case the caller cannot see answers with the permission error,
 * as everywhere else, so a refusal never confirms that a trashed or missing
 * case exists.
 */
async function explainRefusal(
	caseId: string,
	targetKind: CaseKind
): Promise<string> {
	const current = await prisma.assuranceCase.findUnique({
		where: { id: caseId },
		select: {
			deletedAt: true,
			kind: true,
			published: true,
			publishStatus: true,
			_count: { select: { publishedVersions: true } },
		},
	});
	if (!current || current.deletedAt) {
		return PERMISSION_DENIED;
	}
	if (current.kind === targetKind) {
		return `This is already a ${noun(targetKind)}`;
	}
	if (current.published || current.publishStatus !== "DRAFT") {
		return `Unpublish this ${noun(current.kind)} before converting it`;
	}
	if (current._count.publishedVersions > 0) {
		return `Remove this ${noun(current.kind)}'s copy from Discover before converting it`;
	}
	return CHANGED_MEANWHILE;
}

/**
 * Turns a case into a pattern, or a pattern back into a case, in place.
 * Requires ADMIN permission on the case.
 *
 * One conditional write does the work: it changes a row only if the case is
 * not in the trash, is a draft, has no published copy (live or archived) and
 * has the opposite kind. A write that changes no row is refused, so a publish
 * or a second conversion that lands first cannot be overwritten. Nothing
 * else changes: elements, sharing, plugin data and integration grants stay as
 * they are.
 */
export async function convertCaseKind(
	userId: string,
	caseId: string,
	targetKind: CaseKind
): ServiceResult<{ kind: CaseKind }> {
	const allowed = await canAccessCase({ userId, caseId }, "ADMIN");
	if (!allowed) {
		return { error: PERMISSION_DENIED };
	}

	try {
		const { count } = await prisma.assuranceCase.updateMany({
			where: {
				id: caseId,
				deletedAt: null,
				published: false,
				publishStatus: "DRAFT",
				kind: targetKind === "PATTERN" ? "CASE" : "PATTERN",
				publishedVersions: { none: {} },
			},
			data: { kind: targetKind },
		});
		if (count === 0) {
			return { error: await explainRefusal(caseId, targetKind) };
		}

		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: { username: true },
		});
		emitSSEEvent("case:updated", caseId, {
			action: "kind-changed",
			kind: targetKind,
			userId,
			username: user?.username ?? "Someone",
		});

		return { data: { kind: targetKind } };
	} catch (error) {
		log.error("convertCaseKind", { userId, caseId, targetKind, error });
		return { error: "Failed to convert the case" };
	}
}

/**
 * What converting a case would affect, for the confirmation dialog: how many
 * people and teams it is shared with, and how many other cases cite it.
 * Requires ADMIN permission, the same as the conversion.
 */
export async function getConversionConsequences(
	userId: string,
	caseId: string
): ServiceResult<ConversionConsequences> {
	const allowed = await canAccessCase({ userId, caseId }, "ADMIN");
	if (!allowed) {
		return { error: PERMISSION_DENIED };
	}

	try {
		const [current, people, teams, citingCases] = await Promise.all([
			prisma.assuranceCase.findUnique({
				where: { id: caseId, deletedAt: null },
				select: { id: true },
			}),
			prisma.casePermission.count({
				where: {
					caseId,
					userId: { not: userId },
					user: { isSystemUser: false },
				},
			}),
			prisma.caseTeamPermission.count({ where: { caseId } }),
			prisma.assuranceCase.count({
				where: {
					id: { not: caseId },
					deletedAt: null,
					elements: {
						some: {
							deletedAt: null,
							elementType: { in: ["AWAY_GOAL", "MODULE"] },
							moduleReferenceId: caseId,
						},
					},
				},
			}),
		]);
		if (!current) {
			return { error: PERMISSION_DENIED };
		}

		return { data: { people, teams, citingCases } };
	} catch (error) {
		log.error("getConversionConsequences", { userId, caseId, error });
		return { error: "Failed to read what converting would affect" };
	}
}

/**
 * Fetches the patterns the user owns or has been given directly: the My
 * Patterns list. Mirrors `listUserCases`, with the kind the other way round.
 * Excludes soft-deleted patterns.
 */
export async function listUserPatterns(
	userId: string
): ServiceResult<AssuranceCaseSummary[]> {
	try {
		return {
			data: await listOwnAndDirectlySharedCases(userId, "PATTERN"),
		};
	} catch (error) {
		log.error("listUserPatterns", { userId, error });
		return { error: "Failed to fetch patterns" };
	}
}
