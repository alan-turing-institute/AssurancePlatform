"use client";

import type { LinkSafetyConfig, LinkSafetyModalProps } from "streamdown";
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
import { useReturnFocus } from "@/hooks/use-return-focus";

/**
 * The step between a click on a link in model text and the new tab. It is a
 * modal alert dialog, so focus moves into it and stays there, Escape closes
 * only the dialog and not the panel behind it, and focus goes back to the link
 * afterwards. `nokey` keeps the canvas, whose React tree the dialog belongs
 * to, from taking the keys typed in it.
 */
function LinkConfirmation({
	isOpen,
	onClose,
	onConfirm,
	url,
}: LinkSafetyModalProps) {
	const returnFocus = useReturnFocus();
	return (
		<AlertDialog
			onOpenChange={(open) => {
				if (!open) {
					onClose();
				}
			}}
			open={isOpen}
		>
			<AlertDialogContent
				className="nokey"
				onCloseAutoFocus={(event) => {
					returnFocus.onCloseAutoFocus(event);
					event.preventDefault();
				}}
				onOpenAutoFocus={returnFocus.onOpenAutoFocus}
			>
				<AlertDialogHeader>
					<AlertDialogTitle>Open external link?</AlertDialogTitle>
					<AlertDialogDescription className="select-text break-all font-mono">
						{url}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<AlertDialogAction onClick={onConfirm}>Open link</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

/** Streamdown's link settings for model text: confirm every link in the dialog above. Module-level, because Streamdown re-renders only when this object changes. */
export const LINK_SAFETY: LinkSafetyConfig = {
	enabled: true,
	renderModal: (props) => <LinkConfirmation {...props} />,
};
