"use client";

import type { RefObject } from "react";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import type { CasePanelRegistration } from "@/lib/plugins/slots/index";

interface CasePanelSheetProps {
	canEdit: boolean;
	caseId: string;
	isOpen: boolean;
	onClose: () => void;
	registration: CasePanelRegistration;
	/** The toolbar button that opened the sheet; it gets focus back when the sheet closes. */
	returnFocusTo: RefObject<HTMLElement | null>;
	selectedElementId?: string;
	selectedElementLabel?: string;
}

/**
 * The side sheet for one registered case panel. The sheet is mounted only
 * while open, so a panel fetches its data when it is opened and not before.
 * A panel registered with `modal: false` renders no overlay (Radix draws none for a non-modal dialog) and is not dismissed
 * by clicks or focus outside it, so the canvas stays usable beside it; it
 * keeps any state it needs across close and reopen itself.
 */
export function CasePanelSheet({
	canEdit,
	caseId,
	isOpen,
	onClose,
	registration,
	returnFocusTo,
	selectedElementId,
	selectedElementLabel,
}: CasePanelSheetProps) {
	const { Component, label } = registration;
	const nonModal = registration.modal === false;
	return (
		<Sheet
			modal={!nonModal}
			onOpenChange={(open) => {
				if (!open) {
					onClose();
				}
			}}
			open={isOpen}
		>
			<SheetContent
				className="w-full overflow-y-auto sm:max-w-md"
				onCloseAutoFocus={(event) => {
					event.preventDefault();
					returnFocusTo.current?.focus();
				}}
				onInteractOutside={
					nonModal ? (event) => event.preventDefault() : undefined
				}
			>
				<SheetHeader>
					<SheetTitle>{label}</SheetTitle>
					<SheetDescription className="sr-only">{label}</SheetDescription>
				</SheetHeader>
				<div className="nokey mt-4 min-w-0">
					<Component
						canEdit={canEdit}
						caseId={caseId}
						selectedElementId={selectedElementId}
						selectedElementLabel={selectedElementLabel}
					/>
				</div>
			</SheetContent>
		</Sheet>
	);
}
