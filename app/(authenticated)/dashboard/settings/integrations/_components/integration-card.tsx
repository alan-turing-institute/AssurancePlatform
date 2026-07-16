"use client";

import { Ban, KeyRound, PauseCircle, PlayCircle, Trash2 } from "lucide-react";
import { useState } from "react";
import { AlertModal } from "@/components/modals/alert-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useIntegrationCaseGrants } from "@/hooks/use-integration-case-grants";
import {
	formatFullDate,
	formatRelativeToNow,
	formatShortDate,
} from "@/lib/date";
import type {
	IntegrationListItem,
	IssuedTokenResult,
	RotatedTokenResult,
} from "@/lib/schemas/integration";
import { CaseAccessSection } from "./case-access-section";
import { IntegrationDeleteDialog } from "./integration-delete-dialog";
import { scopeLabel } from "./integration-scope-labels";
import { IntegrationStatusBadge } from "./integration-status-badge";
import { IntegrationTokenRow } from "./integration-token-row";
import {
	IntegrationTokenSecretModal,
	type TokenReveal,
} from "./integration-token-secret-modal";

export interface IntegrationCardProps {
	/** True while THIS integration's registration delete request is in flight. */
	deleting: boolean;
	integration: IntegrationListItem;
	onDelete: (id: string) => void;
	onIssueToken: (id: string) => Promise<IssuedTokenResult | null>;
	onReactivate: (id: string) => void;
	onRevoke: (id: string) => void;
	onRevokeToken: (integrationId: string, tokenId: string) => void;
	onRotateToken: (
		integrationId: string,
		tokenId: string
	) => Promise<RotatedTokenResult | null>;
	onSuspend: (id: string) => void;
	/** True while THIS integration's own lifecycle action (suspend/reactivate/revoke) is in flight. */
	pending: boolean;
	/** `${integrationId}:${tokenId}` or `${integrationId}` (issuing) currently in flight, shared across every card. */
	pendingTokenKey: string | null;
}

/**
 * One integration's management card: identity + status + scopes (functional
 * scope item 1), lifecycle actions (item 3), its tokens with issue/rotate/
 * revoke (item 4), and its case-access grants (the settings-page half of
 * "TEA — Integration case-access grants need a product surface"). Mostly
 * presentational — every LIST-level mutation (suspend/revoke/delete/tokens)
 * is still a callback prop from `IntegrationsSection`/`useIntegrations`, so
 * this component's own tests never touch that hook directly. The one
 * exception is case-access grants: unlike tokens, they are NOT embedded in
 * `IntegrationListItem` (a deliberate separate-resource choice on the API
 * side), so this component calls
 * `useIntegrationCaseGrants(integration.id, integration.status)` itself —
 * one hook call per card instance, not a hook-in-a-loop — and
 * threads its state down into the presentational `CaseAccessSection`. The
 * integration's own `status` is passed alongside its id so the hook's 409
 * copy stays correct even if the card revokes/suspends the integration
 * while this card's grant form is open.
 */
