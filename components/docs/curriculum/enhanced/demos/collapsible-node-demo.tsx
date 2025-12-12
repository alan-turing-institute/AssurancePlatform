"use client";
/**
 * Collapsible Node Demo
 *
 * Demonstration of the collapsible node system with various usage patterns.
 * Shows integration of CollapsibleNode, NodeStateManager, and useNodeState hook.
 *
 * Features demonstrated:
 * - Basic collapsible nodes
 * - Centralised state management
 * - Bulk operations (expand/collapse all)
 * - Progressive disclosure
 * - Focus mode
 * - Persistent state (localStorage)
 *
 * @component
 * @example
 * <CollapsibleNodeDemo />
 */

import { useCallback, useMemo } from "react";
import ReactFlow, {
	Background,
	BackgroundVariant,
	Controls,
	type Edge,
	MarkerType,
	MiniMap,
	type Node,
	ReactFlowProvider,
} from "reactflow";
import "reactflow/dist/style.css";

import {
	CollapsibleNode,
	ControlledCollapsibleNode,
	NodeStateControls,
	NodeStateManager,
	ProgressiveCollapsibleNode,
	useNodeStateContext,
} from "../nodes";

type NodeDataType = {
	id: string;
	name: string;
	description: string;
	long_description: string;
};

/**
 * Demo node types using CollapsibleNode variants
 */
const demoNodeTypes = {
	collapsible: CollapsibleNode,
	progressive: ProgressiveCollapsibleNode,
	controlled: ControlledCollapsibleNode,
};

/**
 * Sample data for demonstration
 */
const createDemoData = () => {
	const nodes: Node<NodeDataType>[] = [
		{
			id: "goal-1",
			type: "collapsible",
			position: { x: 250, y: 50 },
			data: {
				id: "goal-1",
				name: "System Safety Goal",
				description: "The system shall be safe to operate",
				long_description:
					"The autonomous vehicle system shall operate safely under all normal operating conditions, minimising risk to passengers, pedestrians, and other road users.",
			},
		},
		{
			id: "strategy-1",
			type: "progressive",
			position: { x: 100, y: 200 },
			data: {
				id: "strategy-1",
				name: "Argument by Decomposition",
				description: "Break down into subsystems",
				long_description:
					"Decompose the system safety argument into individual subsystem safety arguments for perception, planning, and control.",
			},
		},
		{
			id: "strategy-2",
			type: "progressive",
			position: { x: 400, y: 200 },
			data: {
				id: "strategy-2",
				name: "Argument by Hazard Analysis",
				description: "Identify and mitigate hazards",
				long_description:
					"Systematically identify all potential hazards and demonstrate appropriate mitigation strategies for each.",
			},
		},
		{
			id: "claim-1",
			type: "controlled",
			position: { x: 50, y: 350 },
			data: {
				id: "claim-1",
				name: "Perception is Reliable",
				description: "Sensor fusion provides accurate world model",
				long_description:
					"The perception subsystem accurately detects and classifies objects in the environment with 99.9% accuracy under nominal conditions.",
			},
		},
		{
			id: "claim-2",
			type: "controlled",
			position: { x: 250, y: 350 },
			data: {
				id: "claim-2",
				name: "Planning is Safe",
				description: "Path planning avoids collisions",
				long_description:
					"The planning subsystem generates collision-free trajectories that respect all traffic rules and safety constraints.",
			},
		},
		{
			id: "claim-3",
			type: "collapsible",
			position: { x: 450, y: 350 },
			data: {
				id: "claim-3",
				name: "Control is Stable",
				description: "Vehicle control maintains stability",
				long_description:
					"The control subsystem maintains vehicle stability and responds appropriately to all planning commands.",
			},
		},
		{
			id: "evidence-1",
			type: "collapsible",
			position: { x: 50, y: 500 },
			data: {
				id: "evidence-1",
				name: "Sensor Test Results",
				description: "Test report showing 99.9% accuracy",
				long_description:
					"Comprehensive testing results demonstrating perception accuracy across 10,000+ test scenarios.",
			},
		},
		{
			id: "evidence-2",
			type: "collapsible",
			position: { x: 250, y: 500 },
			data: {
				id: "evidence-2",
				name: "Simulation Results",
				description: "Million mile simulation with zero collisions",
				long_description:
					"Results from 1 million miles of simulated driving with zero collision events.",
			},
		},
	];

	const edges: Edge[] = [
		{
			id: "e-goal-1-strategy-1",
			source: "goal-1",
			target: "strategy-1",
			type: "smoothstep",
			markerEnd: { type: MarkerType.ArrowClosed },
		},
		{
			id: "e-goal-1-strategy-2",
			source: "goal-1",
			target: "strategy-2",
			type: "smoothstep",
			markerEnd: { type: MarkerType.ArrowClosed },
		},
		{
			id: "e-strategy-1-claim-1",
			source: "strategy-1",
			target: "claim-1",
			type: "smoothstep",
			markerEnd: { type: MarkerType.ArrowClosed },
		},
		{
			id: "e-strategy-1-claim-2",
			source: "strategy-1",
			target: "claim-2",
			type: "smoothstep",
			markerEnd: { type: MarkerType.ArrowClosed },
		},
		{
			id: "e-strategy-1-claim-3",
			source: "strategy-1",
			target: "claim-3",
			type: "smoothstep",
			markerEnd: { type: MarkerType.ArrowClosed },
		},
		{
			id: "e-claim-1-evidence-1",
			source: "claim-1",
			target: "evidence-1",
			type: "smoothstep",
			markerEnd: { type: MarkerType.ArrowClosed },
		},
		{
			id: "e-claim-2-evidence-2",
			source: "claim-2",
			target: "evidence-2",
			type: "smoothstep",
			markerEnd: { type: MarkerType.ArrowClosed },
		},
	];

	return { nodes, edges };
};

