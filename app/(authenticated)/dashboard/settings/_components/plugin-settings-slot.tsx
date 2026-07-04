import { settingsSectionSlot } from "@/lib/plugins/slots";

/**
 * The `settings-section` extension point (ADR 0002 v2 §2.3) — the region
 * within a plugin's row where an enabled plugin contributes its own settings
 * UI (e.g. the health plugin's scoring thresholds), wired through the
 * build-time slot registry (`[[TEA — UI extension slots]]`).
 *
 * No official plugin registers into this slot yet, so this renders nothing
 * in every 1.0 deployment — matching §2.3's rule that "slots render nothing
 * when no enabled plugin registers into them": core screens must be
 * complete with every slot empty, so this must never leave a layout
 * artefact (an empty border, a stray heading) behind it.
 *
 * Deliberately does not itself gate on enablement (unlike the canvas slots,
 * which read `use-plugin-enablement.ts`): the caller (`PluginToggleRow`)
 * already has the plugin's effective `enabled` state in scope from
 * `usePluginSettings`, so re-fetching it here would just be a second
 * request answering a question the pane already has the answer to. Gating
 * this slot's visibility on `enabled` is left to that call site.
 */
export function PluginSettingsSlot({ pluginId }: { pluginId: string }) {
	const registrations = settingsSectionSlot
		.list()
		.filter((registration) => registration.pluginId === pluginId);

	if (registrations.length === 0) {
		return null;
	}

	// A plugin registers into this slot at most once in practice — the
	// manifest carries one entry per pluginId, and a second registration for
	// the same plugin would be a bug in that plugin's module, not a case to
	// design a synthetic key around. `pluginId` alone is therefore a stable
	// key for the (expected) single element this renders.
	return (
		<>
			{registrations.map(({ Component }) => (
				<Component key={pluginId} pluginId={pluginId} />
			))}
		</>
	);
}
