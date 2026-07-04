/**
 * The UI extension slot registry (ADR 0002 v2 §2.3) — the pattern
 * `lib/export/exporters/base-exporter.ts` already proves, applied to
 * build-time-registered plugin UI instead of export formats.
 *
 * A `SlotRegistry` holds every plugin's registration for one slot id, in
 * registration order. Registration is validated against the manifest
 * (`lib/plugins/manifest.ts`) — a plugin can only register into a slot its
 * own manifest entry admits to using — but says nothing about whether that
 * registration is currently *enabled* for any given user; that's a runtime
 * question the render-time consumers (`hooks/use-element-badge-slot.tsx`,
 * `hooks/use-element-panel-slot.ts`) answer by filtering `.list()` against
 * effective enablement.
 *
 * Client-side by intent, despite living under `lib/`: the exported instances
 * below (`elementBadgeSlot` et al.) are one module-level singleton per slot,
 * populated by official plugin modules calling `.register()` at import time
 * in the client bundle. Importing this module from server code (a route, a
 * server action) would spin up a second, unsynchronised registry in the
 * server runtime — registrations made in one would simply be invisible to
 * the other, with no error to flag the split. Nothing server-side needs to
 * import from here yet; enforcing that structurally (an eslint/biome
 * boundary rule) is a 1.1 concern, not a 1.0 blocker.
 */

import { getManifestEntry } from "@/lib/plugins/manifest";
import type {
	ElementBadgeRegistration,
	ElementPanelRegistration,
	SettingsSectionRegistration,
	SlotId,
} from "./types";

/**
 * Own-enumerable-key shallow compare (`Object.is` per value, so a `Component`
 * field only counts as equal when it's the SAME function reference — two
 * components that merely render the same output are still a conflict).
 * Deliberately generic rather than hand-listing `Component`/`tabId`/`label`:
 * `SlotRegistry` is shared across three differently-shaped registration
 * types (`ElementBadgeRegistration`, `ElementPanelRegistration`,
 * `SettingsSectionRegistration`), and this way a future field added to any
 * of them is compared for free, with no change here.
 */
function isShallowEqualRegistration<T extends { pluginId: string }>(
	a: T,
	b: T
): boolean {
	const aKeys = Object.keys(a) as (keyof T)[];
	const bKeys = Object.keys(b) as (keyof T)[];
	if (aKeys.length !== bKeys.length) {
		return false;
	}
	return aKeys.every((key) => Object.is(a[key], b[key]));
}

export class SlotRegistry<TRegistration extends { pluginId: string }> {
	private readonly registrations: TRegistration[] = [];
	private readonly slotId: SlotId;

	constructor(slotId: SlotId) {
		this.slotId = slotId;
	}

	/**
	 * Registers a plugin's contribution to this slot. Call once per plugin
	 * module, at import time — never per-request. Throws rather than
	 * returning a `ServiceResult`: an invalid registration is a programming
	 * error in a first-party plugin module, not user input to report
	 * gracefully.
	 *
	 * Two checks, both load-bearing for the one-way dependency rule (ADR
	 * §1): the pluginId must be a real manifest entry, and that entry must
	 * declare this slot's id among its `surfaces` — a plugin cannot show up
	 * somewhere its own manifest doesn't admit to reaching.
	 *
	 * Idempotent by pluginId (bootstrap safety, `lib/plugins/bootstrap.ts`):
	 * a plugin's register module runs its top-level `register()` calls as an
	 * import side effect, and nothing here guarantees that module's import
	 * graph is only ever entered once in a given process — a test file that
	 * imports the bootstrap alongside the real providers path importing it
	 * too, for instance. A second call for a pluginId already present in
	 * this slot is a silent no-op ONLY when it is the identical registration
	 * (every field shallow-equal to the one already held) — without this,
	 * `.list()` would return the same registration twice, and every render-
	 * time consumer that maps over it keyed by `pluginId`
	 * (`useElementBadgeSlot`, `useElementPanelSlot`) would render the
	 * plugin's UI twice under a duplicate React key.
	 *
	 * A second call that differs from the first (a different `Component`,
	 * `tabId`, or `label` for the SAME pluginId) is not a re-run bootstrap —
	 * it is a first-party programming error (two plugin modules, or two
	 * versions of one, both claiming the same pluginId in this slot with
	 * different contents) and throws, exactly like the unknown-plugin and
	 * undeclared-surface checks above it (vincent review, 2026-07-04). One
	 * accepted source of a legitimate-looking "conflict": dev-mode HMR
	 * reloading a plugin's register module gives its `Component` a fresh
	 * function identity on every reload, so a second registration after a
	 * hot reload IS a shallow-compare mismatch and WILL throw here — caught
	 * and logged by `register.ts`'s try/catch (degrades to "unregistered"
	 * for that reload), not a bug in this method.
	 */
	register(registration: TRegistration): void {
		const entry = getManifestEntry(registration.pluginId);
		if (!entry) {
			throw new Error(
				`Cannot register '${registration.pluginId}' into slot '${this.slotId}': unknown plugin (not in PLUGIN_MANIFEST)`
			);
		}
		if (!entry.surfaces.includes(this.slotId)) {
			throw new Error(
				`Cannot register '${registration.pluginId}' into slot '${this.slotId}': its manifest entry does not declare this surface`
			);
		}
		const existing = this.registrations.find(
			(candidate) => candidate.pluginId === registration.pluginId
		);
		if (existing) {
			if (isShallowEqualRegistration(existing, registration)) {
				return;
			}
			throw new Error(
				`Cannot register '${registration.pluginId}' into slot '${this.slotId}': a conflicting registration already exists for this plugin (different Component/tabId/label)`
			);
		}
		this.registrations.push(registration);
	}

	/** Every registration for this slot, in registration order. Callers filter by effective enablement before rendering. */
	list(): readonly TRegistration[] {
		return this.registrations;
	}

	/**
	 * Test-only. Clears every registration so each test file starts from a
	 * clean slate — production code must never call this; registrations are
	 * meant to live for the process lifetime (build-time registration, not
	 * request-scoped state).
	 */
	resetForTests(): void {
		this.registrations.length = 0;
	}
}

/** 1.0 slot registries — one instance per slot id, shared process-wide. */
export const elementBadgeSlot = new SlotRegistry<ElementBadgeRegistration>(
	"element-badge"
);
export const elementPanelSlot = new SlotRegistry<ElementPanelRegistration>(
	"element-panel"
);
export const settingsSectionSlot =
	new SlotRegistry<SettingsSectionRegistration>("settings-section");
