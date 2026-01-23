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
	onSkipPreferenceChange?: (skip: boolean) => void;
};

export const DeleteElementModal: React.FC<DeleteElementModalProps> = ({
	isOpen,
	onClose,
	onDelete,
	loading,
	hasChildren,
	childCount = 0,
	onSkipPreferenceChange,
}) => {
	const [isMounted, setIsMounted] = useState(false);
	const [dontAskAgain, setDontAskAgain] = useState(false);

	useEffect(() => {
		setIsMounted(true);
	}, []);

	// Reset state when modal closes
	useEffect(() => {
		if (!isOpen) {
			setDontAskAgain(false);
		}
	}, [isOpen]);

	if (!isMounted) {
		return null;
	}

	const handleDelete = async () => {
		if (dontAskAgain && onSkipPreferenceChange) {
			onSkipPreferenceChange(true);
		}
		await onDelete();
	};

	if (!hasChildren) {
		// Simple delete for elements without children
		return (
			<Modal
				description="You can undo this action during the current session."
				isOpen={isOpen}
				onClose={onClose}
				title="Delete element?"
			>
				<div className="space-y-4 pt-4">
					<label className="flex cursor-pointer items-center gap-2 text-muted-foreground text-sm">
						<input
							checked={dontAskAgain}
							className="rounded border-input"
							onChange={(e) => setDontAskAgain(e.target.checked)}
							type="checkbox"
						/>
						Don't ask me again
					</label>
					<div className="flex w-full items-center justify-end space-x-2">
						<Button disabled={loading} onClick={onClose} variant="outline">
							Cancel
						</Button>
						<Button
							disabled={loading}
							onClick={handleDelete}
							variant="destructive"
						>
							{loading ? "Deleting..." : "Delete"}
						</Button>
					</div>
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

				<div className="flex items-center justify-between pt-2">
					<label className="flex cursor-pointer items-center gap-2 text-muted-foreground text-sm">
						<input
							checked={dontAskAgain}
							className="rounded border-input"
							onChange={(e) => setDontAskAgain(e.target.checked)}
							type="checkbox"
						/>
						Don't ask me again
					</label>
					<div className="flex items-center space-x-2">
						<Button disabled={loading} onClick={onClose} variant="outline">
							Cancel
						</Button>
						<Button
							disabled={loading}
							onClick={handleDelete}
							variant="destructive"
						>
							{loading ? "Deleting..." : "Delete"}
						</Button>
					</div>
				</div>
			</div>
		</Modal>
	);
};
