import { canAccessCase } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { assertPluginEnabledForUser } from "@/lib/services/plugin-enablement-service";
import {
	type PermissionLevel,
	type PluginData,
	Prisma,
} from "@/src/generated/prisma";
import type { ServiceResult } from "@/types/service";

/**
 * Namespaced read/write access over the tier-1 `PluginData` model (ADR 0002
 * v2 §2.1). Two guarantees this service exists to make structural rather
 * than conventional:
 *
 * 1. **Namespace isolation.** A caller acting for plugin X can touch ONLY
 *    rows with `pluginId` X. Every query below includes `pluginId` in its
 *    `where` clause and addresses rows via the case/element composite, never
 *    a bare `PluginData.id` — there is no code path here that could resolve
 *    to a different plugin's row no matter what a caller passes in.
 * 2. **elementId <-> caseId integrity.** There is no DB constraint tying
 *    `PluginData.elementId` to `PluginData.caseId` (element-level rows
 *    reference both independently), so every element-scoped operation
 *    verifies the element actually belongs to the given case before
 *    touching anything — otherwise element-scoped plugin data could ride a
 *    permission anchor (`caseId`) that has nothing to do with the element it
 *    claims to describe.
 *
 * Disabled plugins (deployment-unavailable or off for this user) refuse
 * every operation here — read, write, and delete alike (ADR §2.2: off hides
 * the plugin's surface for that user; existing rows sit inert, never
 * purged). This is the "plugin routes refuse when the plugin is off for the
 * caller" behaviour (work item 4) until the health plugin's own machine
 * endpoints exist to enforce it on their own surface too.
 */

export interface PluginDataLocation {
	caseId: string;
	/** Omit or `null` for case-level data. */
	elementId?: string | null;
}

function isUniqueConstraintError(error: unknown): boolean {
	return (
		error instanceof Prisma.PrismaClientKnownRequestError &&
		error.code === "P2002"
	);
}

/**
 * Enablement + case-permission guard shared by every operation below.
 * Returns `null` on success, or the error message to surface otherwise.
 * Order is deliberate: the enablement check is a cheap, case-independent
 * lookup and fails closed before any case-specific query runs.
 */
async function guardPluginAccess(
	pluginId: string,
	userId: string,
	caseId: string,
	requiredLevel: PermissionLevel
): Promise<string | null> {
	const enablement = await assertPluginEnabledForUser(pluginId, userId);
	if ("error" in enablement) {
		return enablement.error;
	}

	const hasAccess = await canAccessCase({ userId, caseId }, requiredLevel);
	if (!hasAccess) {
		// Same message for not-found and no-permission (repo convention) —
		// prevents resource-enumeration via the plugin surface.
		return "Case not found";
	}

	return null;
}

/**
 * Verifies `elementId` belongs to `caseId` and is not soft-deleted
 * (nanaki QA finding 4, 2026-07-03). Returns `null` on success, or a clear
 * rejection message otherwise — distinct messages for "doesn't exist" vs.
 * "exists but wrong case" so a caller can tell a typo'd id from a genuine
 * cross-case mismatch.
 */
async function validateElementBelongsToCase(
	elementId: string,
	caseId: string
): Promise<string | null> {
	const element = await prisma.assuranceElement.findUnique({
		where: { id: elementId },
		select: { caseId: true, deletedAt: true },
	});

	if (!element || element.deletedAt) {
		return "Element not found";
	}
	if (element.caseId !== caseId) {
		return "Element does not belong to the specified case";
	}
	return null;
}

/**
 * Upserts an element-level row via the real (fully non-null) compound
 * unique key — a single atomic Prisma upsert, no race window.
 */
function upsertElementLevelPluginData(
	pluginId: string,
	caseId: string,
	elementId: string,
	data: Prisma.InputJsonValue
): Promise<PluginData> {
	return prisma.pluginData.upsert({
		where: { pluginId_caseId_elementId: { pluginId, caseId, elementId } },
		create: { pluginId, caseId, elementId, data },
		update: { data },
	});
}

/**
 * Upserts a case-level row (`elementId` null). Prisma's compound-unique
 * lookup type requires a non-null `elementId`, so it cannot address
 * case-level rows directly — this does a manual find-then-create/update
 * instead. The migration's hand-written partial unique index
 * (`pluginId, caseId WHERE elementId IS NULL`, see `prisma/schema.prisma`)
 * backstops the small race window: if a concurrent writer wins, the create
 * throws P2002 and this falls back to updating the row that now exists.
 */
