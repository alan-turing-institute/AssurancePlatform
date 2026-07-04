import { z } from "zod";
import { listManifestPluginIds } from "@/lib/plugins/manifest";

/**
 * Zod schemas for the plugin lifecycle core's user-facing surface (ADR 0002
 * v2 §2.2) — `GET`/`PATCH /api/user/plugins`, the settings pane's only data
 * source. See `lib/services/plugin-enablement-service.ts` for the service
 * these validate input for.
 */

// ============================================
// Bounded JSON — plugin `settings`
// ============================================

/**
 * `setPluginEnabledForUser` (the service this schema guards) deliberately
 * trusts schema-validated input and imposes no bound of its own on
 * `settings` (vincent finding 7, 2026-07-03 backend review: "the zod schema
 * on any route wiring to `setPluginEnabledForUser` MUST cap `settings`
 * size/shape"). These constants are that cap — generous enough for a
 * plugin's user-facing preferences, small enough that no caller can smuggle
 * an unbounded JSON blob into a tier-1 row through this route.
 */
const PLUGIN_SETTINGS_MAX_DEPTH = 4;
const PLUGIN_SETTINGS_MAX_KEYS = 20;
const PLUGIN_SETTINGS_MAX_ARRAY_ITEMS = 20;
const PLUGIN_SETTINGS_MAX_STRING_LENGTH = 500;
/** Final belt-and-braces bound on the whole payload, serialized as UTF-8 bytes. */
export const PLUGIN_SETTINGS_MAX_BYTES = 4096;

const jsonPrimitiveSchema = z.union([
	z.string().max(PLUGIN_SETTINGS_MAX_STRING_LENGTH),
	z.number(),
	z.boolean(),
	z.null(),
]);

/**
 * A bounded JSON value, at most `depth` further levels of array/object
 * nesting below this call — `depth <= 0` collapses to primitives only, so
 * the recursion structurally terminates rather than relying on a runtime
 * counter. Each level down is a fresh schema (cheap: `PLUGIN_SETTINGS_MAX_DEPTH`
 * is small and fixed), not unbounded recursion.
 */
// biome-ignore lint/suspicious/noExplicitAny: Required for Zod recursive schema typing (same pattern as lib/schemas/case-export.ts's TreeNodeSchema)
function boundedJsonValueSchema(depth: number): z.ZodType<any> {
	if (depth <= 0) {
		return jsonPrimitiveSchema;
	}
	return z.lazy(() =>
		z.union([
			jsonPrimitiveSchema,
			z
				.array(boundedJsonValueSchema(depth - 1))
				.max(PLUGIN_SETTINGS_MAX_ARRAY_ITEMS),
			z
				.record(z.string(), boundedJsonValueSchema(depth - 1))
				.refine((obj) => Object.keys(obj).length <= PLUGIN_SETTINGS_MAX_KEYS, {
					message: `Must have at most ${PLUGIN_SETTINGS_MAX_KEYS} keys`,
				}),
		])
	);
}

function serializedByteLength(value: unknown): number {
	return new TextEncoder().encode(JSON.stringify(value)).length;
}

/**
 * A plugin's `settings` JSON (ADR §2.2: "`PluginState` ... settings JSON,
 * unique per plugin+scope"). The top level must be a plain object — a
 * settings blob is a bag of named preferences, never a bare array or
 * scalar — nested up to `PLUGIN_SETTINGS_MAX_DEPTH` levels, with per-object
 * key counts, per-array lengths, and per-string lengths all capped, and the
 * whole payload capped at `PLUGIN_SETTINGS_MAX_BYTES` serialized bytes as a
 * final structural-bypass-proof bound (a payload could satisfy every
 * per-node cap and still be enormous via many small keys — this refine
 * closes that gap).
 */
export const pluginSettingsSchema = z
	.record(z.string(), boundedJsonValueSchema(PLUGIN_SETTINGS_MAX_DEPTH - 1))
	.refine((obj) => Object.keys(obj).length <= PLUGIN_SETTINGS_MAX_KEYS, {
		message: `settings must have at most ${PLUGIN_SETTINGS_MAX_KEYS} top-level keys`,
	})
	.refine((obj) => serializedByteLength(obj) <= PLUGIN_SETTINGS_MAX_BYTES, {
		message: `settings must serialize to at most ${PLUGIN_SETTINGS_MAX_BYTES} bytes`,
	});

// ============================================
// PATCH /api/user/plugins
// ============================================

/**
 * Body schema for `PATCH /api/user/plugins`. `pluginId` is checked against
 * the live manifest (`listManifestPluginIds()`, read at parse time — not
 * baked into a `z.enum` at module load) so shipping a new official plugin
 * needs no schema change, and — the direction that matters for security —
 * an id absent from the manifest is rejected HERE, before the service
 * layer, with a proper 400. `setPluginEnabledForUser` also rejects unknown
 * ids, but its error string ("Unknown plugin '...'") matches none of
 * `serviceErrorToAppError`'s patterns and would otherwise surface as an
 * unmapped 500.
 *
 * The acting user is never part of this schema — the route derives it from
 * the session (`requireAuth()`), never from the request body.
 */
export const pluginToggleSchema = z.object({
	pluginId: z
		.string()
		.min(1, "pluginId is required")
		.max(100, "pluginId must be less than 100 characters")
		.refine((id) => listManifestPluginIds().includes(id), {
			message: "Unknown plugin id",
		}),
	enabled: z.boolean({ message: "enabled must be a boolean" }),
	settings: pluginSettingsSchema.optional(),
});

export type PluginToggleInput = z.input<typeof pluginToggleSchema>;
export type PluginToggleOutput = z.output<typeof pluginToggleSchema>;
