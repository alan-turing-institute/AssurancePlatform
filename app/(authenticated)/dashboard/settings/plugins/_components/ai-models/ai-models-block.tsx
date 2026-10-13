"use client";

import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useModelSettings } from "@/hooks/use-model-settings";
import { ConnectionsList } from "./connections-list";
import { JobsList } from "./jobs-list";
import { QuickSetup } from "./quick-setup";

/** The id of the block, which links and the page's own scroll-to-anchor point at. */
export const AI_MODELS_ANCHOR = "ai-models";

/** The message of a failed load or refetch, with a button that fetches again. */
function LoadFailure({
	message,
	onRetry,
}: {
	message: string;
	onRetry: () => Promise<void>;
}) {
	const [retrying, setRetrying] = useState(false);

	async function retry() {
		setRetrying(true);
		await onRetry();
		setRetrying(false);
	}

	return (
		<div className="space-y-3">
			<Alert variant="destructive">
				<AlertDescription>{message}</AlertDescription>
			</Alert>
			<Button
				disabled={retrying}
				onClick={retry}
				size="sm"
				type="button"
				variant="outline"
			>
				{retrying ? "Retrying…" : "Retry"}
			</Button>
		</div>
	);
}

/**
 * The "AI models" block on the Plugins tab: quick setup, the user's model
 * connections, and which connection and model does each of the three jobs.
 * It appears only while a plugin that uses models is on. A failed load or
 * refetch shows its message with a Retry button in place of the content.
 */
export function AiModelsBlock() {
	const models = useModelSettings();
	const { settings } = models;

	return (
		<section
			aria-labelledby="ai-models-heading"
			className="grid grid-cols-1 gap-x-8 gap-y-10 md:col-span-3 md:grid-cols-3"
			id={AI_MODELS_ANCHOR}
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
					<LoadFailure message={models.error} onRetry={models.reload} />
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
