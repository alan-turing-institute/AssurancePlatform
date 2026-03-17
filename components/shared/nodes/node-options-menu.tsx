"use client";

import {
	ArrowRightLeft,
	MoreHorizontal,
	Plug,
	Trash2,
	Unplug,
} from "lucide-react";
import { useState } from "react";
import type { Node } from "reactflow";
import { useEdges, useNodes } from "reactflow";
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
import {
	getCompatibleChildTypes,
	normaliseOrphanType,
	REACTFLOW_TO_CANONICAL,
} from "@/lib/element-compatibility";
import type { AssuranceCaseResponse } from "@/lib/services/case-response-types";
import { recordDelete, recordDetach } from "@/lib/services/history-service";
import useStore from "@/store/store";
import { AttachElementDialog } from "./attach-element-dialog";
import { MoveElementDialog } from "./move-element-dialog";
import type { DiagramNodeType } from "./node-config";

interface NodeOptionsMenuProps {
	/** The ReactFlow node object */
	node: Node;
	/** The type of node */
	nodeType: DiagramNodeType;
}

/** Create orphan element from node data */
function createOrphanElement(node: Node) {
	return {
		id: node.data.id as string,
		type: REACTFLOW_TO_CANONICAL[node.type ?? ""] ?? (node.data.type as string),
		name: node.data.name as string,
		description: (node.data.description as string) ?? "",
	};
}

/** Derive parent data ID from edges and nodes */
function getParentDataId(
	nodeId: string,
	edges: { source: string; target: string }[],
	allNodes: Node[]
): string {
	const parentEdge = edges.find((e) => e.target === nodeId);
	if (!parentEdge) {
		return "";
	}
	const parentNode = allNodes.find((n) => n.id === parentEdge.source);
	return parentNode ? String(parentNode.data.id as string | number) : "";
}

