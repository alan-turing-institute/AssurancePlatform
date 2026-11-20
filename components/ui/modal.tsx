"use client";

import type { RefObject } from "react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { useReturnFocus } from "@/hooks/use-return-focus";

type ModalProps = {
	title: string;
	description: string;
	isOpen: boolean;
	onClose: () => void;
	children?: React.ReactNode;
	classNames?: string;
	/** Receives focus on close when the opener has left the page. */
	returnFocusRef?: RefObject<HTMLElement | null>;
};

export const Modal: React.FC<ModalProps> = ({
	title,
	description,
	isOpen,
	onClose,
	children,
	classNames,
	returnFocusRef,
}) => {
	const returnFocus = useReturnFocus(returnFocusRef);
	const onChange = (open: boolean) => {
		if (!open) {
			onClose();
		}
	};

	return (
		<Dialog onOpenChange={onChange} open={isOpen}>
			<DialogContent className={classNames} {...returnFocus}>
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				<div className="max-h-[60vh] overflow-y-auto">{children}</div>
			</DialogContent>
		</Dialog>
	);
};
