/**
 * Data Mapping Utilities
 *
 * Utilities for converting between different data formats:
 * - Legacy InteractiveCaseViewer format
 * - Enhanced component format
 * - React Flow native format
 *
 * Ensures backward compatibility while supporting new features.
 *
 * @module dataMapping
 */

import { type Edge, MarkerType, type Node } from "reactflow";

type BaseNodeData = {
	id: string;
	name: string;
	description: string;
	long_description: string;
	element?: unknown;
	[key: string]: unknown;
};

/**
 * Map legacy node data to enhanced format
 */
export const mapNodeToEnhanced = (
	id: string,
	type: string,
	position: { x: number; y: number },
	data: Record<string, unknown>,
	_nodeType: string
): Node<BaseNodeData> => {
	return {
		id,
		type,
		position,
		data: {
			id,
			name: (data.name as string) || "Unnamed Node",
			description:
				(data.short_description as string) ||
				(data.description as string) ||
				"",
			long_description:
				(data.long_description as string) || (data.description as string) || "",
			element: data.element || data,
			// Preserve all original data
			...data,
		},
	};
};

type EdgeAdditionalData = Record<string, unknown>;

/**
 * Map legacy edge data to enhanced format
 */
export const mapEdgeToEnhanced = (
	id: string,
	source: string,
	target: string,
	animated = false,
	type = "smart",
	additionalData: EdgeAdditionalData = {}
): Edge => ({
	id,
	source,
	target,
	type,
	animated,
	markerEnd: {
		type: MarkerType.ArrowClosed,
	},
	data: {
		strength: 0.7,
		showStrengthIndicator: false,
		...additionalData,
	},
});

type CaseElement = {
	name: string;
	short_description?: string;
	description?: string;
	long_description?: string;
	[key: string]: unknown;
};

type PropertyClaim = CaseElement & {
	evidence?: CaseElement[];
};

type Strategy = CaseElement & {
	property_claims?: PropertyClaim[];
};

type Goal = CaseElement & {
	strategies?: Strategy[];
	context?: CaseElement[];
};

type CaseData = {
	goals?: Goal[];
};

type ConversionResult = {
	nodes: Node<BaseNodeData>[];
	edges: Edge[];
};

/**
 * Convert legacy case data structure to enhanced format
 */
export const convertCaseDataToEnhanced = (
	caseData: CaseData,
	guidedPath: string[] = [],
	useEnhancedEdges = true
): ConversionResult => {
	if (!caseData?.goals || caseData.goals.length === 0) {
		console.warn("Invalid or empty case data provided");
		return { nodes: [], edges: [] };
	}

	const flowNodes: Node<BaseNodeData>[] = [];
	const flowEdges: Edge[] = [];
	let yOffset = 0;
	const xSpacing = 500;
	const ySpacing = 180;

	const goal = caseData.goals[0];

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
			},
			"goal"
		)
	);
	yOffset += ySpacing;

	// Add context nodes
	if (goal.context && Array.isArray(goal.context)) {
		goal.context.forEach((ctx, idx) => {
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
		});
	}

	// Add strategies
	if (goal.strategies && Array.isArray(goal.strategies)) {
		goal.strategies.forEach((strategy, stratIdx) => {
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
					},
					"strategy"
				)
			);

			// Add edge from goal to strategy
			const edgeType = useEnhancedEdges ? "smart" : "smoothstep";
			const isAnimated = guidedPath.includes(strategyId);
			flowEdges.push(
				mapEdgeToEnhanced(
					`goal-${strategyId}`,
					"goal-1",
					strategyId,
					isAnimated,
					edgeType,
					{
						relationshipType: "supports",
					}
				)
			);

			// Add property claims for each strategy
			if (strategy.property_claims && Array.isArray(strategy.property_claims)) {
				strategy.property_claims.forEach((claim, claimIdx) => {
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
							},
							"propertyClaim"
						)
					);

					// Add edge from strategy to claim
					flowEdges.push(
						mapEdgeToEnhanced(
							`${strategyId}-${claimId}`,
							strategyId,
							claimId,
							guidedPath.includes(claimId),
							edgeType,
							{
								relationshipType: "decomposes",
							}
						)
					);

					// Add evidence for claims
					if (claim.evidence && Array.isArray(claim.evidence)) {
						claim.evidence.forEach((evid, evidIdx) => {
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
									},
									"evidence"
								)
							);

							// Add edge from claim to evidence
							flowEdges.push(
								mapEdgeToEnhanced(
									`${claimId}-${evidId}`,
									claimId,
									evidId,
									guidedPath.includes(evidId),
									edgeType,
									{
										relationshipType: "supports",
									}
								)
							);
						});
					}
				});
			}
		});
	}

	return { nodes: flowNodes, edges: flowEdges };
};

