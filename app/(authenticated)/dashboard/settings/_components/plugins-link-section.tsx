"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { usePluginSettings } from "@/hooks/use-plugin-settings";

/**
 * Settings-landing link-out to the Plugins page (`/dashboard/settings/
 * plugins`, TEA — Plugin management surface D1) — mirrors
 * `IntegrationsLinkSection`. The full plugin manager (description, what it
 * adds, off-switch consequences) stays on its own page; this is a link-out
 * plus a live count only. One place manages; the landing page points at it.
 */
export function PluginsLinkSection() {
	const { plugins } = usePluginSettings();
	const onCount = plugins.filter(
		(plugin) => plugin.available && plugin.enabled
	).length;

	return (
		<div
			className="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-8"
			data-testid="plugins-link-section"
		>
			<div>
				<h2 className="font-semibold text-base text-foreground leading-7">
					Plugins
				</h2>
				<p className="mt-1 text-muted-foreground text-sm leading-6">
					{`${onCount} plugin${onCount === 1 ? "" : "s"} on`}
				</p>
			</div>

			<div className="md:col-span-2">
				<Button asChild variant="outline">
					<Link href="/dashboard/settings/plugins">Manage plugins →</Link>
				</Button>
			</div>
		</div>
	);
}
