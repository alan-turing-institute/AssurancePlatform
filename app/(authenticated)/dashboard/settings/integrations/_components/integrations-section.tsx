"use client";

import { AlertCircle, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useIntegrations } from "@/hooks/use-integrations";
import { IntegrationCard } from "./integration-card";
import { IntegrationRegisterDialog } from "./integration-register-dialog";

/**
 * The Integrations settings pane — lists the caller's registered machine
 * clients (`GET /api/integrations`) with register/lifecycle/token actions
 * (ADR 0002 v2 §2.4, work item 7's settings-page half). Fetches and mutates
 * entirely through `useIntegrations` — no other data source, no direct
 * service/Prisma import, per the house rule for this pane (mirrors
 * `PluginsSection`'s relationship to `usePluginSettings`).
 */
export function IntegrationsSection() {
	const {
		integrations,
		loading,
		error,
		registering,
		registerIntegration,
		pendingIntegrationId,
		deletingId,
		pendingTokenKey,
		suspendIntegration,
		reactivateIntegration,
		revokeIntegration,
		deleteIntegration,
		issueToken,
		rotateToken,
		revokeToken,
	} = useIntegrations();

	const registerButtonRef = useRef<HTMLButtonElement>(null);
	const [registerOpen, setRegisterOpen] = useState(false);
	const [checkFocusAfterDelete, setCheckFocusAfterDelete] = useState(false);
	// Bumped on every "open" click and used as the dialog's `key` — remounting
	// it is how it gets a fresh `useForm` state each time it opens (React's
	// own recommended fix for "resetting state when a prop changes", rather
	// than a `useEffect` watching `open` to imperatively call `form.reset()`).
	const [registerDialogInstance, setRegisterDialogInstance] = useState(0);

	// A deleted card takes its Delete button with it, so focus would fall to the
	// page body. A failed delete leaves the button in place and focus untouched.
	async function handleDelete(id: string) {
		await deleteIntegration(id);
		setCheckFocusAfterDelete(true);
	}

	// Runs after the commit that removed the deleted card.
	useEffect(() => {
		if (!checkFocusAfterDelete) {
			return;
		}
		setCheckFocusAfterDelete(false);
		const active = document.activeElement;
		if (!active || active === document.body) {
			registerButtonRef.current?.focus();
		}
	}, [checkFocusAfterDelete]);

	return (
		<div className="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-8">
			<div>
				<h2 className="font-semibold text-base text-foreground leading-7">
					Integrations
				</h2>
				<p className="mt-1 text-muted-foreground text-sm leading-6">
					Manage external machine clients that authenticate against the
					platform's API on your behalf — pipelines, evidence collectors, and
					other automated callers. Each integration authenticates with its own
					bearer tokens, scoped to the verbs it's allowed to call.
				</p>
			</div>

			<div className="space-y-4 md:col-span-2">
				<div className="flex justify-end">
					<Button
						onClick={() => {
							setRegisterDialogInstance((instance) => instance + 1);
							setRegisterOpen(true);
						}}
						ref={registerButtonRef}
						type="button"
					>
						<Plus aria-hidden="true" className="h-4 w-4" />
						Register integration
					</Button>
				</div>

				{loading && (
					<div className="space-y-3" data-testid="integrations-section-loading">
						<Skeleton className="h-32 w-full rounded-lg" />
						<Skeleton className="h-32 w-full rounded-lg" />
					</div>
				)}

				{!loading && error && (
					<div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-destructive text-sm">
						<AlertCircle aria-hidden="true" className="h-4 w-4 shrink-0" />
						<span>{error}</span>
					</div>
				)}

				{!(loading || error) && integrations.length === 0 && (
					<p className="text-muted-foreground text-sm">
						You haven't registered any integrations yet.
					</p>
				)}

				{!(loading || error) &&
					integrations.map((integration) => (
						<IntegrationCard
							deleting={deletingId === integration.id}
							integration={integration}
							key={integration.id}
							onDelete={handleDelete}
							onIssueToken={issueToken}
							onReactivate={reactivateIntegration}
							onRevoke={revokeIntegration}
							onRevokeToken={revokeToken}
							onRotateToken={rotateToken}
							onSuspend={suspendIntegration}
							pending={pendingIntegrationId === integration.id}
							pendingTokenKey={pendingTokenKey}
						/>
					))}
			</div>

			<IntegrationRegisterDialog
				key={registerDialogInstance}
				onOpenChange={setRegisterOpen}
				onSubmit={registerIntegration}
				open={registerOpen}
				returnFocusRef={registerButtonRef}
				submitting={registering}
			/>
		</div>
	);
}
