"use client";

import { type FormEvent, type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/lib/toast";

export interface HealthActionRequest {
	body: Record<string, string>;
	method: "POST" | "PUT";
	url: string;
}

export interface HealthActionDialogProps {
	/** Builds the request from the reason the person typed. */
	buildRequest: (reason: string) => HealthActionRequest;
	/** Extra fields shown above the reason. */
	children?: ReactNode;
	description: string;
	/** Title of the error message shown when the server refuses the change. */
	failureTitle: string;
	/** False while a field in `children` is not yet filled in. */
	fieldsValid?: boolean;
	onDone: () => void;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	submitLabel: string;
	submitVariant?: "default" | "destructive";
	title: string;
}

async function readErrorMessage(response: Response): Promise<string> {
	try {
		const body = (await response.json()) as { error?: unknown };
		if (typeof body.error === "string" && body.error) {
			return body.error;
		}
	} catch {
		// Not JSON: fall through to the generic message.
	}
	return `The server refused the change (${response.status}).`;
}

/**
 * The shared body of the three health dialogs (withdraw a record, put one
 * back, change the accepted check): a required reason, a submit button that
 * sends the request the caller builds, and the server's own message in an
 * error toast when it refuses. The dialog stays open on a refusal so the
 * person can read it and try again.
 */
export function HealthActionDialog({
	buildRequest,
	children,
	description,
	failureTitle,
	fieldsValid = true,
	onDone,
	onOpenChange,
	open,
	submitLabel,
	submitVariant = "default",
	title,
}: HealthActionDialogProps) {
	const [reason, setReason] = useState("");
	const [pending, setPending] = useState(false);
	const canSubmit = reason.trim().length > 0 && fieldsValid && !pending;

	const submit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		event.stopPropagation();
		if (!canSubmit) {
			return;
		}
		setPending(true);
		try {
			const { url, method, body } = buildRequest(reason.trim());
			const response = await fetch(url, {
				method,
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});
			if (response.ok) {
				setReason("");
				onOpenChange(false);
				onDone();
			} else {
				toast({
					variant: "destructive",
					title: failureTitle,
					description: await readErrorMessage(response),
				});
			}
		} catch {
			toast({
				variant: "destructive",
				title: failureTitle,
				description: "The request could not be sent. Check your connection.",
			});
		} finally {
			setPending(false);
		}
	};

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				<form className="space-y-4" onSubmit={submit}>
					{children}
					<div className="space-y-2">
						<Label htmlFor="health-action-reason">Reason</Label>
						<Textarea
							id="health-action-reason"
							maxLength={2000}
							onChange={(event) => setReason(event.target.value)}
							required
							value={reason}
						/>
					</div>
					<DialogFooter>
						<Button
							disabled={pending}
							onClick={() => onOpenChange(false)}
							type="button"
							variant="outline"
						>
							Cancel
						</Button>
						<Button disabled={!canSubmit} type="submit" variant={submitVariant}>
							{submitLabel}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