/**
 * Apply progressive disclosure to nodes
 */
export const applyProgressiveDisclosure = (
	nodes: Node[],
	revealedNodes: Set<string>,
	guidedPath: string[] = []
): Node[] =>
	nodes.map((node) => ({
		...node,
		hidden: !(revealedNodes.has(node.id) || guidedPath.includes(node.id)),
	}));

/**
 * Get child nodes of a given node
 */
export const getChildNodes = (nodeId: string, edges: Edge[]): string[] =>
	edges.filter((edge) => edge.source === nodeId).map((edge) => edge.target);

/**
 * Get parent nodes of a given node
 */
export const getParentNodes = (nodeId: string, edges: Edge[]): string[] =>
	edges.filter((edge) => edge.target === nodeId).map((edge) => edge.source);

type ConnectedNodes = {
	parents: string[];
	children: string[];
};

/**
 * Get all connected nodes (parents and children)
 */
export const getConnectedNodes = (
	nodeId: string,
	edges: Edge[]
): ConnectedNodes => ({
	parents: getParentNodes(nodeId, edges),
	children: getChildNodes(nodeId, edges),
});

type GraphStats = {
	totalNodes: number;
	totalEdges: number;
	nodeTypeCount: Record<string, number>;
	maxDepth: number;
};

/**
 * Calculate node statistics
 */
export const calculateGraphStats = (
	nodes: Node[],
	edges: Edge[]
): GraphStats => {
	const nodeTypeCount = nodes.reduce((acc: Record<string, number>, node) => {
		const type = node.type || "unknown";
		acc[type] = (acc[type] || 0) + 1;
		return acc;
	}, {});

	return {
		totalNodes: nodes.length,
		totalEdges: edges.length,
		nodeTypeCount,
		maxDepth: calculateMaxDepth(nodes, edges),
	};
};

/**
 * Calculate maximum depth of graph
 */
const calculateMaxDepth = (nodes: Node[], edges: Edge[]): number => {
	// Find root nodes (nodes with no parents)
	const rootNodes = nodes.filter(
		(node) => !edges.some((edge) => edge.target === node.id)
	);

	if (rootNodes.length === 0) {
		return 0;
	}

	let maxDepth = 0;

	const calculateDepth = (nodeId: string, currentDepth: number): void => {
		const children = getChildNodes(nodeId, edges);
		if (children.length === 0) {
			maxDepth = Math.max(maxDepth, currentDepth);
		} else {
			for (const childId of children) {
				calculateDepth(childId, currentDepth + 1);
			}
		}
	};

	for (const rootNode of rootNodes) {
		calculateDepth(rootNode.id, 1);
	}

	return maxDepth;
};

type ValidationResult = {
	isValid: boolean;
	errors: string[];
};

/**
 * Validate node data structure
 */
export const validateNodeData = (node: Node): ValidationResult => {
	const errors: string[] = [];

	if (!node.id) {
		errors.push("Node must have an id");
	}

	if (!node.type) {
		errors.push("Node must have a type");
	}

	if (
		!node.position ||
		typeof node.position.x !== "number" ||
		typeof node.position.y !== "number"
	) {
		errors.push("Node must have valid position {x, y}");
	}

	if (node.data) {
		if (!(node.data as BaseNodeData).name) {
			errors.push("Node data must have a name");
		}
	} else {
		errors.push("Node must have data object");
	}

	return {
		isValid: errors.length === 0,
		errors,
	};
};

/**
 * Validate edge data structure
 */
export const validateEdgeData = (edge: Edge): ValidationResult => {
	const errors: string[] = [];

	if (!edge.id) {
		errors.push("Edge must have an id");
	}

	if (!edge.source) {
		errors.push("Edge must have a source");
	}

	if (!edge.target) {
		errors.push("Edge must have a target");
	}

	return {
		isValid: errors.length === 0,
		errors,
	};
};

type GraphValidationResult = {
	isValid: boolean;
	errors: string[];
	warnings: string[];
};

/**
 * Validate edges and check node existence
 */
