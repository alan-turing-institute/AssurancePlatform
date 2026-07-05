"use client";

import { RotateCw, ShieldOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatRelativeToNow, formatShortDate } from "@/lib/date";
import type { IntegrationTokenSummary } from "@/lib/schemas/integration";
import { cn } from "@/lib/utils";

export interface IntegrationTokenRowProps {
	/** False when the parent integration isn't ACTIVE — rotation is refused server-side for a non-active integration, even for an otherwise-live token. */
	canRotate: boolean;
	onRevoke: (tokenId: string) => void;
	onRotate: (tokenId: string) => void;
	/** True while THIS token's rotate/revoke request is in flight. */
	pending: boolean;
	token: IntegrationTokenSummary;
}

type TokenState = "expired" | "live" | "revoked";

function tokenState(token: IntegrationTokenSummary): TokenState {
	if (token.revokedAt) {
		return "revoked";
	}
	if (token.expiresAt && new Date(token.expiresAt).getTime() <= Date.now()) {
		return "expired";
	}
	return "live";
}

/**
 * One issued token's row: prefix, timestamps, and its revoked/expired/live
 * state rendered distinctly (functional scope item 1) — never the plaintext
 * secret, which this row never receives (`IntegrationListItem`'s tokens are
 * `IntegrationTokenSummary`, prefix only). Rotate/revoke actions render only
 * for a live token; a revoked or expired token is read-only history here.
 */
export function IntegrationTokenRow({
	canRotate,
	onRevoke,
	onRotate,
	pending,
	token,
}: IntegrationTokenRowProps) {
	const state = tokenState(token);
	const isLive = state === "live";

	return (
		<div
			className={cn(
				"flex flex-wrap items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm",
				!isLive && "bg-muted/40"
			)}
			data-testid={`token-row-${token.id}`}
		>
			<div className="space-y-0.5">
				<div className="flex items-center gap-2">
					<code className="font-mono text-xs">{token.tokenPrefix}…</code>
					{state === "revoked" && <Badge variant="destructive">Revoked</Badge>}
					{state === "expired" && <Badge variant="outline">Expired</Badge>}
					{state === "live" && <Badge variant="secondary">Live</Badge>}
				</div>
				<p className="text-muted-foreground text-xs">
					{`Issued ${formatShortDate(token.createdAt)}`}
					{token.lastUsedAt
						? ` · last used ${formatRelativeToNow(token.lastUsedAt)}`
						: " · never used"}
					{token.expiresAt
						? ` · expires ${formatShortDate(token.expiresAt)}`
						: ""}
					{token.revokedAt
						? ` · revoked ${formatShortDate(token.revokedAt)}`
						: ""}
				</p>
			</div>

			{isLive && (
				<div className="flex shrink-0 items-center gap-2">
					<Button
						disabled={pending || !canRotate}
						onClick={() => onRotate(token.id)}
						size="sm"
						title={
							canRotate
								? undefined
								: "Only an ACTIVE integration's tokens can be rotated"
						}
						type="button"
						variant="outline"
					>
						<RotateCw aria-hidden="true" className="h-3.5 w-3.5" />
						{pending ? "Rotating…" : "Rotate"}
					</Button>
					<Button
						aria-label="Revoke this token"
						className="text-destructive hover:text-destructive"
						disabled={pending}
						onClick={() => onRevoke(token.id)}
						size="sm"
						type="button"
						variant="ghost"
					>
						<ShieldOff aria-hidden="true" className="h-3.5 w-3.5" />
						Revoke
					</Button>
				</div>
			)}
		</div>
	);
}