/**
 * Demo Controls Component
 * Shows advanced controls using the node state context
 */
const DemoControls = () => {
	const { focusMode, expandPathToNode, expandNodeTree, resetAll } =
		useNodeStateContext();

	const handleFocusGoal = useCallback(() => {
		focusMode(["goal-1"]);
	}, [focusMode]);

	const handleExpandGoalTree = useCallback(() => {
		expandNodeTree("goal-1");
	}, [expandNodeTree]);

	const handleExpandToEvidence = useCallback(() => {
		expandPathToNode("evidence-1");
	}, [expandPathToNode]);

	return (
		<div className="absolute top-4 left-4 z-10 space-y-2">
			{/* State Manager Built-in Controls */}
			<NodeStateControls />

			{/* Advanced Demo Controls */}
			<div className="f-effect-backdrop-blur-lg space-y-2 rounded-lg border border-transparent bg-background-transparent-black p-3 shadow-glassmorphic">
				<div className="mb-2 font-semibold text-text-light text-xs">
					Advanced Controls
				</div>

				<button
					className="w-full rounded-md bg-background-transparent-white-hover px-3 py-1.5 font-medium text-text-light text-xs transition-colors duration-200 hover:bg-background-transparent-white-secondaryHover"
					onClick={handleFocusGoal}
					title="Focus on goal node only"
					type="button"
				>
					Focus on Goal
				</button>

				<button
					className="w-full rounded-md bg-background-transparent-white-hover px-3 py-1.5 font-medium text-text-light text-xs transition-colors duration-200 hover:bg-background-transparent-white-secondaryHover"
					onClick={handleExpandGoalTree}
					title="Expand entire goal tree"
					type="button"
				>
					Expand Goal Tree
				</button>

				<button
					className="w-full rounded-md bg-background-transparent-white-hover px-3 py-1.5 font-medium text-text-light text-xs transition-colors duration-200 hover:bg-background-transparent-white-secondaryHover"
					onClick={handleExpandToEvidence}
					title="Show path to evidence"
					type="button"
				>
					Show Path to Evidence
				</button>

				<button
					className="w-full rounded-md bg-transparent px-3 py-1.5 font-medium text-text-light/70 text-xs transition-colors duration-200 hover:bg-background-transparent-white-hover hover:text-text-light"
					onClick={resetAll}
					title="Reset all states"
					type="button"
				>
					Reset All
				</button>
			</div>

			{/* Instructions */}
			<div className="f-effect-backdrop-blur-lg space-y-1 rounded-lg border border-transparent bg-background-transparent-black p-3 text-text-light/70 text-xs shadow-glassmorphic">
				<div className="mb-1 font-semibold text-text-light">
					Interaction Guide
				</div>
				<div>• Click node to expand/collapse</div>
				<div>• Double-click to expand tree</div>
				<div>• Select node to auto-expand</div>
				<div>• Progressive nodes reveal children</div>
				<div>• Controlled nodes show extra controls</div>
			</div>
		</div>
	);
};

