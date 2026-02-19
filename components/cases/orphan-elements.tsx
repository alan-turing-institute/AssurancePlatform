"use client";

import { Loader2, Trash2 } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import type { Node } from "reactflow";
import { AlertModal } from "../modals/alert-modal";
import { Button } from "../ui/button";
import { ScrollArea } from "../ui/scroll-area";
import { OrphanElementItem } from "./_orphan-elements/orphan-element-item";
import { useOrphanActions } from "./_orphan-elements/use-orphan-actions";

export type OrphanElementsProps = {
	node: Node;
	handleClose: () => void;
	loadingState: {
		loading: boolean;
		setLoading: Dispatch<SetStateAction<boolean>>;
	};
	setAction: Dispatch<SetStateAction<string | null>>;
	className?: string;
};

export function OrphanElements({
	node,
	handleClose,
	loadingState,
	setAction,
}: OrphanElementsProps) {
	const {
		filteredOrphanElements,
		loading,
		deleteOpen,
		setDeleteOpen,
		handleOrphanSelection,
		handleDelete,
		handleDeleteSingle,
	} = useOrphanActions({ node, handleClose, loadingState, setAction });

	return (
		<div className="mt-8 flex flex-col items-start justify-start">
			<h3 className="mb-2 font-semibold text-lg">Existing Elements</h3>
			<ScrollArea
				className={`${filteredOrphanElements.length > 3 ? "h-80" : "h-auto"} w-full rounded-md border`}
			>
				<div className="p-1">
					{filteredOrphanElements.length === 0 && (
						<div className="flex items-center rounded-md p-2 text-sm">
							No items found.
						</div>
					)}
					{filteredOrphanElements.map((el) => (
						<OrphanElementItem
							key={el.id}
							loading={loading}
							onDelete={handleDeleteSingle}
							onSelect={handleOrphanSelection}
							orphan={el}
						/>
					))}
				</div>
			</ScrollArea>
			{loading && (
				<p className="mt-4 flex items-center justify-start">
					<Loader2 className="mr-2 h-4 w-4 animate-spin" />
					Adding Element...
				</p>
			)}
			<div className="flex w-full items-center justify-start gap-3">
				<Button
					className="my-6 w-full"
					onClick={() => setAction(null)}
					variant={"outline"}
				>
					Cancel
				</Button>
				<Button
					className="my-6 w-full"
					onClick={() => setDeleteOpen(true)}
					variant={"destructive"}
				>
					<Trash2 className="mr-2 h-4 w-4" />
					Delete All
				</Button>
			</div>
			<AlertModal
				cancelButtonText={"No, keep them"}
				confirmButtonText={"Yes, delete all"}
				isOpen={deleteOpen}
				loading={loading}
				message={
					"Are you sure you want to delete all orphaned elements. This cannot be undone."
				}
				onClose={() => setDeleteOpen(false)}
				onConfirm={handleDelete}
			/>
		</div>
	);
}

export default OrphanElements;
