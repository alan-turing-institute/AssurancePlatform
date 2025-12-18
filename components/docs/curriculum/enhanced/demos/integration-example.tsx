"use client";
/**
 * Integration Example
 *
 * Shows how to integrate CollapsibleNode system with existing InteractiveCaseViewer.
 * Provides migration path from current implementation to enhanced collapsible nodes.
 *
 * @component
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

import { CollapsibleNode, NodeStateControls, NodeStateManager } from "../nodes";

type CaseElement = {
	name: string;
	short_description?: string;
	description?: string;
	long_description?: string;
	evidence?: CaseElement[];
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

type NodeDataType = {
	id: string;
	name: string;
	description: string;
	long_description: string;
};

/**
 * Convert existing node data to collapsible node format
 */
const convertToCollapsibleNodes = (caseData: CaseData) => {
	if (!caseData?.goals) {
		return { nodes: [], edges: [] };
	}

	const nodes: Node<NodeDataType>[] = [];
	const edges: Edge[] = [];
	let yOffset = 0;
	const xSpacing = 500;
	const ySpacing = 180;

	// Process goals
	const goal = caseData.goals[0];
	if (goal) {
		nodes.push({
			id: "goal-1",
			type: "collapsible",
			position: { x: 400, y: yOffset },
			data: {
				id: "goal-1",
				name: goal.name,
				description: goal.short_description || goal.description || "",
				long_description: goal.long_description || goal.description || "",
			},
		});
		yOffset += ySpacing;

		// Process strategies
		if (goal.strategies) {
			goal.strategies.forEach((strategy, stratIdx) => {
				const strategyId = `strategy-${stratIdx + 1}`;

				nodes.push({
					id: strategyId,
					type: "collapsible",
					position: { x: 200 + stratIdx * xSpacing, y: yOffset + ySpacing },
					data: {
						id: strategyId,
						name: strategy.name,
						description:
							strategy.short_description || strategy.description || "",
						long_description:
							strategy.long_description || strategy.description || "",
					},
				});

				edges.push({
					id: `goal-${strategyId}`,
					source: "goal-1",
					target: strategyId,
					type: "smoothstep",
					markerEnd: { type: MarkerType.ArrowClosed },
				});

				// Process property claims
				if (strategy.property_claims) {
					strategy.property_claims.forEach((claim, claimIdx) => {
						const claimId = `claim-${stratIdx}-${claimIdx + 1}`;

						nodes.push({
							id: claimId,
							type: "collapsible",
							position: {
								x: 150 + stratIdx * xSpacing + (claimIdx % 2) * 420,
								y: yOffset + ySpacing * 2 + Math.floor(claimIdx / 2) * 150,
							},
							data: {
								id: claimId,
								name: claim.name,
								description: claim.short_description || claim.description || "",
								long_description:
									claim.long_description || claim.description || "",
							},
						});

						edges.push({
							id: `${strategyId}-${claimId}`,
							source: strategyId,
							target: claimId,
							type: "smoothstep",
							markerEnd: { type: MarkerType.ArrowClosed },
						});

						// Process evidence
						if (claim.evidence) {
							claim.evidence.forEach((evid, evidIdx) => {
								const evidId = `evidence-${stratIdx}-${claimIdx}-${evidIdx + 1}`;

								nodes.push({
									id: evidId,
									type: "collapsible",
									position: {
										x: 150 + stratIdx * xSpacing + (claimIdx % 2) * 420,
										y: yOffset + ySpacing * 3 + Math.floor(claimIdx / 2) * 150,
									},
									data: {
										id: evidId,
										name: evid.name,
										description:
											evid.short_description || evid.description || "",
										long_description:
											evid.long_description || evid.description || "",
									},
								});

								edges.push({
									id: `${claimId}-${evidId}`,
									source: claimId,
									target: evidId,
									type: "smoothstep",
									markerEnd: { type: MarkerType.ArrowClosed },
								});
							});
						}
					});
				}
			});
		}

		// Process context
		if (goal.context) {
			goal.context.forEach((ctx, idx) => {
				nodes.push({
					id: `context-${idx + 1}`,
					type: "collapsible",
					position: { x: 100 + idx * 200, y: yOffset },
					data: {
						id: `context-${idx + 1}`,
						name: ctx.name,
						description: ctx.short_description || ctx.description || "",
						long_description: ctx.long_description || ctx.description || "",
					},
				});
			});
		}
	}

	return { nodes, edges };
};

type EnhancedInteractiveCaseViewerProps = {
	caseData: CaseData;
	onNodeClick?: (node: Node) => void;
	persistKey?: string;
	showControls?: boolean;
};

/**
 * Enhanced Interactive Case Viewer with Collapsible Nodes
 */
