"use client";

/**
 * Enhanced Interactive Case Viewer
 *
 * Full integration of all enhanced React Flow components:
 * - Collapsible nodes with glassmorphism
 * - Custom handles with + decorators
 * - Animated edges with 40 variants
 * - Double-click node creation
 * - Add Block Dialog
 * - Animation system with polish
 *
 * Supports CaseExportNested (v1.0) format only.
 *
 * @component
 */

import {
	CheckCircle,
	FileText,
	GitBranch,
	Info,
	LayoutGrid,
	Maximize,
	Minimize,
	Target,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, {
	addEdge,
	Background,
	type Connection,
	Controls,
	type Edge,
	MarkerType,
	MiniMap,
	type Node,
	type OnConnect,
	ReactFlowProvider,
	useEdgesState,
	useNodesState,
	useReactFlow,
} from "reactflow";

import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	createReactFlowNode,
	transformCaseToReactFlow,
} from "@/lib/docs/case-data-transformer";
import { getLayoutedElements } from "@/lib/docs/elk-layout";
import type { CaseExportNested, ReactFlowNodeData } from "@/types/curriculum";
import "reactflow/dist/style.css";

import { AnimationProvider } from "./enhanced/animations";
import CreateNodePopover from "./enhanced/dialogs/create-node-popover";
import { edgeTypes } from "./enhanced/edges";
import { NodeStateManager, nodeTypes } from "./enhanced/nodes";
import { isValidConnection } from "./enhanced/nodes/node-types";
import type { NodeDataUpdate } from "./enhanced/utils/theme-config";
import { ThemeContext } from "./enhanced/utils/theme-config";

// ========================================================================
// Helper Functions for Node Operations
// ========================================================================

/**
 * Recursively get all descendant node IDs from a given node
 */
const getDescendantIds = (nodeId: string, allEdges: Edge[]): string[] => {
	const childIds = allEdges
		.filter((e) => e.source === nodeId)
		.map((e) => e.target);
	return childIds.flatMap((childId) => [
		childId,
		...getDescendantIds(childId, allEdges),
	]);
};

// ========================================================================
// Type Definitions
// ========================================================================

type NodeCreationData = {
	nodeType: string;
	name: string;
	description: string;
	position?: { x: number; y: number };
	parentNode: Node | null;
	/** Skip auto-layout after creation (used for drag-to-create where position is intentional) */
	skipLayout?: boolean;
};

type ControlButtonsProps = {
	nodes: Node[];
	edges: Edge[];
	setNodes: (nodes: Node[]) => void;
	setEdges: (edges: Edge[]) => void;
	isFullscreen: boolean;
	onToggleFullscreen: () => void;
	showLegend: boolean;
	setShowLegend: (show: boolean) => void;
};

type EnhancedInteractiveCaseViewerInnerProps = {
	caseData: CaseExportNested;
	onNodeClick?: (node: Node<ReactFlowNodeData>) => void;
	guidedPath?: string[];
	highlightedNodes?: string[];
	enableCollapsible?: boolean;
	enableNodeCreation?: boolean;
	enableAnimations?: boolean;
	enableEnhancedEdges?: boolean;
	/** Enable editing mode (browser-only, no persistence) */
	editable?: boolean;
	className?: string;
	height?: string;
	persistKey?: string;
};

type EnhancedInteractiveCaseViewerProps =
	EnhancedInteractiveCaseViewerInnerProps;

/**
 * Control buttons component that uses useReactFlow
 */