async function upsertCaseLevelPluginData(
	pluginId: string,
	caseId: string,
	data: Prisma.InputJsonValue
): Promise<PluginData> {
	const existing = await prisma.pluginData.findFirst({
		where: { pluginId, caseId, elementId: null },
	});
	if (existing) {
		return prisma.pluginData.update({
			where: { id: existing.id },
			data: { data },
		});
	}

	try {
		return await prisma.pluginData.create({
			data: { pluginId, caseId, elementId: null, data },
		});
	} catch (error) {
		if (!isUniqueConstraintError(error)) {
			throw error;
		}
		const afterRace = await prisma.pluginData.findFirstOrThrow({
			where: { pluginId, caseId, elementId: null },
		});
		return prisma.pluginData.update({
			where: { id: afterRace.id },
			data: { data },
		});
	}
}

/** Reads a single case- or element-level row for `pluginId`, or `null` if none exists. Requires VIEW on the case. */
export async function readPluginData(
	pluginId: string,
	userId: string,
	location: PluginDataLocation
): ServiceResult<PluginData | null> {
	const guardError = await guardPluginAccess(
		pluginId,
		userId,
		location.caseId,
		"VIEW"
	);
	if (guardError) {
		return { error: guardError };
	}

	if (location.elementId) {
		const elementError = await validateElementBelongsToCase(
			location.elementId,
			location.caseId
		);
		if (elementError) {
			return { error: elementError };
		}
	}

	try {
		const record = await prisma.pluginData.findFirst({
			where: {
				pluginId,
				caseId: location.caseId,
				elementId: location.elementId ?? null,
			},
		});
		return { data: record };
	} catch (error) {
		console.error("Failed to read plugin data:", error);
		return { error: "Failed to read plugin data" };
	}
}

/** Lists every row (case-level and all element-level) `pluginId` holds on `caseId`. Requires VIEW on the case. */
export async function listPluginDataForCase(
	pluginId: string,
	userId: string,
	caseId: string
): ServiceResult<PluginData[]> {
	const guardError = await guardPluginAccess(pluginId, userId, caseId, "VIEW");
	if (guardError) {
		return { error: guardError };
	}

	try {
		const records = await prisma.pluginData.findMany({
			where: { pluginId, caseId },
			orderBy: { createdAt: "asc" },
		});
		return { data: records };
	} catch (error) {
		console.error("Failed to list plugin data:", error);
		return { error: "Failed to list plugin data" };
	}
}

/** Creates or replaces a case- or element-level row for `pluginId`. Requires EDIT on the case. */
export async function writePluginData(
	pluginId: string,
	userId: string,
	location: PluginDataLocation,
	data: Prisma.InputJsonValue
): ServiceResult<PluginData> {
	const guardError = await guardPluginAccess(
		pluginId,
		userId,
		location.caseId,
		"EDIT"
	);
	if (guardError) {
		return { error: guardError };
	}

	if (location.elementId) {
		const elementError = await validateElementBelongsToCase(
			location.elementId,
			location.caseId
		);
		if (elementError) {
			return { error: elementError };
		}
	}

	try {
		const record = location.elementId
			? await upsertElementLevelPluginData(
					pluginId,
					location.caseId,
					location.elementId,
					data
				)
			: await upsertCaseLevelPluginData(pluginId, location.caseId, data);
		return { data: record };
	} catch (error) {
		console.error("Failed to write plugin data:", error);
		return { error: "Failed to write plugin data" };
	}
}

/**
 * Deletes a case- or element-level row for `pluginId` — the "explicit user
 * action" ADR §2.2 reserves as the only way plugin data is ever removed
 * (disabling a plugin never purges it). Requires EDIT on the case. A no-op
 * (success, no error) if no such row exists.
 */
export async function deletePluginData(
	pluginId: string,
	userId: string,
	location: PluginDataLocation
): ServiceResult<true> {
	const guardError = await guardPluginAccess(
		pluginId,
		userId,
		location.caseId,
		"EDIT"
	);
	if (guardError) {
		return { error: guardError };
	}

	if (location.elementId) {
		const elementError = await validateElementBelongsToCase(
			location.elementId,
			location.caseId
		);
		if (elementError) {
			return { error: elementError };
		}
	}

	try {
		await prisma.pluginData.deleteMany({
			where: {
				pluginId,
				caseId: location.caseId,
				elementId: location.elementId ?? null,
			},
		});
		return { data: true };
	} catch (error) {
		console.error("Failed to delete plugin data:", error);
		return { error: "Failed to delete plugin data" };
	}
}
