"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactFlow, {
	Background,
	Controls,
	type Node,
	useReactFlow,
} from "reactflow";

import "reactflow/dist/style.css";
import "react-toastify/dist/ReactToastify.css";
import { Loader2, Unplug, X } from "lucide-react";
import EvidenceNode from "@/components/cases/evidence-node";
import GoalNode from "@/components/cases/goal-node";
import PropertyNode from "@/components/cases/property-node";
import StrategyNode from "@/components/cases/strategy-node";
import NodeEdit, {
	type AssuranceCaseNode,
} from "@/components/common/node-edit";
import useStore from "@/data/store";
import { useAutoScreenshot } from "@/hooks/use-auto-screenshot";
import { convertAssuranceCase } from "@/lib/convert-case";
import { getLayoutedElements } from "@/lib/layout-helper";
import { Button } from "../ui/button";
import { useToast } from "../ui/use-toast";
import ActionButtons from "./action-buttons";

// Define nodeTypes at module level to ensure stable reference
// This prevents React Flow warning about recreated nodeTypes objects
const nodeTypes = {
	goal: GoalNode,
	property: PropertyNode,
	strategy: StrategyNode,
	evidence: EvidenceNode,
};

function Flow() {
	const { fitView } = useReactFlow();
	const {
		nodes,
		edges,
		onNodesChange,
		setNodes,
		setEdges,
		layoutNodes,
		assuranceCase,
		orphanedElements,
	} = useStore();

	const [editOpen, setEditOpen] = useState(false);
	const [selectedNode, setSelectedNode] = useState<Node | null>(null);
	const [loading, setLoading] = useState(true);
	const [showOrphanMessage, setShowOrphanMessage] = useState<boolean>(true);

	const { toast } = useToast();

	// Determine if user can edit (for auto-screenshot)
	const canEdit =
		assuranceCase?.permissions === "edit" ||
		assuranceCase?.permissions === "manage";

	// Auto-screenshot hook - captures screenshots when changes are made
	const { markChanged } = useAutoScreenshot({
		caseId: assuranceCase?.id ?? "",
		canEdit,
		selector: "#ReactFlow",
		debounceMs: 5000,
	});

	const onLayout = (direction: "LR" | "TB" | "RL" | "BT") => {
		const layouted = getLayoutedElements(nodes, edges, { direction });

		setNodes(layouted.nodes);
		setEdges(layouted.edges);

		window.requestAnimationFrame(() => {
			fitView();
		});
	};

	const convert = useCallback(async () => {
		try {
			if (assuranceCase) {
				const result = await convertAssuranceCase({
					...assuranceCase,
					goals: assuranceCase.goals || [],
				});
				const { caseNodes, caseEdges } = result;

				// Send new nodes & edges to layout function
				layoutNodes(caseNodes, caseEdges);
				setLoading(false);
			} else {
				setLoading(false);
			}
		} catch (_error) {
			// Error is caught to prevent unhandled rejection
			// Component will remain in loading state if conversion fails
			setLoading(false);
		}
	}, [assuranceCase, layoutNodes]);

	// intial conversion of the assurance case on component render
	useEffect(() => {
		convert();
	}, [convert]);

	// Track case changes to trigger screenshot capture
	// Only runs after loading completes so the ReactFlow element exists
	const initialLoadRef = useRef(true);
	const previousCaseRef = useRef<string | null>(null);
	useEffect(() => {
		// Wait until loading is complete - the ReactFlow element only exists when not loading
		if (loading || !assuranceCase) {
			return;
		}

		// Create a fingerprint of case content using the case's updated_at timestamp
		const caseFingerprint = JSON.stringify({
			id: assuranceCase.id,
			// Use the case's modification time if available
			updatedAt: (assuranceCase as { updated_at?: string }).updated_at,
			goalsCount: assuranceCase.goals?.length ?? 0,
		});

		if (initialLoadRef.current) {
			// Mark as changed on initial load to capture initial state
			previousCaseRef.current = caseFingerprint;
			initialLoadRef.current = false;
			markChanged();
			return;
		}

		// Check if case content has actually changed
		if (previousCaseRef.current !== caseFingerprint) {
			previousCaseRef.current = caseFingerprint;
			markChanged();
		}
	}, [assuranceCase, loading, markChanged]);

	const handleNodeClick = (_event: React.MouseEvent, node: Node) => {
		setSelectedNode(node);
		setEditOpen(true);
	};

	const showCreateGoal = !(nodes.length > 0 && nodes[0].type === "goal");

	const notifyError = (message: string) => {
		toast({
			variant: "destructive",
			title: "Uh oh! Something went wrong.",
			description: message,
		});
	};

	const reactFlowWrapper = useRef(null);

	return (
		<div className="min-h-screen">
			{loading ? (
				<div className="flex min-h-screen items-center justify-center">
					<Loader2 className="h-8 w-8 animate-spin" />
				</div>
			) : (
				<div id="ChartFlow" ref={reactFlowWrapper}>
					<ReactFlow
						className="min-h-screen"
						edges={edges}
						fitView
						id="ReactFlow"
						nodes={nodes}
						nodesDraggable={false}
						nodeTypes={nodeTypes}
						onNodeClick={handleNodeClick}
						onNodesChange={onNodesChange}
					>
						<Controls className="z-50" />
						<Background />
					</ReactFlow>
					<ActionButtons
						actions={{ onLayout }}
						notifyError={notifyError}
						showCreateGoal={showCreateGoal}
					/>
					{selectedNode?.type && (
						<NodeEdit
							isOpen={editOpen}
							node={selectedNode as AssuranceCaseNode}
							setEditOpen={setEditOpen}
						/>
					)}
					{orphanedElements &&
						orphanedElements.length > 0 &&
						showOrphanMessage && (
							<div className="absolute top-16 left-0 w-full bg-slate-200/30 px-8 py-2 text-foreground backdrop-blur-xs dark:bg-violet-500/30">
								<div className="flex items-center justify-center">
									<div className="container mx-auto flex items-center justify-center gap-2">
										<Unplug className="h-4 w-4" />
										<p>You have orphaned elements for this assurance case.</p>
									</div>
									<Button
										className="hover:bg-gray-400/10 dark:hover:bg-slate-900/10"
										onClick={() => setShowOrphanMessage(false)}
										size={"icon"}
										title="Dismiss"
										variant={"ghost"}
									>
										<X className="h-4 w-4" />
									</Button>
								</div>
							</div>
						)}
				</div>
			)}
		</div>
	);
}

export default Flow;
