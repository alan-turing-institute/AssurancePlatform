"use client";
/**
 * Edge Demo Component
 *
 * Comprehensive demonstration of all edge types with interactive controls
 * and visual examples. Shows different edge styles, animations, and configurations.
 *
 * @module EdgeDemo
 */

import { motion } from "framer-motion";
import { useCallback, useState } from "react";
import type { Connection, Edge, Node } from "reactflow";
import ReactFlow, {
	addEdge,
	Background,
	BackgroundVariant,
	Controls,
	MiniMap,
	useEdgesState,
	useNodesState,
} from "reactflow";
import "reactflow/dist/style.css";
import { applyEdgePreset, edgeStylePresets, edgeTypes } from "./index";

// Use BackgroundVariant.Dots for type safety
const BACKGROUND_VARIANT = BackgroundVariant.Dots;

/**
 * Initial demo nodes
 */
const initialNodes: Node[] = [
	// Animated edges demo
	{
		id: "animated-1",
		type: "default",
		position: { x: 50, y: 50 },
		data: { label: "Animated Start" },
	},
	{
		id: "animated-2",
		type: "default",
		position: { x: 300, y: 50 },
		data: { label: "Animated End" },
	},

	// Gradient edges demo
	{
		id: "gradient-1",
		type: "default",
		position: { x: 50, y: 150 },
		data: { label: "Gradient Start" },
	},
	{
		id: "gradient-2",
		type: "default",
		position: { x: 300, y: 150 },
		data: { label: "Gradient End" },
	},

	// Glowing edges demo
	{
		id: "glow-1",
		type: "default",
		position: { x: 50, y: 250 },
		data: { label: "Glow Start" },
	},
	{
		id: "glow-2",
		type: "default",
		position: { x: 300, y: 250 },
		data: { label: "Glow End" },
	},

	// Flowing edges demo
	{
		id: "flow-1",
		type: "default",
		position: { x: 50, y: 350 },
		data: { label: "Flow Start" },
	},
	{
		id: "flow-2",
		type: "default",
		position: { x: 300, y: 350 },
		data: { label: "Flow End" },
	},

	// Smart edges demo
	{
		id: "smart-1",
		type: "default",
		position: { x: 50, y: 450 },
		data: { label: "Smart Start" },
	},
	{
		id: "smart-2",
		type: "default",
		position: { x: 300, y: 450 },
		data: { label: "Smart End" },
	},

	// Complex network
	{
		id: "center",
		type: "default",
		position: { x: 550, y: 250 },
		data: { label: "Hub Node" },
	},
	{
		id: "top",
		type: "default",
		position: { x: 550, y: 50 },
		data: { label: "Top" },
	},
	{
		id: "right",
		type: "default",
		position: { x: 750, y: 250 },
		data: { label: "Right" },
	},
	{
		id: "bottom",
		type: "default",
		position: { x: 550, y: 450 },
		data: { label: "Bottom" },
	},
	{
		id: "left",
		type: "default",
		position: { x: 350, y: 250 },
		data: { label: "Left" },
	},
];

/**
 * Initial demo edges showcasing different types
 */
const initialEdges: Edge[] = [
	// Animated edges
	{
		id: "e-animated-1",
		source: "animated-1",
		target: "animated-2",
		type: "animated",
		label: "Animated",
		data: {
			label: "Animated Edge",
			animated: true,
		},
	},

	// Gradient edges
	{
		id: "e-gradient-1",
		source: "gradient-1",
		target: "gradient-2",
		type: "gradient",
		data: {
			label: "Gradient",
			sourceColor: "#3b82f6",
			targetColor: "#8b5cf6",
			gradientStops: 3,
		},
	},

	// Glowing edges
	{
		id: "e-glow-1",
		source: "glow-1",
		target: "glow-2",
		type: "neon",
		data: {
			label: "Neon Glow",
			color: "#10b981",
		},
	},

	// Flowing edges
	{
		id: "e-flow-1",
		source: "flow-1",
		target: "flow-2",
		type: "flowing",
		data: {
			label: "Data Flow",
			particleCount: 4,
			flowSpeed: 1,
		},
	},

	// Smart edges
	{
		id: "e-smart-1",
		source: "smart-1",
		target: "smart-2",
		type: "smart",
		data: {
			label: "Smart Edge",
			strength: 0.8,
			showStrengthIndicator: true,
		},
	},

	// Complex network with different types
	{
		id: "e-center-top",
		source: "center",
		target: "top",
		type: "strongConnection",
		data: { label: "Strong", strength: 1 },
	},
	{
		id: "e-center-right",
		source: "center",
		target: "right",
		type: "gradient",
		data: {
			sourceColor: "#3b82f6",
			targetColor: "#f59e0b",
		},
	},
	{
		id: "e-center-bottom",
		source: "center",
		target: "bottom",
		type: "dataStream",
		data: { particleCount: 6 },
	},
	{
		id: "e-center-left",
		source: "center",
		target: "left",
		type: "weakConnection",
		data: { label: "Weak", strength: 0.3 },
	},
];

/**
 * EdgeDemo Component
 */
