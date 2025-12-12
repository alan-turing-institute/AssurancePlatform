"use client";

/**
 * Block Preview Component
 *
 * Live preview of node as user fills form. Shows actual node component
 * with connection point indicators, zoom controls, and style variations.
 *
 * @component
 */

import { AnimatePresence, motion } from "framer-motion";
import {
	ArrowRight,
	Info,
	Link as LinkIcon,
	Maximize2,
	ZoomIn,
	ZoomOut,
} from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { Background, Controls, type Node, ReactFlow } from "reactflow";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createNodeData, nodeTypes } from "../nodes/node-types";
import "reactflow/dist/style.css";

/**
 * Connection hint type
 */
type ConnectionHint = {
	nodeName: string;
	distance: number;
	direction: string;
};

/**
 * Template node configuration type
 */
type TemplateNodeConfig = {
	type: string;
	name: string;
	description?: string;
	offsetX?: number;
	offsetY?: number;
};

/**
 * Template type
 */
type Template = {
	id: string;
	name: string;
	nodes?: TemplateNodeConfig[];
};

/**
 * Form data type
 */
type FormData = {
	name?: string;
	description?: string;
	[key: string]: unknown;
};

/**
 * Edge type for React Flow
 */
type Edge = {
	id: string;
	source: string;
	target: string;
	type: string;
	animated: boolean;
};

/**
 * Connection Hint Component Props
 */
type ConnectionHintProps = {
	hint: ConnectionHint;
	index: number;
};

/**
 * Connection Hint Component
 */
const ConnectionHint = ({ hint, index }: ConnectionHintProps): ReactNode => (
	<motion.div
		animate={{ opacity: 1, x: 0 }}
		className={cn(
			"flex items-center gap-2 rounded-lg p-2",
			"bg-background-transparent-white-hover",
			"border border-transparent",
			"text-xs"
		)}
		initial={{ opacity: 0, x: -10 }}
		transition={{ delay: index * 0.05 }}
	>
		<LinkIcon className="h-3 w-3 shrink-0 text-blue-400" />
		<div className="min-w-0 flex-1">
			<div className="truncate font-medium text-text-light">
				{hint.nodeName}
			</div>
			<div className="text-text-light/60">
				{Math.round(hint.distance)}px {hint.direction}
			</div>
		</div>
	</motion.div>
);

/**
 * Template Preview Component Props
 */
type TemplatePreviewProps = {
	template: Template;
};

/**
 * Template Preview Component
 */
const TemplatePreview = ({ template }: TemplatePreviewProps): ReactNode => {
	const [nodes, setNodes] = useState<Node[]>([]);
	const [edges, setEdges] = useState<Edge[]>([]);

	// Create nodes from template
	useMemo(() => {
		if (!template?.nodes) {
			return;
		}

		const createdNodes = template.nodes.map((nodeConfig, index) => {
			const baseX = 100;
			const baseY = 100;
			const x = baseX + (nodeConfig.offsetX || 0);
			const y = baseY + (nodeConfig.offsetY || index * 150);

			return {
				id: `preview-${nodeConfig.type}-${index}`,
				type: nodeConfig.type,
				position: { x, y },
				data: createNodeData(nodeConfig.type, {
					name: nodeConfig.name,
					description: nodeConfig.description || "Template node",
				}),
			};
		});

		// Create edges between consecutive nodes
		const createdEdges = createdNodes.slice(0, -1).map((node, index) => ({
			id: `edge-${index}`,
			source: node.id,
			target: createdNodes[index + 1].id,
			type: "smoothstep",
			animated: true,
		}));

		setNodes(createdNodes);
		setEdges(createdEdges);
	}, [template]);

	if (!template) {
		return null;
	}

	return (
		<div className="relative h-[400px] w-full overflow-hidden rounded-lg border border-border-transparent">
			<ReactFlow
				className="bg-gray-950"
				defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
				edges={edges}
				fitView
				maxZoom={1.5}
				minZoom={0.5}
				nodes={nodes}
				nodeTypes={nodeTypes}
				proOptions={{ hideAttribution: true }}
			>
				<Background color="rgba(255, 255, 255, 0.05)" gap={20} />
				<Controls className="border-transparent bg-background-transparent-black-secondary" />
			</ReactFlow>

			{/* Template Info Overlay */}
			<div className="absolute right-4 bottom-4 left-4">
				<div className="f-effect-backdrop-blur-lg rounded-lg border border-transparent bg-background-transparent-black-secondaryAlt p-3">
					<div className="flex items-center justify-between">
						<div>
							<div className="font-medium text-sm text-text-light">
								{template.name}
							</div>
							<div className="mt-0.5 text-text-light/70 text-xs">
								{template.nodes?.length || 0} nodes
							</div>
						</div>
						<Badge
							className="bg-purple-500/20 text-purple-400"
							variant="secondary"
						>
							Template
						</Badge>
					</div>
				</div>
			</div>
		</div>
	);
};

