"use client";
/**
 * Context Menu Demo Component
 *
 * Comprehensive demonstration of all context menu types and features.
 *
 * @module menus/ContextMenuDemo
 */

import { useCallback, useState } from "react";
import type { Connection, Edge, Node, NodeProps } from "reactflow";
import ReactFlow, {
	addEdge,
	Background,
	Controls,
	MiniMap,
	useEdgesState,
	useNodesState,
	useReactFlow,
} from "reactflow";
import "reactflow/dist/style.css";

import {
	useCanvasContextMenu,
	useEdgeContextMenu,
	useNodeContextMenu,
} from "./index";

/**
 * Node data type
 */
type NodeData = {
	name: string;
	description: string;
	type: string;
	priority?: string;
	strategyType?: string;
	status?: string;
	confidence?: string;
	importance?: string;
};

/**
 * Demo node type
 */
type DemoNode = Node<NodeData>;

/**
 * Action log entry type
 */
type ActionLogEntry = {
	timestamp: string;
	action: string;
	details: string;
};

/**
 * Position type
 */
type Position = {
	x: number;
	y: number;
};

/**
 * Initial demo nodes
 */
const initialNodes: DemoNode[] = [
	{
		id: "1",
		type: "goal",
		position: { x: 250, y: 50 },
		data: {
			name: "System Safety Goal",
			description: "The system shall be safe to operate",
			priority: "critical",
			type: "goal",
		},
	},
	{
		id: "2",
		type: "strategy",
		position: { x: 100, y: 200 },
		data: {
			name: "Argument by Decomposition",
			description: "Break down into sub-goals",
			strategyType: "and",
			type: "strategy",
		},
	},
	{
		id: "3",
		type: "strategy",
		position: { x: 400, y: 200 },
		data: {
			name: "Argument by Evidence",
			description: "Support with testing evidence",
			strategyType: "or",
			type: "strategy",
		},
	},
	{
		id: "4",
		type: "propertyClaim",
		position: { x: 50, y: 350 },
		data: {
			name: "Hardware Safety",
			description: "All hardware components are verified",
			status: "verified",
			type: "propertyClaim",
		},
	},
	{
		id: "5",
		type: "propertyClaim",
		position: { x: 200, y: 350 },
		data: {
			name: "Software Safety",
			description: "Software meets safety requirements",
			status: "pending",
			type: "propertyClaim",
		},
	},
	{
		id: "6",
		type: "evidence",
		position: { x: 350, y: 350 },
		data: {
			name: "Test Results",
			description: "10,000 test cases executed",
			confidence: "high",
			type: "evidence",
		},
	},
	{
		id: "7",
		type: "evidence",
		position: { x: 500, y: 350 },
		data: {
			name: "Code Review",
			description: "Independent code review completed",
			confidence: "medium",
			type: "evidence",
		},
	},
	{
		id: "8",
		type: "context",
		position: { x: 600, y: 50 },
		data: {
			name: "Regulatory Context",
			description: "Must comply with ISO 26262",
			importance: "critical",
			type: "context",
		},
	},
];

/**
 * Initial demo edges
 */
const initialEdges: Edge[] = [
	{ id: "e1-2", source: "1", target: "2", type: "smoothstep" },
	{ id: "e1-3", source: "1", target: "3", type: "smoothstep" },
	{ id: "e2-4", source: "2", target: "4", type: "smoothstep" },
	{ id: "e2-5", source: "2", target: "5", type: "smoothstep" },
	{ id: "e3-6", source: "3", target: "6", type: "smoothstep" },
	{ id: "e3-7", source: "3", target: "7", type: "smoothstep" },
	{
		id: "e1-8",
		source: "1",
		target: "8",
		type: "straight",
		style: { strokeDasharray: "5 5" },
	},
];

/**
 * Node type configuration
 */
type NodeTypeConfig = {
	color: string;
	icon: string;
};

/**
 * Get node type configuration
 */
function getNodeTypeConfig(type: string): NodeTypeConfig {
	const nodeTypes: Record<string, NodeTypeConfig> = {
		goal: { color: "bg-green-500/20 border-green-400/50", icon: "G" },
		strategy: { color: "bg-purple-500/20 border-purple-400/50", icon: "S" },
		propertyClaim: {
			color: "bg-orange-500/20 border-orange-400/50",
			icon: "C",
		},
		evidence: { color: "bg-cyan-500/20 border-cyan-400/50", icon: "E" },
		context: { color: "bg-gray-500/20 border-gray-400/50", icon: "X" },
	};

	return nodeTypes[type] || nodeTypes.goal;
}

/**
 * Custom node component with context menu indicator
 */
