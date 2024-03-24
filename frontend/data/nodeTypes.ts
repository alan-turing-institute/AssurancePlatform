import ContextNode from "@/components/cases/ContextNode";
import EvidenceNode from "@/components/cases/EvidenceNode";
import GoalNode from "@/components/cases/GoalNode";
import PropertyNode from "@/components/cases/PropertyNode";
import StrategyNode from "@/components/cases/StrategyNode";

export const nodeTypes = {
  goal: GoalNode,
  property: PropertyNode,
  strategy: StrategyNode,
  evidence: EvidenceNode,
  context: ContextNode
};