/** Process detach result and update state */
function processDetachResult(
	node: Node,
	assuranceCase: AssuranceCaseResponse,
	orphanedElements: Array<{ id: string; type: string; name: string }>,
	setAssuranceCase: (ac: AssuranceCaseResponse) => void,
	setOrphanedElements: (
		elements: Array<{ id: string; type: string; name: string }>
	) => void
) {
	const newOrphanElement = createOrphanElement(node);
	const updatedAssuranceCase = removeAssuranceCaseNode(
		assuranceCase,
		node.data.id as string,
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
	assuranceCase: AssuranceCaseResponse,
	setAssuranceCase: (ac: AssuranceCaseResponse) => void
) {
	recordDelete(node.data.id as string, node.type ?? "", node.data);
	const updatedAssuranceCase = removeAssuranceCaseNode(
		assuranceCase,
		node.data.id as string,
		node.data.type as string
	);
	if (updatedAssuranceCase) {
		setAssuranceCase(updatedAssuranceCase);
	}
}

interface DestructiveActionsProps {
	loading: boolean;
	node: Node;
	nodeType: DiagramNodeType;
	onRequestDelete: () => void;
	onRequestDetach: () => void;
	setLoading: (v: boolean) => void;
}

/**
 * Menu items and confirmation dialogs for move, detach, and delete —
 * only rendered for non-goal nodes.
 */
function DestructiveMenuItems({
	loading,
	onRequestDetach,
	onRequestDelete,
}: Pick<
	DestructiveActionsProps,
	"loading" | "onRequestDetach" | "onRequestDelete"
>) {
	return (
		<>
			<DropdownMenuItem
				className="gap-2"
				disabled={loading}
				onSelect={(e) => {
					e.stopPropagation();
					onRequestDetach();
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
					onRequestDelete();
				}}
			>
				<Trash2 className="h-4 w-4" />
				Delete
			</DropdownMenuItem>
		</>
	);
}

interface ConfirmationDialogsProps {
	deleteOpen: boolean;
	detachOpen: boolean;
	loading: boolean;
	moveOpen: boolean;
	node: Node;
	nodeType: DiagramNodeType;
	onConfirmDelete: () => void;
	onConfirmDetach: () => void;
	onDeleteOpenChange: (v: boolean) => void;
	onDetachOpenChange: (v: boolean) => void;
	onMoveOpenChange: (v: boolean) => void;
}

function ConfirmationDialogs({
	node,
	nodeType,
	loading,
	detachOpen,
	deleteOpen,
	moveOpen,
	onDetachOpenChange,
	onDeleteOpenChange,
	onMoveOpenChange,
	onConfirmDetach,
	onConfirmDelete,
}: ConfirmationDialogsProps) {
	const nodeName = (node.data?.name as string) || "this element";

	return (
		<>
			<MoveElementDialog
				node={node}
				nodeType={nodeType}
				onOpenChange={onMoveOpenChange}
				open={moveOpen}
			/>

			<AlertDialog onOpenChange={onDetachOpenChange} open={detachOpen}>
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
						<AlertDialogAction disabled={loading} onClick={onConfirmDetach}>
							{loading ? "Detaching..." : "Detach"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<AlertDialog onOpenChange={onDeleteOpenChange} open={deleteOpen}>
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
							onClick={onConfirmDelete}
						>
							{loading ? "Deleting..." : "Delete"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}

/**
 * NodeOptionsMenu - Dropdown menu for node operations (attach, move, detach, delete)
 *
 * Shows "More options" button with dropdown containing:
 * - Attach (when compatible orphans exist) — works for all node types including goals
 * - Move (for non-goal nodes) — reparents element to a new compatible parent
 * - Detach (for non-goal nodes) — keeps element as orphan
 * - Delete (for non-goal nodes) — permanently removes element
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
	const allNodes = useNodes() as Node[];
	const allEdges = useEdges();
	const [loading, setLoading] = useState(false);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [detachDialogOpen, setDetachDialogOpen] = useState(false);
	const [attachDialogOpen, setAttachDialogOpen] = useState(false);
	const [moveDialogOpen, setMoveDialogOpen] = useState(false);

	const readOnly = !!(
		assuranceCase?.permissions === "view" ||
		assuranceCase?.permissions === "comment"
	);

	const isGoal = nodeType === "goal";
	const compatibleChildTypes = getCompatibleChildTypes(nodeType);
	const hasCompatibleOrphans = orphanedElements.some((orphan) =>
		compatibleChildTypes.includes(normaliseOrphanType(orphan.type))
	);

	if (readOnly || (isGoal && !hasCompatibleOrphans)) {
		return null;
	}

	const handleDetach = async () => {
		if (!assuranceCase) {
			return;
		}
		setLoading(true);

		// Capture parent ID before detach (needed for undo)
		const parentDataId = getParentDataId(node.id, allEdges, allNodes);
		const elementType =
			REACTFLOW_TO_CANONICAL[node.type ?? ""] ?? (node.data.type as string);

		const result = await detachCaseElement(
			node as ReactFlowNode,
			node.type ?? "",
			node.data.id as string,
			""
		);
		if (!("error" in result) && result.detached) {
			recordDetach(
				node.data.id as string,
				elementType,
				parentDataId,
				node.data
			);
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
			node.data.id as string,
			""
		);
		if (deleted) {
			processDeleteResult(node, assuranceCase, setAssuranceCase);
		}
		setLoading(false);
		setDeleteDialogOpen(false);
	};

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
					{hasCompatibleOrphans && (
						<DropdownMenuItem
							className="gap-2"
							disabled={loading}
							onSelect={(e) => {
								e.stopPropagation();
								setAttachDialogOpen(true);
							}}
						>
							<Plug className="h-4 w-4" />
							Attach
						</DropdownMenuItem>
					)}
					{!isGoal && (
						<>
							<DropdownMenuItem
								className="gap-2"
								disabled={loading}
								onSelect={(e) => {
									e.stopPropagation();
									setMoveDialogOpen(true);
								}}
							>
								<ArrowRightLeft className="h-4 w-4" />
								Move
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DestructiveMenuItems
								loading={loading}
								onRequestDelete={() => setDeleteDialogOpen(true)}
								onRequestDetach={() => setDetachDialogOpen(true)}
							/>
						</>
					)}
				</DropdownMenuContent>
			</DropdownMenu>

			<AttachElementDialog
				node={node}
				nodeType={nodeType}
				onOpenChange={setAttachDialogOpen}
				open={attachDialogOpen}
			/>

			{!isGoal && (
				<ConfirmationDialogs
					deleteOpen={deleteDialogOpen}
					detachOpen={detachDialogOpen}
					loading={loading}
					moveOpen={moveDialogOpen}
					node={node}
					nodeType={nodeType}
					onConfirmDelete={handleDelete}
					onConfirmDetach={handleDetach}
					onDeleteOpenChange={setDeleteDialogOpen}
					onDetachOpenChange={setDetachDialogOpen}
					onMoveOpenChange={setMoveDialogOpen}
				/>
			)}
		</>
	);
}