const EdgeDemo = () => {
	const [nodes, _setNodes, onNodesChange] = useNodesState(initialNodes);
	const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
	const [selectedPreset, setSelectedPreset] = useState("modern");

	// Handle new connections
	const onConnect = useCallback(
		(params: Edge | Connection) => {
			const newEdge = {
				...params,
				type: "smart",
				data: { label: "New Connection" },
			};
			setEdges((eds) => addEdge(newEdge, eds));
		},
		[setEdges]
	);

	// Apply preset to all edges
	const applyPresetToAll = (presetName: string) => {
		setSelectedPreset(presetName);
		setEdges((edgesList) =>
			edgesList.map((edge) => applyEdgePreset(edge, presetName))
		);
	};

	return (
		<div className="flex h-screen w-full flex-col bg-gray-950">
			{/* Control Panel */}
			<motion.div
				animate={{ y: 0, opacity: 1 }}
				className="border-white/10 border-b bg-black/80 p-4 backdrop-blur-lg"
				initial={{ y: -100, opacity: 0 }}
				transition={{ duration: 0.5 }}
			>
				<div className="mx-auto max-w-7xl">
					<h1 className="mb-4 font-bold text-2xl text-white">
						Enhanced Edges Demo
					</h1>

					{/* Preset Selector */}
					<div className="mb-4 flex flex-wrap gap-2">
						<span className="mr-2 self-center text-gray-400 text-sm">
							Edge Presets:
						</span>
						{Object.keys(edgeStylePresets).map((preset) => (
							<button
								className={`rounded-lg px-4 py-2 font-medium text-sm transition-all duration-200 ${
									selectedPreset === preset
										? "bg-blue-600 text-white shadow-blue-600/50 shadow-lg"
										: "bg-white/5 text-gray-300 hover:bg-white/10"
								}
                `}
								key={preset}
								onClick={() => applyPresetToAll(preset)}
								type="button"
							>
								{preset.charAt(0).toUpperCase() + preset.slice(1)}
							</button>
						))}
					</div>

					{/* Legend */}
					<div className="flex flex-wrap gap-4 text-gray-400 text-xs">
						<div className="flex items-center gap-2">
							<div className="h-0.5 w-8 bg-blue-500" />
							<span>Animated</span>
						</div>
						<div className="flex items-center gap-2">
							<div className="h-0.5 w-8 bg-gradient-to-r from-blue-500 to-purple-500" />
							<span>Gradient</span>
						</div>
						<div className="flex items-center gap-2">
							<div className="h-0.5 w-8 bg-green-500 shadow-green-500/50 shadow-lg" />
							<span>Glowing</span>
						</div>
						<div className="flex items-center gap-2">
							<div className="h-0.5 w-8 bg-purple-500" />
							<span>• • • Flowing</span>
						</div>
						<div className="flex items-center gap-2">
							<div className="h-0.5 w-8 bg-amber-500" />
							<span>Smart</span>
						</div>
					</div>
				</div>
			</motion.div>

			{/* React Flow Canvas */}
			<div className="relative flex-1">
				<ReactFlow
					className="bg-gray-950"
					defaultEdgeOptions={{
						animated: true,
					}}
					edges={edges}
					edgeTypes={edgeTypes}
					fitView
					nodes={nodes}
					onConnect={onConnect}
					onEdgesChange={onEdgesChange}
					onNodesChange={onNodesChange}
				>
					<Background
						color="#374151"
						gap={20}
						size={1}
						variant={BACKGROUND_VARIANT}
					/>
					<Controls className="border border-white/10 bg-black/80 backdrop-blur-lg" />
					<MiniMap
						className="border border-white/10 bg-black/80 backdrop-blur-lg"
						nodeColor={(_node) => "#3b82f6"}
					/>
				</ReactFlow>

				{/* Instructions */}
				<motion.div
					animate={{ opacity: 1 }}
					className="absolute bottom-4 left-4 max-w-sm rounded-lg border border-white/10 bg-black/80 p-4 text-gray-300 text-sm backdrop-blur-lg"
					initial={{ opacity: 0 }}
					transition={{ delay: 1 }}
				>
					<h3 className="mb-2 font-semibold text-white">Instructions</h3>
					<ul className="space-y-1 text-xs">
						<li>• Hover over edges to see hover effects</li>
						<li>• Click edges to select them</li>
						<li>• Try different presets from the top panel</li>
						<li>• Drag nodes to see dynamic edge recalculation</li>
						<li>• Connect nodes to create new edges</li>
					</ul>
				</motion.div>
			</div>
		</div>
	);
};

/**
 * Simple Edge Showcase
 * Minimal demo showing all edge types side by side
 */
export const SimpleEdgeShowcase = () => {
	const showcaseNodes: Node[] = [
		{ id: "1", position: { x: 0, y: 0 }, data: { label: "Source" } },
		{ id: "2", position: { x: 250, y: 0 }, data: { label: "Target" } },
	];

	const edgeTypesList = [
		"animated",
		"gradient",
		"glowing",
		"flowing",
		"smart",
		"neon",
		"dataStream",
		"strongConnection",
	];

	const showcaseEdges: Edge[] = edgeTypesList.map((type, index) => ({
		id: `edge-${index}`,
		source: "1",
		target: "2",
		type,
		data: {
			label:
				type.charAt(0).toUpperCase() + type.slice(1).replace(/([A-Z])/g, " $1"),
		},
		style: {
			transform: `translateY(${index * 80}px)`,
		},
	}));

	return (
		<div className="h-screen w-full bg-gray-950">
			<ReactFlow
				edges={showcaseEdges}
				edgeTypes={edgeTypes}
				fitView
				nodes={showcaseNodes}
				nodesConnectable={false}
				nodesDraggable={false}
			>
				<Background
					color="#374151"
					gap={20}
					size={1}
					variant={BACKGROUND_VARIANT}
				/>
			</ReactFlow>
		</div>
	);
};

export default EdgeDemo;
