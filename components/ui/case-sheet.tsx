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

type CaseSheetProps = {
	title: string;
	description: string;
	isOpen: boolean;
	onChange: (open: boolean) => void;
	onClose?: () => void;
	children?: React.ReactNode;
	/** Receives focus on close when the opener has left the page. */
	returnFocusRef?: RefObject<HTMLElement | null>;
};

const CaseSheet = ({
	title,
	description,
	isOpen,
	onChange,
	children,
	returnFocusRef,
}: CaseSheetProps) => {
	const returnFocus = useReturnFocus(returnFocusRef);
	return (
		<Sheet onOpenChange={onChange} open={isOpen}>
			<SheetContent className="overflow-y-scroll" {...returnFocus}>
				<SheetHeader>
					<SheetTitle>{title}</SheetTitle>
					<SheetDescription>{description}</SheetDescription>
				</SheetHeader>
				{children}
			</SheetContent>
		</Sheet>
	);
};

export default CaseSheet;
