"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { PluginSettingsListItem } from "@/hooks/use-plugin-settings";
import { settingsSectionSlot } from "@/lib/plugins/slots";
import { cn } from "@/lib/utils";
import { PluginSettingsSlot } from "../../_components/plugin-settings-slot";
import { PluginOffConfirmDialog } from "./plugin-off-confirm-dialog";
import { whatItAddsCopy } from "./plugin-surface-copy";

export interface PluginCardProps {
	onToggle: (pluginId: string, enabled: boolean) => void;
	/** True while a toggle request for this plugin is in flight. */
	pending?: boolean;
	plugin: PluginSettingsListItem;
}

/**
 * The effective-state message shown under a plugin's name. Deployment
 * unavailability takes priority over everything else, and a block from
 * ORGANISATION/TEAM reads distinctly from the user's own off state — both
 * carried over unchanged from the row this card replaces (`PluginToggleRow`,
 * retired the same commit) so the strings a user has already seen don't
 * change.
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
 * A single plugin's card on the Plugins page (TEA — Plugin management
 * surface D2): name/version, description, "what it adds" (derived from
 * `surfaces`), a Learn more link to its docs, status, the user-tier toggle,
 * and its `settings-section` slot (or the "no settings" sentence when
 * nothing is registered into it — D4).
 *
 * Turning ON is immediate, matching today's behaviour. Turning OFF opens a
 * confirmation dialog (D3) instead of calling `onToggle` straight away; the
 * dialog itself is what calls `onToggle` once the user confirms.
 */
export function PluginCard({
	onToggle,
	pending = false,
	plugin,
}: PluginCardProps) {
	const [confirmOffOpen, setConfirmOffOpen] = useState(false);
	const lockedByHigherScope =
		plugin.pinnedAt === "ORGANISATION" || plugin.pinnedAt === "TEAM";
	const locked = !plugin.available || lockedByHigherScope;
	const toggleId = `plugin-toggle-${plugin.pluginId}`;
	// available is always paired with enabled: false in the effective-state
	// resolver, but this stays explicit rather than trusting that invariant.
	const checked = plugin.available && plugin.enabled;
	const whatItAdds = whatItAddsCopy(plugin.surfaces);
	// Covers both halves of D4's rule in one check: a plugin whose manifest
	// doesn't declare `settings-section` has no registration here by
	// construction (the registry refuses one), and a plugin that declares
	// the surface but has nothing registered (tea.health today) also has
	// none — either way, an empty result means "show the sentence".
	const hasRegisteredSettings = settingsSectionSlot
		.list()
		.some((registration) => registration.pluginId === plugin.pluginId);

	function handleCheckedChange(next: boolean) {
		if (next) {
			onToggle(plugin.pluginId, true);
			return;
		}
		setConfirmOffOpen(true);
	}

	function handleConfirmOff() {
		setConfirmOffOpen(false);
		onToggle(plugin.pluginId, false);
	}

	return (
		<div className="space-y-3 rounded-lg border border-border bg-card p-4">
			<div className="flex items-start justify-between gap-4">
				<div className="space-y-1">
					<div className="flex items-center gap-2">
						<span className="font-medium text-foreground text-sm">
							{plugin.name}
						</span>
						<span className="text-muted-foreground text-xs">
							v{plugin.version}
						</span>
					</div>
					<p className="text-foreground text-sm">{plugin.description}</p>
				</div>

				<div className="flex shrink-0 items-center">
					<Label className="sr-only" htmlFor={toggleId}>
						{`Turn ${plugin.name} ${checked ? "off" : "on"}`}
					</Label>
					<Switch
						checked={checked}
						disabled={locked || pending}
						id={toggleId}
						onCheckedChange={handleCheckedChange}
					/>
				</div>
			</div>

			{whatItAdds.length > 0 && (
				<div>
					<h4 className="font-medium text-foreground text-xs uppercase tracking-wide">
						What it adds
					</h4>
					<ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground text-sm">
						{whatItAdds.map((line) => (
							<li key={line}>{line}</li>
						))}
					</ul>
				</div>
			)}

			<div className="flex items-center justify-between gap-4">
				<p
					className={cn(
						"text-sm",
						locked ? "text-muted-foreground" : "text-foreground"
					)}
				>
					{pending ? "Saving…" : statusMessage(plugin)}
				</p>
				{plugin.docsPath && (
					<Button asChild className="h-auto p-0" variant="link">
						<Link href={plugin.docsPath}>Learn more</Link>
					</Button>
				)}
			</div>

			{checked &&
				(hasRegisteredSettings ? (
					<PluginSettingsSlot pluginId={plugin.pluginId} />
				) : (
					<p className="text-muted-foreground text-sm">
						This plugin has no settings.
					</p>
				))}

			<PluginOffConfirmDialog
				onConfirm={handleConfirmOff}
				onOpenChange={setConfirmOffOpen}
				open={confirmOffOpen}
				pending={pending}
				pluginId={plugin.pluginId}
				pluginName={plugin.name}
			/>
		</div>
	);
}
