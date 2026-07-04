/**
 * The `settings-section` extension point (ADR 0002 v2 §2.3) — the region
 * within a plugin's row where an enabled plugin will one day contribute its
 * own settings UI (e.g. the health plugin's scoring thresholds).
 *
 * No plugin registers into this slot yet — the registry that would let a
 * plugin do so is `[[TEA — UI extension slots]]` (separate issue, out of
 * scope here). This component is the seam that registry will fill in: it
 * renders nothing now, matching §2.3's rule that "slots render nothing when
 * no enabled plugin registers into them" — core screens must be complete
 * with every slot empty, so this must never leave a layout artefact
 * (an empty border, a stray heading) behind it.
 */
export function PluginSettingsSlot(_props: { pluginId: string }) {
	return null;
}
