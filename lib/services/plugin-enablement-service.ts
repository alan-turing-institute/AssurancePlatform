import { logger } from "@/lib/logger";
import {
	getManifestEntry,
	isPluginAvailableForDeployment,
	listManifestPluginIds,
} from "@/lib/plugins/manifest";
import { prisma } from "@/lib/prisma";
import type { TxClient } from "@/lib/utils/tree-traversal";
import type {
	PluginScopeType,
	PluginState,
	Prisma,
} from "@/src/generated/prisma";
import type { ServiceResult } from "@/types/service";

const log = logger.child({ component: "plugin-enablement-service" });

/**
 * Resolves effective plugin enablement per ADR 0002 v2 §2.2: a plugin is ON
 * for a user iff it is available at the deployment level AND no
 * `PluginState` row with `enabled: false` exists at any scope at-or-above
 * the user in the ORGANISATION -> TEAM -> USER chain ("off wins downward").
 * A manifest entry with `defaultEnabled: false` additionally needs the
 * user's own USER-scope row to be on, except for an integration's machine
 * account, which counts as opted in (see `isIntegrationMachineAccount`).
 *
 * 1.0 activates only the USER tier for writes (`setPluginEnabledForUser`
 * below) — there is no Organisation model yet, and mapping a user to their
 * team(s) for plugin-scoping purposes is deliberately deferred. But this
 * resolver walks the FULL chain unconditionally: given an `organisationId`
 * and/or `teamIds`, it honours rows at those scopes today. Nothing here
 * needs to change when the organisation model lands and callers start
 * supplying those ids — only the callers do.
 */

export interface PluginScopeChain {
	/** Not derivable in 1.0 (no Organisation model yet) — omit to skip this tier. */
	organisationId?: string;
	/** A user may belong to several teams; any one of them being off disables the plugin. */
	teamIds?: string[];
	userId: string;
}

export interface EffectivePluginState {
	availableAtDeployment: boolean;
	/**
	 * The scope that turned this off — "DEPLOYMENT" if withheld before any
	 * per-scope row is consulted, the topmost `PluginScopeType` whose row was
	 * `enabled: false`, or `null` if the plugin is on. ADR §2.2's storage
	 * guarantee ("nothing stored at all") attaches to this value being
	 * "DEPLOYMENT" or "ORGANISATION" — the topmost OFF.
	 */
	disabledAt: "DEPLOYMENT" | PluginScopeType | null;
	enabled: boolean;
}

interface ScopeLookup {
	scopeId: string;
	scopeType: PluginScopeType;
}

/**
 * Builds the ordered (scopeType, scopeId) pairs to consult, in
 * ORGANISATION -> TEAM -> USER order — array order IS precedence order, so
 * the first disabling row found while walking it is the topmost OFF.
 */
function buildScopeLookups(scopeIds: PluginScopeChain): ScopeLookup[] {
	const lookups: ScopeLookup[] = [];
	if (scopeIds.organisationId) {
		lookups.push({
			scopeType: "ORGANISATION",
			scopeId: scopeIds.organisationId,
		});
	}
	for (const teamId of scopeIds.teamIds ?? []) {
		lookups.push({ scopeType: "TEAM", scopeId: teamId });
	}
	lookups.push({ scopeType: "USER", scopeId: scopeIds.userId });
	return lookups;
}

/**
 * True when `userId` is the machine account of an integration. The test is
 * that an `Integration` row names the account as its `systemUserId`, not the
 * bare `isSystemUser` flag: the fallback account that inherits a deleted
 * user's cases carries that flag too and is not an integration's principal.
 * Only the integration registry creates such a row, in the same transaction
 * that creates the account, so a person cannot attach one to their own.
 */
async function isIntegrationMachineAccount(
	userId: string,
	db: TxClient
): Promise<boolean> {
	const integration = await db.integration.findUnique({
		where: { systemUserId: userId },
		select: { id: true },
	});
	return integration !== null;
}

export async function resolveEffectivePluginState(
	pluginId: string,
	scopeIds: PluginScopeChain,
	db: TxClient = prisma
): ServiceResult<EffectivePluginState> {
	if (!getManifestEntry(pluginId)) {
		return { error: `Unknown plugin '${pluginId}'` };
	}

	if (!isPluginAvailableForDeployment(pluginId)) {
		return {
			data: {
				enabled: false,
				availableAtDeployment: false,
				disabledAt: "DEPLOYMENT",
			},
		};
	}

	const lookups = buildScopeLookups(scopeIds);

	try {
		const rows = await db.pluginState.findMany({
			where: {
				pluginId,
				OR: lookups.map(({ scopeType, scopeId }) => ({ scopeType, scopeId })),
			},
			select: { scopeType: true, scopeId: true, enabled: true },
		});

		for (const { scopeType, scopeId } of lookups) {
			const row = rows.find(
				(r) => r.scopeType === scopeType && r.scopeId === scopeId
			);
			if (row && !row.enabled) {
				return {
					data: {
						enabled: false,
						availableAtDeployment: true,
						disabledAt: scopeType,
					},
				};
			}
		}

		if (getManifestEntry(pluginId)?.defaultEnabled === false) {
			const userRow = rows.find(
				(r) => r.scopeType === "USER" && r.scopeId === scopeIds.userId
			);
			// A machine account never chooses plugins; its token's scopes and
			// case grants already say what it is for. The lookup runs only on
			// this path, and the off rows and deployment check above still win.
			if (
				!(
					userRow?.enabled ||
					(await isIntegrationMachineAccount(scopeIds.userId, db))
				)
			) {
				return {
					data: {
						enabled: false,
						availableAtDeployment: true,
						disabledAt: "USER",
					},
				};
			}
		}

		return {
			data: { enabled: true, availableAtDeployment: true, disabledAt: null },
		};
	} catch (error) {
		log.error("Failed to resolve plugin state", { error });
		return { error: "Failed to resolve plugin state" };
	}
}

