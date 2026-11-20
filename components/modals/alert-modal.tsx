"use client";

import { type RefObject, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

interface AlertModalProps {
	cancelButtonText?: string | null;
	children?: React.ReactNode;
	confirmButtonText: string;
	isOpen: boolean;
	loading: boolean;
	message?: string;
	onClose: () => void;
	onConfirm: () => void;
	/** Receives focus on close when the opener has left the page. */
	returnFocusRef?: RefObject<HTMLElement | null>;
}

export const AlertModal: React.FC<AlertModalProps> = ({
	isOpen,
	onClose,
	onConfirm,
	loading,
	message,
	confirmButtonText,
	cancelButtonText,
	children,
	returnFocusRef,
}) => {
	const [isMounted, setIsMounted] = useState(false);

	useEffect(() => {
		setIsMounted(true);
	}, []);

	if (!isMounted) {
		return null;
	}

	return (
		<Modal
			description={message ? message : "This action cannot be undone."}
			isOpen={isOpen}
			onClose={onClose}
			returnFocusRef={returnFocusRef}
			title="Are you sure?"
		>
			{children}
			<div className="flex w-full items-center justify-end space-x-2 pt-6">
				<Button disabled={loading} onClick={onClose} variant="outline">
					{cancelButtonText ? cancelButtonText : "Cancel"}
				</Button>
				<Button disabled={loading} onClick={onConfirm} variant="destructive">
					{loading ? "Processing" : confirmButtonText}
				</Button>
			</div>
		</Modal>
	);
};
