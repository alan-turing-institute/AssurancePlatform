"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

type DeleteElementModalProps = {
	isOpen: boolean;
	onClose: () => void;
	onDeleteWithChildren: () => Promise<void>;
	onDetachAndDelete: () => Promise<void>;
	loading: boolean;
	hasChildren: boolean;
	childCount?: number;
};

export const DeleteElementModal: React.FC<DeleteElementModalProps> = ({
	isOpen,
	onClose,
	onDeleteWithChildren,
	onDetachAndDelete,
	loading,
	hasChildren,
	childCount = 0,
}) => {
	const [isMounted, setIsMounted] = useState(false);
	const [action, setAction] = useState<"delete" | "detach" | null>(null);

	useEffect(() => {
		setIsMounted(true);
	}, []);

	// Reset action state when modal closes
	useEffect(() => {
		if (!isOpen) {
			setAction(null);
		}
	}, [isOpen]);

	if (!isMounted) {
		return null;
	}

	const handleDelete = async () => {
		setAction("delete");
		await onDeleteWithChildren();
	};

	const handleDetach = async () => {
		setAction("detach");
		await onDetachAndDelete();
	};

	if (!hasChildren) {
		// Simple delete for elements without children
		return (
			<Modal
				description="This action cannot be undone."
				isOpen={isOpen}
				onClose={onClose}
				title="Delete element?"
			>
				<div className="flex w-full items-center justify-end space-x-2 pt-6">
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
			</Modal>
		);
	}

	// Enhanced modal for elements with children
	return (
		<Modal
			description=""
			isOpen={isOpen}
			onClose={onClose}
			title="Delete element with children?"
		>
			<div className="space-y-4">
				<div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950">
					<AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
					<p className="text-amber-800 text-sm dark:text-amber-200">
						This element has {childCount} child element
						{childCount !== 1 ? "s" : ""}. Choose how to handle them:
					</p>
				</div>

				<div className="space-y-3">
					{/* Option 1: Detach children */}
					<button
						className="w-full rounded-lg border-2 border-muted p-4 text-left transition-colors hover:border-primary hover:bg-muted/50 disabled:opacity-50"
						disabled={loading}
						onClick={handleDetach}
						type="button"
					>
						<p className="font-medium">Detach children to sandbox</p>
						<p className="text-muted-foreground text-sm">
							Move child elements to the sandbox where they can be reattached
							later. Only this element will be deleted.
						</p>
						{loading && action === "detach" && (
							<p className="mt-2 text-primary text-sm">Detaching children...</p>
						)}
					</button>

					{/* Option 2: Delete all */}
					<button
						className="w-full rounded-lg border-2 border-destructive/30 p-4 text-left transition-colors hover:border-destructive hover:bg-destructive/5 disabled:opacity-50"
						disabled={loading}
						onClick={handleDelete}
						type="button"
					>
						<p className="font-medium text-destructive">Delete all</p>
						<p className="text-muted-foreground text-sm">
							Permanently delete this element and all {childCount} child element
							{childCount !== 1 ? "s" : ""}. This cannot be undone.
						</p>
						{loading && action === "delete" && (
							<p className="mt-2 text-destructive text-sm">Deleting...</p>
						)}
					</button>
				</div>

				<div className="flex justify-end pt-2">
					<Button disabled={loading} onClick={onClose} variant="outline">
						Cancel
					</Button>
				</div>
			</div>
		</Modal>
	);
};
