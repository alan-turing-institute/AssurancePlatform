"use client";

import type { RefObject } from "react";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { useReturnFocus } from "@/hooks/use-return-focus";

type NotesSheetProps = {
	isOpen: boolean;
	onClose: () => void;
	children?: React.ReactNode;
	title: string;
	description: string;
	/** Receives focus on close when the opener has left the page. */
	returnFocusRef?: RefObject<HTMLElement | null>;
};

const NotesSheet = ({
	isOpen,
	onClose,
	children,
	title,
	description,
	returnFocusRef,
}: NotesSheetProps) => {
	const returnFocus = useReturnFocus(returnFocusRef);
	const onChange = (open: boolean) => {
		if (!open) {
			onClose();
		}
	};

	return (
		<Sheet onOpenChange={onChange} open={isOpen}>
			<SheetContent
				className="min-w-full overflow-y-scroll"
				{...returnFocus}
			>
				<SheetHeader>
					<SheetTitle>{title}</SheetTitle>
					<SheetDescription>{description}</SheetDescription>
				</SheetHeader>
				{children}
			</SheetContent>
		</Sheet>
	);
};

export default NotesSheet;
