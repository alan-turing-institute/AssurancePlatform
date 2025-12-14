"use client";

/**
 * Enhanced Interactive Case Viewer
 *
 * Full integration of all enhanced React Flow components:
 * - Collapsible nodes with glassmorphism
 * - Custom handles with + decorators
 * - Animated edges with 40 variants
 * - Double-click node creation
 * - Context menus (node, edge, canvas)
 * - Add Block Dialog
 * - Animation system with polish
 * - Progressive disclosure
 *
 * Maintains backward compatibility with existing InteractiveCaseViewer
 * while adding modern FloraFauna.ai-inspired features.
 *
 * @component
 */

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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, {
	addEdge,
	Background,
	BackgroundVariant,
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

// Re-export to prevent linter from removing unused import
const BACKGROUND_DOTS = BackgroundVariant.Dots;

import { getLayoutedElements } from "@/lib/docs/layout-helper";
import type {
	CaseData,
	CaseExportNested,
	Context,
	Evidence,
	Goal,
	PropertyClaim,
	ReactFlowNodeData,
	Strategy,
	TreeNode,
} from "@/types/curriculum";
import "reactflow/dist/style.css";

import { AnimationProvider } from "./enhanced/animations";
import CreateNodePopover from "./enhanced/dialogs/create-node-popover";
import { edgeTypes } from "./enhanced/edges";
import {
	useCanvasContextMenu,
	useEdgeContextMenu,
	useNodeContextMenu,
} from "./enhanced/menus";
import { NodeStateManager, nodeTypes } from "./enhanced/nodes";
import { isValidConnection } from "./enhanced/nodes/node-types";
import { ThemeContext } from "./enhanced/utils/theme-config";

type NodeData = {
	name: string;
	description?: string;
	short_description?: string;
	long_description?: string;
	element?: Goal | Strategy | PropertyClaim | Evidence | Context;
	priority?: string;
	status?: string;
	strength?: number;
	confidence?: number;
	context?: Context[];
	assumptions?: string[];
	justifications?: string[];
};

type NodeCreationData = {
	nodeType: string;
	name: string;
	description: string;
	position?: { x: number; y: number };
	parentNode: Node | null;
};

type ControlButtonsProps = {
	nodes: Node[];
	edges: Edge[];
	setNodes: (nodes: Node[]) => void;
	setEdges: (edges: Edge[]) => void;
	setRevealedNodes: (nodes: Set<string>) => void;
	showAllNodes: boolean;
	setShowAllNodes: (show: boolean) => void;
};

type LegendProps = {
	showLegend: boolean;
	setShowLegend: (show: boolean) => void;
};

type EnhancedInteractiveCaseViewerInnerProps = {
	caseData: CaseExportNested | CaseData;
	onNodeClick?: (node: Node<ReactFlowNodeData>) => void;
	guidedPath?: string[];
	showAllNodes?: boolean;
	highlightedNodes?: string[];
	enableExploration?: boolean;
	enableCollapsible?: boolean;
	enableContextMenus?: boolean;
	enableNodeCreation?: boolean;
	enableAnimations?: boolean;
	enableEnhancedEdges?: boolean;
	className?: string;
	height?: string;
	persistKey?: string;
};

type EnhancedInteractiveCaseViewerProps =
	EnhancedInteractiveCaseViewerInnerProps;

/**
 * Convert existing case data node format to enhanced node format
 */
const mapNodeToEnhanced = (
	id: string,
	type: string,
	position: { x: number; y: number },
	data: NodeData,
	_nodeType: string
): Node<ReactFlowNodeData> => ({
	id,
	type,
	position,
	data: {
		id,
		name: data.name || "Unnamed Node",
		description: data.short_description || data.description || "",
		element: data.element,
		strength: data.strength?.toString(),
		confidence: data.confidence,
	},
});

/**
 * Convert existing case data edge format to enhanced edge format
 */
const mapEdgeToEnhanced = (
	id: string,
	source: string,
	target: string,
	animated = false,
	type = "smart"
): Edge => ({
	id,
	source,
	target,
	sourceHandle: `${source}-source`,
	targetHandle: `${target}-target`,
	type,
	animated,
	markerEnd: {
		type: MarkerType.ArrowClosed,
	},
	data: {
		strength: 0.7,
		showStrengthIndicator: false,
	},
});

/**
 * Convert case data to enhanced nodes and edges
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Complex case data transformation requires deeply nested logic
function convertCaseDataToEnhanced(
	caseData: CaseData,
	guidedPath: string[] = [],
	enhancedEdges = true
): { nodes: Node<ReactFlowNodeData>[]; edges: Edge[] } {
	if (!caseData?.goals || caseData.goals.length === 0) {
		return { nodes: [], edges: [] };
	}

	const flowNodes: Node<ReactFlowNodeData>[] = [];
	const flowEdges: Edge[] = [];
	let yOffset = 0;
	const xSpacing = 500;
	const ySpacing = 180;

	const goal = caseData.goals[0];
	const edgeType = enhancedEdges ? "smart" : "smoothstep";

	// Add goal node
	flowNodes.push(
		mapNodeToEnhanced(
			"goal-1",
			"goal",
			{ x: 400, y: yOffset },
			{
				name: goal.name,
				short_description: goal.short_description || goal.description,
				long_description: goal.long_description || goal.description,
				description: goal.description,
				element: goal,
				priority: goal.priority,
				status: goal.status,
				context: goal.context,
				assumptions: goal.assumptions,
				justifications: goal.justifications,
				strength: goal.strength,
				confidence: goal.confidence,
			},
			"goal"
		)
	);
	yOffset += ySpacing;

	// Add context nodes
	if (goal.context) {
		for (const [idx, ctx] of goal.context.entries()) {
			flowNodes.push(
				mapNodeToEnhanced(
					`context-${idx + 1}`,
					"context",
					{ x: 100 + idx * 200, y: yOffset },
					{
						name: ctx.name,
						short_description: ctx.short_description || ctx.description,
						long_description: ctx.long_description || ctx.description,
						description: ctx.description,
						element: ctx,
					},
					"context"
				)
			);
		}
	}

	// Add strategies
	if (goal.strategies) {
		for (const [stratIdx, strategy] of goal.strategies.entries()) {
			const strategyId = `strategy-${stratIdx + 1}`;

			flowNodes.push(
				mapNodeToEnhanced(
					strategyId,
					"strategy",
					{ x: 200 + stratIdx * xSpacing, y: yOffset + ySpacing },
					{
						name: strategy.name,
						short_description:
							strategy.short_description || strategy.description,
						long_description: strategy.long_description || strategy.description,
						description: strategy.description,
						element: strategy,
						priority: strategy.priority,
						status: strategy.status,
						strength: strategy.strength,
						confidence: strategy.confidence,
						context: strategy.context,
						assumptions: strategy.assumptions,
						justifications: strategy.justifications,
					},
					"strategy"
				)
			);

			flowEdges.push(
				mapEdgeToEnhanced(
					`goal-${strategyId}`,
					"goal-1",
					strategyId,
					guidedPath.includes(strategyId),
					edgeType
				)
			);

			// Add property claims for each strategy
			if (strategy.property_claims) {
				for (const [claimIdx, claim] of strategy.property_claims.entries()) {
					const claimId = `claim-${stratIdx}-${claimIdx + 1}`;

					flowNodes.push(
						mapNodeToEnhanced(
							claimId,
							"propertyClaim",
							{
								x: 150 + stratIdx * xSpacing + (claimIdx % 2) * 420,
								y: yOffset + ySpacing * 2 + Math.floor(claimIdx / 2) * 150,
							},
							{
								name: claim.name,
								short_description: claim.short_description || claim.description,
								long_description: claim.long_description || claim.description,
								description: claim.description,
								element: claim,
								priority: claim.priority,
								status: claim.status,
								strength: claim.strength,
								confidence: claim.confidence,
								context: claim.context,
								assumptions: claim.assumptions,
								justifications: claim.justifications,
							},
							"propertyClaim"
						)
					);

					flowEdges.push(
						mapEdgeToEnhanced(
							`${strategyId}-${claimId}`,
							strategyId,
							claimId,
							guidedPath.includes(claimId),
							edgeType
						)
					);

					// Add evidence for claims
					if (claim.evidence) {
						for (const [evidIdx, evid] of claim.evidence.entries()) {
							const evidId = `evidence-${stratIdx}-${claimIdx}-${evidIdx + 1}`;

							flowNodes.push(
								mapNodeToEnhanced(
									evidId,
									"evidence",
									{
										x: 150 + stratIdx * xSpacing + (claimIdx % 2) * 420,
										y: yOffset + ySpacing * 3 + Math.floor(claimIdx / 2) * 150,
									},
									{
										name: evid.name,
										short_description:
											evid.short_description || evid.description,
										long_description: evid.long_description || evid.description,
										description: evid.description,
										element: evid,
										priority: evid.priority,
										status: evid.status,
										strength: evid.strength,
										confidence: evid.confidence,
										context: evid.context,
										assumptions: evid.assumptions,
										justifications: evid.justifications,
									},
									"evidence"
								)
							);

							flowEdges.push(
								mapEdgeToEnhanced(
									`${claimId}-${evidId}`,
									claimId,
									evidId,
									guidedPath.includes(evidId),
									edgeType
								)
							);
						}
					}
				}
			}
		}
	}

	return { nodes: flowNodes, edges: flowEdges };
}

/**
 * Map element type from uppercase schema to lowercase React Flow node type
 */
const ELEMENT_TYPE_MAP: Record<string, string> = {
	GOAL: "goal",
	STRATEGY: "strategy",
	PROPERTY_CLAIM: "propertyClaim",
	EVIDENCE: "evidence",
	CONTEXT: "context",
	JUSTIFICATION: "context",
	ASSUMPTION: "context",
};

/**
 * Type guard to check if data is the new nested export format (v1.0)
 */
function isCaseExportNested(
	data: CaseExportNested | CaseData
): data is CaseExportNested {
	return "version" in data && data.version === "1.0" && "tree" in data;
}

/**
 * Convert tree-based case data (v1.0) to enhanced nodes and edges.
 * Processes the recursive TreeNode structure from CaseExportNested.
 */
function convertTreeToEnhanced(
	caseData: CaseExportNested,
	guidedPath: string[] = [],
	enhancedEdges = true
): { nodes: Node<ReactFlowNodeData>[]; edges: Edge[] } {
	const flowNodes: Node<ReactFlowNodeData>[] = [];
	const flowEdges: Edge[] = [];
	const edgeType = enhancedEdges ? "smart" : "smoothstep";
	const xSpacing = 300;
	const ySpacing = 180;

	/**
	 * Recursively process a TreeNode and its children
	 */
	function processNode(
		node: TreeNode,
		parentId: string | null,
		x: number,
		y: number,
		_depth: number
	): void {
		const nodeType = ELEMENT_TYPE_MAP[node.type] || "goal";

		flowNodes.push({
			id: node.id,
			type: nodeType,
			position: { x, y },
			data: {
				id: node.id,
				name: node.name || "",
				title: node.title || undefined,
				description: node.description,
				url: node.url || undefined,
				// Attribute fields for display in expanded nodes
				context: node.context || [],
				assumption: node.assumption || undefined,
				justification: node.justification || undefined,
			},
		});

		if (parentId) {
			flowEdges.push({
				id: `${parentId}-${node.id}`,
				source: parentId,
				target: node.id,
				sourceHandle: `${parentId}-source`,
				targetHandle: `${node.id}-target`,
				type: edgeType,
				animated: guidedPath.includes(node.id),
				markerEnd: {
					type: MarkerType.ArrowClosed,
				},
			});
		}

		// Position children horizontally centered under this node
		const childCount = node.children.length;
		if (childCount > 0) {
			const totalWidth = (childCount - 1) * xSpacing;
			const startX = x - totalWidth / 2;

			for (const [index, child] of node.children.entries()) {
				const childX = startX + index * xSpacing;
				processNode(child, node.id, childX, y + ySpacing, _depth + 1);
			}
		}
	}

	processNode(caseData.tree, null, 400, 0, 0);
	return { nodes: flowNodes, edges: flowEdges };
}

/**
 * Union type for supported case data formats
 */
type SupportedCaseData = CaseExportNested | CaseData;

/**
 * Convert case data to enhanced nodes and edges.
 * Automatically detects schema version and uses appropriate converter.
 */
function convertToEnhanced(
	caseData: SupportedCaseData,
	guidedPath: string[] = [],
	enhancedEdges = true
): { nodes: Node<ReactFlowNodeData>[]; edges: Edge[] } {
	if (isCaseExportNested(caseData)) {
		return convertTreeToEnhanced(caseData, guidedPath, enhancedEdges);
	}
	return convertCaseDataToEnhanced(caseData, guidedPath, enhancedEdges);
}

/**
 * Control buttons component that uses useReactFlow
 */
const ControlButtons = ({
	nodes,
	edges,
	setNodes,
	setEdges,
	setRevealedNodes,
	showAllNodes: _showAllNodes,
	setShowAllNodes,
}: ControlButtonsProps) => {
	const { fitView } = useReactFlow();

	const handleAutoLayout = useCallback(() => {
		const layouted = getLayoutedElements(nodes, edges, { direction: "TB" });
		setNodes(layouted.nodes);
		setEdges(layouted.edges);
		window.requestAnimationFrame(() => {
			fitView({ padding: 0.2, duration: 400 });
		});
	}, [nodes, edges, setNodes, setEdges, fitView]);

	const handleRevealAll = useCallback(() => {
		setShowAllNodes(true);
		setRevealedNodes(new Set(nodes.map((n) => n.id)));
	}, [nodes, setShowAllNodes, setRevealedNodes]);

	const handleReset = useCallback(() => {
		setShowAllNodes(false);
		setRevealedNodes(new Set(["goal-1"]));
	}, [setShowAllNodes, setRevealedNodes]);

	return (
		<div className="absolute top-4 left-4 z-10 flex gap-2">
			<button
				className="flex items-center gap-1 rounded bg-blue-500 px-3 py-1 text-white transition hover:bg-blue-600"
				onClick={handleRevealAll}
				title="Reveal all nodes"
				type="button"
			>
				<Eye className="h-4 w-4" />
				Reveal All
			</button>
			<button
				className="flex items-center gap-1 rounded bg-gray-500 px-3 py-1 text-white transition hover:bg-gray-600"
				onClick={handleReset}
				title="Reset to initial view"
				type="button"
			>
				<EyeOff className="h-4 w-4" />
				Reset
			</button>
			<button
				className="flex items-center gap-1 rounded bg-green-500 px-3 py-1 text-white transition hover:bg-green-600"
				onClick={handleAutoLayout}
				title="Auto-arrange nodes with proper spacing"
				type="button"
			>
				<Maximize2 className="h-4 w-4" />
				Auto Layout
			</button>
		</div>
	);
};

/**
 * Legend component
 */
const Legend = ({ showLegend, setShowLegend }: LegendProps) => (
	<div className="absolute top-4 right-4 z-10">
		{showLegend ? (
			<div className="f-effect-backdrop-blur-lg rounded-xl border border-transparent bg-background-transparent-black p-3 shadow-glassmorphic">
				<div className="mb-2 flex items-center justify-between">
					<h3 className="font-bold text-sm text-text-light">Element Types</h3>
					<button
						aria-label="Hide legend"
						className="text-icon-light-secondary transition hover:text-text-light"
						onClick={() => setShowLegend(false)}
						type="button"
					>
						<ChevronRight className="h-4 w-4" />
					</button>
				</div>
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
					<div className="flex items-center gap-2">
						<AlertCircle className="h-4 w-4 text-gray-400" />
						<span className="text-text-light">Context</span>
					</div>
				</div>
			</div>
		) : (
			<button
				aria-label="Show element types legend"
				className="f-effect-backdrop-blur-lg rounded-xl border border-transparent bg-background-transparent-black p-2 shadow-glassmorphic transition hover:shadow-3d"
				onClick={() => setShowLegend(true)}
				title="Show element types"
				type="button"
			>
				<Info className="h-5 w-5 text-icon-light-secondary" />
			</button>
		)}
	</div>
);

/**
 * Enhanced Interactive Case Viewer Inner Component
 * (Needs to be inside ReactFlowProvider to use useReactFlow)
 */
const EnhancedInteractiveCaseViewerInner = ({
	caseData,
	onNodeClick,
	guidedPath = [],
	showAllNodes: initialShowAllNodes = false,
	enableExploration: _enableExploration = true,
	enableCollapsible = true,
	enableContextMenus = true,
	enableNodeCreation = true,
	enableAnimations: _enableAnimations = true,
	enableEnhancedEdges = true,
	className = "",
	height = "600px",
	persistKey: _persistKey = "enhanced-case-viewer",
}: EnhancedInteractiveCaseViewerInnerProps) => {
	const [isDarkMode, setIsDarkMode] = useState(true);
	const [colorMode, setColorMode] = useState<"light" | "dark">("dark");

	useEffect(() => {
		const updateTheme = () => {
			const htmlElement = document.documentElement;
			const themeAttr = htmlElement.getAttribute("data-theme");
			const theme: "light" | "dark" = themeAttr === "light" ? "light" : "dark";
			setColorMode(theme);
			setIsDarkMode(theme === "dark");
		};

		updateTheme();

		const observer = new MutationObserver(updateTheme);
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["data-theme"],
		});

		return () => observer.disconnect();
	}, []);

	const [nodes, setNodes, onNodesChange] = useNodesState([]);
	const [edges, setEdges, onEdgesChange] = useEdgesState([]);
	const [_selectedNode, setSelectedNode] =
		useState<Node<ReactFlowNodeData> | null>(null);
	const [revealedNodes, setRevealedNodes] = useState(new Set(["goal-1"]));
	const [showLegend, setShowLegend] = useState(false);
	const [showAllNodes, setShowAllNodes] = useState(initialShowAllNodes);
	const [connectionSource, setConnectionSource] = useState<{
		nodeId: string;
		handleType: string;
		handleId: string;
	} | null>(null);

	const lastPaneClickRef = useRef(0);
	const reactFlowInstance = useReactFlow();
	const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
	const [addPosition, setAddPosition] = useState<{
		x: number;
		y: number;
	} | null>(null);
	const [parentNodeForCreation, setParentNodeForCreation] =
		useState<Node<ReactFlowNodeData> | null>(null);

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

					setParentNodeForCreation(sourceNode);
					setAddPosition(screenPosition);
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
			let nodePosition = dialogPosition;

			if (!nodePosition && addPosition && reactFlowInstance) {
				nodePosition = reactFlowInstance.screenToFlowPosition(addPosition);
			}

			if (!nodePosition && parentNode) {
				const parentPosition = parentNode.position || { x: 0, y: 0 };
				nodePosition = {
					x: parentPosition.x,
					y: parentPosition.y + 150,
				};
			}

			if (!nodePosition) {
				nodePosition = { x: 0, y: 0 };
			}

			const newNode = mapNodeToEnhanced(
				newNodeId,
				nodeType,
				nodePosition,
				{
					name,
					description,
					short_description: description,
					long_description: description,
				},
				nodeType
			);

			setNodes((nds) => [...nds, newNode]);
			setRevealedNodes((revealed) => new Set([...revealed, newNodeId]));

			if (parentNode) {
				const newEdge: Edge = {
					id: `edge-${parentNode.id}-${newNodeId}`,
					source: parentNode.id,
					target: newNodeId,
					sourceHandle: `${parentNode.id}-source`,
					targetHandle: `${newNodeId}-target`,
					type: enableEnhancedEdges ? "smart" : "smoothstep",
					animated: false,
					markerEnd: {
						type: MarkerType.ArrowClosed,
					},
				};

				setEdges((eds) => [...eds, newEdge]);
			}

			setTimeout(() => {
				const layouted = getLayoutedElements(nodes.concat(newNode), edges, {
					direction: "TB",
				});
				setNodes(layouted.nodes);
				setEdges(layouted.edges);
			}, 100);
		},
		[
			nodes,
			edges,
			setNodes,
			setEdges,
			addPosition,
			enableEnhancedEdges,
			reactFlowInstance,
		]
	);

	const handleHandleClick = useCallback(
		(
			_nodeId: string,
			_handleId: string,
			_position: { x: number; y: number },
			_nodeData: ReactFlowNodeData
		) => {
			const sourceNode = nodes.find((n) => n.id === _nodeId);

			if (sourceNode) {
				setParentNodeForCreation(sourceNode);
				setAddPosition(null);
				setIsAddDialogOpen(true);
			}
		},
		[nodes]
	);

	const revealChildren = useCallback(
		(nodeId: string) => {
			const newRevealed = new Set(revealedNodes);
			newRevealed.add(nodeId);

			const childNodes = edges
				.filter((edge) => edge.source === nodeId)
				.map((edge) => edge.target);

			for (const childId of childNodes) {
				newRevealed.add(childId);
			}

			setRevealedNodes(newRevealed);
		},
		[revealedNodes, edges]
	);

	const hideChildren = useCallback(
		(nodeId: string) => {
			const newRevealed = new Set(revealedNodes);

			const childNodes = edges
				.filter((edge) => edge.source === nodeId)
				.map((edge) => edge.target);

			for (const childId of childNodes) {
				newRevealed.delete(childId);
			}

			setRevealedNodes(newRevealed);
		},
		[revealedNodes, edges]
	);

	const toggleChildren = useCallback(
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
		[revealedNodes, edges]
	);

	const revealAllDescendants = useCallback(
		(nodeId: string) => {
			const newRevealed = new Set(revealedNodes);
			newRevealed.add(nodeId);

			const revealDescendantsRecursive = (currentNodeId: string) => {
				const childNodes = edges
					.filter((edge) => edge.source === currentNodeId)
					.map((edge) => edge.target);

				for (const childId of childNodes) {
					if (!newRevealed.has(childId)) {
						newRevealed.add(childId);
						revealDescendantsRecursive(childId);
					}
				}
			};

			revealDescendantsRecursive(nodeId);
			setRevealedNodes(newRevealed);
		},
		[revealedNodes, edges]
	);

	const nodeContextMenu = useNodeContextMenu({
		nodes,
		edges,
		setNodes,
		setEdges,
		reactFlowInstance,
		callbacks: {
			revealChildren,
			hideChildren,
			toggleChildren,
			revealAllDescendants,
		},
	});

	const edgeContextMenu = useEdgeContextMenu({
		edges,
		setEdges,
		reactFlowInstance,
	});

	const canvasContextMenu = useCanvasContextMenu({
		nodes,
		edges,
		setNodes,
		setEdges,
		reactFlowInstance,
	});

	useEffect(() => {
		if (!caseData) {
			console.warn("No caseData provided to EnhancedInteractiveCaseViewer");
			return;
		}

		const { nodes: flowNodes, edges: flowEdges } = convertToEnhanced(
			caseData,
			guidedPath,
			enableEnhancedEdges
		);

		const visibleNodes = showAllNodes
			? flowNodes
			: flowNodes.map((node) => ({
					...node,
					hidden: !(revealedNodes.has(node.id) || guidedPath.includes(node.id)),
				}));

		setNodes(visibleNodes);
		setEdges(flowEdges);
	}, [
		caseData,
		showAllNodes,
		revealedNodes,
		guidedPath,
		enableEnhancedEdges,
		setNodes,
		setEdges,
	]);

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

			if (timeSinceLastClick < 300 && enableNodeCreation) {
				const bounds = (event.target as HTMLElement).getBoundingClientRect();
				const position = {
					x: event.clientX - bounds.left,
					y: event.clientY - bounds.top,
				};

				setAddPosition(position);
				setIsAddDialogOpen(true);
			}

			lastPaneClickRef.current = currentTime;
		},
		[enableNodeCreation]
	);

	const handleNodeContextMenu = useCallback(
		(event: React.MouseEvent, node: Node<ReactFlowNodeData>) => {
			if (!enableContextMenus) {
				return;
			}
			nodeContextMenu.handleNodeContextMenu(event, node);
		},
		[enableContextMenus, nodeContextMenu]
	);

	const handleEdgeContextMenu = useCallback(
		(event: React.MouseEvent, edge: Edge) => {
			if (!enableContextMenus) {
				return;
			}
			edgeContextMenu.handleEdgeContextMenu(event, edge);
		},
		[enableContextMenus, edgeContextMenu]
	);

	const handlePaneContextMenu = useCallback(
		(event: React.MouseEvent) => {
			if (!enableContextMenus) {
				return;
			}
			canvasContextMenu.handlePaneContextMenu(event);
		},
		[enableContextMenus, canvasContextMenu]
	);

	const enhancedNodeTypes = useMemo(
		() => (enableCollapsible ? nodeTypes : {}),
		[enableCollapsible]
	);

	const enhancedEdgeTypes = useMemo(
		() => (enableEnhancedEdges ? edgeTypes : {}),
		[enableEnhancedEdges]
	);

	const canvasBg = isDarkMode ? "bg-gray-950" : "bg-gray-100";
	const backgroundDotColor = isDarkMode
		? "rgba(255, 255, 255, 0.05)"
		: "rgba(0, 0, 0, 0.1)";

	const themeContextValue = useMemo(
		() => ({
			isDarkMode,
			colorMode,
			onHandleClick: handleHandleClick,
		}),
		[isDarkMode, colorMode, handleHandleClick]
	);

	return (
		<ThemeContext.Provider value={themeContextValue}>
			<div
				className={`relative w-full overflow-hidden rounded-lg shadow-lg ${canvasBg} ${className}`}
				style={{ height }}
			>
				<ControlButtons
					edges={edges}
					nodes={nodes}
					setEdges={setEdges}
					setNodes={setNodes}
					setRevealedNodes={setRevealedNodes}
					setShowAllNodes={setShowAllNodes}
					showAllNodes={showAllNodes}
				/>

				<Legend setShowLegend={setShowLegend} showLegend={showLegend} />

				<ReactFlow
					attributionPosition="bottom-left"
					className={canvasBg}
					edges={edges}
					edgeTypes={enhancedEdgeTypes}
					fitView
					fitViewOptions={{ padding: 0.2 }}
					maxZoom={4}
					minZoom={0.2}
					nodes={nodes}
					nodeTypes={enhancedNodeTypes}
					onConnect={onConnect}
					onConnectEnd={onConnectEnd}
					onConnectStart={onConnectStart}
					onEdgeContextMenu={handleEdgeContextMenu}
					onEdgesChange={onEdgesChange}
					onNodeClick={handleNodeClick}
					onNodeContextMenu={handleNodeContextMenu}
					onNodesChange={onNodesChange}
					onPaneClick={handlePaneClick}
					onPaneContextMenu={handlePaneContextMenu}
				>
					<Background
						color={backgroundDotColor}
						gap={12}
						size={1}
						variant={BACKGROUND_DOTS}
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
				</ReactFlow>

				{enableContextMenus && (
					<>
						{nodeContextMenu.NodeContextMenu}
						{edgeContextMenu.EdgeContextMenu}
						{canvasContextMenu.CanvasContextMenu}
					</>
				)}

				<CreateNodePopover
					onOpenChange={(open) => {
						setIsAddDialogOpen(open);
						if (!open) {
							setParentNodeForCreation(null);
							setAddPosition(null);
						}
					}}
					onSelect={handleCreateNode}
					open={isAddDialogOpen}
					parentNode={parentNodeForCreation}
					position={addPosition}
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

	// Determine inner component based on features
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
export { convertCaseDataToEnhanced, mapEdgeToEnhanced, mapNodeToEnhanced };
