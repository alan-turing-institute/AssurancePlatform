/**
 * Menu Actions
 *
 * Implementation of all context menu actions for nodes, edges, and canvas.
 * Each action receives context including nodes, edges, setters, and the React Flow instance.
 *
 * @module menus/menuActions
 */

import { toJpeg, toPng, toSvg } from "html-to-image";
import type { Edge, Node, ReactFlowInstance } from "reactflow";

/**
 * Action context type
 */
type ActionContext = {
	node?: Node;
	edge?: Edge;
	nodes?: Node[];
	edges?: Edge[];
	selectedNodes?: Node[] | null;
	setNodes?: (nodes: Node[] | ((nodes: Node[]) => Node[])) => void;
	setEdges?: (edges: Edge[] | ((edges: Edge[]) => Edge[])) => void;
	reactFlowInstance?: ReactFlowInstance;
	position?: { x: number; y: number };
	clipboard?: { type: string; data: unknown } | null;
	setClipboard?: (data: { type: string; data: unknown } | null) => void;
	onEdit?: (node: Node) => void;
	onDelete?: (node: Node) => void;
	onAddEvidence?: (node: Node) => void;
	onLinkSource?: (node: Node) => void;
	onViewDetails?: (node: Node) => void;
	onEditLabel?: (edge: Edge) => void;
	onAddWaypoint?: (edge: Edge) => void;
	onCreate?: (nodeType: string, position: { x: number; y: number }) => void;
	onAutoLayout?: (layoutType: string, nodes: Node[], edges: Edge[]) => void;
	onGroup?: (nodes: Node[]) => void;
	revealChildren?: (nodeId: string) => void;
	hideChildren?: (nodeId: string) => void;
	toggleChildren?: (nodeId: string) => void;
	revealAllDescendants?: (nodeId: string) => void;
	priority?: string;
	strategyType?: string;
	status?: string;
	confidence?: string;
	importance?: string;
	alignment?: string;
	direction?: string;
	edgeType?: string;
	edgeStyle?: string;
	strength?: string;
	nodeType?: string;
	layoutType?: string;
	format?: string;
	event?: React.MouseEvent;
	[key: string]: unknown;
};

/**
 * Action handler function type
 */
type ActionHandler = (context: ActionContext) => void | Promise<void>;

/**
 * Menu action handlers
 * Each handler receives the action context with all necessary data
 */