/**
 * BlockPreview Component Props
 */
type BlockPreviewProps = {
	nodeType?: string;
	formData?: FormData;
	template?: Template | null;
	connectionHints?: ConnectionHint[];
	showConnectionHints?: boolean;
	showZoomControls?: boolean;
	className?: string;
};

/**
 * BlockPreview Component
 */
const BlockPreview = ({
	nodeType,
	formData = {},
	template = null,
	connectionHints = [],
	showConnectionHints = true,
	showZoomControls = true,
	className,
}: BlockPreviewProps): ReactNode => {
	const [zoom, setZoom] = useState(1);
	const [showInfo, setShowInfo] = useState(false);

	// Create preview node data (must be called before any early returns)
	const previewNode = useMemo(() => {
		if (!nodeType) {
			return null;
		}

		return {
			id: "preview-node",
			type: nodeType,
			position: { x: 150, y: 100 },
			data: createNodeData(nodeType, {
				name: formData.name || "Untitled Node",
				description: formData.description || "No description provided",
				short_description: formData.description || "No description provided",
				long_description: formData.description || "No description provided",
				...formData,
			}),
			selected: false,
		};
	}, [nodeType, formData]);

	// If template is provided, show template preview
	if (template) {
		return (
			<div className={cn("space-y-4", className)}>
				<TemplatePreview template={template} />
				{showConnectionHints && connectionHints.length > 0 && (
					<div className="space-y-2">
						<div className="font-semibold text-text-light/50 text-xs uppercase tracking-wider">
							Suggested Connections
						</div>
						<div className="space-y-1">
							{connectionHints.slice(0, 3).map((hint, index) => (
								<ConnectionHint hint={hint} index={index} key={hint.nodeName} />
							))}
						</div>
					</div>
				)}
			</div>
		);
	}

	// Zoom handlers
	const handleZoomIn = (): void => setZoom((prev) => Math.min(prev + 0.1, 2));
	const handleZoomOut = (): void =>
		setZoom((prev) => Math.max(prev - 0.1, 0.5));
	const handleZoomReset = (): void => setZoom(1);

	if (!previewNode) {
		return (
			<div
				className={cn(
					"flex h-[300px] w-full items-center justify-center",
					"bg-background-transparent-white-hover",
					"rounded-lg border border-border-transparent",
					className
				)}
			>
				<div className="text-center text-text-light/50">
					<Info className="mx-auto mb-2 h-8 w-8 opacity-50" />
					<p className="text-sm">No preview available</p>
				</div>
			</div>
		);
	}

	return (
		<div className={cn("space-y-4", className)}>
			{/* Preview Canvas */}
			<div className="relative">
				<div
					className={cn(
						"h-[300px] w-full overflow-hidden rounded-lg",
						"bg-gray-950",
						"border border-border-transparent",
						"relative"
					)}
				>
					{/* Background Grid */}
					<div
						className="absolute inset-0"
						style={{
							backgroundImage:
								"radial-gradient(circle, rgba(255, 255, 255, 0.05) 1px, transparent 1px)",
							backgroundSize: "20px 20px",
							transform: `scale(${zoom})`,
							transformOrigin: "center",
						}}
					/>

					{/* Node Preview */}
					<div
						className="absolute inset-0 flex items-center justify-center"
						style={{
							transform: `scale(${zoom})`,
							transition: "transform 0.2s ease-out",
						}}
					>
						<motion.div
							animate={{ opacity: 1, scale: 1 }}
							initial={{ opacity: 0, scale: 0.9 }}
							transition={{ duration: 0.3 }}
						>
							<ReactFlow
								className="pointer-events-none"
								defaultViewport={{ x: 0, y: 0, zoom }}
								edges={[]}
								elementsSelectable={false}
								fitView
								maxZoom={zoom}
								minZoom={zoom}
								nodes={[previewNode]}
								nodesConnectable={false}
								nodesDraggable={false}
								nodeTypes={nodeTypes}
								panOnDrag={false}
								panOnScroll={false}
								proOptions={{ hideAttribution: true }}
								zoomOnScroll={false}
							>
								<Background
									className="opacity-0"
									color="rgba(255, 255, 255, 0.05)"
									gap={20}
								/>
							</ReactFlow>
						</motion.div>
					</div>

					{/* Zoom Controls */}
					{showZoomControls && (
						<div className="absolute top-3 right-3 flex flex-col gap-1">
							<Button
								className={cn(
									"h-8 w-8",
									"bg-background-transparent-black-secondary",
									"hover:bg-background-transparent-black-secondaryAlt",
									"border border-transparent"
								)}
								onClick={handleZoomIn}
								size="icon"
								variant="ghost"
							>
								<ZoomIn className="h-4 w-4 text-text-light" />
							</Button>
							<Button
								className={cn(
									"h-8 w-8",
									"bg-background-transparent-black-secondary",
									"hover:bg-background-transparent-black-secondaryAlt",
									"border border-transparent"
								)}
								onClick={handleZoomReset}
								size="icon"
								variant="ghost"
							>
								<Maximize2 className="h-4 w-4 text-text-light" />
							</Button>
							<Button
								className={cn(
									"h-8 w-8",
									"bg-background-transparent-black-secondary",
									"hover:bg-background-transparent-black-secondaryAlt",
									"border border-transparent"
								)}
								onClick={handleZoomOut}
								size="icon"
								variant="ghost"
							>
								<ZoomOut className="h-4 w-4 text-text-light" />
							</Button>
						</div>
					)}

					{/* Info Toggle */}
					<div className="absolute bottom-3 left-3">
						<Button
							className={cn(
								"bg-background-transparent-black-secondary",
								"hover:bg-background-transparent-black-secondaryAlt",
								"border border-transparent",
								"text-text-light"
							)}
							onClick={() => setShowInfo(!showInfo)}
							size="sm"
							variant="ghost"
						>
							<Info className="mr-1.5 h-3 w-3" />
							{showInfo ? "Hide" : "Show"} Info
						</Button>
					</div>

					{/* Zoom Level Indicator */}
					<div className="absolute right-3 bottom-3">
						<div
							className={cn(
								"px-2 py-1 font-mono text-xs",
								"bg-background-transparent-black-secondary",
								"border border-transparent",
								"rounded",
								"text-text-light"
							)}
						>
							{Math.round(zoom * 100)}%
						</div>
					</div>
				</div>

				{/* Info Panel */}
				<AnimatePresence>
					{showInfo && (
						<motion.div
							animate={{ opacity: 1, height: "auto" }}
							className="overflow-hidden"
							exit={{ opacity: 0, height: 0 }}
							initial={{ opacity: 0, height: 0 }}
						>
							<div
								className={cn(
									"mt-2 rounded-lg p-3",
									"bg-background-transparent-white-hover",
									"border border-transparent"
								)}
							>
								<div className="space-y-2 text-xs">
									<div className="flex justify-between">
										<span className="text-text-light/60">Node Type:</span>
										<span className="font-medium text-text-light">
											{nodeType}
										</span>
									</div>
									<div className="flex justify-between">
										<span className="text-text-light/60">Name Length:</span>
										<span className="font-medium text-text-light">
											{formData.name?.length || 0} characters
										</span>
									</div>
									{formData.description && (
										<div className="flex justify-between">
											<span className="text-text-light/60">
												Description Length:
											</span>
											<span className="font-medium text-text-light">
												{formData.description.length} characters
											</span>
										</div>
									)}
								</div>
							</div>
						</motion.div>
					)}
				</AnimatePresence>
			</div>

			{/* Connection Hints */}
			{showConnectionHints && connectionHints.length > 0 && (
				<div className="space-y-2">
					<div className="flex items-center gap-2 font-semibold text-text-light/50 text-xs uppercase tracking-wider">
						<LinkIcon className="h-3 w-3" />
						Suggested Connections ({connectionHints.length})
					</div>
					<div className="space-y-1">
						{connectionHints.slice(0, 3).map((hint, index) => (
							<ConnectionHint hint={hint} index={index} key={hint.nodeName} />
						))}
						{connectionHints.length > 3 && (
							<div className="py-1 text-center text-text-light/50 text-xs">
								+{connectionHints.length - 3} more nearby nodes
							</div>
						)}
					</div>
				</div>
			)}

			{/* Connection Point Indicators */}
			<div
				className={cn(
					"rounded-lg p-3",
					"bg-background-transparent-white-hover",
					"border border-transparent"
				)}
			>
				<div className="mb-2 font-semibold text-text-light/50 text-xs uppercase tracking-wider">
					Connection Points
				</div>
				<div className="flex items-center gap-4 text-xs">
					<div className="flex items-center gap-2">
						<div className="h-2 w-2 rounded-full bg-blue-400" />
						<span className="text-text-light/70">Top (Target)</span>
					</div>
					<ArrowRight className="h-3 w-3 text-text-light/30" />
					<div className="flex items-center gap-2">
						<div className="h-2 w-2 rounded-full bg-green-400" />
						<span className="text-text-light/70">Bottom (Source)</span>
					</div>
				</div>
			</div>
		</div>
	);
};

/**
 * Compact Block Preview Props
 */
type CompactBlockPreviewProps = {
	nodeType?: string;
	formData?: FormData;
};

/**
 * Compact Block Preview (smaller version)
 */
export const CompactBlockPreview = ({
	nodeType,
	formData,
}: CompactBlockPreviewProps): ReactNode => (
	<BlockPreview
		className="max-w-md"
		formData={formData}
		nodeType={nodeType}
		showConnectionHints={false}
		showZoomControls={false}
	/>
);

export default BlockPreview;
