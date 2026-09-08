/**
 * TEA-syntax element-name prefix registry (design note: "TEA — Element Name
 * Prefix Validation", ADR 0002 amendment — validation extension point).
 *
 * Core rule (Chris, ruled 2026-09-03): a named element's `name` must be the
 * full TEA-syntax format for its type — `<prefix><n>(.<n>)*`, e.g. `P1`,
 * `P1.1`, `G2`. Names stay optional; the rule applies only when a name is
 * given. `getCorePrefix`'s ten-entry table is the single source of prefixes —
 * `toPrefix` (`lib/element-types.ts`) and `identifier-service.ts` read from
 * it rather than keeping their own copies, so the two can't drift again.
 *
 * The plugin override seam mirrors `lib/plugins/slots/registry.ts`'s
 * additive-only, first-registration-wins-on-identical, conflict-throws
 * shape: a plugin may register EXTRA accepted patterns for a type (e.g. a
 * future GSN plugin adding `Sn<n>` alongside Evidence's `E<n>`), but can
 * never remove a core pattern or another plugin's. Unlike the slot
 * registry, this module does not check the pluginId against
 * `PLUGIN_MANIFEST` — no shipped plugin registers a pattern in this PR (the
 * seam is proven by a test-registered fake plugin id), and the manifest's
 * `PluginSurface` union has no entry for name-pattern extension yet; adding
 * one is a follow-up if/when a real plugin uses this seam.
 *
 * Server-safe: no React, no Prisma. Plain strings in, so callers pass
 * whatever representation of an element type they already have (Prisma's
 * UPPERCASE `ElementType` enum values, in practice).
 */

/** The ten element types the platform's Prisma `ElementType` enum defines, each with its ruled prefix. */
const CORE_PREFIXES = {
	GOAL: "G",
	STRATEGY: "S",
	PROPERTY_CLAIM: "P",
	EVIDENCE: "E",
	CONTEXT: "C",
	JUSTIFICATION: "J",
	ASSUMPTION: "A",
	MODULE: "M",
	AWAY_GOAL: "AG",
	CONTRACT: "Ct",
} as const;

type CoreElementType = keyof typeof CORE_PREFIXES;

/** Human-readable label per core type, for error messages (`describeExpectedFormat`). */
const TYPE_LABELS: Record<CoreElementType, string> = {
	GOAL: "Goal",
	STRATEGY: "Strategy",
	PROPERTY_CLAIM: "Property Claim",
	EVIDENCE: "Evidence",
	CONTEXT: "Context",
	JUSTIFICATION: "Justification",
	ASSUMPTION: "Assumption",
	MODULE: "Module",
	AWAY_GOAL: "Away Goal",
	CONTRACT: "Contract",
};

function isCoreElementType(type: string): type is CoreElementType {
	return Object.hasOwn(CORE_PREFIXES, type);
}

/** Escapes regex metacharacters — defensive only; no current prefix contains one. */
function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Builds the anchored full-format pattern for a prefix: `<prefix><n>(.<n>)*`, start to end. */
function buildFullFormatPattern(prefix: string): RegExp {
	return new RegExp(`^${escapeRegExp(prefix)}[0-9]+(\\.[0-9]+)*$`);
}

/**
 * Returns the ruled prefix for a core element type, or `undefined` if `type`
 * isn't one of the ten known types (e.g. a plugin-only type, or a typo).
 */
export function getCorePrefix(type: string): string | undefined {
	return isCoreElementType(type) ? CORE_PREFIXES[type] : undefined;
}

// ---------------------------------------------------------------------------
// Plugin override seam
// ---------------------------------------------------------------------------

/** elementType -> pluginId -> that plugin's registered patterns for the type. */
const pluginPatternsByType = new Map<string, Map<string, RegExp[]>>();

function isSamePatternList(
	a: readonly RegExp[],
	b: readonly RegExp[]
): boolean {
	if (a.length !== b.length) {
		return false;
	}
	return a.every(
		(re, i) => re.source === b[i]?.source && re.flags === b[i]?.flags
	);
}

/**
 * Registers one or more additional accepted name patterns for `type`,
 * attributed to `pluginId`. Additive only — nothing here can remove a core
 * pattern or a pattern registered by a different plugin. Call once per
 * plugin module, at bootstrap (mirrors `SlotRegistry.register`):
 *
 * - A second call for the same `pluginId` + `type` with an identical pattern
 *   list (same regex sources and flags) is a silent no-op — safe against a
 *   bootstrap module whose top-level `register()` calls run more than once
 *   in a process (e.g. HMR, or a test importing the real bootstrap).
 * - A second call for the same `pluginId` + `type` with a DIFFERENT pattern
 *   list throws — a first-party programming error, not a legitimate re-run.
 */
export function registerPluginNamePatterns(
	pluginId: string,
	type: string,
	pattern: RegExp | readonly RegExp[]
): void {
	const patterns = Array.isArray(pattern) ? pattern : [pattern as RegExp];

	let byPlugin = pluginPatternsByType.get(type);
	if (!byPlugin) {
		byPlugin = new Map();
		pluginPatternsByType.set(type, byPlugin);
	}

	const existing = byPlugin.get(pluginId);
	if (existing) {
		if (isSamePatternList(existing, patterns)) {
			return;
		}
		throw new Error(
			`Cannot register name pattern(s) for plugin '${pluginId}' on element type '${type}': a conflicting registration already exists for this plugin and type`
		);
	}

	byPlugin.set(pluginId, patterns);
}

/**
 * Every pattern accepted for `type`: the core full-format pattern (if `type`
 * is one of the ten known types) plus any plugin-registered pattern whose
 * plugin id is in `enabledPluginIds`. A plugin's patterns are invisible to
 * every caller that doesn't pass its id — disabling a plugin stops its
 * patterns validating NEW names without touching names already stored in
 * that format (back-compat, per the design note).
 */
export function getAcceptedPatterns(
	type: string,
	enabledPluginIds: readonly string[] = []
): RegExp[] {
	const patterns: RegExp[] = [];

	const corePrefix = getCorePrefix(type);
	if (corePrefix) {
		patterns.push(buildFullFormatPattern(corePrefix));
	}

	const byPlugin = pluginPatternsByType.get(type);
	if (byPlugin) {
		for (const [pluginId, pluginPatterns] of byPlugin) {
			if (enabledPluginIds.includes(pluginId)) {
				patterns.push(...pluginPatterns);
			}
		}
	}

	return patterns;
}

/** Does `name` match at least one pattern accepted for `type`, given `enabledPluginIds`? */
export function isValidElementName(
	type: string,
	name: string,
	enabledPluginIds: readonly string[] = []
): boolean {
	return getAcceptedPatterns(type, enabledPluginIds).some((pattern) =>
		pattern.test(name)
	);
}

/**
 * Human-readable description of the expected name format for `type`, for use
 * directly in a validation error message (e.g. "Property Claim names must
 * look like P1 or P1.1"). Falls back to a generic message for a type this
 * registry doesn't know a core prefix for.
 */
export function describeExpectedFormat(type: string): string {
	const prefix = getCorePrefix(type);
	if (!(prefix && isCoreElementType(type))) {
		return "Names must follow this element type's registered format";
	}
	return `${TYPE_LABELS[type]} names must look like ${prefix}1 or ${prefix}1.1`;
}

/**
 * Test-only: clears every plugin-registered pattern so each test file starts
 * from a clean slate. Production code must never call this — plugin
 * registrations live for the process lifetime, same as `SlotRegistry.resetForTests`.
 */
export function resetPluginNamePatternsForTests(): void {
	pluginPatternsByType.clear();
}