const validateEdgesWithNodes = (edges: Edge[], nodes: Node[]): string[] => {
	const errors: string[] = [];

	for (const edge of edges) {
		const validation = validateEdgeData(edge);
		if (!validation.isValid) {
			errors.push(...validation.errors.map((err) => `Edge ${edge.id}: ${err}`));
		}

		const sourceExists = nodes.some((n) => n.id === edge.source);
		const targetExists = nodes.some((n) => n.id === edge.target);

		if (!sourceExists) {
			errors.push(`Edge ${edge.id}: Source node ${edge.source} does not exist`);
		}

		if (!targetExists) {
			errors.push(`Edge ${edge.id}: Target node ${edge.target} does not exist`);
		}
	}

	return errors;
};

/**
 * Check for orphaned nodes (no connections)
 */
const findOrphanedNodes = (nodes: Node[], edges: Edge[]): string[] => {
	const warnings: string[] = [];

	for (const node of nodes) {
		const hasConnection =
			edges.some((e) => e.source === node.id) ||
			edges.some((e) => e.target === node.id);
		if (!hasConnection && node.type !== "goal") {
			warnings.push(`Node ${node.id} has no connections`);
		}
	}

	return warnings;
};

/**
 * Validate entire graph structure
 */
export const validateGraphData = (
	nodes: Node[],
	edges: Edge[]
): GraphValidationResult => {
	const errors: string[] = [];
	const warnings: string[] = [];

	// Validate all nodes
	for (const node of nodes) {
		const validation = validateNodeData(node);
		if (!validation.isValid) {
			errors.push(...validation.errors.map((err) => `Node ${node.id}: ${err}`));
		}
	}

	// Validate all edges and check node existence
	errors.push(...validateEdgesWithNodes(edges, nodes));

	// Check for orphaned nodes
	warnings.push(...findOrphanedNodes(nodes, edges));

	// Check for circular dependencies
	const hasCycle = detectCycle(nodes, edges);
	if (hasCycle) {
		warnings.push("Graph contains circular dependencies");
	}

	return {
		isValid: errors.length === 0,
		errors,
		warnings,
	};
};

/**
 * Detect if graph has cycles
 */
const detectCycle = (nodes: Node[], edges: Edge[]): boolean => {
	const visited = new Set<string>();
	const recursionStack = new Set<string>();

	const hasCycleDFS = (nodeId: string): boolean => {
		visited.add(nodeId);
		recursionStack.add(nodeId);

		const children = getChildNodes(nodeId, edges);
		for (const childId of children) {
			if (!visited.has(childId)) {
				if (hasCycleDFS(childId)) {
					return true;
				}
			} else if (recursionStack.has(childId)) {
				return true;
			}
		}

		recursionStack.delete(nodeId);
		return false;
	};

	for (const node of nodes) {
		if (!visited.has(node.id) && hasCycleDFS(node.id)) {
			return true;
		}
	}

	return false;
};

type ExportData = {
	version: string;
	metadata: {
		exportDate: string;
		[key: string]: unknown;
	};
	nodes: Node[];
	edges: Edge[];
	stats: GraphStats;
};

/**
 * Export graph data to JSON
 */
export const exportGraphToJSON = (
	nodes: Node[],
	edges: Edge[],
	metadata: Record<string, unknown> = {}
): string =>
	JSON.stringify(
		{
			version: "1.0",
			metadata: {
				exportDate: new Date().toISOString(),
				...metadata,
			},
			nodes,
			edges,
			stats: calculateGraphStats(nodes, edges),
		} as ExportData,
		null,
		2
	);

type ImportResult = {
	nodes: Node[];
	edges: Edge[];
	metadata: Record<string, unknown>;
	error?: string;
};

/**
 * Import graph data from JSON
 */
export const importGraphFromJSON = (jsonString: string): ImportResult => {
	try {
		const data = JSON.parse(jsonString) as ExportData;
		return {
			nodes: data.nodes || [],
			edges: data.edges || [],
			metadata: data.metadata || {},
		};
	} catch (error) {
		console.error("Error importing graph data:", error);
		return {
			nodes: [],
			edges: [],
			metadata: {},
			error: (error as Error).message,
		};
	}
};

// Default export with all utilities
export default {
	mapNodeToEnhanced,
	mapEdgeToEnhanced,
	convertCaseDataToEnhanced,
	applyProgressiveDisclosure,
	getChildNodes,
	getParentNodes,
	getConnectedNodes,
	calculateGraphStats,
	validateNodeData,
	validateEdgeData,
	validateGraphData,
	exportGraphToJSON,
	importGraphFromJSON,
};
