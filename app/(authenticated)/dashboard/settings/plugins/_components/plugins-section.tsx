"use client";

import { AlertCircle } from "lucide-react";
import { useEffect, useRef } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
	type PluginSettingsListItem,
	usePluginSettings,
} from "@/hooks/use-plugin-settings";
import { getManifestEntry } from "@/lib/plugins/manifest";
import { AI_MODELS_ANCHOR, AiModelsBlock } from "./ai-models/ai-models-block";
import { PluginCard } from "./plugin-card";

/**
 * Whether any plugin that is on for the user calls the models they connect.
 * `GET /api/user/plugins` does not say, so the manifest, which the browser
 * bundle carries, is asked.
 */
function usesModels(plugins: readonly PluginSettingsListItem[]): boolean {
	return plugins.some(
		(plugin) =>
			plugin.available &&
			plugin.enabled &&
			getManifestEntry(plugin.pluginId)?.usesModels === true
	);
}

/**
 * Scrolls to the AI models block the first time it shows, when the page was
 * opened at its anchor: the block is built after the plugin list loads, so the
 * browser's own jump to the anchor finds nothing. Showing it again later (a
 * plugin turned off and on) leaves the scroll position alone.
 */
function useScrollToAiModelsOnce(shown: boolean) {
	const done = useRef(false);
	useEffect(() => {
		if (!shown || done.current) {
			return;
		}
		done.current = true;
		if (window.location.hash === `#${AI_MODELS_ANCHOR}`) {
			document.getElementById(AI_MODELS_ANCHOR)?.scrollIntoView();
		}
	}, [shown]);
}

/**
 * The Plugins page's content (TEA — Plugin management surface D1/D2):
 * heading, intro, and a card per plugin. Fetches and toggles entirely
 * through `usePluginSettings` (`/api/user/plugins`) — no other data source,
 * per the house rule for this pane. Moved here from the settings landing
 * page's `_components/plugins-section.tsx` (which now only links out —
 * see `PluginsLinkSection`) and extended from a name+version+switch row
 * (`PluginToggleRow`, retired the same commit) to a full card
 * (`PluginCard`): description, what it adds, a docs link, and the D3
 * off-switch confirmation. When a plugin that uses models is on, the
 * "AI models" block follows the cards.
 */
export function PluginsSection() {
	const { plugins, loading, error, togglingId, togglePlugin } =
		usePluginSettings();
	const showModels = !(loading || error) && usesModels(plugins);
	useScrollToAiModelsOnce(showModels);

	return (
		<div className="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-8">
			<div>
				<h2 className="font-semibold text-base text-foreground leading-7">
					Plugins
				</h2>
				<p className="mt-1 text-muted-foreground text-sm leading-6">
					Official plugins extend the case builder. Turning a plugin off here
					hides it for your account only — data other collaborators have written
					stays stored, though passing results that repeat are still thinned out
					each night.
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
						<PluginCard
							key={plugin.pluginId}
							onToggle={togglePlugin}
							pending={togglingId === plugin.pluginId}
							plugin={plugin}
						/>
					))}
			</div>

			{showModels && <AiModelsBlock />}
		</div>
	);
}