export const menuActions: Record<string, ActionHandler> = {
	// ============================================================================
	// NODE ACTIONS
	// ============================================================================

	/**
	 * Edit node - opens edit dialog or makes node editable
	 */
	edit: ({ node, onEdit }) => {
		if (!node) {
			return;
		}

		if (onEdit) {
			onEdit(node);
		}
		console.log("Edit node:", node.id);
	},

	/**
	 * Delete node with confirmation
	 */
	delete: ({ node, nodes, edges, setNodes, setEdges, onDelete }) => {
		if (!node) {
			return;
		}

		if (onDelete) {
			onDelete(node);
			return;
		}

		if (!(setNodes && setEdges && nodes && edges)) {
			return;
		}

		// Confirm deletion
		// biome-ignore lint/suspicious/noAlert: User confirmation is appropriate for destructive actions
		const confirmed = window.confirm(
			`Are you sure you want to delete "${node.data?.name || node.id}"?`
		);

		if (confirmed) {
			// Remove node
			setNodes(nodes.filter((n) => n.id !== node.id));

			// Remove connected edges
			setEdges(
				edges.filter((e) => e.source !== node.id && e.target !== node.id)
			);

			console.log("Deleted node:", node.id);
		}
	},

	/**
	 * Duplicate node at offset position
	 */
	duplicate: ({ node, nodes, setNodes }) => {
		if (!(node && nodes && setNodes)) {
			return;
		}

		const offset = 50;
		const newNode: Node = {
			...node,
			id: `${node.id}-copy-${Date.now()}`,
			position: {
				x: node.position.x + offset,
				y: node.position.y + offset,
			},
			data: {
				...node.data,
				name: `${node.data?.name || "Node"} (Copy)`,
			},
			selected: false,
		};

		setNodes([...nodes, newNode]);
		console.log("Duplicated node:", newNode.id);
	},

	/**
	 * Copy node style to clipboard
	 */
	copyStyle: ({ node, setClipboard }) => {
		if (!node) {
			return;
		}

		const style = {
			style: node.style,
			className: node.className,
			type: node.type,
		};

		if (setClipboard) {
			setClipboard({ type: "style", data: style });
		}

		console.log("Copied style from node:", node.id);
	},

	/**
	 * Focus/center view on node
	 */
	focus: ({ node, reactFlowInstance }) => {
		if (!(node && reactFlowInstance)) {
			return;
		}

		reactFlowInstance.setCenter(
			node.position.x + (node.width || 200) / 2,
			node.position.y + (node.height || 100) / 2,
			{ duration: 800, zoom: 1.5 }
		);

		console.log("Focused on node:", node.id);
	},

	/**
	 * Progressive Disclosure - Reveal immediate children
	 */
	revealChildren: ({ node, revealChildren }) => {
		if (!node) {
			return;
		}

		if (revealChildren) {
			revealChildren(node.id);
			console.log("Revealed children of node:", node.id);
		}
	},

	/**
	 * Progressive Disclosure - Hide immediate children
	 */
	hideChildren: ({ node, hideChildren }) => {
		if (!node) {
			return;
		}

		if (hideChildren) {
			hideChildren(node.id);
			console.log("Hid children of node:", node.id);
		}
	},

	/**
	 * Progressive Disclosure - Toggle children visibility
	 */
	toggleChildren: ({ node, toggleChildren }) => {
		if (!node) {
			return;
		}

		if (toggleChildren) {
			toggleChildren(node.id);
			console.log("Toggled children of node:", node.id);
		}
	},

	/**
	 * Progressive Disclosure - Reveal all descendants recursively
	 */
	revealAllDescendants: ({ node, revealAllDescendants }) => {
		if (!node) {
			return;
		}

		if (revealAllDescendants) {
			revealAllDescendants(node.id);
			console.log("Revealed all descendants of node:", node.id);
		}
	},

	/**
	 * Set goal priority
	 */
	setPriority: ({ node, nodes, setNodes, priority }) => {
		if (!(node && nodes && setNodes && priority)) {
			return;
		}

		setNodes(
			nodes.map((n) =>
				n.id === node.id ? { ...n, data: { ...n.data, priority } } : n
			)
		);
		console.log(`Set priority to ${priority} for node:`, node.id);
	},

	/**
	 * Mark goal as complete
	 */
	markComplete: ({ node, nodes, setNodes }) => {
		if (!(node && nodes && setNodes)) {
			return;
		}

		setNodes(
			nodes.map((n) =>
				n.id === node.id
					? {
							...n,
							data: {
								...n.data,
								completed: true,
								completedAt: new Date().toISOString(),
							},
						}
					: n
			)
		);
		console.log("Marked complete:", node.id);
	},

	/**
	 * Change strategy type (AND/OR)
	 */
	changeType: ({ node, nodes, setNodes, strategyType }) => {
		if (!(node && nodes && setNodes && strategyType)) {
			return;
		}

		setNodes(
			nodes.map((n) =>
				n.id === node.id ? { ...n, data: { ...n.data, strategyType } } : n
			)
		);
		console.log(`Changed strategy type to ${strategyType} for node:`, node.id);
	},

	/**
	 * Expand node and all children
	 */
	expandAll: ({ node, nodes, setNodes }) => {
		if (!(node && nodes && setNodes)) {
			return;
		}

		// Find all descendant nodes
		const descendants = findDescendants(node.id, nodes);

		setNodes(
			nodes.map((n) =>
				n.id === node.id || descendants.includes(n.id)
					? { ...n, data: { ...n.data, expanded: true } }
					: n
			)
		);
		console.log("Expanded all for node:", node.id);
	},

	/**
	 * Collapse node and all children
	 */
	collapseAll: ({ node, nodes, setNodes }) => {
		if (!(node && nodes && setNodes)) {
			return;
		}

		const descendants = findDescendants(node.id, nodes);

		setNodes(
			nodes.map((n) =>
				n.id === node.id || descendants.includes(n.id)
					? { ...n, data: { ...n.data, expanded: false } }
					: n
			)
		);
		console.log("Collapsed all for node:", node.id);
	},

	/**
	 * Verify property claim
	 */
	verify: ({ node, nodes, setNodes }) => {
		if (!(node && nodes && setNodes)) {
			return;
		}

		setNodes(
			nodes.map((n) =>
				n.id === node.id
					? {
							...n,
							data: {
								...n.data,
								verified: true,
								verifiedAt: new Date().toISOString(),
							},
						}
					: n
			)
		);
		console.log("Verified claim:", node.id);
	},

	/**
	 * Add evidence to claim
	 */
	addEvidence: ({ node, onAddEvidence }) => {
		if (!node) {
			return;
		}

		if (onAddEvidence) {
			onAddEvidence(node);
		}
		console.log("Add evidence to node:", node.id);
	},

	/**
	 * Update status (verified, pending, disputed)
	 */
	updateStatus: ({ node, nodes, setNodes, status }) => {
		if (!(node && nodes && setNodes && status)) {
			return;
		}

		setNodes(
			nodes.map((n) =>
				n.id === node.id
					? {
							...n,
							data: {
								...n.data,
								status,
								statusUpdatedAt: new Date().toISOString(),
							},
						}
					: n
			)
		);
		console.log(`Updated status to ${status} for node:`, node.id);
	},

	/**
	 * Update evidence confidence level
	 */
	updateConfidence: ({ node, nodes, setNodes, confidence }) => {
		if (!(node && nodes && setNodes && confidence)) {
			return;
		}

		setNodes(
			nodes.map((n) =>
				n.id === node.id ? { ...n, data: { ...n.data, confidence } } : n
			)
		);
		console.log(`Updated confidence to ${confidence} for node:`, node.id);
	},

	/**
	 * Link external source to evidence
	 */
	linkSource: ({ node, onLinkSource }) => {
		if (!node) {
			return;
		}

		if (onLinkSource) {
			onLinkSource(node);
		}
		console.log("Link source to node:", node.id);
	},

	/**
	 * View evidence details
	 */
	viewDetails: ({ node, onViewDetails }) => {
		if (!node) {
			return;
		}

		if (onViewDetails) {
			onViewDetails(node);
		}
		console.log("View details for node:", node.id);
	},

	/**
	 * Change context importance
	 */
	changeImportance: ({ node, nodes, setNodes, importance }) => {
		if (!(node && nodes && setNodes && importance)) {
			return;
		}

		setNodes(
			nodes.map((n) =>
				n.id === node.id ? { ...n, data: { ...n.data, importance } } : n
			)
		);
		console.log(`Changed importance to ${importance} for node:`, node.id);
	},

	/**
	 * Toggle visibility
	 */
	toggleVisibility: ({ node, nodes, setNodes }) => {
		if (!(node && nodes && setNodes)) {
			return;
		}

		setNodes(
			nodes.map((n) => (n.id === node.id ? { ...n, hidden: !n.hidden } : n))
		);
		console.log("Toggled visibility for node:", node.id);
	},

	// ============================================================================
	// MULTI-SELECT ACTIONS
	// ============================================================================

	/**
	 * Align selected nodes
	 */
	align: ({ selectedNodes, nodes, setNodes, alignment }) => {
		if (!selectedNodes || selectedNodes.length < 2 || !nodes || !setNodes) {
			return;
		}
		if (!alignment) {
			return;
		}

		const positions = selectedNodes.map((n) => n.position);

		const applyAlignment = (alignmentType: string): void => {
			switch (alignmentType) {
				case "left": {
					const alignValue = Math.min(...positions.map((p) => p.x));
					setNodes(
						nodes.map((n) => {
							const selected = selectedNodes.find((sn) => sn.id === n.id);
							return selected
								? { ...n, position: { ...n.position, x: alignValue } }
								: n;
						})
					);
					break;
				}
				case "right": {
					const alignValue = Math.max(
						...positions.map((p, i) => p.x + (selectedNodes[i].width || 200))
					);
					setNodes(
						nodes.map((n) => {
							const selected = selectedNodes.find((sn) => sn.id === n.id);
							return selected
								? {
										...n,
										position: {
											...n.position,
											x: alignValue - (n.width || 200),
										},
									}
								: n;
						})
					);
					break;
				}
				case "center": {
					const minX = Math.min(...positions.map((p) => p.x));
					const maxX = Math.max(
						...positions.map((p, i) => p.x + (selectedNodes[i].width || 200))
					);
					const alignValue = (minX + maxX) / 2;
					setNodes(
						nodes.map((n) => {
							const selected = selectedNodes.find((sn) => sn.id === n.id);
							return selected
								? {
										...n,
										position: {
											...n.position,
											x: alignValue - (n.width || 200) / 2,
										},
									}
								: n;
						})
					);
					break;
				}
				case "top": {
					const alignValue = Math.min(...positions.map((p) => p.y));
					setNodes(
						nodes.map((n) => {
							const selected = selectedNodes.find((sn) => sn.id === n.id);
							return selected
								? { ...n, position: { ...n.position, y: alignValue } }
								: n;
						})
					);
					break;
				}
				case "bottom": {
					const alignValue = Math.max(
						...positions.map((p, i) => p.y + (selectedNodes[i].height || 100))
					);
					setNodes(
						nodes.map((n) => {
							const selected = selectedNodes.find((sn) => sn.id === n.id);
							return selected
								? {
										...n,
										position: {
											...n.position,
											y: alignValue - (n.height || 100),
										},
									}
								: n;
						})
					);
					break;
				}
				case "middle": {
					const minY = Math.min(...positions.map((p) => p.y));
					const maxY = Math.max(
						...positions.map((p, i) => p.y + (selectedNodes[i].height || 100))
					);
					const alignValue = (minY + maxY) / 2;
					setNodes(
						nodes.map((n) => {
							const selected = selectedNodes.find((sn) => sn.id === n.id);
							return selected
								? {
										...n,
										position: {
											...n.position,
											y: alignValue - (n.height || 100) / 2,
										},
									}
								: n;
						})
					);
					break;
				}
				default:
					break;
			}
		};

		applyAlignment(alignment);
		console.log(`Aligned ${selectedNodes.length} nodes: ${alignment}`);
	},

	/**
	 * Distribute nodes evenly
	 */
	distribute: ({ selectedNodes, nodes, setNodes, direction }) => {
		if (!selectedNodes || selectedNodes.length < 3 || !nodes || !setNodes) {
			return;
		}
		if (!direction) {
			return;
		}

		const sorted = [...selectedNodes].sort((a, b) =>
			direction === "horizontal"
				? a.position.x - b.position.x
				: a.position.y - b.position.y
		);

		const first = sorted[0];
		const last = sorted.at(-1);
		if (!(first && last)) {
			return;
		}
		const totalSpace =
			direction === "horizontal"
				? last.position.x - first.position.x
				: last.position.y - first.position.y;
		const spacing = totalSpace / (sorted.length - 1);

		setNodes(
			nodes.map((n) => {
				const index = sorted.findIndex((sn) => sn.id === n.id);
				if (index > 0 && index < sorted.length - 1) {
					return {
						...n,
						position:
							direction === "horizontal"
								? { ...n.position, x: first.position.x + spacing * index }
								: { ...n.position, y: first.position.y + spacing * index },
					};
				}
				return n;
			})
		);

		console.log(`Distributed ${selectedNodes.length} nodes: ${direction}`);
	},

	/**
	 * Group selected nodes
	 */
	group: ({ selectedNodes, onGroup }) => {
		if (!selectedNodes) {
			return;
		}

		if (onGroup) {
			onGroup(selectedNodes);
		}
		console.log(
			"Grouped nodes:",
			selectedNodes.map((n) => n.id)
		);
	},

	/**
	 * Copy all selected nodes
	 */
	copyAll: ({ selectedNodes, setClipboard }) => {
		if (!selectedNodes) {
			return;
		}

		if (setClipboard) {
			setClipboard({ type: "nodes", data: selectedNodes });
		}
		console.log("Copied all selected nodes:", selectedNodes.length);
	},

	/**
	 * Delete all selected nodes
	 */
	deleteAll: ({ selectedNodes, nodes, edges, setNodes, setEdges }) => {
		if (!(selectedNodes && nodes && edges && setNodes && setEdges)) {
			return;
		}

		// biome-ignore lint/suspicious/noAlert: User confirmation is appropriate for destructive actions
		const confirmed = window.confirm(
			`Are you sure you want to delete ${selectedNodes.length} nodes?`
		);

		if (confirmed) {
			const selectedIds = selectedNodes.map((n) => n.id);
			setNodes(nodes.filter((n) => !selectedIds.includes(n.id)));
			setEdges(
				edges.filter(
					(e) =>
						!(selectedIds.includes(e.source) || selectedIds.includes(e.target))
				)
			);
			console.log("Deleted all selected nodes:", selectedIds.length);
		}
	},

	// ============================================================================
	// EDGE ACTIONS
	// ============================================================================

	/**
	 * Edit edge label
	 */
	editLabel: ({ edge, onEditLabel }) => {
		if (!edge) {
			return;
		}

		if (onEditLabel) {
			onEditLabel(edge);
		}
		console.log("Edit label for edge:", edge.id);
	},

	/**
	 * Change edge type
	 */
	changeEdgeType: ({ edge, edges, setEdges, edgeType }) => {
		if (!(edge && edges && setEdges && edgeType)) {
			return;
		}

		setEdges(
			edges.map((e) => (e.id === edge.id ? { ...e, type: edgeType } : e))
		);
		console.log(`Changed edge type to ${edgeType} for edge:`, edge.id);
	},

	/**
	 * Change edge style
	 */
	changeEdgeStyle: ({ edge, edges, setEdges, edgeStyle }) => {
		if (!(edge && edges && setEdges && edgeStyle)) {
			return;
		}

		const styleMap: Record<
			string,
			{ strokeDasharray: string; animated: boolean; stroke?: string }
		> = {
			solid: { strokeDasharray: "none", animated: false },
			dashed: { strokeDasharray: "5 5", animated: false },
			dotted: { strokeDasharray: "1 3", animated: false },
			animated: { strokeDasharray: "5 5", animated: true },
			gradient: {
				strokeDasharray: "none",
				animated: false,
				stroke: "url(#edge-gradient)",
			},
		};

		const selectedStyle = styleMap[edgeStyle];
		if (!selectedStyle) {
			return;
		}

		setEdges(
			edges.map((e) =>
				e.id === edge.id
					? {
							...e,
							style: { ...e.style, ...selectedStyle },
							animated: selectedStyle.animated,
						}
					: e
			)
		);
		console.log(`Changed edge style to ${edgeStyle} for edge:`, edge.id);
	},

	/**
	 * Add waypoint to edge
	 */
	addWaypoint: ({ edge, onAddWaypoint }) => {
		if (!edge) {
			return;
		}

		if (onAddWaypoint) {
			onAddWaypoint(edge);
		}
		console.log("Add waypoint to edge:", edge.id);
	},

	/**
	 * Change edge strength/weight
	 */
	changeStrength: ({ edge, edges, setEdges, strength }) => {
		if (!(edge && edges && setEdges && strength)) {
			return;
		}

		const widthMap: Record<string, number> = {
			strong: 4,
			normal: 2,
			weak: 1,
		};

		const strokeWidth = widthMap[strength];
		if (!strokeWidth) {
			return;
		}

		setEdges(
			edges.map((e) =>
				e.id === edge.id ? { ...e, style: { ...e.style, strokeWidth } } : e
			)
		);
		console.log(`Changed edge strength to ${strength} for edge:`, edge.id);
	},

	/**
	 * Reverse edge direction
	 */
	reverse: ({ edge, edges, setEdges }) => {
		if (!(edge && edges && setEdges)) {
			return;
		}

		setEdges(
			edges.map((e) =>
				e.id === edge.id
					? {
							...e,
							source: e.target,
							target: e.source,
							sourceHandle: e.targetHandle,
							targetHandle: e.sourceHandle,
						}
					: e
			)
		);
		console.log("Reversed edge:", edge.id);
	},

	/**
	 * Delete edge
	 */
	deleteEdge: ({ edge, edges, setEdges }) => {
		if (!(edge && edges && setEdges)) {
			return;
		}

		setEdges(edges.filter((e) => e.id !== edge.id));
		console.log("Deleted edge:", edge.id);
	},

	// ============================================================================
	// CANVAS ACTIONS
	// ============================================================================

	/**
	 * Create new node at position
	 */
	createNode: ({ nodeType, position, nodes, setNodes, onCreate }) => {
		if (!nodeType) {
			return;
		}

		if (onCreate && position) {
			onCreate(nodeType, position);
			return;
		}

		if (!(nodes && setNodes)) {
			return;
		}

		const newNode: Node = {
			id: `${nodeType}-${Date.now()}`,
			type: nodeType,
			position: position || { x: 100, y: 100 },
			data: {
				name: `New ${nodeType}`,
				description: "Click to edit",
			},
		};

		setNodes([...nodes, newNode]);
		console.log("Created node:", newNode.id);
	},

	/**
	 * Paste from clipboard
	 */
	paste: ({ clipboard, position, nodes, setNodes }) => {
		if (!(clipboard && nodes && setNodes)) {
			return;
		}

		if (clipboard.type === "nodes" && Array.isArray(clipboard.data)) {
			const clipboardNodes = clipboard.data as Node[];
			const newNodes = clipboardNodes.map((node, index) => ({
				...node,
				id: `${node.id}-paste-${Date.now()}-${index}`,
				position: {
					x: (position?.x || node.position.x) + index * 20,
					y: (position?.y || node.position.y) + index * 20,
				},
				selected: false,
			}));

			setNodes([...nodes, ...newNodes]);
			console.log("Pasted nodes:", newNodes.length);
		}
	},

	/**
	 * Select all nodes
	 */
	selectAll: ({ nodes, setNodes }) => {
		if (!(nodes && setNodes)) {
			return;
		}

		setNodes(nodes.map((n) => ({ ...n, selected: true })));
		console.log("Selected all nodes");
	},

	/**
	 * Auto layout
	 */
	autoLayout: ({ layoutType, nodes, edges, onAutoLayout }) => {
		if (!layoutType) {
			return;
		}

		if (onAutoLayout && nodes && edges) {
			onAutoLayout(layoutType, nodes, edges);
		}
		console.log("Auto layout:", layoutType);
	},

	/**
	 * Reset view to fit all nodes
	 */
	resetView: ({ reactFlowInstance }) => {
		if (!reactFlowInstance) {
			return;
		}

		reactFlowInstance.fitView({ duration: 800, padding: 0.2 });
		console.log("Reset view");
	},

	/**
	 * Export as image
	 */
	exportImage: async ({ format, reactFlowInstance }) => {
		if (!(reactFlowInstance && format)) {
			return;
		}

		const viewport = document.querySelector(
			".react-flow__viewport"
		) as HTMLElement;
		if (!viewport) {
			return;
		}

		try {
			let dataUrl: string;
			const filename = `assurance-case-${Date.now()}.${format}`;

			switch (format) {
				case "png":
					dataUrl = await toPng(viewport, { quality: 1.0 });
					break;
				case "svg":
					dataUrl = await toSvg(viewport);
					break;
				case "jpeg":
					dataUrl = await toJpeg(viewport, { quality: 0.95 });
					break;
				default:
					return;
			}

			// Download
			const link = document.createElement("a");
			link.download = filename;
			link.href = dataUrl;
			link.click();

			console.log("Exported as:", format);
		} catch (error) {
			console.error("Export failed:", error);
		}
	},
};

/**
 * Execute menu action
 */
export function executeAction(
	actionString: string,
	context: ActionContext
): void {
	const [action, ...params] = actionString.split(":");
	const param = params.join(":");

	const handler = menuActions[action];
	if (!handler) {
		console.warn("Unknown action:", action);
		return;
	}

	// Add param to context if present
	const enhancedContext: ActionContext = param
		? {
				...context,
				[action]: param,
				priority: param,
				strategyType: param,
				status: param,
				confidence: param,
				importance: param,
				alignment: param,
				direction: param,
				edgeType: param,
				edgeStyle: param,
				strength: param,
				nodeType: param,
				layoutType: param,
				format: param,
			}
		: context;

	handler(enhancedContext);
}

/**
 * Helper: Find all descendant nodes
 */
function findDescendants(_nodeId: string, _nodes: Node[]): string[] {
	// This is a placeholder - implement based on your edge structure
	// For now, returns empty array
	return [];
}

/**
 * Helper: Check if clipboard has content
 */
export function checkClipboard(context: ActionContext): boolean {
	return !!context.clipboard?.data;
}

export default {
	menuActions,
	executeAction,
	checkClipboard,
};
