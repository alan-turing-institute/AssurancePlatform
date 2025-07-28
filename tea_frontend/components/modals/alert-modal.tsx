"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

interface AlertModalProps {
	isOpen: boolean;
	onClose: () => void;
	onConfirm: () => void;
	loading: boolean;
	message?: string;
	confirmButtonText: string;
	cancelButtonText?: string | null;
}

export const AlertModal: React.FC<AlertModalProps> = ({
	isOpen,
	onClose,
	onConfirm,
	loading,
	message,
	confirmButtonText,
	cancelButtonText,
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
			title="Are you sure?"
		>
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
