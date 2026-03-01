"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactFlow, {
	Background,
	Controls,
	useReactFlow,
	useUpdateNodeInternals,
} from "reactflow";

import "reactflow/dist/style.css";
import { Loader2, Unplug, X } from "lucide-react";
import EvidenceNode from "@/components/cases/evidence-node";
import GoalNode from "@/components/cases/goal-node";
import PropertyNode from "@/components/cases/property-node";
import StrategyNode from "@/components/cases/strategy-node";
import { useAutoScreenshot } from "@/hooks/use-auto-screenshot";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { convertAssuranceCase } from "@/lib/case/convert-case";
import { getLayoutedElements } from "@/lib/case/layout-helper";
import { toast } from "@/lib/toast";
import useStore from "@/store/store";
import { Button } from "../ui/button";
import ActionButtons from "./action-buttons";
import CommentsSheet from "./comments-sheet";

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
	const updateNodeInternals = useUpdateNodeInternals();
	const {
		nodes,
		edges,
		onNodesChange,
		setNodes,
		setEdges,
		layoutNodes,
		assuranceCase,
		orphanedElements,
		layoutDirection,
		setLayoutDirection,
	} = useStore();

	const [loading, setLoading] = useState(true);
	const [showOrphanMessage, setShowOrphanMessage] = useState<boolean>(true);

	// Keyboard shortcuts for undo/redo
	useKeyboardShortcuts();

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

	const onLayout = async (
		direction: "LR" | "TB" | "RL" | "BT" = layoutDirection
	) => {
		const layouted = await getLayoutedElements(nodes, edges, { direction });

		setNodes(layouted.nodes);
		setEdges(layouted.edges);

		window.requestAnimationFrame(() => {
			fitView();
		});
	};

	// Sync layout direction from persisted case data (only on case load, not on user toggle)
	const syncedCaseIdRef = useRef<string | null>(null);
	useEffect(() => {
		if (
			assuranceCase?.id &&
			assuranceCase.layoutDirection &&
			syncedCaseIdRef.current !== assuranceCase.id
		) {
			syncedCaseIdRef.current = assuranceCase.id;
			setLayoutDirection(assuranceCase.layoutDirection);
		}
	}, [assuranceCase?.id, assuranceCase?.layoutDirection, setLayoutDirection]);

	// When layout direction changes, tell ReactFlow to re-read handle positions
	// so edge paths recalculate to connect at the correct sides of nodes
	const prevDirectionRef = useRef(layoutDirection);
	useEffect(() => {
		if (prevDirectionRef.current !== layoutDirection) {
			prevDirectionRef.current = layoutDirection;
			for (const node of nodes) {
				updateNodeInternals(node.id);
			}
		}
	}, [layoutDirection, nodes, updateNodeInternals]);

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
			toast({
				variant: "destructive",
				title: "Diagram error",
				description: "Failed to render diagram",
			});
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
				<div data-tour="canvas" id="ChartFlow" ref={reactFlowWrapper}>
					<ReactFlow
						className="min-h-screen"
						edges={edges}
						fitView
						id="ReactFlow"
						nodes={nodes}
						nodesDraggable={false}
						nodeTypes={nodeTypes}
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
					{/* Comments Sheet - controlled by store state */}
					<CommentsSheet />
					{orphanedElements &&
						orphanedElements.length > 0 &&
						showOrphanMessage && (
							<div className="absolute top-16 left-0 w-full bg-card px-8 py-2 text-foreground shadow-sm">
								<div className="flex items-center justify-center">
									<div className="container mx-auto flex items-center justify-center gap-2">
										<Unplug className="h-4 w-4" />
										<p>You have orphaned elements for this assurance case.</p>
									</div>
									<Button
										className="hover:bg-muted"
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