const ControlButtons = ({
	nodes,
	edges,
	setNodes,
	setEdges,
	isFullscreen,
	onToggleFullscreen,
	showLegend,
	setShowLegend,
}: ControlButtonsProps) => {
	const { fitView } = useReactFlow();

	const handleAutoLayout = useCallback(async () => {
		const layouted = await getLayoutedElements(nodes, edges, {
			direction: "TB",
		});
		setNodes(layouted.nodes);
		setEdges(layouted.edges);
		window.requestAnimationFrame(() => {
			fitView({ padding: 0.2, duration: 400 });
		});
	}, [nodes, edges, setNodes, setEdges, fitView]);

	return (
		<TooltipProvider delayDuration={300}>
			<div className="absolute top-4 left-4 z-10 flex rounded-md shadow-sm">
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							aria-label="Auto-arrange nodes"
							className="rounded-r-none border-r-0"
							onClick={handleAutoLayout}
							size="icon"
							variant="secondary"
						>
							<LayoutGrid className="h-4 w-4" />
						</Button>
					</TooltipTrigger>
					<TooltipContent side="bottom">
						<p>Auto Layout</p>
					</TooltipContent>
				</Tooltip>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
							className="rounded-none border-r-0"
							onClick={onToggleFullscreen}
							size="icon"
							variant="secondary"
						>
							{isFullscreen ? (
								<Minimize className="h-4 w-4" />
							) : (
								<Maximize className="h-4 w-4" />
							)}
						</Button>
					</TooltipTrigger>
					<TooltipContent side="bottom">
						<p>{isFullscreen ? "Exit Fullscreen" : "Fullscreen"}</p>
					</TooltipContent>
				</Tooltip>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							aria-label={showLegend ? "Hide legend" : "Show legend"}
							className="rounded-l-none"
							onClick={() => setShowLegend(!showLegend)}
							size="icon"
							variant="secondary"
						>
							<Info className="h-4 w-4" />
						</Button>
					</TooltipTrigger>
					<TooltipContent side="bottom">
						<p>{showLegend ? "Hide Legend" : "Show Legend"}</p>
					</TooltipContent>
				</Tooltip>
			</div>
			{showLegend && (
				<div className="f-effect-backdrop-blur-lg absolute top-16 left-4 z-10 rounded-xl border border-transparent bg-background-transparent-black p-3 shadow-glassmorphic">
					<h3 className="mb-2 font-bold text-sm text-text-light">
						Element Types
					</h3>
					<div className="space-y-1 text-xs">
						<div className="flex items-center gap-2">
							<Target className="h-4 w-4 text-green-400" />
							<span className="text-text-light">Goal</span>
						</div>
						<div className="flex items-center gap-2">
							<GitBranch className="h-4 w-4 text-purple-400" />
							<span className="text-text-light">Strategy</span>
						</div>
						<div className="flex items-center gap-2">
							<FileText className="h-4 w-4 text-orange-400" />
							<span className="text-text-light">Property Claim</span>
						</div>
						<div className="flex items-center gap-2">
							<CheckCircle className="h-4 w-4 text-cyan-400" />
							<span className="text-text-light">Evidence</span>
						</div>
					</div>
				</div>
			)}
		</TooltipProvider>
	);
};

/**
 * Calculate node position for creation
 */
const calculateNodePosition = (
	dialogPosition: { x: number; y: number } | undefined,
	addPosition: { x: number; y: number } | null,
	parentNode: Node | null
): { x: number; y: number } => {
	if (dialogPosition) {
		return dialogPosition;
	}
	if (addPosition) {
		return addPosition;
	}
	if (parentNode) {
		const parentPosition = parentNode.position || { x: 0, y: 0 };
		return {
			x: parentPosition.x,
			y: parentPosition.y + 150,
		};
	}
	return { x: 0, y: 0 };
};

/**
 * Create an edge between parent and child nodes
 */
const createParentChildEdge = (
	parentId: string,
	childId: string,
	useEnhancedEdges: boolean
): Edge => ({
	id: `edge-${parentId}-${childId}`,
	source: parentId,
	target: childId,
	sourceHandle: `${parentId}-source`,
	targetHandle: `${childId}-target`,
	type: useEnhancedEdges ? "smart" : "smoothstep",
	animated: false,
	markerEnd: {
		type: MarkerType.ArrowClosed,
	},
	data: {
		pathType: "smoothstep",
	},
});

