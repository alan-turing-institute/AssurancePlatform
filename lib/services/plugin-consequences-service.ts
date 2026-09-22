import { logger } from "@/lib/logger";
import { getManifestEntry } from "@/lib/plugins/manifest";
import { prisma } from "@/lib/prisma";
import type { ServiceResult } from "@/types/service";

const log = logger.child({ component: "plugin-consequences-service" });

/**
 * The off-switch consequence read (TEA — Plugin management surface D3): what
 * turning a plugin off would mean for the user, informational only — nothing
 * here changes what the switch does. See `resolveEffectivePluginState`
 * (`plugin-enablement-service.ts`) for the state the switch actually writes.
 */

const HEALTH_EVIDENCE_WRITE_SCOPE = "health:evidence:write";

const PLUGIN_NOT_FOUND = "Plugin not found";

export interface PluginDisableConsequences {
	/**
	 * Active integrations that hold `health:evidence:write` and whose
	 * machine account (systemUser) has a direct `CasePermission` on at least
	 * one case the user can access. Never affected by the user's own switch —
	 * see `appendHealthEvidence`'s enablement check, which is scoped to the
	 * integration's own machine account, not the human user (D3 amendment,
	 * cid 2026-09-22).
	 */
	activeIntegrations: Array<{ id: string; name: string }>;
	/** Distinct cases among those evidence records. */
	caseCount: number;
	/** PluginHealthEvidence rows whose claim's case the user can access. */
	evidenceRecordCount: number;
}

const EMPTY_CONSEQUENCES: PluginDisableConsequences = {
	evidenceRecordCount: 0,
	caseCount: 0,
	activeIntegrations: [],
};

/**
 * Case ids `userId` can VIEW-access — the same union `canAccessCase`
 * (`lib/permissions.ts`) resolves to at VIEW level: cases the user created,
 * cases with a direct `CasePermission` row, and cases reachable through a
 * `CaseTeamPermission` via team membership. One query, not a per-case
 * `canAccessCase` loop — the shape this read needs is the whole accessible
 * set, not a single case's yes/no.
 */
async function accessibleCaseIdsForUser(userId: string): Promise<string[]> {
	const cases = await prisma.assuranceCase.findMany({
		where: {
			deletedAt: null,
			OR: [
				{ createdById: userId },
				{ userPermissions: { some: { userId } } },
				{
					teamPermissions: {
						some: { team: { members: { some: { userId } } } },
					},
				},
			],
		},
		select: { id: true },
	});
	return cases.map((c) => c.id);
}

interface EvidenceCaseCounts {
	caseCount: number;
	evidenceRecordCount: number;
}

/**
 * One aggregate query for both counts: the evidence rows are on
 * `PluginHealthEvidence`, keyed by `claimId`, and the case a claim belongs to
 * is a column on its `AssuranceElement` — not on the evidence row itself —
 * so getting both counts in one round trip needs the join `$queryRaw` gives
 * that a chained Prisma `count`/`groupBy` pair cannot (Prisma's `groupBy`
 * only groups by scalar fields of the model being queried, not a related
 * model's fields).
 */
async function countEvidenceAndCasesForClaims(
	caseIds: string[]
): Promise<EvidenceCaseCounts> {
	const rows = await prisma.$queryRaw<
		Array<{ evidence_count: number; case_count: number }>
	>`
		SELECT
			COUNT(*)::int AS evidence_count,
			COUNT(DISTINCT ae.case_id)::int AS case_count
		FROM plugin_health_evidence phe
		JOIN assurance_elements ae ON ae.id = phe.claim_id
		WHERE ae.deleted_at IS NULL
			AND ae.case_id = ANY(${caseIds})
	`;
	const row = rows[0];
	return {
		evidenceRecordCount: row?.evidence_count ?? 0,
		caseCount: row?.case_count ?? 0,
	};
}

/**
 * Active integrations holding `health:evidence:write` whose system user has
 * a direct `CasePermission` on at least one of `caseIds`. Deliberately
 * `CasePermission` only (never `CaseTeamPermission`) — every machine
 * account's case access is granted directly, one row per case
 * (`grantIntegrationCaseAccess`, `integration-registry-service.ts`); system
 * users are never team members.
 */
async function activeIntegrationsForCases(
	caseIds: string[]
): Promise<Array<{ id: string; name: string }>> {
	return await prisma.integration.findMany({
		where: {
			status: "ACTIVE",
			scopes: { has: HEALTH_EVIDENCE_WRITE_SCOPE },
			systemUser: {
				casePermissions: { some: { caseId: { in: caseIds } } },
			},
		},
		select: { id: true, name: true },
	});
}

/**
 * Reads the consequences of `userId` turning `pluginId` off for themself:
 * how much evidence and how many of their cases carry it, and which active
 * integrations are still writing to those cases. Read-only — does not touch
 * enablement state.
 *
 * Generic by manifest shape: a plugin without the `plugin-tables` surface
 * has no per-case evidence table this read knows how to count, so it returns
 * the empty shape rather than guessing at one only the health plugin
 * currently has.
 */
export async function getPluginDisableConsequences(
	pluginId: string,
	userId: string
): ServiceResult<PluginDisableConsequences> {
	const manifestEntry = getManifestEntry(pluginId);
	if (!manifestEntry) {
		return { error: PLUGIN_NOT_FOUND };
	}

	if (!manifestEntry.surfaces.includes("plugin-tables")) {
		return { data: EMPTY_CONSEQUENCES };
	}

	try {
		const caseIds = await accessibleCaseIdsForUser(userId);
		if (caseIds.length === 0) {
			return { data: EMPTY_CONSEQUENCES };
		}

		const [counts, activeIntegrations] = await Promise.all([
			countEvidenceAndCasesForClaims(caseIds),
			activeIntegrationsForCases(caseIds),
		]);

		return {
			data: {
				evidenceRecordCount: counts.evidenceRecordCount,
				caseCount: counts.caseCount,
				activeIntegrations,
			},
		};
	} catch (error) {
		log.error("Failed to read plugin disable consequences", { error });
		return { error: "Failed to read plugin disable consequences" };
	}
}
