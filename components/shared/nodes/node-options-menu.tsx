"use client";

import { MoreHorizontal, Trash2, Unplug } from "lucide-react";
import { useState } from "react";
import type { Node } from "reactflow";
import ActionTooltip from "@/components/ui/action-tooltip";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	deleteAssuranceCaseNode,
	detachCaseElement,
	type ReactFlowNode,
	removeAssuranceCaseNode,
} from "@/lib/case";
import { recordDelete } from "@/lib/services/history-service";
import useStore from "@/store/store";
import type { AssuranceCase } from "@/types";
import type { DiagramNodeType } from "./node-config";

type NodeOptionsMenuProps = {
	/** The ReactFlow node object */
	node: Node;
	/** The type of node */
	nodeType: DiagramNodeType;
};

/** Map of React Flow node types to canonical element types */
const TYPE_MAP: Record<string, string> = {
	property: "property_claim",
	strategy: "strategy",
	evidence: "evidence",
	context: "context",
	goal: "goal",
};

/** Create orphan element from node data */
function createOrphanElement(node: Node) {
	return {
		id: node.data.id as number,
		type: TYPE_MAP[node.type ?? ""] ?? (node.data.type as string),
		name: node.data.name as string,
		description: (node.data.description as string) ?? "",
	};
}

/** Process detach result and update state */
function processDetachResult(
	node: Node,
	assuranceCase: AssuranceCase,
	orphanedElements: Array<{ id: number; type: string; name: string }>,
	setAssuranceCase: (ac: AssuranceCase) => void,
	setOrphanedElements: (
		elements: Array<{ id: number; type: string; name: string }>
	) => void
) {
	const newOrphanElement = createOrphanElement(node);
	const updatedAssuranceCase = removeAssuranceCaseNode(
		assuranceCase,
		node.data.id as number,
		node.data.type as string
	);

	if (updatedAssuranceCase) {
		setAssuranceCase(updatedAssuranceCase);
		const existingIds = new Set(orphanedElements.map((el) => el.id));
		if (!existingIds.has(newOrphanElement.id)) {
			setOrphanedElements([...orphanedElements, newOrphanElement]);
		}
	}
}

/** Process delete result and update state */
function processDeleteResult(
	node: Node,
	assuranceCase: AssuranceCase,
	setAssuranceCase: (ac: AssuranceCase) => void
) {
	recordDelete(node.data.id as number, node.type ?? "", node.data);
	const updatedAssuranceCase = removeAssuranceCaseNode(
		assuranceCase,
		node.data.id as number,
		node.data.type as string
	);
	if (updatedAssuranceCase) {
		setAssuranceCase(updatedAssuranceCase);
	}
}

/**
 * NodeOptionsMenu - Dropdown menu for node operations (detach, delete)
 *
 * Shows "More options" button with dropdown containing:
 * - Detach (for non-goal nodes) - keeps element as orphan
 * - Delete - permanently removes element
 */
export default function NodeOptionsMenu({
	node,
	nodeType,
}: NodeOptionsMenuProps) {
	const {
		assuranceCase,
		setAssuranceCase,
		orphanedElements,
		setOrphanedElements,
	} = useStore();
	const [loading, setLoading] = useState(false);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [detachDialogOpen, setDetachDialogOpen] = useState(false);

	const readOnly = !!(
		assuranceCase?.permissions === "view" ||
		assuranceCase?.permissions === "comment"
	);

	if (readOnly || nodeType === "goal") {
		return null;
	}

	const handleDetach = async () => {
		if (!assuranceCase) {
			return;
		}

		setLoading(true);
		const result = await detachCaseElement(
			node as ReactFlowNode,
			node.type ?? "",
			node.data.id as number,
			""
		);

		if (!("error" in result) && result.detached) {
			processDetachResult(
				node,
				assuranceCase,
				orphanedElements,
				setAssuranceCase,
				setOrphanedElements
			);
		}

		setLoading(false);
		setDetachDialogOpen(false);
	};

	const handleDelete = async () => {
		if (!assuranceCase) {
			return;
		}

		setLoading(true);
		const deleted = await deleteAssuranceCaseNode(
			node.type ?? "",
			node.data.id as number,
			""
		);

		if (deleted) {
			processDeleteResult(node, assuranceCase, setAssuranceCase);
		}

		setLoading(false);
		setDeleteDialogOpen(false);
	};

	const nodeName = (node.data?.name as string) || "this element";

	return (
		<>
			<DropdownMenu>
				<ActionTooltip label="More options">
					<DropdownMenuTrigger asChild>
						<button
							onClick={(e) => e.stopPropagation()}
							onMouseDown={(e) => e.stopPropagation()}
							type="button"
						>
							<div className="inline-flex rounded-full p-1 hover:bg-foreground/10">
								<MoreHorizontal aria-hidden="true" size={16} />
							</div>
						</button>
					</DropdownMenuTrigger>
				</ActionTooltip>
				<DropdownMenuContent align="start" side="top">
					<DropdownMenuItem
						className="gap-2"
						disabled={loading}
						onSelect={(e) => {
							e.stopPropagation();
							setDetachDialogOpen(true);
						}}
					>
						<Unplug className="h-4 w-4" />
						Detach
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuItem
						className="gap-2 text-destructive focus:text-destructive"
						disabled={loading}
						onSelect={(e) => {
							e.stopPropagation();
							setDeleteDialogOpen(true);
						}}
					>
						<Trash2 className="h-4 w-4" />
						Delete
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>

			<AlertDialog onOpenChange={setDetachDialogOpen} open={detachDialogOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Detach {nodeName}?</AlertDialogTitle>
						<AlertDialogDescription>
							This will detach the element and its children from the assurance
							case. The elements will be kept as orphans and can be reattached
							later.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
						<AlertDialogAction disabled={loading} onClick={handleDetach}>
							{loading ? "Detaching..." : "Detach"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<AlertDialog onOpenChange={setDeleteDialogOpen} open={deleteDialogOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete {nodeName}?</AlertDialogTitle>
						<AlertDialogDescription>
							This action cannot be undone. This will permanently delete the
							element and all of its children.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
						<AlertDialogAction
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							disabled={loading}
							onClick={handleDelete}
						>
							{loading ? "Deleting..." : "Delete"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
