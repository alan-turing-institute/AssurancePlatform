import { logger } from "@/lib/logger";
import { canAccessCase } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import type { HealthCheck, HealthCheckList } from "@/lib/schemas/health-checks";
import {
	blockIssues,
	checkListIssues,
	issuesToFieldErrors,
	type PartialSettings,
	recommendedCheckParams,
	timingIssues,
} from "@/lib/schemas/health-criteria";
import {
	guardCaseAccess,
	HEALTH_PLUGIN_ID,
} from "@/lib/services/health-claim-access";
import { assertPluginEnabledForUser } from "@/lib/services/plugin-enablement-service";
import type { Prisma } from "@/src/generated/prisma";
import type { ServiceResult } from "@/types/service";

const log = logger.child({ component: "health-check-catalogue-service" });

/**
 * The check lists pipelines publish (`plugin_health_check_catalogues`, one
 * row per integration, replaced whole on each publish) and the reads of them.
 * Publishing a list never changes any claim's settings.
 */

export interface CheckListWarning {
	check: string;
	problem: string;
}

/** What `recommended` would be as settings, judged only for the blocks it names. */
function recommendationWarnings(check: HealthCheck): CheckListWarning[] {
	const { recommended } = check;
	if (!recommended) {
		return [];
	}
	const defaults = recommendedCheckParams(check);
	const settings: PartialSettings = {
		check: {
			name: check.name,
			version: check.version,
			scope: check.scope,
			...(Object.keys(defaults).length > 0 && { params: defaults }),
		},
		...recommended,
	};
	const fieldErrors = issuesToFieldErrors([
		...blockIssues(settings),
		...timingIssues(settings),
		...checkListIssues(settings, check, true),
	]);
	return Object.entries(fieldErrors).map(([field, message]) => ({
		check: check.name,
		problem: `recommended.${field}: ${message}`,
	}));
}

/**
 * Stores `list` as the calling integration's check list, replacing the
 * previous one. Returns how many checks it holds and a warning for every
 * recommendation that would not pass as evidence settings. The plugin must
 * be enabled for the integration's system user.
 */
export async function publishHealthCheckList(
	principal: { integrationId: string; systemUserId: string },
	list: HealthCheckList
): ServiceResult<{ checks: number; warnings: CheckListWarning[] }> {
	const enablement = await assertPluginEnabledForUser(
		HEALTH_PLUGIN_ID,
		principal.systemUserId
	);
	if ("error" in enablement) {
		return { error: enablement.error };
	}
	try {
		const checks = list.checks as unknown as Prisma.InputJsonArray;
		const publishedAt = new Date();
		await prisma.pluginHealthCheckCatalogue.upsert({
			where: { integrationId: principal.integrationId },
			create: {
				integrationId: principal.integrationId,
				pipeline: list.pipeline,
				checks,
				publishedAt,
			},
			update: { pipeline: list.pipeline, checks, publishedAt },
		});
		return {
			data: {
				checks: list.checks.length,
				warnings: list.checks.flatMap(recommendationWarnings),
			},
		};
	} catch (error) {
		log.error("Failed to publish health check list", { error });
		return { error: "Failed to publish the check list" };
	}
}

export interface CaseCheckList {
	checks: HealthCheck[];
	integration: { id: string; name: string };
	pipeline: string;
	published_at: string;
}

/** An active integration's check list, when its system user may edit `caseId`; otherwise null. */
export async function loadOfferedChecks(
	integrationId: string,
	caseId: string
): Promise<{
	checks: HealthCheck[];
	integration: { id: string; name: string; ownerId: string };
	pipeline: string;
	publishedAt: Date;
} | null> {
	const catalogue = await prisma.pluginHealthCheckCatalogue.findUnique({
		where: { integrationId },
		include: {
			integration: {
				select: {
					id: true,
					name: true,
					ownerId: true,
					status: true,
					systemUserId: true,
				},
			},
		},
	});
	if (!catalogue || catalogue.integration.status !== "ACTIVE") {
		return null;
	}
	const canEdit = await canAccessCase(
		{ userId: catalogue.integration.systemUserId, caseId },
		"EDIT"
	);
	if (!canEdit) {
		return null;
	}
	return {
		checks: catalogue.checks as unknown as HealthCheck[],
		integration: {
			id: catalogue.integration.id,
			name: catalogue.integration.name,
			ownerId: catalogue.integration.ownerId,
		},
		pipeline: catalogue.pipeline,
		publishedAt: catalogue.publishedAt,
	};
}

/**
 * The check lists of the active integrations whose system user has EDIT on
 * `caseId`, which are the checks a person can set up for its claims. Requires
 * VIEW-level case access.
 */
export async function listCaseCheckLists(
	actingUserId: string,
	caseId: string
): ServiceResult<CaseCheckList[]> {
	const guard = await guardCaseAccess(actingUserId, caseId, "VIEW");
	if ("error" in guard) {
		return { error: guard.error };
	}
	try {
		const catalogues = await prisma.pluginHealthCheckCatalogue.findMany({
			where: { integration: { status: "ACTIVE" } },
			select: { integrationId: true },
			orderBy: { publishedAt: "asc" },
		});
		const lists: CaseCheckList[] = [];
		for (const { integrationId } of catalogues) {
			const offered = await loadOfferedChecks(integrationId, caseId);
			if (offered) {
				lists.push({
					integration: {
						id: offered.integration.id,
						name: offered.integration.name,
					},
					pipeline: offered.pipeline,
					published_at: offered.publishedAt.toISOString(),
					checks: offered.checks,
				});
			}
		}
		return { data: lists };
	} catch (error) {
		log.error("Failed to list health check lists", { error });
		return { error: "Failed to list the check lists" };
	}
}
