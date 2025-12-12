"use client";
import { motion } from "framer-motion";
import {
	AlertCircle,
	CheckCircle,
	ChevronRight,
	Eye,
	EyeOff,
	FileText,
	GitBranch,
	Info,
	Maximize2,
	Target,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import ReactFlow, {
	Background,
	BackgroundVariant,
	Controls,
	type Edge,
	Handle,
	MarkerType,
	MiniMap,
	type Node,
	Position,
	useEdgesState,
	useNodesState,
	useReactFlow,
} from "reactflow";
import { getLayoutedElements } from "@/lib/docs/layout-helper";
import type {
	CaseData,
	CustomNodeProps,
	ReactFlowNodeData,
} from "@/types/curriculum";
import "reactflow/dist/style.css";

// Store the enum value for use in Background component
const dotsVariant = BackgroundVariant.Dots;

// Custom node components for different element types
const GoalNode = ({
	data,
	isSelected,
}: CustomNodeProps & { isSelected?: boolean }) => (
	<motion.div
		animate={{ scale: 1, opacity: 1 }}
		className={`max-w-sm rounded-lg border-2 px-4 py-3 shadow-lg ${
			isSelected
				? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
				: "border-green-400 bg-green-50 dark:bg-green-900/20"
		} cursor-pointer transition-all hover:shadow-xl`}
		initial={{ scale: 0.8, opacity: 0 }}
		transition={{ duration: 0.3 }}
	>
		<div className="flex items-center gap-2">
			<Target className="h-5 w-5 text-green-600 dark:text-green-400" />
			<div className="font-bold text-gray-900 dark:text-gray-100">
				{data.name}
			</div>
		</div>
		<div className="mt-1 text-gray-600 text-sm dark:text-gray-400">
			{data.description}
		</div>
		<Handle position={Position.Bottom} type="source" />
	</motion.div>
);

const StrategyNode = ({
	data,
	isSelected,
}: CustomNodeProps & { isSelected?: boolean }) => (
	<motion.div
		animate={{ scale: 1, opacity: 1 }}
		className={`max-w-sm rounded-lg border-2 px-4 py-3 shadow-lg ${
			isSelected
				? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
				: "border-purple-400 bg-purple-50 dark:bg-purple-900/20"
		} cursor-pointer transition-all hover:shadow-xl`}
		initial={{ scale: 0.8, opacity: 0 }}
		transition={{ duration: 0.3 }}
	>
		<Handle position={Position.Top} type="target" />
		<div className="flex items-center gap-2">
			<GitBranch className="h-5 w-5 text-purple-600 dark:text-purple-400" />
			<div className="font-bold text-gray-900 dark:text-gray-100">
				{data.name}
			</div>
		</div>
		<div className="mt-1 text-gray-600 text-sm dark:text-gray-400">
			{data.description}
		</div>
		<Handle position={Position.Bottom} type="source" />
	</motion.div>
);

const PropertyClaimNode = ({
	data,
	isSelected,
}: CustomNodeProps & { isSelected?: boolean }) => (
	<motion.div
		animate={{ scale: 1, opacity: 1 }}
		className={`max-w-sm rounded-lg border-2 px-4 py-3 shadow-lg ${
			isSelected
				? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
				: "border-orange-400 bg-orange-50 dark:bg-orange-900/20"
		} cursor-pointer transition-all hover:shadow-xl`}
		initial={{ scale: 0.8, opacity: 0 }}
		transition={{ duration: 0.3 }}
	>
		<Handle position={Position.Top} type="target" />
		<div className="flex items-center gap-2">
			<FileText className="h-5 w-5 text-orange-600 dark:text-orange-400" />
			<div className="font-bold text-gray-900 dark:text-gray-100">
				{data.name}
			</div>
		</div>
		<div className="mt-1 text-gray-600 text-sm dark:text-gray-400">
			{data.description}
		</div>
		<Handle position={Position.Bottom} type="source" />
	</motion.div>
);

const EvidenceNode = ({
	data,
	isSelected,
}: CustomNodeProps & { isSelected?: boolean }) => (
	<motion.div
		animate={{ scale: 1, opacity: 1 }}
		className={`max-w-sm rounded-lg border-2 px-4 py-3 shadow-lg ${
			isSelected
				? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
				: "border-cyan-400 bg-cyan-50 dark:bg-cyan-900/20"
		} cursor-pointer transition-all hover:shadow-xl`}
		initial={{ scale: 0.8, opacity: 0 }}
		transition={{ duration: 0.3 }}
	>
		<Handle position={Position.Top} type="target" />
		<div className="flex items-center gap-2">
			<CheckCircle className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
			<div className="font-bold text-gray-900 dark:text-gray-100">
				{data.name}
			</div>
		</div>
		<div className="mt-1 text-gray-600 text-sm dark:text-gray-400">
			{data.description}
		</div>
	</motion.div>
);

const ContextNode = ({
	data,
	isSelected,
}: CustomNodeProps & { isSelected?: boolean }) => (
	<motion.div
		animate={{ scale: 1, opacity: 1 }}
		className={`max-w-sm rounded-lg border-2 px-4 py-3 shadow-lg ${
			isSelected
				? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
				: "border-gray-400 bg-gray-50 dark:bg-gray-900/20"
		} cursor-pointer transition-all hover:shadow-xl`}
		initial={{ scale: 0.8, opacity: 0 }}
		transition={{ duration: 0.3 }}
	>
		<div className="flex items-center gap-2">
			<AlertCircle className="h-5 w-5 text-gray-600 dark:text-gray-400" />
			<div className="font-bold text-gray-900 dark:text-gray-100">
				{data.name}
			</div>
		</div>
		<div className="mt-1 text-gray-600 text-sm dark:text-gray-400">
			{data.description}
		</div>
	</motion.div>
);

const nodeTypes = {
	goal: GoalNode,
	strategy: StrategyNode,
	propertyClaimNode: PropertyClaimNode,
	evidence: EvidenceNode,
	context: ContextNode,
};

type ControlButtonsProps = {
	nodes: Node[];
	edges: Edge[];
	setNodes: (nodes: Node[]) => void;
	setEdges: (edges: Edge[]) => void;
	setRevealedNodes: (nodes: Set<string>) => void;
};

// Control buttons component that uses useReactFlow
const ControlButtons = ({
	nodes,
	edges,
	setNodes,
	setEdges,
	setRevealedNodes,
}: ControlButtonsProps) => {
	const { fitView } = useReactFlow();

	const handleAutoLayout = useCallback(() => {
		// Apply Dagre layout to arrange nodes
		const layouted = getLayoutedElements(nodes, edges, { direction: "TB" });

		// Update nodes with new positions
		setNodes(layouted.nodes);
		setEdges(layouted.edges);

		// Fit view to show all nodes after layout
		window.requestAnimationFrame(() => {
			fitView({ padding: 0.2, duration: 400 });
		});
	}, [nodes, edges, setNodes, setEdges, fitView]);

	const handleRevealAll = useCallback(() => {
		setRevealedNodes(new Set(nodes.map((n) => n.id)));
	}, [nodes, setRevealedNodes]);

	const handleReset = useCallback(() => {
		setRevealedNodes(new Set(["goal-1"]));
	}, [setRevealedNodes]);

	return (
		<div className="absolute top-4 left-4 z-10 flex gap-2">
			<button
				className="flex items-center gap-1 rounded bg-blue-500 px-3 py-1 text-white transition hover:bg-blue-600"
				onClick={handleRevealAll}
				type="button"
			>
				<Eye className="h-4 w-4" />
				Reveal All
			</button>
			<button
				className="flex items-center gap-1 rounded bg-gray-500 px-3 py-1 text-white transition hover:bg-gray-600"
				onClick={handleReset}
				type="button"
			>
				<EyeOff className="h-4 w-4" />
				Reset
			</button>
			<button
				className="flex items-center gap-1 rounded bg-green-500 px-3 py-1 text-white transition hover:bg-green-600"
				onClick={handleAutoLayout}
				type="button"
			>
				<Maximize2 className="h-4 w-4" />
				Auto Layout
			</button>
		</div>
	);
};

type InteractiveCaseViewerProps = {
	caseData: CaseData;
	onNodeClick?: (node: Node<ReactFlowNodeData>) => void;
	guidedPath?: string[];
	showAllNodes?: boolean;
	enableExploration?: boolean;
};

type LayoutParams = {
	xSpacing: number;
	ySpacing: number;
	yOffset: number;
};

type BuildResult = {
	flowNodes: Node<ReactFlowNodeData>[];
	flowEdges: Edge[];
};

// Add evidence nodes for a claim
const addEvidenceNodes = (
	claimId: string,
	evidence: { name: string; description: string }[],
	stratIdx: number,
	claimIdx: number,
	layout: LayoutParams,
	guidedPath: string[],
	flowNodes: Node<ReactFlowNodeData>[],
	flowEdges: Edge[]
) => {
	for (const [evidIdx, evid] of evidence.entries()) {
		const evidId = `evidence-${stratIdx}-${claimIdx}-${evidIdx + 1}`;
		flowNodes.push({
			id: evidId,
			type: "evidence",
			position: {
				x: 150 + stratIdx * layout.xSpacing + (claimIdx % 2) * 420,
				y:
					layout.yOffset + layout.ySpacing * 3 + Math.floor(claimIdx / 2) * 150,
			},
			data: { name: evid.name, description: evid.description, element: evid },
		});

		flowEdges.push({
			id: `${claimId}-${evidId}`,
			source: claimId,
			target: evidId,
			type: "smoothstep",
			animated: guidedPath.includes(evidId),
			markerEnd: { type: MarkerType.ArrowClosed },
		});
	}
};

// Add property claim nodes for a strategy
const addPropertyClaimNodes = (
	strategyId: string,
	claims: {
		name: string;
		description: string;
		evidence?: { name: string; description: string }[];
	}[],
	stratIdx: number,
	layout: LayoutParams,
	guidedPath: string[],
	flowNodes: Node<ReactFlowNodeData>[],
	flowEdges: Edge[]
) => {
	for (const [claimIdx, claim] of claims.entries()) {
		const claimId = `claim-${stratIdx}-${claimIdx + 1}`;
		flowNodes.push({
			id: claimId,
			type: "propertyClaimNode",
			position: {
				x: 150 + stratIdx * layout.xSpacing + (claimIdx % 2) * 420,
				y:
					layout.yOffset + layout.ySpacing * 2 + Math.floor(claimIdx / 2) * 150,
			},
			data: {
				name: claim.name,
				description: claim.description,
				element: claim,
			},
		});

		flowEdges.push({
			id: `${strategyId}-${claimId}`,
			source: strategyId,
			target: claimId,
			type: "smoothstep",
			animated: guidedPath.includes(claimId),
			markerEnd: { type: MarkerType.ArrowClosed },
		});

		if (claim.evidence) {
			addEvidenceNodes(
				claimId,
				claim.evidence,
				stratIdx,
				claimIdx,
				layout,
				guidedPath,
				flowNodes,
				flowEdges
			);
		}
	}
};

// Helper to build case nodes and edges from case data
const buildNodesAndEdges = (
	caseData: CaseData,
	guidedPath: string[]
): BuildResult => {
	const flowNodes: Node<ReactFlowNodeData>[] = [];
	const flowEdges: Edge[] = [];
	const layout: LayoutParams = { xSpacing: 500, ySpacing: 180, yOffset: 0 };

	const goal = caseData.goals?.[0];
	if (!goal) {
		return { flowNodes, flowEdges };
	}

	// Add goal node
	flowNodes.push({
		id: "goal-1",
		type: "goal",
		position: { x: 400, y: layout.yOffset },
		data: { name: goal.name, description: goal.description, element: goal },
	});
	layout.yOffset += layout.ySpacing;

	// Add context nodes
	if (goal.context) {
		for (const [idx, ctx] of goal.context.entries()) {
			flowNodes.push({
				id: `context-${idx + 1}`,
				type: "context",
				position: { x: 100 + idx * 200, y: layout.yOffset },
				data: { name: ctx.name, description: ctx.description, element: ctx },
			});
		}
	}

	// Add strategies and their children
	if (goal.strategies) {
		for (const [stratIdx, strategy] of goal.strategies.entries()) {
			const strategyId = `strategy-${stratIdx + 1}`;
			flowNodes.push({
				id: strategyId,
				type: "strategy",
				position: {
					x: 200 + stratIdx * layout.xSpacing,
					y: layout.yOffset + layout.ySpacing,
				},
				data: {
					name: strategy.name,
					description: strategy.description,
					element: strategy,
				},
			});

			flowEdges.push({
				id: `goal-${strategyId}`,
				source: "goal-1",
				target: strategyId,
				type: "smoothstep",
				animated: guidedPath.includes(strategyId),
				markerEnd: { type: MarkerType.ArrowClosed },
			});

			if (strategy.property_claims) {
				addPropertyClaimNodes(
					strategyId,
					strategy.property_claims,
					stratIdx,
					layout,
					guidedPath,
					flowNodes,
					flowEdges
				);
			}
		}
	}

	return { flowNodes, flowEdges };
};

// Main Interactive Case Viewer Component
const InteractiveCaseViewer = ({
	caseData,
	onNodeClick,
	guidedPath = [],
	showAllNodes = false,
	enableExploration = true,
}: InteractiveCaseViewerProps) => {
	const [nodes, setNodes, onNodesChange] = useNodesState([]);
	const [edges, setEdges, onEdgesChange] = useEdgesState([]);
	const [_selectedNode, setSelectedNode] =
		useState<Node<ReactFlowNodeData> | null>(null);
	const [revealedNodes, setRevealedNodes] = useState(new Set(["goal-1"]));
	const [showLegend, setShowLegend] = useState(false);

	// Convert case data to ReactFlow nodes and edges
	useEffect(() => {
		if (!caseData) {
			console.warn("No caseData provided to InteractiveCaseViewer");
			return;
		}

		const { flowNodes, flowEdges } = buildNodesAndEdges(caseData, guidedPath);

		// Apply progressive disclosure
		const visibleNodes = showAllNodes
			? flowNodes
			: flowNodes.map((node) => ({
					...node,
					hidden: !(revealedNodes.has(node.id) || guidedPath.includes(node.id)),
				}));

		setNodes(visibleNodes);
		setEdges(flowEdges);
	}, [caseData, showAllNodes, revealedNodes, guidedPath, setNodes, setEdges]);

	const toggleChildNodes = useCallback(
		(nodeId: string) => {
			const newRevealed = new Set(revealedNodes);
			newRevealed.add(nodeId);

			const childNodes = edges
				.filter((edge) => edge.source === nodeId)
				.map((edge) => edge.target);

			const allChildrenVisible =
				childNodes.length > 0 &&
				childNodes.every((childId) => revealedNodes.has(childId));

			for (const childId of childNodes) {
				if (allChildrenVisible) {
					newRevealed.delete(childId);
				} else {
					newRevealed.add(childId);
				}
			}

			setRevealedNodes(newRevealed);
		},
		[edges, revealedNodes]
	);

	const handleNodeClick = useCallback(
		(_event: React.MouseEvent, node: Node<ReactFlowNodeData>) => {
			setSelectedNode(node);

			if (enableExploration && !showAllNodes) {
				toggleChildNodes(node.id);
			}

			if (onNodeClick) {
				onNodeClick(node);
			}
		},
		[enableExploration, showAllNodes, onNodeClick, toggleChildNodes]
	);

	return (
		<div className="relative h-[600px] w-full rounded-lg border bg-white shadow-lg dark:bg-gray-900">
			{/* Legend Toggle */}
			<div className="absolute top-4 right-4 z-10">
				{showLegend ? (
					<div className="rounded bg-white p-3 shadow-lg dark:bg-gray-800">
						<div className="mb-2 flex items-center justify-between">
							<h3 className="font-bold text-sm">Element Types</h3>
							<button
								aria-label="Hide legend"
								className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
								onClick={() => setShowLegend(false)}
								type="button"
							>
								<ChevronRight className="h-4 w-4" />
							</button>
						</div>
						<div className="space-y-1 text-xs">
							<div className="flex items-center gap-2">
								<Target className="h-4 w-4 text-green-600" />
								<span>Goal</span>
							</div>
							<div className="flex items-center gap-2">
								<GitBranch className="h-4 w-4 text-purple-600" />
								<span>Strategy</span>
							</div>
							<div className="flex items-center gap-2">
								<FileText className="h-4 w-4 text-orange-600" />
								<span>Property Claim</span>
							</div>
							<div className="flex items-center gap-2">
								<CheckCircle className="h-4 w-4 text-cyan-600" />
								<span>Evidence</span>
							</div>
							<div className="flex items-center gap-2">
								<AlertCircle className="h-4 w-4 text-gray-600" />
								<span>Context</span>
							</div>
						</div>
					</div>
				) : (
					<button
						aria-label="Show element types legend"
						className="rounded bg-white p-2 shadow-lg transition hover:shadow-xl dark:bg-gray-800"
						onClick={() => setShowLegend(true)}
						title="Show element types"
						type="button"
					>
						<Info className="h-5 w-5 text-gray-600 dark:text-gray-400" />
					</button>
				)}
			</div>

			{/* ReactFlow Canvas */}
			<ReactFlow
				attributionPosition="bottom-left"
				edges={edges}
				fitView
				nodes={nodes}
				nodeTypes={nodeTypes}
				onEdgesChange={onEdgesChange}
				onNodeClick={handleNodeClick}
				onNodesChange={onNodesChange}
			>
				<ControlButtons
					edges={edges}
					nodes={nodes}
					setEdges={setEdges}
					setNodes={setNodes}
					setRevealedNodes={setRevealedNodes}
				/>
				<Background gap={12} size={1} variant={dotsVariant} />
				<Controls />
				<MiniMap />
			</ReactFlow>
		</div>
	);
};

export default InteractiveCaseViewer;