export function IntegrationCard({
	deleting,
	integration,
	onDelete,
	onIssueToken,
	onReactivate,
	onRevoke,
	onRevokeToken,
	onRotateToken,
	onSuspend,
	pending,
	pendingTokenKey,
}: IntegrationCardProps) {
	const [tokenReveal, setTokenReveal] = useState<TokenReveal | null>(null);
	const [confirmRevokeOpen, setConfirmRevokeOpen] = useState(false);
	const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
	const [confirmRevokeTokenId, setConfirmRevokeTokenId] = useState<
		string | null
	>(null);

	const {
		grants: caseGrants,
		loading: caseGrantsLoading,
		loadError: caseGrantsLoadError,
		granting: grantingCaseAccess,
		grantError,
		clearGrantError,
		grantAccess,
		removingCaseId,
		removeAccess,
		refetch: refetchCaseGrants,
	} = useIntegrationCaseGrants(integration.id, integration.status);

	const isIssuing = pendingTokenKey === integration.id;
	const integrationActive = integration.status === "ACTIVE";
	const integrationRevoked = integration.status === "REVOKED";

	async function handleIssueToken() {
		const result = await onIssueToken(integration.id);
		if (result) {
			setTokenReveal({ secret: result.secret });
		}
	}

	async function handleRotateToken(tokenId: string) {
		const result = await onRotateToken(integration.id, tokenId);
		if (result) {
			setTokenReveal({
				secret: result.secret,
				notice: `The previous token stays valid until ${formatFullDate(
					result.overlapUntil
				)}, so callers mid-flight have time to pick up the new one.`,
			});
		}
	}

	function handleConfirmRevokeToken() {
		const tokenId = confirmRevokeTokenId;
		setConfirmRevokeTokenId(null);
		if (tokenId) {
			onRevokeToken(integration.id, tokenId);
		}
	}

	return (
		<div
			className="space-y-4 rounded-lg border border-border bg-card p-4"
			data-testid={`integration-card-${integration.id}`}
		>
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="space-y-1">
					<div className="flex items-center gap-2">
						<span className="font-medium text-foreground text-sm">
							{integration.name}
						</span>
						<IntegrationStatusBadge status={integration.status} />
					</div>
					{integration.description && (
						<p className="text-muted-foreground text-sm">
							{integration.description}
						</p>
					)}
					<p className="text-muted-foreground text-xs">
						{`Registered ${formatShortDate(integration.createdAt)}`}
						{integration.lastSeenAt
							? ` · last seen ${formatRelativeToNow(integration.lastSeenAt)}`
							: " · never used"}
					</p>
					<div className="flex flex-wrap gap-1.5 pt-1">
						{integration.scopes.map((scope) => (
							<Badge key={scope} variant="outline">
								{scopeLabel(scope)}
							</Badge>
						))}
					</div>
				</div>

				<div className="flex flex-wrap items-center gap-2">
					{integrationActive && (
						<Button
							disabled={pending}
							onClick={() => onSuspend(integration.id)}
							size="sm"
							type="button"
							variant="outline"
						>
							<PauseCircle aria-hidden="true" className="h-3.5 w-3.5" />
							{pending ? "Suspending…" : "Suspend"}
						</Button>
					)}
					{integration.status === "SUSPENDED" && (
						<Button
							disabled={pending}
							onClick={() => onReactivate(integration.id)}
							size="sm"
							type="button"
							variant="outline"
						>
							<PlayCircle aria-hidden="true" className="h-3.5 w-3.5" />
							{pending ? "Reactivating…" : "Reactivate"}
						</Button>
					)}
					{integration.status !== "REVOKED" && (
						<Button
							aria-label="Revoke this integration"
							className="text-destructive hover:text-destructive"
							disabled={pending}
							onClick={() => setConfirmRevokeOpen(true)}
							size="sm"
							type="button"
							variant="outline"
						>
							<Ban aria-hidden="true" className="h-3.5 w-3.5" />
							Revoke
						</Button>
					)}
					<Button
						disabled={deleting || !integrationRevoked}
						onClick={() => setConfirmDeleteOpen(true)}
						size="sm"
						title={
							integrationRevoked
								? undefined
								: "Revoke first — delete is permanent"
						}
						type="button"
						variant="destructive"
					>
						<Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
						{deleting ? "Deleting…" : "Delete"}
					</Button>
				</div>
			</div>

			<div className="space-y-2 border-border border-t pt-3">
				<div className="flex items-center justify-between gap-2">
					<h4 className="font-medium text-foreground text-xs uppercase tracking-wide">
						Tokens
					</h4>
					<Button
						disabled={!integrationActive || isIssuing}
						onClick={handleIssueToken}
						size="sm"
						title={
							integrationActive
								? undefined
								: "Only an ACTIVE integration can issue a token"
						}
						type="button"
						variant="outline"
					>
						<KeyRound aria-hidden="true" className="h-3.5 w-3.5" />
						{isIssuing ? "Issuing…" : "Issue new token"}
					</Button>
				</div>

				{integration.tokens.length === 0 ? (
					<p className="text-muted-foreground text-xs">No tokens issued yet.</p>
				) : (
					<div className="space-y-2">
						{integration.tokens.map((token) => (
							<IntegrationTokenRow
								canRotate={integrationActive}
								key={token.id}
								onRevoke={(tokenId) => setConfirmRevokeTokenId(tokenId)}
								onRotate={handleRotateToken}
								pending={pendingTokenKey === `${integration.id}:${token.id}`}
								token={token}
							/>
						))}
					</div>
				)}
			</div>

			<CaseAccessSection
				grantError={grantError}
				granting={grantingCaseAccess}
				grants={caseGrants}
				integrationActive={integrationActive}
				// Keyed to activity, not `integration.id`: crossing the
				// ACTIVE/non-ACTIVE boundary (revoke or suspend from this same
				// card) remounts the section, which discards its own `addOpen`
				// state — the stale-form path this closes off — for free, with
				// no effect and no manual reset. Re-activating (SUSPENDED →
				// ACTIVE via Reactivate) remounts the same way, which is fine:
				// the form was never open across a state it can't act in anyway.
				key={integrationActive ? "active" : "inactive"}
				loadError={caseGrantsLoadError}
				loading={caseGrantsLoading}
				onClearGrantError={clearGrantError}
				onGrant={grantAccess}
				onRemove={removeAccess}
				onRetry={refetchCaseGrants}
				removingCaseId={removingCaseId}
			/>

			<IntegrationTokenSecretModal
				onClose={() => setTokenReveal(null)}
				reveal={tokenReveal}
			/>

			<AlertModal
				cancelButtonText="Cancel"
				confirmButtonText="Revoke integration"
				isOpen={confirmRevokeOpen}
				loading={pending}
				message={`Revoking "${integration.name}" is permanent — every token it has issued stops authenticating immediately, and a revoked integration cannot be reactivated.`}
				onClose={() => setConfirmRevokeOpen(false)}
				onConfirm={() => {
					setConfirmRevokeOpen(false);
					onRevoke(integration.id);
				}}
			/>

			<IntegrationDeleteDialog
				deleting={deleting}
				integrationName={integration.name}
				onConfirm={() => {
					setConfirmDeleteOpen(false);
					onDelete(integration.id);
				}}
				onOpenChange={setConfirmDeleteOpen}
				open={confirmDeleteOpen}
			/>

			<AlertModal
				cancelButtonText="Cancel"
				confirmButtonText="Revoke token"
				isOpen={confirmRevokeTokenId !== null}
				loading={
					confirmRevokeTokenId !== null &&
					pendingTokenKey === `${integration.id}:${confirmRevokeTokenId}`
				}
				message="Revoking this token takes effect immediately and cannot be undone — any caller still using it will start failing to authenticate right away."
				onClose={() => setConfirmRevokeTokenId(null)}
				onConfirm={handleConfirmRevokeToken}
			/>
		</div>
	);
}
