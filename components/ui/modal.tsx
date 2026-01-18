"use client";

import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

type ModalProps = {
	title: string;
	description: string;
	isOpen: boolean;
	onClose: () => void;
	children?: React.ReactNode;
	classNames?: string;
};

export const Modal: React.FC<ModalProps> = ({
	title,
	description,
	isOpen,
	onClose,
	children,
	classNames,
}) => {
	const onChange = (open: boolean) => {
		if (!open) {
			onClose();
		}
	};

	return (
		<Dialog onOpenChange={onChange} open={isOpen}>
			<DialogContent className={classNames}>
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				<div className="max-h-[60vh] overflow-y-auto">{children}</div>
			</DialogContent>
		</Dialog>
	);
};
