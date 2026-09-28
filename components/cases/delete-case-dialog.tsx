"use client";

import {
	AlertDialog,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { PublishedCopyChoice } from "@/lib/schemas/case-trash";

interface DeleteCaseDialogProps {
	isOpen: boolean;
	/** Whether the caller is the case's owner, not merely a collaborator with delete rights. Picks which "Keep as archived" sentence to show. */
	isOwner: boolean;
	loading: boolean;
	onCancel: () => void;
	onConfirm: (publishedCopy: PublishedCopyChoice) => void;
}

/**
 * The delete confirmation for a published case, shared by the case page
 * toolbar and the dashboard case cards — the choice between removing its
 * Discover copy and keeping it archived. An unpublished case keeps each
 * caller's own plain confirmation instead; this component covers only the
 * published branch. An archived copy can only ever be removed later from
 * the case owner's own Trash page, so a collaborator who isn't the owner
 * sees that stated as the owner's action, not theirs.
 */
export function DeleteCaseDialog({
	isOpen,
	isOwner,
	loading,
	onCancel,
	onConfirm,
}: DeleteCaseDialogProps) {
	return (
		<AlertDialog
			onOpenChange={(open) => {
				if (!open) {
					onCancel();
				}
			}}
			open={isOpen}
		>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>
						This case is published on Discover
					</AlertDialogTitle>
					<AlertDialogDescription asChild>
						<div className="space-y-3 text-left">
							<p>
								The case moves to the trash either way, and you can restore it
								within 30 days. What should happen to its public copy?
							</p>
							<p>
								<strong className="text-foreground">
									Remove from Discover
								</strong>{" "}
								— the public copy is deleted. If you restore the case, it comes
								back as a draft.
							</p>
							<p>
								<strong className="text-foreground">Keep as archived</strong> —
								the public copy stays on Discover, marked as archived, and no
								longer receives updates.{" "}
								{isOwner
									? "You can remove it later from your Trash page, even after the case itself is permanently deleted."
									: "The case owner can remove it later from their Trash page, even after the case itself is permanently deleted."}
							</p>
						</div>
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
					<Button
						disabled={loading}
						onClick={() => onConfirm("archive")}
						variant="outline"
					>
						Keep as archived
					</Button>
					<Button
						disabled={loading}
						onClick={() => onConfirm("remove")}
						variant="destructive"
					>
						Remove from Discover
					</Button>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
