"use client";

import { X } from "lucide-react";
import { useState } from "react";
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
							onClick={() => setConfirming(false)}
							size="sm"
							type="button"
							variant="outline"
						>
							Cancel
						</Button>
						<Button
							disabled={removing}
							onClick={() => onRemove(grant.caseId)}
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
