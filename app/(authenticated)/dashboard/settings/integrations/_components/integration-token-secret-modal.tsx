"use client";

import { AlertTriangle, Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/lib/toast";

/**
 * The data a token-shown-once reveal needs — deliberately narrow (just the
 * plaintext secret plus enough context to label it), never the full
 * `IssuedTokenResult`/`RotatedTokenResult` response, so nothing beyond what
 * this modal renders can accidentally be threaded through to a longer-lived
 * piece of state by a future edit.
 */
export interface TokenReveal {
	/** e.g. "Rotated token — the previous one stays valid until 14:32." */
	notice?: string;
	secret: string;
}

export interface IntegrationTokenSecretModalProps {
	onClose: () => void;
	reveal: TokenReveal | null;
}

/**
 * The token-shown-once modal (functional scope item 4). The plaintext secret
 * is rendered ONLY from the `reveal` prop the caller passes in for as long as
 * the modal is open — this component holds no state of its own that outlives
 * a render, and the caller (`IntegrationCard`'s `tokenReveal` state) clears
 * that prop to `null` on close, so the secret cannot be re-shown by
 * reopening the dialog.
 */
export function IntegrationTokenSecretModal({
	onClose,
	reveal,
}: IntegrationTokenSecretModalProps) {
	const [copied, setCopied] = useState(false);

	if (!reveal) {
		return null;
	}

	const handleClose = () => {
		setCopied(false);
		onClose();
	};

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(reveal.secret);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			toast({
				variant: "destructive",
				title: "Copy failed",
				description:
					"Could not copy to the clipboard — copy the token manually.",
			});
		}
	};

	return (
		<Modal
			description="Copy it now — for security, it will not be shown again."
			isOpen
			onClose={handleClose}
			title="Token secret"
		>
			<div className="space-y-4">
				<div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning-foreground">
					<AlertTriangle aria-hidden="true" className="h-4 w-4 shrink-0" />
					<span>
						This is the only time this token is displayed — store it somewhere
						safe before closing this dialog.
					</span>
				</div>

				<div className="flex items-stretch gap-2">
					<code
						className="flex-1 overflow-x-auto rounded-md border border-border bg-muted px-3 py-2 font-mono text-sm"
						data-testid="token-secret-value"
					>
						{reveal.secret}
					</code>
					<Button
						aria-label={
							copied ? "Copied to clipboard" : "Copy token to clipboard"
						}
						onClick={handleCopy}
						type="button"
						variant="outline"
					>
						{copied ? (
							<Check aria-hidden="true" className="h-4 w-4" />
						) : (
							<Copy aria-hidden="true" className="h-4 w-4" />
						)}
						{copied ? "Copied" : "Copy"}
					</Button>
				</div>

				{reveal.notice && (
					<p className="text-muted-foreground text-sm">{reveal.notice}</p>
				)}

				<div className="flex justify-end pt-2">
					<Button onClick={handleClose} type="button">
						Done — I have stored it
					</Button>
				</div>
			</div>
		</Modal>
	);
}
