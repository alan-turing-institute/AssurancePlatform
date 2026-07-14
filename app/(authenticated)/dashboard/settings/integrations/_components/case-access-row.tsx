"use client";

import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatShortDate } from "@/lib/date";
import type { IntegrationCaseGrant } from "@/lib/schemas/integration";

const PERMISSION_LABEL: Record<IntegrationCaseGrant["permission"], string> = {
	VIEW: "VIEW",
	COMMENT: "COMMENT",
	EDIT: "EDIT",
};

export interface CaseAccessRowProps {
	grant: IntegrationCaseGrant;
	onRemove: (caseId: string) => void;
	/** True while THIS row's removal request is in flight. */
	removing: boolean;
}

/**
 * One case the integration's system user currently has access to. Removal
 * is a lightweight, reversible action (re-granting restores it), so unlike
 * the integration/token lifecycle actions in `IntegrationCard` this confirms
 * inline — a second click on the row itself — rather than opening a full
 * `AlertModal`, which this codebase reserves for genuinely irreversible
 * actions (revoke integration, delete integration, revoke token).
 */
export function CaseAccessRow({
	grant,
	onRemove,
	removing,
}: CaseAccessRowProps) {
	const [confirming, setConfirming] = useState(false);
	const confirmButtonRef = useRef<HTMLButtonElement>(null);
	const removeTriggerRef = useRef<HTMLButtonElement>(null);
	// Set only by `handleCancel`, never by the initial mount or the
	// entry-into-confirm transition — this is what stops the effect below
	// from stealing focus onto the Remove trigger the first time the row
	// ever renders (when `confirming` is already `false` and nothing has
	// been focused yet).
	const returnFocusOnCancel = useRef(false);

	// Moves focus to the Confirm button the moment the inline confirm
	// appears (so a keyboard user lands straight on it rather than the DOM
	// default of nowhere-in-particular), and back to the Remove trigger
	// when a cancel collapses it — never on removal success/failure, which
	// leaves the row's confirm state exactly where the click left it.
	useEffect(() => {
		if (confirming) {
			confirmButtonRef.current?.focus();
		} else if (returnFocusOnCancel.current) {
			removeTriggerRef.current?.focus();
			returnFocusOnCancel.current = false;
		}
	}, [confirming]);

	function handleCancel() {
		returnFocusOnCancel.current = true;
		setConfirming(false);
	}

	return (
		<div
			className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm"
			data-testid={`case-access-row-${grant.caseId}`}
		>
			<div className="space-y-0.5">
				<p className="font-medium text-foreground">{grant.caseName}</p>
				<p className="text-muted-foreground text-xs">
					{`Granted ${formatShortDate(grant.grantedAt)}`}
				</p>
			</div>

			<div className="flex shrink-0 items-center gap-2">
				<Badge variant="outline">{PERMISSION_LABEL[grant.permission]}</Badge>

				{confirming ? (
					<>
						<span className="text-muted-foreground text-xs">
							Remove access?
						</span>
						<Button
							disabled={removing}
							onClick={handleCancel}
							size="sm"
							type="button"
							variant="outline"
						>
							Cancel
						</Button>
						<Button
							disabled={removing}
							onClick={() => onRemove(grant.caseId)}
							ref={confirmButtonRef}
							size="sm"
							type="button"
							variant="destructive"
						>
							{removing ? "Removing…" : "Confirm"}
						</Button>
					</>
				) : (
					<Button
						aria-label={`Remove access to ${grant.caseName}`}
						className="text-destructive hover:text-destructive"
						onClick={() => setConfirming(true)}
						ref={removeTriggerRef}
						size="sm"
						type="button"
						variant="ghost"
					>
						<X aria-hidden="true" className="h-3.5 w-3.5" />
						Remove
					</Button>
				)}
			</div>
		</div>
	);
}
