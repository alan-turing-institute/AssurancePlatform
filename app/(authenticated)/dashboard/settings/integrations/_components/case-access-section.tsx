"use client";

import { AlertCircle, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type {
	CaseGrantPermission,
	IntegrationCaseGrant,
} from "@/lib/schemas/integration";
import { CaseAccessRow } from "./case-access-row";
import { GrantCaseAccessForm } from "./grant-case-access-form";

export interface CaseAccessSectionProps {
	/** The faithfully-mapped message from the most recent failed grant attempt, or `null`. */
	grantError: string | null;
	/** True while a grant request is in flight (disables the form's submit/cancel). */
	granting: boolean;
	grants: IntegrationCaseGrant[];
	/** True when the integration is ACTIVE — gates opening the grant form (existing grants stay listable/removable regardless, per N1: GET/DELETE deliberately ungated). */
	integrationActive: boolean;
	loadError: string | null;
	/** True while the initial list fetch is in flight. */
	loading: boolean;
	/** Clears the hook-held `grantError` — called on both the grant form opening and closing, so a past attempt's copy never resurfaces on an unrelated later open (QA: stale "Reactivate it" banner on reopen with no new attempt). */
	onClearGrantError: () => void;
	onGrant: (
		caseId: string,
		permission: CaseGrantPermission
	) => Promise<boolean>;
	onRemove: (caseId: string) => void;
	/** Retries the initial list fetch — wired to the hook's own `refetch`. Only rendered alongside `loadError`. */
	onRetry: () => void;
	/** The caseId currently mid-removal, or `null`. */
	removingCaseId: string | null;
}

/**
 * The "Case access" section of an integration's card — which cases the
 * integration's machine user can currently touch, with grant/remove actions
 * (ADR 0002 v2 §2.4, work item 7's settings-page half). Presentational, like
 * its `Tokens` sibling section in `IntegrationCard`: every mutation is a
 * callback prop, and this component (and its tests) never call
 * `useIntegrationCaseGrants` directly — `IntegrationCard` owns that hook and
 * threads its state down here.
 *
 * This component's own `addOpen` state (whether the grant form is showing)
 * deliberately has no logic to force it closed when `integrationActive`
 * turns false — that reset lives one level up, in `IntegrationCard`, via a
 * `key` on this component keyed to activity. Remounting on that transition
 * discards `addOpen` (and every other bit of local state) for free, with no
 * Effect and no stale-then-corrected render — the two ways of clearing state
 * "by hand" that both caused a react-doctor regression (a one-frame stale
 * flash from a `useEffect`, then an "impure state updater" flag from doing
 * the reset synchronously in the render body) before this file settled on
 * leaving the reset out of this component entirely.
 */
export function CaseAccessSection({
	granting,
	grantError,
	grants,
	integrationActive,
	loading,
	loadError,
	onClearGrantError,
	onGrant,
	onRemove,
	onRetry,
	removingCaseId,
}: CaseAccessSectionProps) {
	const [addOpen, setAddOpen] = useState(false);

	// Both the open-trigger and Cancel route through these, not just Cancel:
	// clearing only on close would still leave a window (open → immediately
	// re-triggered `onClearGrantError` a caller forgot to wire, or a future
	// close path added here) where a stale banner could resurface on open.
	// Clearing at both transitions costs nothing (the hook's clear is an
	// idempotent `setGrantError(null)`) and needs no Effect.
	function openForm() {
		onClearGrantError();
		setAddOpen(true);
	}

	function closeForm() {
		onClearGrantError();
		setAddOpen(false);
	}

	async function handleGrant(caseId: string, permission: CaseGrantPermission) {
		const granted = await onGrant(caseId, permission);
		if (granted) {
			closeForm();
		}
		return granted;
	}

	return (
		<div className="space-y-2 border-border border-t pt-3">
			<h4 className="font-medium text-foreground text-xs uppercase tracking-wide">
				Case access
			</h4>

			{loading && (
				<p className="text-muted-foreground text-xs">Loading case access…</p>
			)}

			{!loading && loadError && (
				<div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-destructive text-xs">
					<AlertCircle aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
					<span className="flex-1">{loadError}</span>
					<Button onClick={onRetry} size="sm" type="button" variant="outline">
						Try again
					</Button>
				</div>
			)}

			{!(loading || loadError) && grants.length === 0 && (
				<p className="text-muted-foreground text-xs">
					Which cases this integration&apos;s machine user can touch — none
					granted yet.
				</p>
			)}

			{!(loading || loadError) && grants.length > 0 && (
				<div className="space-y-2">
					{grants.map((grant) => (
						<CaseAccessRow
							grant={grant}
							key={grant.caseId}
							onRemove={onRemove}
							removing={removingCaseId === grant.caseId}
						/>
					))}
				</div>
			)}

			{!(loading || loadError) &&
				(addOpen ? (
					<GrantCaseAccessForm
						existingCaseIds={grants.map((grant) => grant.caseId)}
						grantError={grantError}
						granting={granting}
						onCancel={closeForm}
						onGrant={handleGrant}
					/>
				) : (
					<Button
						disabled={!integrationActive}
						onClick={openForm}
						size="sm"
						title={
							integrationActive
								? undefined
								: "Only an ACTIVE integration can be granted access to a case"
						}
						type="button"
						variant="outline"
					>
						<Plus aria-hidden="true" className="h-3.5 w-3.5" />
						Grant access to a case…
					</Button>
				))}
		</div>
	);
}
