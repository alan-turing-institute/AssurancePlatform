/**
 * The `tea.health` plugin's UI registration (ADR 0002 v2 §2.3/§3): registers
 * `HealthBadge` into `elementBadgeSlot` and `HealthPanel` into
 * `elementPanelSlot`. The registry's contract (`lib/plugins/slots/
 * registry.ts`) requires this to happen once, at import time — never
 * per-request — which is why `registerHealthPlugin()` both runs immediately
 * below AND is exported: a real bootstrap import gets the module-load side
 * effect for free, while tests call it explicitly after
 * `elementBadgeSlot.resetForTests()` / `elementPanelSlot.resetForTests()`.
 *
 * Bootstrap point — OPEN QUESTION (flagged in the delegation return):
 * nothing in the app imports this module yet. ADR 0002 v2 §2.3 says official
 * plugins register "through one registry module" but does not name where an
 * official plugin's UI module itself gets imported into the running app —
 * unlike, say, `lib/export/exporters/`'s pattern, which this registry
 * otherwise mirrors. Until cid settles that, this module is wired against
 * test-only registration; the badge/panel will not appear in a real running
 * app until something imports `lib/plugins/health/register`.
 *
 * Bootstrap safety (review forward-note v4): `SlotRegistry.register()`
 * throws on a bad registration (unknown plugin id, undeclared surface) by
 * design — a programming error in first-party code, not user input. Once a
 * real bootstrap point imports this module, a throw here must not
 * white-screen the whole bundle, so the calls are wrapped defensively:
 * catch, log, degrade to "unregistered" (the badge/panel simply never
 * appear — the same observable behaviour as the plugin being disabled).
 */

import { elementBadgeSlot, elementPanelSlot } from "@/lib/plugins/slots";
import { HealthBadge } from "./health-badge";
import { HealthPanel } from "./health-panel";

const PLUGIN_ID = "tea.health";

export function registerHealthPlugin(): void {
	try {
		elementBadgeSlot.register({
			pluginId: PLUGIN_ID,
			Component: HealthBadge,
		});
		elementPanelSlot.register({
			pluginId: PLUGIN_ID,
			tabId: PLUGIN_ID,
			label: "Evidence",
			Component: HealthPanel,
		});
	} catch (error) {
		// No structured logger exists in this codebase yet (CLAUDE.md names
		// one; none of the merged health-plugin server-core files use it
		// either) — console.error matches the prevailing actual pattern, not a
		// deviation introduced here.
		console.error(
			"[tea.health] UI slot registration failed — badge/panel will not render:",
			error
		);
	}
}

registerHealthPlugin();
