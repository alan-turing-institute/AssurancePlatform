"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import type { Node } from "reactflow";
import { useEdges, useNodes } from "reactflow";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { moveCaseElement } from "@/lib/case";
import {
	getCompatibleParentTypes,
	REACTFLOW_TO_CANONICAL,
} from "@/lib/element-compatibility";
import { recordMove } from "@/lib/services/history-service";
import { toastError, toastSuccess } from "@/lib/toast";
import type { DiagramNodeType } from "./node-config";
import { getNodeIcon } from "./node-config";

export interface MoveElementDialogProps {
	node: Node;
	nodeType: DiagramNodeType;
	onOpenChange: (open: boolean) => void;
	open: boolean;
}

/** Map canonical parent types from the compatibility module to ReactFlow node types */
const DISPLAY_TO_REACTFLOW: Record<string, string> = {
	goal: "goal",
	strategy: "strategy",
	property_claim: "property",
	evidence: "evidence",
};

/** Get all descendant node IDs via BFS on edges */
function getDescendantIds(
	nodeId: string,
	edges: { source: string; target: string }[]
): Set<string> {
	const descendants = new Set<string>();
	const queue = [nodeId];

	while (queue.length > 0) {
		const current = queue.shift();
		if (!current) {
			break;
		}
		for (const edge of edges) {
			if (edge.source === current && !descendants.has(edge.target)) {
				descendants.add(edge.target);
				queue.push(edge.target);
			}
		}
	}

	return descendants;
}

export function MoveElementDialog({
	node,
	nodeType,
	open,
	onOpenChange,
}: MoveElementDialogProps) {
	// Cast to Node[] for untyped data property access — matches codebase convention
	const allNodes = useNodes() as Node[];
	const allEdges = useEdges();
	const [loading, setLoading] = useState(false);

	// Get compatible parent types and map to ReactFlow node types
	const compatibleParentTypes = getCompatibleParentTypes(nodeType);
	const reactFlowTypes = compatibleParentTypes
		.map((t) => DISPLAY_TO_REACTFLOW[t])
		.filter(Boolean);

	// Find current parent from edges
	const parentEdge = allEdges.find((e) => e.target === node.id);
	const currentParentId = parentEdge?.source;

	// Get all descendants to exclude (to prevent cycles)
	const descendantIds = getDescendantIds(node.id, allEdges);

	// Filter candidate parent nodes
	const candidates = allNodes.filter((n) => {
		if (!(n.type && reactFlowTypes.includes(n.type))) {
			return false;
		}
		if (n.id === node.id) {
			return false;
		}
		if (n.id === currentParentId) {
			return false;
		}
		if (descendantIds.has(n.id)) {
			return false;
		}
		// Exclude soft-deleted nodes
		if (n.data.deletedAt) {
			return false;
		}
		return true;
	});

	const handleMove = async (target: Node) => {
		setLoading(true);

		const elementId = node.data.id as string | number;
		const newParentId = String(target.data.id as string | number);

		const result = await moveCaseElement(elementId, newParentId);

		if ("error" in result) {
			toastError("Failed to move element");
		} else {
			// Derive old parent's data ID from the edge-based currentParentId (ReactFlow node ID)
			const currentParentNode = currentParentId
				? allNodes.find((n) => n.id === currentParentId)
				: undefined;
			const oldParentDataId = currentParentNode
				? String(currentParentNode.data.id as string | number)
				: "";
			const elementType =
				REACTFLOW_TO_CANONICAL[node.type ?? ""] ?? (node.data.type as string);

			recordMove(
				elementId,
				elementType,
				oldParentDataId,
				newParentId,
				(node.data?.name as string) || undefined
			);

			toastSuccess(
				`Moved ${(node.data?.name as string) || "element"} to ${(target.data.name as string) || "new parent"}`
			);
			onOpenChange(false);
		}

		setLoading(false);
	};

	const nodeName = (node.data?.name as string) || "this element";

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Move element</DialogTitle>
					<DialogDescription>
						Select a new parent for {nodeName}.
					</DialogDescription>
				</DialogHeader>
				<ScrollArea className={candidates.length > 5 ? "h-64" : "h-auto"}>
					<div className="space-y-1">
						{candidates.map((candidate) => {
							const Icon = getNodeIcon(candidate.type as DiagramNodeType);
							const candidateName =
								(candidate.data.name as string) || candidate.type;
							const candidateDescription =
								typeof candidate.data.description === "string"
									? candidate.data.description
									: null;
							return (
								<button
									className="flex w-full items-center gap-3 rounded-md p-2 text-left text-sm hover:bg-muted disabled:opacity-50"
									disabled={loading}
									key={candidate.id}
									onClick={() => handleMove(candidate)}
									type="button"
								>
									<Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
									<div className="min-w-0 flex-1">
										<span className="font-medium">{candidateName}</span>
										{candidateDescription && (
											<p className="truncate text-muted-foreground text-xs">
												{candidateDescription}
											</p>
										)}
									</div>
									{loading && <Loader2 className="h-4 w-4 animate-spin" />}
								</button>
							);
						})}
						{candidates.length === 0 && (
							<p className="p-2 text-muted-foreground text-sm">
								No compatible parent elements found.
							</p>
						)}
					</div>
				</ScrollArea>
			</DialogContent>
		</Dialog>
	);
}
