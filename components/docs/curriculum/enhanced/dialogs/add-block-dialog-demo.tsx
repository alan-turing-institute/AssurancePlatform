"use client";

/**
 * Add Block Dialog Demo Component
 *
 * Comprehensive demonstration of the Add Block Dialog system.
 *
 * @component
 */

import { Code, Info, Layers, Play, Plus, RefreshCw, Zap } from "lucide-react";
import { type MouseEvent, type ReactNode, useCallback, useState } from "react";
import {
	Background,
	Controls,
	type Edge,
	MiniMap,
	type Node,
	ReactFlow,
	useEdgesState,
	useNodesState,
} from "reactflow";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { generateNodeId } from "../interactions/creation-utils";
import { nodeTypes } from "../nodes/node-types";
import AddBlockDialog, { CompactAddBlockDialog } from "./add-block-dialog";
import "reactflow/dist/style.css";

/**
 * Position type
 */
type Position = {
	x: number;
	y: number;
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
 * Node data type for adding
 */
type AddNodeData = {
	type: string;
	template?: Template;
	position?: Position | null;
	id?: string;
	data?: Record<string, unknown>;
};

/**
 * Stats type
 */
type Stats = {
	nodesCreated: number;
	templatesUsed: number;
	draftsRestored: number;
};

/**
 * Initial demo nodes
 */
const initialNodes: Node[] = [
	{
		id: "demo-goal-1",
		type: "goal",
		position: { x: 250, y: 50 },
		data: {
			name: "System Safety Goal",
			description: "Ensure the system operates safely under all conditions",
			priority: "critical",
		},
	},
	{
		id: "demo-strategy-1",
		type: "strategy",
		position: { x: 250, y: 250 },
		data: {
			name: "Decomposition by Component",
			description: "Break down safety argument by system components",
			strategyType: "AND",
		},
	},
];

const initialEdges: Edge[] = [
	{
		id: "edge-1",
		source: "demo-goal-1",
		target: "demo-strategy-1",
		type: "smoothstep",
	},
];

/**
 * Demo Section Component Props
 */
type DemoSectionProps = {
	title: string;
	description?: string;
	children: ReactNode;
	code?: string;
};

/**
 * Demo Section Component
 */
const DemoSection = ({
	title,
	description,
	children,
	code,
}: DemoSectionProps): ReactNode => {
	const [showCode, setShowCode] = useState(false);

	return (
		<Card className="border-transparent bg-background-transparent-black-secondary">
			<CardHeader>
				<div className="flex items-start justify-between">
					<div>
						<CardTitle className="text-lg text-text-light">{title}</CardTitle>
						{description && (
							<CardDescription className="mt-1 text-text-light/70">
								{description}
							</CardDescription>
						)}
					</div>
					{code && (
						<Button
							className="text-text-light/70"
							onClick={() => setShowCode(!showCode)}
							size="sm"
							variant="ghost"
						>
							<Code className="mr-2 h-4 w-4" />
							{showCode ? "Hide" : "Show"} Code
						</Button>
					)}
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				{showCode && code && (
					<pre className="overflow-x-auto rounded-lg bg-gray-950 p-4 text-text-light/80 text-xs">
						<code>{code}</code>
					</pre>
				)}
				{children}
			</CardContent>
		</Card>
	);
};

/**
 * AddBlockDialogDemo Component
 */
const AddBlockDialogDemo = (): ReactNode => {
	const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
	const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

	// Dialog states
	const [standardDialogOpen, setStandardDialogOpen] = useState(false);
	const [compactDialogOpen, setCompactDialogOpen] = useState(false);

	const [clickPosition, setClickPosition] = useState<Position | null>(null);
	const [stats, setStats] = useState<Stats>({
		nodesCreated: 0,
		templatesUsed: 0,
		draftsRestored: 0,
	});

	// Handle canvas double-click
	const handlePaneDoubleClick = useCallback(
		(event: MouseEvent<Element>): void => {
			const rect = (event.target as HTMLElement).getBoundingClientRect();
			const position = {
				x: event.clientX - rect.left,
				y: event.clientY - rect.top,
			};
			setClickPosition(position);
			setStandardDialogOpen(true);
		},
		[]
	);

	// Handle add node
	const handleAddNode = useCallback(
		(nodeData: AddNodeData): void => {
			if (nodeData.type === "template" && nodeData.template) {
				// Handle template creation
				const template = nodeData.template;
				const basePosition = clickPosition || { x: 100, y: 100 };

				const newNodes =
					template.nodes?.map((nodeConfig, index) => {
						const x = basePosition.x + (nodeConfig.offsetX || 0);
						const y = basePosition.y + (nodeConfig.offsetY || index * 150);

						return {
							id: generateNodeId(nodeConfig.type),
							type: nodeConfig.type,
							position: { x, y },
							data: {
								name: nodeConfig.name,
								description: nodeConfig.description || "Template node",
							},
						};
					}) || [];

				setNodes((nds) => [...nds, ...newNodes]);
				setStats((prev) => ({
					...prev,
					nodesCreated: prev.nodesCreated + newNodes.length,
					templatesUsed: prev.templatesUsed + 1,
				}));
			} else {
				// Handle single node creation
				const newNode: Node = {
					id: nodeData.id || generateNodeId(nodeData.type),
					type: nodeData.type,
					position: nodeData.position || clickPosition || { x: 100, y: 100 },
					data: nodeData.data || {},
				};
				setNodes((nds) => [...nds, newNode]);
				setStats((prev) => ({
					...prev,
					nodesCreated: prev.nodesCreated + 1,
				}));
			}
		},
		[clickPosition, setNodes]
	);

	// Handle bulk add
	const handleBulkAdd = useCallback(
		(nodesList: AddNodeData[]): void => {
			const newNodes: Node[] = nodesList.map((nodeData) => ({
				id: nodeData.id || generateNodeId(nodeData.type),
				type: nodeData.type,
				position: nodeData.position || { x: 100, y: 100 },
				data: nodeData.data || {},
			}));
			setNodes((nds) => [...nds, ...newNodes]);
			setStats((prev) => ({
				...prev,
				nodesCreated: prev.nodesCreated + nodesList.length,
			}));
		},
		[setNodes]
	);

	// Reset demo
	const handleReset = useCallback((): void => {
		setNodes(initialNodes);
		setEdges(initialEdges);
		setStats({
			nodesCreated: 0,
			templatesUsed: 0,
			draftsRestored: 0,
		});
	}, [setNodes, setEdges]);

	// Sample code snippets
	const standardDialogCode = `<AddBlockDialog
  open={dialogOpen}
  onClose={() => setDialogOpen(false)}
  onAdd={handleAddBlock}
  currentNodes={nodes}
  position={clickPosition}
  enableTemplates={true}
  enableQuickMode={true}
  showConnectionHints={true}
/>`;

	const compactDialogCode = `<CompactAddBlockDialog
  open={dialogOpen}
  onClose={() => setDialogOpen(false)}
  onAdd={handleAddBlock}
  position={clickPosition}
/>`;

	return (
		<div className="min-h-screen bg-gray-950 p-6">
			<div className="mx-auto max-w-7xl space-y-6">
				{/* Header */}
				<div className="space-y-2">
					<h1 className="flex items-center gap-3 font-bold text-3xl text-text-light">
						<Plus className="h-8 w-8 text-blue-400" />
						Add Block Dialog Demo
					</h1>
					<p className="text-text-light/70">
						Comprehensive demonstration of the Add Block Dialog system with all
						features and integration patterns.
					</p>
				</div>

				{/* Stats */}
				<div className="grid grid-cols-4 gap-4">
					<Card className="border-transparent bg-background-transparent-black-secondary">
						<CardContent className="p-4">
							<div className="font-bold text-2xl text-text-light">
								{nodes.length}
							</div>
							<div className="text-text-light/60 text-xs">Total Nodes</div>
						</CardContent>
					</Card>
					<Card className="border-transparent bg-background-transparent-black-secondary">
						<CardContent className="p-4">
							<div className="font-bold text-2xl text-text-light">
								{stats.nodesCreated}
							</div>
							<div className="text-text-light/60 text-xs">Nodes Created</div>
						</CardContent>
					</Card>
					<Card className="border-transparent bg-background-transparent-black-secondary">
						<CardContent className="p-4">
							<div className="font-bold text-2xl text-text-light">
								{stats.templatesUsed}
							</div>
							<div className="text-text-light/60 text-xs">Templates Used</div>
						</CardContent>
					</Card>
					<Card className="border-transparent bg-background-transparent-black-secondary">
						<CardContent className="p-4">
							<div className="font-bold text-2xl text-text-light">
								{edges.length}
							</div>
							<div className="text-text-light/60 text-xs">Connections</div>
						</CardContent>
					</Card>
				</div>

				<Tabs className="space-y-4" defaultValue="demos">
					<TabsList className="bg-background-transparent-black-secondary">
						<TabsTrigger value="demos">
							<Play className="mr-2 h-4 w-4" />
							Demos
						</TabsTrigger>
						<TabsTrigger value="canvas">
							<Layers className="mr-2 h-4 w-4" />
							Canvas
						</TabsTrigger>
						<TabsTrigger value="docs">
							<Info className="mr-2 h-4 w-4" />
							Documentation
						</TabsTrigger>
					</TabsList>

					{/* Demos Tab */}
					<TabsContent className="space-y-6" value="demos">
						{/* Standard Dialog */}
						<DemoSection
							code={standardDialogCode}
							description="Full-featured dialog with all options."
							title="1. Standard Dialog"
						>
							<div className="space-y-3">
								<Button
									className="bg-blue-600 hover:bg-blue-700"
									onClick={() => {
										setClickPosition({ x: 400, y: 400 });
										setStandardDialogOpen(true);
									}}
								>
									<Plus className="mr-2 h-4 w-4" />
									Open Standard Dialog
								</Button>
								<div className="flex flex-wrap gap-2">
									<Badge variant="secondary">Two-panel layout</Badge>
									<Badge variant="secondary">Search & filter</Badge>
									<Badge variant="secondary">Template library</Badge>
								</div>
							</div>
						</DemoSection>

						{/* Compact Dialog */}
						<DemoSection
							code={compactDialogCode}
							description="Minimal version with essential features only."
							title="2. Compact Dialog"
						>
							<div className="space-y-3">
								<Button
									className="bg-purple-600 hover:bg-purple-700"
									onClick={() => {
										setClickPosition({ x: 300, y: 300 });
										setCompactDialogOpen(true);
									}}
								>
									<Zap className="mr-2 h-4 w-4" />
									Open Compact Dialog
								</Button>
								<div className="flex flex-wrap gap-2">
									<Badge variant="secondary">Smaller size</Badge>
									<Badge variant="secondary">Quick mode enabled</Badge>
								</div>
							</div>
						</DemoSection>
					</TabsContent>

					{/* Canvas Tab */}
					<TabsContent className="space-y-4" value="canvas">
						<div className="flex items-center justify-between">
							<div>
								<h3 className="font-semibold text-lg text-text-light">
									Interactive Canvas
								</h3>
								<p className="text-sm text-text-light/70">
									Double-click anywhere to create a new node
								</p>
							</div>
							<Button
								className="text-text-light"
								onClick={handleReset}
								variant="ghost"
							>
								<RefreshCw className="mr-2 h-4 w-4" />
								Reset
							</Button>
						</div>

						<div
							className="h-[600px] w-full overflow-hidden rounded-lg border border-border-transparent"
							style={{ background: "rgb(10, 10, 10)" }}
						>
							<ReactFlow
								edges={edges}
								fitView
								maxZoom={2}
								minZoom={0.5}
								nodes={nodes}
								nodeTypes={nodeTypes}
								onEdgesChange={onEdgesChange}
								onNodesChange={onNodesChange}
								onPaneClick={(e) =>
									handlePaneDoubleClick(e as unknown as MouseEvent<Element>)
								}
								proOptions={{ hideAttribution: true }}
							>
								<Background color="rgba(255, 255, 255, 0.05)" gap={20} />
								<Controls className="border-transparent bg-background-transparent-black-secondary" />
								<MiniMap
									className="border-transparent bg-background-transparent-black-secondary"
									nodeColor={(node) => {
										switch (node.type) {
											case "goal":
												return "#10b981";
											case "strategy":
												return "#a855f7";
											case "propertyClaim":
												return "#f97316";
											case "evidence":
												return "#06b6d4";
											case "context":
												return "#6b7280";
											default:
												return "#6b7280";
										}
									}}
								/>
							</ReactFlow>
						</div>
					</TabsContent>

					{/* Documentation Tab */}
					<TabsContent className="space-y-4" value="docs">
						<Card className="border-transparent bg-background-transparent-black-secondary">
							<CardHeader>
								<CardTitle className="text-text-light">Usage Guide</CardTitle>
							</CardHeader>
							<CardContent className="space-y-6 text-text-light/80">
								<div>
									<h4 className="mb-2 font-semibold text-text-light">
										Features
									</h4>
									<ul className="space-y-2 text-sm">
										<li className="flex items-start gap-2">
											<span className="mt-1 text-blue-400">•</span>
											<span>
												Two-panel layout with node type selection and live
												preview
											</span>
										</li>
										<li className="flex items-start gap-2">
											<span className="mt-1 text-blue-400">•</span>
											<span>
												Template library with pre-configured node patterns
											</span>
										</li>
									</ul>
								</div>
							</CardContent>
						</Card>
					</TabsContent>
				</Tabs>
			</div>

			{/* Dialogs */}
			<AddBlockDialog
				currentNodes={nodes}
				enableBulkMode={false}
				enableQuickMode={true}
				enableTemplates={true}
				onAdd={handleAddNode}
				onBulkAdd={handleBulkAdd}
				onClose={() => setStandardDialogOpen(false)}
				open={standardDialogOpen}
				position={clickPosition}
				showConnectionHints={true}
			/>

			<CompactAddBlockDialog
				onAdd={handleAddNode}
				onClose={() => setCompactDialogOpen(false)}
				open={compactDialogOpen}
				position={clickPosition}
			/>
		</div>
	);
};

export default AddBlockDialogDemo;
