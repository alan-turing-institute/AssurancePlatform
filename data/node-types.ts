import ContextNode from "@/components/cases/context-node";
import EvidenceNode from "@/components/cases/evidence-node";
import GoalNode from "@/components/cases/goal-node";
import PropertyNode from "@/components/cases/property-node";
import StrategyNode from "@/components/cases/strategy-node";

export const nodeTypes = {
	goal: GoalNode,
	property: PropertyNode,
	strategy: StrategyNode,
	evidence: EvidenceNode,
	context: ContextNode,
};