/**
 * CollapsibleNodeDemo Flow Component
 */
const CollapsibleNodeDemoFlow = () => {
	const { nodes, edges } = useMemo(() => createDemoData(), []);

	const handleNodeClick = useCallback(
		(_event: React.MouseEvent, node: Node) => {
			console.log("Node clicked:", node);
		},
		[]
	);

	return (
		<div className="h-[800px] w-full overflow-hidden rounded-lg bg-gray-950">
			<ReactFlow
				className="bg-gray-950"
				edges={edges}
				fitView
				fitViewOptions={{ padding: 0.2 }}
				maxZoom={2}
				minZoom={0.5}
				nodes={nodes}
				nodeTypes={demoNodeTypes}
				onNodeClick={handleNodeClick}
			>
				<Background
					color="rgba(255, 255, 255, 0.1)"
					gap={12}
					size={1}
					variant={BackgroundVariant.Dots}
				/>
				<Controls className="f-effect-backdrop-blur-lg rounded-lg border border-transparent bg-background-transparent-black" />
				<MiniMap
					className="f-effect-backdrop-blur-lg rounded-lg border border-transparent bg-background-transparent-black"
					nodeColor={(node) => {
						const colors: Record<string, string> = {
							goal: "#10b981",
							strategy: "#a855f7",
							propertyClaim: "#f97316",
							evidence: "#06b6d4",
							context: "#6b7280",
						};
						return colors[node.type || ""] || "#6b7280";
					}}
				/>

				{/* Demo Controls */}
				<DemoControls />
			</ReactFlow>
		</div>
	);
};

type CollapsibleNodeDemoProps = {
	persistKey?: string;
};

/**
 * Main Demo Component with State Manager
 */
const CollapsibleNodeDemo = ({
	persistKey = "collapsible-demo",
}: CollapsibleNodeDemoProps) => {
	const handleStateChange = useCallback((event: unknown) => {
		console.log("Node state changed:", event);
	}, []);

	return (
		<div className="w-full p-4">
			<div className="mb-4">
				<h2 className="mb-2 font-bold text-2xl text-gray-100">
					Collapsible Node System Demo
				</h2>
				<p className="text-gray-400">
					Interactive demonstration of the collapsible node system with state
					management, progressive disclosure, and advanced controls.
				</p>
			</div>

			<ReactFlowProvider>
				<NodeStateManager
					defaultExpanded={false}
					onStateChange={handleStateChange}
					persistKey={persistKey}
				>
					<CollapsibleNodeDemoFlow />
				</NodeStateManager>
			</ReactFlowProvider>

			{/* Feature Highlights */}
			<div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
				<div className="rounded-lg bg-gray-800 p-4">
					<h3 className="mb-2 font-semibold text-gray-100 text-sm">
						State Management
					</h3>
					<p className="text-gray-400 text-xs">
						Centralised state with localStorage persistence and bulk operations
					</p>
				</div>

				<div className="rounded-lg bg-gray-800 p-4">
					<h3 className="mb-2 font-semibold text-gray-100 text-sm">
						Progressive Disclosure
					</h3>
					<p className="text-gray-400 text-xs">
						Auto-reveal connected nodes with smooth transitions and animations
					</p>
				</div>

				<div className="rounded-lg bg-gray-800 p-4">
					<h3 className="mb-2 font-semibold text-gray-100 text-sm">
						Focus Mode
					</h3>
					<p className="text-gray-400 text-xs">
						Collapse all except selected path for better information density
					</p>
				</div>
			</div>
		</div>
	);
};

export default CollapsibleNodeDemo;
