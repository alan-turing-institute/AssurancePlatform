/**
 * Node-kind renderer map (ADR 0005 D5): pairs `lib/case/node-type-resolver.ts`'s
 * element-type -> React Flow node type lookup with the house-style
 * component for each kind, replacing `flow.tsx`'s previous hard-coded
 * four-entry `nodeTypes` map. A defeater is a decoration on its existing
 * card (ADR 0005 D2), not a separate kind, so it has no entry of its own.
 */

import type { ComponentType } from "react";
import type { NodeProps } from "reactflow";
import AwayGoalNode from "./away-goal-node";
import EvidenceNode from "./evidence-node";
import GoalNode from "./goal-node";
import ModuleNode from "./module-node";
import PropertyNode from "./property-node";
import StrategyNode from "./strategy-node";

/**
 * The full React Flow `nodeTypes` map, for `<ReactFlow nodeTypes={...}>`.
 * Keyed by exactly the strings `lib/case/node-type-resolver.ts`'s
 * `resolveReactFlowNodeType` returns, so `convert-case.ts` and this map
 * read from the one shared lookup and can't drift apart.
 */
export const nodeTypes: Record<string, ComponentType<NodeProps>> = {
	goal: GoalNode,
	strategy: StrategyNode,
	property: PropertyNode,
	evidence: EvidenceNode,
	awayGoal: AwayGoalNode,
	module: ModuleNode,
};