const EnhancedInteractiveCaseViewer = ({
	caseData,
	onNodeClick,
	persistKey = "enhanced-case-viewer",
	showControls = true,
}: EnhancedInteractiveCaseViewerProps) => {
	// Convert case data to collapsible nodes
	const { nodes, edges } = useMemo(
		() => convertToCollapsibleNodes(caseData),
		[caseData]
	);

	const nodeTypesMap = useMemo(
		() => ({
			collapsible: CollapsibleNode,
		}),
		[]
	);

	const handleNodeClick = useCallback(
		(_event: React.MouseEvent, node: Node) => {
			console.log("Node clicked:", node);
			if (onNodeClick) {
				onNodeClick(node);
			}
		},
		[onNodeClick]
	);

	return (
		<div className="relative h-[600px] w-full overflow-hidden rounded-lg bg-gray-950">
			<ReactFlowProvider>
				<NodeStateManager
					defaultExpanded={false}
					persistKey={persistKey}
					showControls={false}
				>
					{showControls && (
						<div className="absolute top-4 left-4 z-10">
							<NodeStateControls />
						</div>
					)}

					<ReactFlow
						className="bg-gray-950"
						edges={edges}
						fitView
						fitViewOptions={{ padding: 0.2 }}
						maxZoom={2}
						minZoom={0.5}
						nodes={nodes}
						nodeTypes={nodeTypesMap}
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
					</ReactFlow>
				</NodeStateManager>
			</ReactFlowProvider>
		</div>
	);
};

/**
 * Usage Example Component
 */
const IntegrationExample = () => {
	// Sample case data
	const sampleCaseData: CaseData = {
		goals: [
			{
				name: "System Safety",
				short_description: "System operates safely",
				long_description:
					"The system shall operate safely under all normal operating conditions.",
				description:
					"The system shall operate safely under all normal operating conditions.",
				strategies: [
					{
						name: "Decomposition Strategy",
						short_description: "Break down by subsystem",
						long_description:
							"Decompose safety argument into subsystem arguments.",
						description: "Decompose safety argument into subsystem arguments.",
						property_claims: [
							{
								name: "Perception Safety",
								short_description: "Perception is accurate",
								long_description:
									"Perception subsystem provides accurate environmental model.",
								description:
									"Perception subsystem provides accurate environmental model.",
								evidence: [
									{
										name: "Test Results",
										short_description: "99.9% accuracy",
										long_description: "Test report showing 99.9% accuracy.",
										description: "Test report showing 99.9% accuracy.",
									},
								],
							},
						],
					},
				],
				context: [
					{
						name: "Operating Environment",
						short_description: "Urban roads, daylight",
						long_description:
							"System operates on urban roads during daylight hours.",
						description:
							"System operates on urban roads during daylight hours.",
					},
				],
			},
		],
	};

	return (
		<div className="w-full space-y-4 p-4">
			<div>
				<h2 className="mb-2 font-bold text-2xl text-gray-100">
					Integration Example
				</h2>
				<p className="mb-4 text-gray-400">
					Enhanced Interactive Case Viewer with collapsible nodes
				</p>
			</div>

			<EnhancedInteractiveCaseViewer
				caseData={sampleCaseData}
				showControls={true}
			/>

			{/* Code Example */}
			<div className="mt-8 rounded-lg bg-gray-800 p-4">
				<h3 className="mb-2 font-semibold text-gray-100 text-lg">
					Usage Example
				</h3>
				<pre className="overflow-x-auto text-gray-300 text-xs">
					{`import { EnhancedInteractiveCaseViewer } from './components/curriculum/enhanced/demos/integration-example';

// In your component:
<EnhancedInteractiveCaseViewer
  caseData={yourCaseData}
  persistKey="my-case-viewer"
  showControls={true}
  onNodeClick={(node) => console.log('Clicked:', node)}
/>`}
				</pre>
			</div>

			{/* Migration Guide */}
			<div className="mt-4 rounded-lg bg-gray-800 p-4">
				<h3 className="mb-2 font-semibold text-gray-100 text-lg">
					Migration Steps
				</h3>
				<ol className="list-inside list-decimal space-y-2 text-gray-300 text-sm">
					<li>
						Import <code className="text-cyan-400">NodeStateManager</code> and{" "}
						<code className="text-cyan-400">CollapsibleNode</code>
					</li>
					<li>
						Wrap your ReactFlow component with{" "}
						<code className="text-cyan-400">NodeStateManager</code>
					</li>
					<li>
						Change node type to{" "}
						<code className="text-cyan-400">'collapsible'</code>
					</li>
					<li>
						Add <code className="text-cyan-400">nodeType</code> prop to node
						data (goal, strategy, etc.)
					</li>
					<li>
						Optionally add{" "}
						<code className="text-cyan-400">NodeStateControls</code> for bulk
						operations
					</li>
					<li>Test collapsible behaviour and adjust as needed</li>
				</ol>
			</div>
		</div>
	);
};

export { EnhancedInteractiveCaseViewer, IntegrationExample };
export default IntegrationExample;
