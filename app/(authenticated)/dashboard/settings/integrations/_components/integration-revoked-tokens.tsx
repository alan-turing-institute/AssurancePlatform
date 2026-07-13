"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useId, useState } from "react";
import type { IntegrationTokenSummary } from "@/lib/schemas/integration";
import { IntegrationTokenRow } from "./integration-token-row";

export interface IntegrationRevokedTokensProps {
	tokens: IntegrationTokenSummary[];
}

/**
 * Revoking a token IS the archive action here (no separate archive flag, no
 * API change) — this component is the purely presentational other half:
 * it tucks already-revoked tokens out of the active list and behind a
 * collapsed-by-default disclosure, so a long-lived integration's dead tokens
 * don't crowd out the ones that still authenticate. Renders nothing at all
 * when there are no revoked tokens — never a "Revoked (0)" section.
 * Reuses `IntegrationTokenRow` for the expanded rows: its `state === "revoked"`
 * branch already renders prefix + revoked date with no rotate/revoke actions.
 */
export function IntegrationRevokedTokens({
	tokens,
}: IntegrationRevokedTokensProps) {
	const [open, setOpen] = useState(false);
	const listId = useId();

	if (tokens.length === 0) {
		return null;
	}

	return (
		<div className="space-y-2">
			<button
				aria-controls={listId}
				aria-expanded={open}
				className="flex items-center gap-1.5 text-muted-foreground text-xs hover:text-foreground"
				onClick={() => setOpen((value) => !value)}
				type="button"
			>
				{open ? (
					<ChevronDown aria-hidden="true" className="h-3.5 w-3.5" />
				) : (
					<ChevronRight aria-hidden="true" className="h-3.5 w-3.5" />
				)}
				{`Revoked (${tokens.length})`}
			</button>

			{open && (
				<div className="space-y-2" id={listId}>
					{tokens.map((token) => (
						<IntegrationTokenRow
							canRotate={false}
							key={token.id}
							onRevoke={() => {
								// Revoked rows never render an action to trigger this —
								// `IntegrationTokenRow` only wires rotate/revoke for a
								// live token. Kept as a no-op rather than threading a
								// real handler through for a callback that can't fire.
							}}
							onRotate={() => {
								// See onRevoke above — unreachable for a revoked row.
							}}
							pending={false}
							token={token}
						/>
					))}
				</div>
			)}
		</div>
	);
}
