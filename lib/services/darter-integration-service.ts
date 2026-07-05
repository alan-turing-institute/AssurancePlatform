import { sameScopes } from "@/lib/auth/scopes";
import { prisma } from "@/lib/prisma";
import {
	registerIntegration,
	updateIntegrationScopes,
} from "@/lib/services/integration-registry-service";
import type { PermissionLevel } from "@/src/generated/prisma";
import type { ServiceResult } from "@/types/service";

/**
 * Shared find-or-register-and-grant logic for the `darter-pipeline`
 * integration (ADR 0002 v2 §2.4), reused by two entry points that must stay
 * in lockstep on name/scopes but diverge on what happens next:
 *   - `scripts/seed-darter-integration.ts` — the ad-hoc/manual CLI path,
 *     which additionally issues a token and prints it.
 *   - `prisma/seed/dev-seed.ts` — the demo-seed path, which deliberately
 *     issues NO token (shown-once semantics; the token is issued through
 *     the management UI at demo time, PR #849).
 *
 * Idempotent: reuses the existing integration/system user if one already
 * exists, reconciling its scopes to `DARTER_EXPECTED_SCOPES` if they've
 * drifted; upserts the case permission grant either way.
 */

export const DARTER_INTEGRATION_NAME = "darter-pipeline";
export const DARTER_EXPECTED_SCOPES = [
	"case:read",
	"health:evidence:write",
] as const;
const DARTER_DESCRIPTION =
	"DARTER evidence pipeline — machine client for the health plugin";

export interface DarterIntegrationRef {
	integrationId: string;
	status: "created" | "existing" | "reconciled";
	systemUserId: string;
}

/**
 * Finds or registers the `darter-pipeline` integration, reconciling its
 * scopes if they've drifted from `DARTER_EXPECTED_SCOPES`. Does NOT grant
 * case access or touch tokens — see `ensureDarterCaseGrant` and each
 * caller's own token handling.
 */
export async function ensureDarterIntegration(
	actorUserId: string
): ServiceResult<DarterIntegrationRef> {
	const existing = await prisma.integration.findUnique({
		where: { name: DARTER_INTEGRATION_NAME },
	});

	if (existing) {
		if (sameScopes(existing.scopes, DARTER_EXPECTED_SCOPES)) {
			return {
				data: {
					integrationId: existing.id,
					systemUserId: existing.systemUserId,
					status: "existing",
				},
			};
		}

		const reconciled = await updateIntegrationScopes(
			existing.id,
			[...DARTER_EXPECTED_SCOPES],
			actorUserId
		);
		if ("error" in reconciled) {
			return reconciled;
		}
		return {
			data: {
				integrationId: existing.id,
				systemUserId: existing.systemUserId,
				status: "reconciled",
			},
		};
	}

	const registered = await registerIntegration(
		{
			name: DARTER_INTEGRATION_NAME,
			description: DARTER_DESCRIPTION,
			scopes: [...DARTER_EXPECTED_SCOPES],
		},
		actorUserId
	);
	if ("error" in registered) {
		return registered;
	}
	return {
		data: {
			integrationId: registered.data.integration.id,
			systemUserId: registered.data.systemUserId,
			status: "created",
		},
	};
}

/**
 * Upserts the DARTER system user's case permission grant — safe to call on
 * every run (re-running with the same `permission` is a no-op update).
 */
export async function ensureDarterCaseGrant(
	caseId: string,
	systemUserId: string,
	permission: PermissionLevel,
	grantedById: string
): Promise<void> {
	await prisma.casePermission.upsert({
		where: { caseId_userId: { caseId, userId: systemUserId } },
		create: { caseId, userId: systemUserId, permission, grantedById },
		update: { permission, grantedById },
	});
}
