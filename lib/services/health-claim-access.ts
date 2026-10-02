import { canAccessCase } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { assertPluginEnabledForUser } from "@/lib/services/plugin-enablement-service";

/**
 * The access guard shared by the health plugin's services: plugin enablement
 * for the acting principal (human or machine), case permission, and
 * resolution of the claim or case being addressed.
 */

export const HEALTH_PLUGIN_ID = "tea.health";

/**
 * A single generic message for every reason a claim reference could fail —
 * doesn't exist, is soft-deleted, isn't a PROPERTY_CLAIM, or the caller
 * lacks the case access the operation needs. Distinguishing these would
 * let a caller probe arbitrary ids and learn, from the message, whether
 * something exists elsewhere on the platform.
 */
export const CLAIM_NOT_FOUND = "Claim not found";

/** The same promise for a case reference. */
export const CASE_NOT_FOUND = "Case not found";

async function resolveClaim(
	claimId: string
): Promise<{ caseId: string } | null> {
	const element = await prisma.assuranceElement.findUnique({
		where: { id: claimId },
		select: { caseId: true, elementType: true, deletedAt: true },
	});
	if (
		!element ||
		element.deletedAt ||
		element.elementType !== "PROPERTY_CLAIM"
	) {
		return null;
	}
	return { caseId: element.caseId };
}

/**
 * Plugin enablement (for the acting principal, human or machine) + case
 * permission + claim resolution. Returns the resolved `caseId` on success, or
 * the error to surface otherwise.
 */
export async function guardClaimAccess(
	userId: string,
	claimId: string,
	requiredLevel: "VIEW" | "EDIT"
): Promise<{ caseId: string } | { error: string }> {
	const enablement = await assertPluginEnabledForUser(HEALTH_PLUGIN_ID, userId);
	if ("error" in enablement) {
		return { error: enablement.error };
	}

	const claim = await resolveClaim(claimId);
	if (!claim) {
		return { error: CLAIM_NOT_FOUND };
	}

	const hasAccess = await canAccessCase(
		{ userId, caseId: claim.caseId },
		requiredLevel
	);
	if (!hasAccess) {
		return { error: CLAIM_NOT_FOUND };
	}

	return { caseId: claim.caseId };
}

/** The same guard for an operation on a whole case. */
export async function guardCaseAccess(
	userId: string,
	caseId: string,
	requiredLevel: "VIEW" | "EDIT"
): Promise<{ caseId: string } | { error: string }> {
	const enablement = await assertPluginEnabledForUser(HEALTH_PLUGIN_ID, userId);
	if ("error" in enablement) {
		return { error: enablement.error };
	}
	const hasAccess = await canAccessCase({ userId, caseId }, requiredLevel);
	return hasAccess ? { caseId } : { error: CASE_NOT_FOUND };
}

export const DELETED_USER_NAME = "Deleted user";

export async function usernamesById(
	ids: string[]
): Promise<Map<string, string>> {
	if (ids.length === 0) {
		return new Map();
	}
	const users = await prisma.user.findMany({
		where: { id: { in: ids } },
		select: { id: true, username: true },
	});
	return new Map(users.map((user) => [user.id, user.username]));
}