const CustomNode = ({ data, selected }: NodeProps<NodeData>) => {
	const nodeType = getNodeTypeConfig(data.type);

	return (
		<div
			className={`rounded-lg border-2 px-4 py-3 ${nodeType.color}
        ${selected ? "ring-2 ring-blue-500" : ""}min-w-[180px] f-effect-backdrop-blur-lg max-w-[220px] cursor-pointer bg-background-transparent-black shadow-md transition-all duration-200 hover:shadow-lg`}
		>
			<div className="mb-1 flex items-center gap-2">
				<div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 font-bold text-white text-xs">
					{nodeType.icon}
				</div>
				<div className="truncate font-semibold text-sm text-white">
					{data.name}
				</div>
			</div>
			<div className="line-clamp-2 text-gray-300 text-xs">
				{data.description}
			</div>
			{selected && (
				<div className="mt-2 text-blue-400 text-xs">Right-click for menu</div>
			)}
		</div>
	);
};

/**
 * Node types configuration
 */
const nodeTypes = {
	goal: CustomNode,
	strategy: CustomNode,
	propertyClaim: CustomNode,
	evidence: CustomNode,
	context: CustomNode,
};

/**
 * Get minimap node color
 */
function getMinimapNodeColor(node: DemoNode): string {
	const colors: Record<string, string> = {
		goal: "#22c55e",
		strategy: "#a855f7",
		propertyClaim: "#fb923c",
		evidence: "#06b6d4",
		context: "#6b7280",
	};
	return colors[node.type || ""] || "#3b82f6";
}

/**
 * Action log component props
 */
type ActionLogProps = {
	actionLog: ActionLogEntry[];
	onClear: () => void;
};

/**
 * Action log component
 */
function ActionLog({ actionLog, onClear }: ActionLogProps) {
	if (actionLog.length === 0) {
		return (
			<div className="py-8 text-center text-gray-500 text-sm">
				No actions yet. Try right-clicking!
			</div>
		);
	}

	return (
		<>
			<div className="flex-1 space-y-2 overflow-y-auto p-4">
				{actionLog.map((log) => (
					<div
						className="rounded border border-gray-700 bg-gray-800 p-3"
						key={`${log.timestamp}-${log.action}`}
					>
						<div className="mb-1 flex items-center justify-between">
							<span className="font-mono text-gray-400 text-xs">
								{log.timestamp}
							</span>
						</div>
						<div className="font-semibold text-sm text-white">{log.action}</div>
						<div className="mt-1 text-gray-400 text-xs">{log.details}</div>
					</div>
				))}
			</div>

			<div className="border-gray-800 border-t p-4">
				<button
					className="w-full rounded bg-gray-800 px-4 py-2 text-sm text-white transition-colors hover:bg-gray-700"
					onClick={onClear}
					type="button"
				>
					Clear Log
				</button>
			</div>
		</>
	);
}

/**
 * ContextMenuDemo Component
 */
