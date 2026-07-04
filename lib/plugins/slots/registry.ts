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
	 * this slot is a silent no-op rather than a second entry: without this,
	 * `.list()` would return the same registration twice, and every render-
	 * time consumer that maps over it keyed by `pluginId`
	 * (`useElementBadgeSlot`, `useElementPanelSlot`) would render the
	 * plugin's UI twice under a duplicate React key.
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
		const alreadyRegistered = this.registrations.some(
			(existing) => existing.pluginId === registration.pluginId
		);
		if (alreadyRegistered) {
			return;
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
