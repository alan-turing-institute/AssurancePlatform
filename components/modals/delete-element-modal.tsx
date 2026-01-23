"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

type DeleteElementModalProps = {
	isOpen: boolean;
	onClose: () => void;
	onDelete: () => Promise<void>;
	loading: boolean;
	hasChildren: boolean;
	childCount?: number;
};

export const DeleteElementModal: React.FC<DeleteElementModalProps> = ({
	isOpen,
	onClose,
	onDelete,
	loading,
	hasChildren,
	childCount = 0,
}) => {
	const [isMounted, setIsMounted] = useState(false);

	useEffect(() => {
		setIsMounted(true);
	}, []);

	if (!isMounted) {
		return null;
	}

	if (!hasChildren) {
		// Simple delete for elements without children
		return (
			<Modal
				description="You can undo this action during the current session."
				isOpen={isOpen}
				onClose={onClose}
				title="Delete element?"
			>
				<div className="flex w-full items-center justify-end space-x-2 pt-6">
					<Button disabled={loading} onClick={onClose} variant="outline">
						Cancel
					</Button>
					<Button disabled={loading} onClick={onDelete} variant="destructive">
						{loading ? "Deleting..." : "Delete"}
					</Button>
				</div>
			</Modal>
		);
	}

	// Modal for elements with children
	return (
		<Modal
			description=""
			isOpen={isOpen}
			onClose={onClose}
			title="Delete element?"
		>
			<div className="space-y-4">
				<div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950">
					<AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
					<p className="text-amber-800 text-sm dark:text-amber-200">
						This will also delete {childCount} child element
						{childCount !== 1 ? "s" : ""}. You can undo this action during the
						current session.
					</p>
				</div>

				<div className="flex w-full items-center justify-end space-x-2 pt-2">
					<Button disabled={loading} onClick={onClose} variant="outline">
						Cancel
					</Button>
					<Button disabled={loading} onClick={onDelete} variant="destructive">
						{loading ? "Deleting..." : "Delete"}
					</Button>
				</div>
			</div>
		</Modal>
	);
};
