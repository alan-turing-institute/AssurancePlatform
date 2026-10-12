"use client";

import { AlertCircle } from "lucide-react";
import { useEffect, useRef } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useModelSettings } from "@/hooks/use-model-settings";
import { ConnectionsList } from "./connections-list";
import { JobsList } from "./jobs-list";
import { QuickSetup } from "./quick-setup";

const AI_MODELS_ANCHOR = "ai-models";

/**
 * The "AI models" block on the Plugins tab: quick setup, the user's model
 * connections, and which connection and model does each of the three jobs.
 * It appears only while a plugin that uses models is on, and it is mounted
 * after the plugin list has loaded, so it scrolls itself into view when the
 * page was opened at `#ai-models`.
 */
export function AiModelsBlock() {
	const models = useModelSettings();
	const section = useRef<HTMLElement>(null);
	const { settings } = models;

	useEffect(() => {
		if (window.location.hash === `#${AI_MODELS_ANCHOR}`) {
			section.current?.scrollIntoView();
		}
	}, []);

	return (
		<section
			aria-labelledby="ai-models-heading"
			className="grid grid-cols-1 gap-x-8 gap-y-10 md:col-span-3 md:grid-cols-3"
			id={AI_MODELS_ANCHOR}
			ref={section}
		>
			<div>
				<h2
					className="font-semibold text-base text-foreground leading-7"
					id="ai-models-heading"
				>
					AI models
				</h2>
				<p className="mt-1 text-muted-foreground text-sm leading-6">
					The model connections your plugins use, and which one does each job.
				</p>
			</div>

			<div className="space-y-8 md:col-span-2">
				{models.loading && (
					<div className="space-y-3" data-testid="ai-models-loading">
						<Skeleton className="h-20 w-full rounded-lg" />
						<Skeleton className="h-40 w-full rounded-lg" />
					</div>
				)}

				{!models.loading && models.error && (
					<div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-destructive text-sm">
						<AlertCircle aria-hidden="true" className="h-4 w-4 shrink-0" />
						<span>{models.error}</span>
					</div>
				)}

				{!(models.loading || models.error) && settings && (
					<>
						<QuickSetup onQuickSetup={models.quickSetup} />
						<ConnectionsList
							connections={settings.connections}
							connectionTypes={settings.connectionTypes}
							onAdd={models.addConnection}
							onRemove={models.removeConnection}
							onTest={models.testConnection}
							onUpdate={models.updateConnection}
							roles={settings.roles}
							testing={models.testing}
							tests={models.tests}
						/>
						<JobsList
							connections={settings.connections}
							connectionTypes={settings.connectionTypes}
							lastSearchCheck={models.lastSearchCheck}
							onLoadModels={(id) =>
								models.tests[id] || models.testing.includes(id)
									? Promise.resolve(null)
									: models.testConnection(id)
							}
							onSave={models.saveJobs}
							recommended={settings.recommended}
							roles={settings.roles}
							testing={models.testing}
							tests={models.tests}
						/>
					</>
				)}
			</div>
		</section>
	);
}
