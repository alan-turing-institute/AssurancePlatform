import type React from "react";
import type { NodeProps } from "reactflow";
import { describe, expect, it, vi } from "vitest";
import { renderWithReactFlow, screen } from "@/src/__tests__/utils/test-utils";
import AwayGoalNode from "../away-goal-node";
import EvidenceNode from "../evidence-node";
import GoalNode from "../goal-node";
import ModuleNode from "../module-node";
import PropertyNode from "../property-node";
import StrategyNode from "../strategy-node";

// See away-goal-node.test.tsx for why this local mock is needed.
vi.mock("reactflow", () => {
	const ReactLib: typeof React = require("react");
	return {
		ReactFlowProvider: ({ children }: { children: React.ReactNode }) =>
			children,
		useNodes: () => [],
		useEdges: () => [],
		useReactFlow: () => ({
			fitView: vi.fn(),
			getNodes: vi.fn(() => []),
			getEdges: vi.fn(() => []),
		}),
		Handle: ({ id }: { id?: string }) =>
			ReactLib.createElement("div", { "data-id": id }),
		Position: { Top: "top", Right: "right", Bottom: "bottom", Left: "left" },
	};
});

function nodeProps(type: string, data: Record<string, unknown>): NodeProps {
	return {
		id: "node-1",
		data,
		type,
		selected: false,
		zIndex: 0,
		isConnectable: true,
		xPos: 0,
		yPos: 0,
		dragging: false,
	} as NodeProps;
}

const NODES: [string, React.ComponentType<NodeProps>, string][] = [
	["goal", GoalNode, "goal"],
	["strategy", StrategyNode, "strategy"],
	["property claim", PropertyNode, "property"],
	["evidence", EvidenceNode, "evidence"],
	["away goal", AwayGoalNode, "awayGoal"],
	["module", ModuleNode, "module"],
];

describe("comment count on each kind of node", () => {
	it.each(NODES)("shows the count on a %s node", (_label, Node, type) => {
		renderWithReactFlow(
			<Node
				{...nodeProps(type, {
					id: "el-1",
					name: "N1",
					description: "An element",
					commentCount: 4,
				})}
			/>
		);

		expect(
			screen.getByRole("button", { name: "View comments (4)" })
		).toBeInTheDocument();
	});
});
