"use client";

import { useId, useState } from "react";
import { AlertModal } from "@/components/modals/alert-modal";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface IntegrationTokenIssueDialogProps {
	/** True while THIS integration's token request is in flight. */
	issuing: boolean;
	/** Resolves true once the token was issued, false when the request failed. */
	onIssue: (expiresAt?: string) => Promise<boolean>;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	/** The control that opened the dialog; it gets focus back when the dialog closes. */
	returnFocusRef: React.RefObject<HTMLElement | null>;
}

function pad(value: number): string {
	return String(value).padStart(2, "0");
}

/** Today's date in the user's time zone, as `YYYY-MM-DD` (the date input's format). */
function todayInputValue(): string {
	const now = new Date();
	return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * The instant that ends the chosen day in the user's time zone: 23:59:59.999
 * local time on that date, as an ISO string for the API.
 */
function endOfLocalDay(dateValue: string): string {
	const [year = 0, month = 1, day = 1] = dateValue.split("-").map(Number);
	return new Date(year, month - 1, day, 23, 59, 59, 999).toISOString();
}

/**
 * Asks for an optional end date before a token is issued. A chosen date is
 * sent as the end of that day in the user's time zone. With no date the user
 * confirms in a second dialog that the token will keep working until it is
 * revoked; issuing without an end date stays allowed. The surrounding form
 * stays open if the request fails, so the date can be corrected.
 */
export function IntegrationTokenIssueDialog({
	issuing,
	onIssue,
	onOpenChange,
	open,
	returnFocusRef,
}: IntegrationTokenIssueDialogProps) {
	const [endDate, setEndDate] = useState("");
	const [confirmNoEndDateOpen, setConfirmNoEndDateOpen] = useState(false);
	const inputId = useId();

	function close() {
		setEndDate("");
		setConfirmNoEndDateOpen(false);
		onOpenChange(false);
	}

	async function issue() {
		const issued = await onIssue(endDate ? endOfLocalDay(endDate) : undefined);
		setConfirmNoEndDateOpen(false);
		if (issued) {
			close();
		}
	}

	function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (endDate) {
			issue();
			return;
		}
		setConfirmNoEndDateOpen(true);
	}

	return (
		<Dialog
			onOpenChange={(next) => {
				if (next) {
					onOpenChange(true);
				} else {
					close();
				}
			}}
			open={open}
		>
			<DialogContent
				className="sm:max-w-md"
				onCloseAutoFocus={(event) => {
					event.preventDefault();
					returnFocusRef.current?.focus();
				}}
			>
				<DialogHeader>
					<DialogTitle>Issue a new token</DialogTitle>
					<DialogDescription>
						You can give the token an end date. It stops working at the end of
						that day, in your time zone.
					</DialogDescription>
				</DialogHeader>

				<form className="space-y-4" onSubmit={handleSubmit}>
					<div className="space-y-2">
						<Label htmlFor={inputId}>End date (optional)</Label>
						<Input
							id={inputId}
							min={todayInputValue()}
							onChange={(event) => setEndDate(event.target.value)}
							type="date"
							value={endDate}
						/>
					</div>
					<DialogFooter>
						<Button
							disabled={issuing}
							onClick={close}
							type="button"
							variant="outline"
						>
							Cancel
						</Button>
						<Button disabled={issuing} type="submit">
							{issuing ? "Issuing…" : "Issue token"}
						</Button>
					</DialogFooter>
				</form>

				<AlertModal
					cancelButtonText="Go back"
					confirmButtonText="Issue without an end date"
					isOpen={confirmNoEndDateOpen}
					loading={issuing}
					message="This token has no end date and keeps working until you revoke it."
					onClose={() => setConfirmNoEndDateOpen(false)}
					onConfirm={issue}
				/>
			</DialogContent>
		</Dialog>
	);
}