export const ContextMenuDemo = () => {
	const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
	const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
	const reactFlowInstance = useReactFlow();

	const [actionLog, setActionLog] = useState<ActionLogEntry[]>([]);

	/**
	 * Log actions for demonstration
	 */
	const logAction = useCallback((action: string, details: string) => {
		const timestamp = new Date().toLocaleTimeString();
		setActionLog((prev) => [
			{ timestamp, action, details },
			...prev.slice(0, 9), // Keep last 10 actions
		]);
	}, []);

	/**
	 * Clear action log
	 */
	const clearActionLog = useCallback(() => {
		setActionLog([]);
	}, []);

	/**
	 * Custom callbacks for menu actions
	 */
	const nodeCallbacks = {
		onEdit: (node: Node) => {
			logAction("Edit Node", `Editing ${node.data.name}`);
			// biome-ignore lint/suspicious/noAlert: Demo purposes only
			alert(`Edit dialog would open for: ${node.data.name}`);
		},
		onDelete: (node: Node) => {
			logAction("Delete Node", `Deleted ${node.data.name}`);
			setNodes(nodes.filter((n) => n.id !== node.id));
			setEdges(
				edges.filter((e) => e.source !== node.id && e.target !== node.id)
			);
		},
		onAddEvidence: (node: Node) => {
			logAction("Add Evidence", `Adding evidence to ${node.data.name}`);
			// biome-ignore lint/suspicious/noAlert: Demo purposes only
			alert(`Add evidence dialog would open for: ${node.data.name}`);
		},
		onLinkSource: (node: Node) => {
			logAction("Link Source", `Linking source to ${node.data.name}`);
			// biome-ignore lint/suspicious/noAlert: Demo purposes only
			alert(`Link source dialog would open for: ${node.data.name}`);
		},
		onViewDetails: (node: Node) => {
			logAction("View Details", `Viewing details for ${node.data.name}`);
			// biome-ignore lint/suspicious/noAlert: Demo purposes only
			alert(`Details dialog would open for: ${node.data.name}`);
		},
	};

	const edgeCallbacks = {
		onEditLabel: (edge: Edge) => {
			logAction("Edit Edge Label", `Editing label for edge ${edge.id}`);
			// biome-ignore lint/suspicious/noAlert: Demo purposes only
			alert(`Edit label dialog would open for edge: ${edge.id}`);
		},
		onAddWaypoint: (edge: Edge) => {
			logAction("Add Waypoint", `Adding waypoint to edge ${edge.id}`);
			// biome-ignore lint/suspicious/noAlert: Demo purposes only
			alert(`Waypoint mode would activate for edge: ${edge.id}`);
		},
	};

	const canvasCallbacks = {
		onCreate: (nodeType: string, position: Position) => {
			logAction(
				"Create Node",
				`Creating ${nodeType} at (${Math.round(position.x)}, ${Math.round(position.y)})`
			);
			const newNode: DemoNode = {
				id: `node-${Date.now()}`,
				type: nodeType,
				position,
				data: {
					name: `New ${nodeType}`,
					description: "Right-click to edit",
					type: nodeType,
				},
			};
			setNodes([...nodes, newNode]);
		},
		onAutoLayout: (layoutType: string) => {
			logAction("Auto Layout", `Applying ${layoutType} layout`);
			// biome-ignore lint/suspicious/noAlert: Demo purposes only
			alert(`Auto layout (${layoutType}) would be applied`);
		},
	};

	/**
	 * Initialize context menus
	 */
	const { handleNodeContextMenu, NodeContextMenu } = useNodeContextMenu({
		nodes,
		edges,
		setNodes,
		setEdges,
		reactFlowInstance,
		callbacks: nodeCallbacks,
	});

	const { handleEdgeContextMenu, EdgeContextMenu } = useEdgeContextMenu({
		edges,
		setEdges,
		reactFlowInstance,
		callbacks: edgeCallbacks,
	});

	const { handlePaneContextMenu, CanvasContextMenu } = useCanvasContextMenu({
		nodes,
		edges,
		setNodes,
		setEdges,
		reactFlowInstance,
		callbacks: canvasCallbacks,
	});

	/**
	 * Handle connection creation
	 */
	const onConnect = useCallback(
		(params: Connection) => {
			setEdges((eds) => addEdge({ ...params, type: "smoothstep" }, eds));
			logAction(
				"Create Connection",
				`Connected ${params.source} to ${params.target}`
			);
		},
		[setEdges, logAction]
	);

	return (
		<div className="flex h-screen w-full flex-col bg-gray-950">
			{/* Header */}
			<div className="border-gray-800 border-b bg-gray-900 px-6 py-4">
				<h1 className="mb-2 font-bold text-2xl text-white">
					Context Menu System Demo
				</h1>
				<p className="text-gray-400 text-sm">
					Right-click on nodes, edges, or canvas to see context menus in action
				</p>
			</div>

			{/* Main Content */}
			<div className="flex flex-1">
				{/* React Flow Canvas */}
				<div className="relative flex-1">
					<ReactFlow
						className="bg-gray-950"
						edges={edges}
						fitView
						nodes={nodes}
						nodeTypes={nodeTypes}
						onConnect={onConnect}
						onEdgeContextMenu={handleEdgeContextMenu}
						onEdgesChange={onEdgesChange}
						onNodeContextMenu={handleNodeContextMenu}
						onNodesChange={onNodesChange}
						onPaneContextMenu={handlePaneContextMenu}
					>
						<Background color="#333" gap={16} />
						<Controls className="border-gray-700 bg-gray-800" />
						<MiniMap
							className="border-gray-700 bg-gray-800"
							nodeColor={getMinimapNodeColor}
						/>
					</ReactFlow>

					{/* Context Menus */}
					{NodeContextMenu}
					{EdgeContextMenu}
					{CanvasContextMenu}

					{/* Instructions Overlay */}
					<div className="f-effect-backdrop-blur-lg absolute top-4 left-4 max-w-xs rounded-lg border border-transparent bg-background-transparent-black-secondary p-4 shadow-3d">
						<h3 className="mb-2 flex items-center gap-2 font-semibold text-white">
							<span className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
							Quick Guide
						</h3>
						<ul className="space-y-1 text-gray-300 text-sm">
							<li>
								• Right-click <strong>nodes</strong> for node actions
							</li>
							<li>
								• Right-click <strong>edges</strong> for connection options
							</li>
							<li>
								• Right-click <strong>canvas</strong> to create nodes
							</li>
							<li>• Select multiple nodes for bulk actions</li>
							<li>• Use keyboard shortcuts (E, F, Del)</li>
						</ul>
					</div>
				</div>

				{/* Action Log Sidebar */}
				<div className="flex w-80 flex-col border-gray-800 border-l bg-gray-900">
					<div className="border-gray-800 border-b px-4 py-3">
						<h2 className="font-semibold text-lg text-white">Action Log</h2>
						<p className="mt-1 text-gray-400 text-xs">Recent menu actions</p>
					</div>

					<ActionLog actionLog={actionLog} onClear={clearActionLog} />
				</div>
			</div>
		</div>
	);
};

/**
 * ContextMenuDemoWrapper Component
 *
 * Wraps demo with ReactFlowProvider
 */
export const ContextMenuDemoWrapper = () => (
	<div className="h-screen w-full">
		<ReactFlow>
			<ContextMenuDemo />
		</ReactFlow>
	</div>
);

export default ContextMenuDemo;
