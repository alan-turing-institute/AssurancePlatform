"use client";

import { AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { usePluginSettings } from "@/hooks/use-plugin-settings";
import { PluginToggleRow } from "./plugin-toggle-row";

/**
 * The plugins settings pane (ADR 0002 v2 §2.2: "a settings section ... lists
 * available plugins with toggle + per-plugin settings, showing the
 * effective state and which level pinned it"). Fetches and toggles entirely
 * through `usePluginSettings` (`/api/user/plugins`) — no other data source,
 * per the house rule for this pane.
 */
export function PluginsSection() {
	const { plugins, loading, error, togglingId, togglePlugin } =
		usePluginSettings();

	return (
		<div className="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-8">
			<div>
				<h2 className="font-semibold text-base text-foreground leading-7">
					Plugins
				</h2>
				<p className="mt-1 text-muted-foreground text-sm leading-6">
					Official plugins extend the case builder. Turning a plugin off here
					hides it for your account only — data other collaborators have written
					stays inert, never deleted.
				</p>
			</div>

			<div className="space-y-3 md:col-span-2">
				{loading && (
					<div className="space-y-3" data-testid="plugins-section-loading">
						<Skeleton className="h-20 w-full rounded-lg" />
						<Skeleton className="h-20 w-full rounded-lg" />
					</div>
				)}

				{!loading && error && (
					<div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-destructive text-sm">
						<AlertCircle aria-hidden="true" className="h-4 w-4 shrink-0" />
						<span>{error}</span>
					</div>
				)}

				{!(loading || error) && plugins.length === 0 && (
					<p className="text-muted-foreground text-sm">
						No plugins are registered for this deployment.
					</p>
				)}

				{!(loading || error) &&
					plugins.map((plugin) => (
						<PluginToggleRow
							key={plugin.pluginId}
							onToggle={togglePlugin}
							pending={togglingId === plugin.pluginId}
							plugin={plugin}
						/>
					))}
			</div>
		</div>
	);
}
