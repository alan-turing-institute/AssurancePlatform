"use client";

import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import type { CasePanelRegistration } from "@/lib/plugins/slots";

interface CasePanelSheetProps {
	canEdit: boolean;
	caseId: string;
	isOpen: boolean;
	onClose: () => void;
	registration: CasePanelRegistration;
}

/**
 * The side sheet for one registered case panel. The sheet is mounted only
 * while open, so a panel fetches its data when it is opened and not before.
 */
export function CasePanelSheet({
	canEdit,
	caseId,
	isOpen,
	onClose,
	registration,
}: CasePanelSheetProps) {
	const { Component, label } = registration;
	return (
		<Sheet
			onOpenChange={(open) => {
				if (!open) {
					onClose();
				}
			}}
			open={isOpen}
		>
			<SheetContent className="w-full overflow-y-auto sm:max-w-md">
				<SheetHeader>
					<SheetTitle>{label}</SheetTitle>
					<SheetDescription className="sr-only">{label}</SheetDescription>
				</SheetHeader>
				<div className="nokey mt-4 min-w-0">
					<Component canEdit={canEdit} caseId={caseId} />
				</div>
			</SheetContent>
		</Sheet>
	);
}
