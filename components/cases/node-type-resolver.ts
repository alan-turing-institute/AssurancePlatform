/**
 * Node-kind renderer map (ADR 0005 D5): pairs `lib/case/node-type-resolver.ts`'s
 * element-type -> React Flow node type lookup with the house-style
 * component for each kind, replacing `flow.tsx`'s previous hard-coded
 * four-entry `nodeTypes` map. A defeater is a decoration on its existing
 * card (ADR 0005 D2), not a separate kind, so it has no entry of its own.
 */

import type { ComponentType } from "react";
import type { NodeProps } from "reactflow";
import {
	type NodeResolutionFlags,
	resolveReactFlowNodeType,
} from "@/lib/case/node-type-resolver";
import AwayGoalNode from "./away-goal-node";
import EvidenceNode from "./evidence-node";
import GoalNode from "./goal-node";
import ModuleNode from "./module-node";
import PropertyNode from "./property-node";
import StrategyNode from "./strategy-node";

const RENDERERS: Record<string, ComponentType<NodeProps>> = {
	goal: GoalNode,
	strategy: StrategyNode,
	property: PropertyNode,
	evidence: EvidenceNode,
	awayGoal: AwayGoalNode,
	module: ModuleNode,
};

/** Resolves the React Flow node component for an element type. */
export function resolveNodeRenderer(
	elementType: string,
	flags: NodeResolutionFlags = {}
): ComponentType<NodeProps> {
	return (
		RENDERERS[resolveReactFlowNodeType(elementType, flags)] ?? PropertyNode
	);
}

/**
 * The full React Flow `nodeTypes` map, for `<ReactFlow nodeTypes={...}>` —
 * built from the same registry `resolveNodeRenderer` reads, so the two can
 * never drift.
 */
export const nodeTypes: Record<string, ComponentType<NodeProps>> = {
	...RENDERERS,
};
