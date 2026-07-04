import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuth,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { validationError } from "@/lib/errors";
import {
	getManifestEntry,
	listManifestPluginIds,
} from "@/lib/plugins/manifest";
import { pluginToggleSchema } from "@/lib/schemas/plugin";
import {
	getUserPluginSettings,
	resolveEffectivePluginState,
	setPluginEnabledForUser,
} from "@/lib/services/plugin-enablement-service";
import type { PluginScopeType, Prisma } from "@/src/generated/prisma";

export interface UserPluginListItem {
	/** Deployment concern (ADR §2.2) — withheld entirely means `false`. */
	available: boolean;
	/** Effective state for the session user across the full scope chain. */
	enabled: boolean;
	name: string;
	/**
	 * The scope that is currently pinning this plugin OFF — `"DEPLOYMENT"`,
	 * the topmost `PluginScopeType` whose row disabled it, or `null` if the
	 * plugin is ON. A pane renders the toggle as user-editable only when
	 * this is `null` or `"USER"`; `"DEPLOYMENT"`/`"ORGANISATION"`/`"TEAM"`
	 * mean a level above the user has switched it off (off wins downward —
	 * the user cannot override it from here).
	 */
	pinnedAt: "DEPLOYMENT" | PluginScopeType | null;
	/** The `PluginState`/`PluginData` namespace, e.g. `"tea.health"`. */
	pluginId: string;
	/** The user's own saved settings for this plugin, or `null` if never set. */
	settings: Prisma.JsonValue | null;
	version: string;
}

/**
 * GET /api/user/plugins
 *
 * Effective plugin state for the session user across every manifest entry —
 * the settings pane's only data source (ADR 0002 v2 §2.2: "a settings
 * section ... lists available plugins with toggle + per-plugin settings,
 * showing the effective state and which level pinned it").
 */
export async function GET() {
	try {
		const userId = await requireAuth();

		const plugins = await Promise.all(
			listManifestPluginIds().map(
				async (pluginId): Promise<UserPluginListItem> => {
					const entry = getManifestEntry(pluginId);
					if (!entry) {
						// Cannot happen — pluginId is sourced from the manifest itself.
						throw new Error(`Manifest entry missing for '${pluginId}'`);
					}

					const [stateResult, settingsResult] = await Promise.all([
						resolveEffectivePluginState(pluginId, { userId }),
						getUserPluginSettings(pluginId, userId),
					]);

					if ("error" in stateResult) {
						throw new Error(stateResult.error);
					}
					if ("error" in settingsResult) {
						throw new Error(settingsResult.error);
					}

					return {
						pluginId,
						name: entry.name,
						version: entry.version,
						available: stateResult.data.availableAtDeployment,
						enabled: stateResult.data.enabled,
						pinnedAt: stateResult.data.disabledAt,
						settings: settingsResult.data,
					};
				}
			)
		);

		return apiSuccess({ plugins });
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}

/**
 * PATCH /api/user/plugins
 *
 * Toggles a plugin's USER-scope enablement (and optionally replaces its
 * settings) for the session user — the only scope 1.0 writes to (ADR
 * §2.2). Security-critical (vincent's 2026-07-03 backend review, both
 * non-negotiable):
 * - The acting userId comes from `requireAuth()` — the session — never
 *   from the request body.
 * - `pluginToggleSchema` caps `settings` size/shape and rejects any
 *   pluginId absent from the manifest before this ever reaches the
 *   service layer, which trusts schema-validated input.
 */
export async function PATCH(req: Request) {
	try {
		const userId = await requireAuth();

		const body = await req.json();
		const parsed = pluginToggleSchema.safeParse(body);
		if (!parsed.success) {
			return apiError(
				validationError(parsed.error.issues[0]?.message ?? "Invalid input")
			);
		}

		const { pluginId, enabled, settings } = parsed.data;

		const result = await setPluginEnabledForUser(pluginId, userId, {
			enabled,
			settings,
		});
		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}

		return apiSuccess({
			pluginId: result.data.pluginId,
			enabled: result.data.enabled,
			settings: result.data.settings,
		});
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