/**
 * Convenience guard for any future plugin route/service (item 4 — disabled
 * plugins refuse server-side): resolves effective state for `userId` alone
 * (the only tier 1.0 writes to) and collapses it to a single pass/fail
 * `ServiceResult`. `lib/services/plugin-data-service.ts` composes this;
 * the health plugin's machine endpoints (a later issue) call it directly.
 */
export async function assertPluginEnabledForUser(
	pluginId: string,
	userId: string,
	db: TxClient = prisma
): ServiceResult<true> {
	const result = await resolveEffectivePluginState(pluginId, { userId }, db);
	if ("error" in result) {
		return result;
	}
	if (!result.data.enabled) {
		return { error: `Plugin '${pluginId}' is not enabled` };
	}
	return { data: true };
}

/**
 * Passes when at least one plugin that uses models (`usesModels` in the
 * manifest) is on for `userId`; this is the gate on the model connection
 * routes. When every such plugin is off, the answer is the refusal below;
 * when the state of a plugin could not be read and none is on, that failure
 * is returned instead, so a database fault is not reported as a refusal.
 */
export async function assertModelPluginEnabled(
	userId: string
): ServiceResult<true> {
	const states = await Promise.all(
		listManifestPluginIds()
			.filter((pluginId) => getManifestEntry(pluginId)?.usesModels)
			.map((pluginId) => resolveEffectivePluginState(pluginId, { userId }))
	);
	if (states.some((state) => "data" in state && state.data.enabled)) {
		return { data: true };
	}
	const unreadable = states.find((state) => "error" in state);
	if (unreadable && "error" in unreadable) {
		return unreadable;
	}
	return { error: "No plugin that uses models is enabled" };
}

/** Boolean convenience form of `assertPluginEnabledForUser` for non-`ServiceResult` call sites (e.g. UI slot rendering). */
export async function isPluginEnabledForUser(
	pluginId: string,
	userId: string,
	db: TxClient = prisma
): Promise<boolean> {
	const result = await assertPluginEnabledForUser(pluginId, userId, db);
	return "data" in result;
}

/**
 * Every official plugin id currently enabled for `userId` — deployment
 * availability plus the full ORGANISATION -> TEAM -> USER scope chain, one
 * check per manifest entry. Convenience for callers that need the whole
 * enabled set rather than a yes/no on a single plugin id: the element-name-
 * prefix validation seam (`lib/element-names/prefix-registry.ts`) accepts a
 * plugin's extra name patterns only when its id is in this set, and passes
 * the result straight through — it never queries plugin state itself.
 */
export async function getEnabledPluginIdsForUser(
	userId: string,
	db: TxClient = prisma
): Promise<string[]> {
	const pluginIds = listManifestPluginIds();
	const enabledFlags = await Promise.all(
		pluginIds.map((pluginId) => isPluginEnabledForUser(pluginId, userId, db))
	);
	return pluginIds.filter((_, index) => enabledFlags[index]);
}

/**
 * Reads the current USER-scope `settings` JSON for `pluginId`, or `null` if
 * no USER-scope row exists yet (a user who has never touched this plugin's
 * toggle has no row at all). Separate from `resolveEffectivePluginState`
 * deliberately: that resolver answers "is this plugin ON", walking the full
 * scope chain, and never needed to surface a settings payload; this answers
 * "what did the USER save", a single-scope lookup with no chain-walking.
 * Added for the settings pane (`GET /api/user/plugins`) to round-trip a
 * user's saved settings without duplicating enablement logic in the route.
 */
export async function getUserPluginSettings(
	pluginId: string,
	userId: string
): ServiceResult<Prisma.JsonValue | null> {
	if (!getManifestEntry(pluginId)) {
		return { error: `Unknown plugin '${pluginId}'` };
	}

	try {
		const row = await prisma.pluginState.findUnique({
			where: {
				pluginId_scopeType_scopeId: {
					pluginId,
					scopeType: "USER",
					scopeId: userId,
				},
			},
			select: { settings: true },
		});
		return { data: row?.settings ?? null };
	} catch (error) {
		log.error("Failed to read plugin settings", { error });
		return { error: "Failed to read plugin settings" };
	}
}

export interface SetUserPluginEnabledInput {
	enabled: boolean;
	settings?: Prisma.InputJsonValue;
}

/**
 * Sets a plugin's USER-scope enablement row for `userId` — the only scope
 * tier 1.0 writes to (ADR §2.2: "1.0 implements deployment availability +
 * the user-level toggle"). ORGANISATION/TEAM rows may exist (read by
 * `resolveEffectivePluginState` above) but are not writable through this
 * service until the organisation model lands.
 */
export async function setPluginEnabledForUser(
	pluginId: string,
	userId: string,
	input: SetUserPluginEnabledInput
): ServiceResult<PluginState> {
	if (!getManifestEntry(pluginId)) {
		return { error: `Unknown plugin '${pluginId}'` };
	}

	try {
		const state = await prisma.pluginState.upsert({
			where: {
				pluginId_scopeType_scopeId: {
					pluginId,
					scopeType: "USER",
					scopeId: userId,
				},
			},
			create: {
				pluginId,
				scopeType: "USER",
				scopeId: userId,
				enabled: input.enabled,
				settings: input.settings,
			},
			update: {
				enabled: input.enabled,
				settings: input.settings,
			},
		});
		return { data: state };
	} catch (error) {
		log.error("Failed to set plugin enablement", { error });
		return { error: "Failed to update plugin state" };
	}
}