/**
 * Enhanced Interactive Case Viewer Inner Component
 * (Needs to be inside ReactFlowProvider to use useReactFlow)
 */
const EnhancedInteractiveCaseViewerInner = ({
	caseData,
	onNodeClick,
	guidedPath = [],
	enableCollapsible = true,
	enableNodeCreation = true,
	enableEnhancedEdges = true,
	editable = false,
	className = "",
	height = "600px",
}: EnhancedInteractiveCaseViewerInnerProps) => {
	const [isDarkMode, setIsDarkMode] = useState(true);
	const [colorMode, setColorMode] = useState<"light" | "dark">("dark");

	useEffect(() => {
		const updateTheme = () => {
			const htmlElement = document.documentElement;
			const isDark = htmlElement.classList.contains("dark");
			const theme: "light" | "dark" = isDark ? "dark" : "light";
			setColorMode(theme);
			setIsDarkMode(isDark);
		};

		updateTheme();

		const observer = new MutationObserver(updateTheme);
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class"],
		});

		return () => observer.disconnect();
	}, []);

	const [nodes, setNodes, onNodesChange] = useNodesState([]);
	const [edges, setEdges, onEdgesChange] = useEdgesState([]);
	const [_selectedNode, setSelectedNode] =
		useState<Node<ReactFlowNodeData> | null>(null);
	const [showLegend, setShowLegend] = useState(false);
	const [connectionSource, setConnectionSource] = useState<{
		nodeId: string;
		handleType: string;
		handleId: string;
	} | null>(null);

	const lastPaneClickRef = useRef(0);
	const containerRef = useRef<HTMLDivElement>(null);
	const reactFlowInstance = useReactFlow();
	const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
	const [isFullscreen, setIsFullscreen] = useState(false);
	const [hiddenNodeIds, setHiddenNodeIds] = useState<Set<string>>(new Set());
	const [nodeFlowPosition, setNodeFlowPosition] = useState<{
		x: number;
		y: number;
	} | null>(null);
	const [dialogScreenPosition, setDialogScreenPosition] = useState<{
		x: number;
		y: number;
	} | null>(null);
	const [parentNodeForCreation, setParentNodeForCreation] =
		useState<Node<ReactFlowNodeData> | null>(null);
	const [creationFromDrag, setCreationFromDrag] = useState(false);

	// ========================================================================
	// Fullscreen Handler
	// ========================================================================

	const handleToggleFullscreen = useCallback(() => {
		if (!containerRef.current) {
			return;
		}

		if (document.fullscreenElement) {
			document.exitFullscreen();
		} else {
			containerRef.current.requestFullscreen();
		}
	}, []);

	// Sync fullscreen state when user exits via Escape key
	useEffect(() => {
		const handleFullscreenChange = () => {
			setIsFullscreen(document.fullscreenElement !== null);
		};

		document.addEventListener("fullscreenchange", handleFullscreenChange);
		return () => {
			document.removeEventListener("fullscreenchange", handleFullscreenChange);
		};
	}, []);

	// ========================================================================
	// Node Action Handlers (for edit/delete/visibility)
	// ========================================================================

	const handleNodeDelete = useCallback(
		(nodeId: string) => {
			const descendantIds = getDescendantIds(nodeId, edges);
			const idsToDelete = [nodeId, ...descendantIds];

			setNodes((nds) => nds.filter((n) => !idsToDelete.includes(n.id)));
			setEdges((eds) =>
				eds.filter(
					(e) =>
						!(idsToDelete.includes(e.source) || idsToDelete.includes(e.target))
				)
			);
		},
		[edges, setNodes, setEdges]
	);

	const handleNodeDescriptionChange = useCallback(
		(nodeId: string, description: string) => {
			setNodes((nds) =>
				nds.map((n) =>
					n.id === nodeId ? { ...n, data: { ...n.data, description } } : n
				)
			);
		},
		[setNodes]
	);

	const handleNodeDataChange = useCallback(
		(nodeId: string, data: NodeDataUpdate) => {
			setNodes((nds) =>
				nds.map((n) =>
					n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n
				)
			);
		},
		[setNodes]
	);

	const handleToggleChildrenVisibility = useCallback(
		(nodeId: string) => {
			const descendantIds = getDescendantIds(nodeId, edges);
			setHiddenNodeIds((prev) => {
				const next = new Set(prev);
				const areChildrenHidden = descendantIds.some((id) => prev.has(id));

				if (areChildrenHidden) {
					for (const id of descendantIds) {
						next.delete(id);
					}
				} else {
					for (const id of descendantIds) {
						next.add(id);
					}
				}
				return next;
			});
		},
		[edges]
	);

	// Helper functions for context
	const checkHasChildren = useCallback(
		(nodeId: string): boolean => edges.some((e) => e.source === nodeId),
		[edges]
	);

	const checkHasHiddenChildren = useCallback(
		(nodeId: string): boolean => {
			const childIds = edges
				.filter((e) => e.source === nodeId)
				.map((e) => e.target);
			return childIds.some((id) => hiddenNodeIds.has(id));
		},
		[edges, hiddenNodeIds]
	);

	const checkIsRootNode = useCallback(
		(nodeId: string): boolean => !edges.some((e) => e.target === nodeId),
		[edges]
	);

	// Filter nodes and edges based on hidden state
	const visibleNodes = useMemo(
		() => nodes.filter((n) => !hiddenNodeIds.has(n.id)),
		[nodes, hiddenNodeIds]
	);

	const visibleEdges = useMemo(
		() =>
			edges.filter(
				(e) => !(hiddenNodeIds.has(e.source) || hiddenNodeIds.has(e.target))
			),
		[edges, hiddenNodeIds]
	);

	// ========================================================================
	// Connection Handlers
	// ========================================================================

	const onConnect: OnConnect = useCallback(
		(connection: Connection) => {
			const sourceNode = nodes.find((n) => n.id === connection.source);
			const targetNode = nodes.find((n) => n.id === connection.target);

			if (!(sourceNode && targetNode)) {
				return;
			}

			const isValid = isValidConnection(sourceNode.type, targetNode.type);

			if (isValid) {
				setEdges((eds) =>
					addEdge(
						{
							...connection,
							sourceHandle:
								connection.sourceHandle || `${connection.source}-source`,
							targetHandle:
								connection.targetHandle || `${connection.target}-target`,
							type: enableEnhancedEdges ? "smart" : "smoothstep",
							animated: false,
							markerEnd: {
								type: MarkerType.ArrowClosed,
							},
							data: {
								pathType: "smoothstep",
							},
						},
						eds
					)
				);
			} else {
				console.warn(
					`Invalid connection: ${sourceNode.type} cannot connect to ${targetNode.type}`
				);
			}
		},
		[nodes, setEdges, enableEnhancedEdges]
	);

	const onConnectStart = useCallback(
		(
			_event: React.MouseEvent | React.TouchEvent,
			{
				nodeId,
				handleType,
				handleId,
			}: {
				nodeId: string | null;
				handleType: string | null;
				handleId: string | null;
			}
		) => {
			if (nodeId && handleType && handleId) {
				setConnectionSource({ nodeId, handleType, handleId });
			}
		},
		[]
	);

	const onConnectEnd = useCallback(
		(event: MouseEvent | TouchEvent) => {
			const target = event.target as HTMLElement;
			const targetIsPane = target.classList.contains("react-flow__pane");

			if (targetIsPane && connectionSource && reactFlowInstance) {
				const sourceNode = nodes.find((n) => n.id === connectionSource.nodeId);

				if (sourceNode) {
					const mouseEvent = event as MouseEvent;
					const screenPosition = {
						x: mouseEvent.clientX,
						y: mouseEvent.clientY,
					};
					const flowPosition =
						reactFlowInstance.screenToFlowPosition(screenPosition);

					setParentNodeForCreation(sourceNode);
					setNodeFlowPosition(flowPosition);
					setDialogScreenPosition(screenPosition);
					setCreationFromDrag(true);
					setIsAddDialogOpen(true);
				}
			}

			setConnectionSource(null);
		},
		[connectionSource, nodes, reactFlowInstance]
	);

	const handleCreateNode = useCallback(
		(nodeData: NodeCreationData) => {
			const {
				nodeType,
				name,
				description,
				position: dialogPosition,
				parentNode,
			} = nodeData;

			const newNodeId = `${nodeType}-${Date.now()}`;
			const nodePosition = calculateNodePosition(
				dialogPosition,
				nodeFlowPosition,
				parentNode
			);

			const newNode = createReactFlowNode(newNodeId, nodeType, nodePosition, {
				name,
				description,
			});

			setNodes((nds) => [...nds, newNode]);

			if (parentNode) {
				const newEdge = createParentChildEdge(
					parentNode.id,
					newNodeId,
					enableEnhancedEdges
				);
				setEdges((eds) => [...eds, newEdge]);
			}

			if (!creationFromDrag) {
				setTimeout(async () => {
					const layouted = await getLayoutedElements(
						nodes.concat(newNode),
						edges,
						{
							direction: "TB",
						}
					);
					setNodes(layouted.nodes);
					setEdges(layouted.edges);
				}, 100);
			}

			setCreationFromDrag(false);
		},
		[
			nodes,
			edges,
			setNodes,
			setEdges,
			nodeFlowPosition,
			enableEnhancedEdges,
			creationFromDrag,
		]
	);

	const handleHandleClick = useCallback(
		(
			nodeId: string,
			_handleId: string | undefined,
			_position: { x: number; y: number },
			_nodeData?: Record<string, unknown>
		) => {
			const sourceNode = nodes.find((n) => n.id === nodeId);

			if (sourceNode) {
				setParentNodeForCreation(sourceNode);
				setNodeFlowPosition(null);
				setDialogScreenPosition(null);
				setCreationFromDrag(false);
				setIsAddDialogOpen(true);
			}
		},
		[nodes]
	);

	useEffect(() => {
		if (!caseData) {
			console.warn("No caseData provided to EnhancedInteractiveCaseViewer");
			return;
		}

		const { nodes: flowNodes, edges: flowEdges } = transformCaseToReactFlow(
			caseData,
			{
				guidedPath,
				edgeType: enableEnhancedEdges ? "smart" : "smoothstep",
			}
		);

		const applyInitialLayout = async () => {
			const layouted = await getLayoutedElements(flowNodes, flowEdges, {
				direction: "TB",
			});
			setNodes(layouted.nodes);
			setEdges(layouted.edges);
		};

		applyInitialLayout();
	}, [caseData, guidedPath, enableEnhancedEdges, setNodes, setEdges]);

	const handleNodeClick = useCallback(
		(_event: React.MouseEvent, node: Node<ReactFlowNodeData>) => {
			setSelectedNode(node);

			if (onNodeClick) {
				onNodeClick(node);
			}
		},
		[onNodeClick]
	);

	const handlePaneClick = useCallback(
		(event: React.MouseEvent) => {
			const currentTime = Date.now();
			const timeSinceLastClick = currentTime - lastPaneClickRef.current;

			if (timeSinceLastClick < 300 && enableNodeCreation && reactFlowInstance) {
				const screenPosition = {
					x: event.clientX,
					y: event.clientY,
				};
				const flowPosition =
					reactFlowInstance.screenToFlowPosition(screenPosition);

				setNodeFlowPosition(flowPosition);
				setDialogScreenPosition(screenPosition);
				setCreationFromDrag(false);
				setIsAddDialogOpen(true);
			}

			lastPaneClickRef.current = currentTime;
		},
		[enableNodeCreation, reactFlowInstance]
	);

	const enhancedNodeTypes = useMemo(
		() => (enableCollapsible ? nodeTypes : {}),
		[enableCollapsible]
	);

	const enhancedEdgeTypes = useMemo(
		() => (enableEnhancedEdges ? edgeTypes : {}),
		[enableEnhancedEdges]
	);

	const themeContextValue = useMemo(
		() => ({
			isDarkMode,
			colorMode,
			editable,
			onHandleClick: handleHandleClick,
			onNodeDelete: handleNodeDelete,
			onNodeDescriptionChange: handleNodeDescriptionChange,
			onNodeDataChange: handleNodeDataChange,
			onToggleChildrenVisibility: handleToggleChildrenVisibility,
			hasChildren: checkHasChildren,
			hasHiddenChildren: checkHasHiddenChildren,
			isRootNode: checkIsRootNode,
		}),
		[
			isDarkMode,
			colorMode,
			editable,
			handleHandleClick,
			handleNodeDelete,
			handleNodeDescriptionChange,
			handleNodeDataChange,
			handleToggleChildrenVisibility,
			checkHasChildren,
			checkHasHiddenChildren,
			checkIsRootNode,
		]
	);

	return (
		<ThemeContext.Provider value={themeContextValue}>
			<div
				className={`relative w-full overflow-hidden rounded-lg bg-background shadow-lg ${className}`}
				ref={containerRef}
				style={{ height: isFullscreen ? "100vh" : height }}
			>
				<ControlButtons
					edges={edges}
					isFullscreen={isFullscreen}
					nodes={nodes}
					onToggleFullscreen={handleToggleFullscreen}
					setEdges={setEdges}
					setNodes={setNodes}
					setShowLegend={setShowLegend}
					showLegend={showLegend}
				/>

				<ReactFlow
					attributionPosition="bottom-left"
					edges={visibleEdges}
					edgeTypes={enhancedEdgeTypes}
					fitView
					fitViewOptions={{ padding: 0.2 }}
					maxZoom={4}
					minZoom={0.2}
					nodes={visibleNodes}
					nodeTypes={enhancedNodeTypes}
					onConnect={onConnect}
					onConnectEnd={onConnectEnd}
					onConnectStart={onConnectStart}
					onEdgesChange={onEdgesChange}
					onNodeClick={handleNodeClick}
					onNodesChange={onNodesChange}
					onPaneClick={handlePaneClick}
				>
					<Background />
					<Controls className="z-50" />
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
				</ReactFlow>

				<CreateNodePopover
					onOpenChange={(open) => {
						setIsAddDialogOpen(open);
						if (!open) {
							setParentNodeForCreation(null);
							setNodeFlowPosition(null);
							setDialogScreenPosition(null);
						}
					}}
					onSelect={handleCreateNode}
					open={isAddDialogOpen}
					parentNode={parentNodeForCreation}
					position={dialogScreenPosition}
				/>
			</div>
		</ThemeContext.Provider>
	);
};

/**
 * Enhanced Interactive Case Viewer
 * Main component with providers
 */
const EnhancedInteractiveCaseViewer = (
	props: EnhancedInteractiveCaseViewerProps
) => {
	const {
		enableAnimations = true,
		enableCollapsible = true,
		persistKey = "enhanced-case-viewer",
	} = props;

	let innerComponent = <EnhancedInteractiveCaseViewerInner {...props} />;

	if (enableCollapsible) {
		innerComponent = (
			<NodeStateManager defaultExpanded={false} persistKey={persistKey}>
				{innerComponent}
			</NodeStateManager>
		);
	}

	if (enableAnimations) {
		innerComponent = <AnimationProvider>{innerComponent}</AnimationProvider>;
	}

	return <ReactFlowProvider>{innerComponent}</ReactFlowProvider>;
};

export default EnhancedInteractiveCaseViewer;
