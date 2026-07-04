"use client";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { PluginSettingsListItem } from "@/hooks/use-plugin-settings";
import { cn } from "@/lib/utils";
import { PluginSettingsSlot } from "./plugin-settings-slot";

export interface PluginToggleRowProps {
	onToggle: (pluginId: string, enabled: boolean) => void;
	/** True while a toggle request for this row is in flight. */
	pending?: boolean;
	plugin: PluginSettingsListItem;
}

/**
 * The effective-state message shown under a plugin's name. Deployment
 * unavailability takes priority over everything else — an unavailable
 * plugin must read as unavailable, never as a dead toggle (brief
 * acceptance criteria). A block from ORGANISATION/TEAM reads distinctly
 * from the user's own off state: "off wins downward" (ADR §2.2) means the
 * user cannot override either, but their own toggle is exactly what set a
 * plain "Off".
 */
function statusMessage(plugin: PluginSettingsListItem): string {
	if (!plugin.available) {
		return "Unavailable on this deployment";
	}
	if (plugin.pinnedAt === "ORGANISATION") {
		return "Turned off by your organisation — you cannot turn this on yourself";
	}
	if (plugin.pinnedAt === "TEAM") {
		return "Turned off by your team — you cannot turn this on yourself";
	}
	return plugin.enabled ? "On" : "Off";
}

/**
 * A single plugin's row in the settings pane: name/version, the
 * user-tier toggle, the effective-state message (incl. which level pinned
 * it), and that plugin's `settings-section` slot. Presentational — all data
 * fetching and toggle plumbing live in `usePluginSettings`.
 */
export function PluginToggleRow({
	onToggle,
	pending = false,
	plugin,
}: PluginToggleRowProps) {
	const lockedByHigherScope =
		plugin.pinnedAt === "ORGANISATION" || plugin.pinnedAt === "TEAM";
	const locked = !plugin.available || lockedByHigherScope;
	const toggleId = `plugin-toggle-${plugin.pluginId}`;
	// available is always paired with enabled: false in the effective-state
	// resolver, but this stays explicit rather than trusting that invariant.
	const checked = plugin.available && plugin.enabled;

	return (
		<div className="rounded-lg border border-border bg-card p-4">
			<div className="flex items-center justify-between gap-4">
				<div className="space-y-1">
					<div className="flex items-center gap-2">
						<span className="font-medium text-foreground text-sm">
							{plugin.name}
						</span>
						<span className="text-muted-foreground text-xs">
							v{plugin.version}
						</span>
					</div>
					<p
						className={cn(
							"text-sm",
							locked ? "text-muted-foreground" : "text-foreground"
						)}
					>
						{pending ? "Saving…" : statusMessage(plugin)}
					</p>
				</div>

				<div className="flex shrink-0 items-center">
					<Label className="sr-only" htmlFor={toggleId}>
						{`Turn ${plugin.name} ${checked ? "off" : "on"}`}
					</Label>
					<Switch
						checked={checked}
						disabled={locked || pending}
						id={toggleId}
						onCheckedChange={(next) => onToggle(plugin.pluginId, next)}
					/>
				</div>
			</div>

			{checked && <PluginSettingsSlot pluginId={plugin.pluginId} />}
		</div>
	);
}
