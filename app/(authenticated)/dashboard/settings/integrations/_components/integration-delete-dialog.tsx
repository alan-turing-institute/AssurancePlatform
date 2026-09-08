"use client";

import { useId, useState } from "react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface IntegrationDeleteDialogProps {
	/** True while THIS integration's delete request is in flight. */
	deleting: boolean;
	integrationName: string;
	onConfirm: () => void;
	onOpenChange: (open: boolean) => void;
	open: boolean;
}

/**
 * The type-the-name confirm dialog gating an integration's permanent delete
 * (TEA — "Integration delete needs a guard": a one-click hard delete sat
 * right next to reversible revoke and ate a demo integration by accident).
 * `IntegrationCard` only ever opens this once the integration is REVOKED —
 * the Delete trigger is disabled with an explanatory tooltip for
 * ACTIVE/SUSPENDED integrations, so this dialog never opens for those. Its
 * own component (mirroring `IntegrationRegisterDialog`) so the typed-name
 * state resets cleanly on close without leaking into `IntegrationCard`.
 */
export function IntegrationDeleteDialog({
	deleting,
	integrationName,
	onConfirm,
	onOpenChange,
	open,
}: IntegrationDeleteDialogProps) {
	const [confirmText, setConfirmText] = useState("");
	const inputId = useId();
	const nameMatches = confirmText === integrationName;

	function handleOpenChange(next: boolean) {
		if (!next) {
			setConfirmText("");
		}
		onOpenChange(next);
	}

	function handleConfirm() {
		setConfirmText("");
		onConfirm();
	}

	return (
		<AlertDialog onOpenChange={handleOpenChange} open={open}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Delete {integrationName}?</AlertDialogTitle>
					<AlertDialogDescription>
						This permanently removes the integration, its case-access grants,
						and its audit trail. This cannot be undone.
					</AlertDialogDescription>
				</AlertDialogHeader>

				<div className="space-y-2 py-2">
					<Label htmlFor={inputId}>
						Type{" "}
						<span className="font-medium text-foreground">
							{integrationName}
						</span>{" "}
						to confirm
					</Label>
					<Input
						autoComplete="off"
						id={inputId}
						onChange={(event) => setConfirmText(event.target.value)}
						value={confirmText}
					/>
				</div>

				<AlertDialogFooter>
					<AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
					<AlertDialogAction
						className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						disabled={deleting || !nameMatches}
						onClick={handleConfirm}
					>
						{deleting ? "Deleting…" : "Delete integration"}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
