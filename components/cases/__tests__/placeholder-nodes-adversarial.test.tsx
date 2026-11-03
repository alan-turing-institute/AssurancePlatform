import type React from "react";
import type { ComponentType } from "react";
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
		Handle: ({
			type,
			position,
			id,
		}: {
			id?: string;
			position: string;
			type: string;
		}) =>
			ReactLib.createElement("div", {
				"data-testid": `handle-${type}-${position}`,
				"data-id": id,
			}),
		Position: { Top: "top", Right: "right", Bottom: "bottom", Left: "left" },
	};
});

const HINT = "Say what this element is for";

const NODES: [string, ComponentType<NodeProps>, string][] = [
	["goal", GoalNode, "goal"],
	["strategy", StrategyNode, "strategy"],
	["property claim", PropertyNode, "property"],
	["evidence", EvidenceNode, "evidence"],
	["away goal", AwayGoalNode, "awayGoal"],
	["module", ModuleNode, "module"],
];

function nodeProps(type: string, data: Record<string, unknown>): NodeProps {
	return {
		id: "node-1",
		data: { id: "el-1", name: "X1", description: "", ...data },
		type,
		selected: false,
		zIndex: 0,
		isConnectable: true,
		xPos: 0,
		yPos: 0,
		dragging: false,
	} as NodeProps;
}

describe.each(NODES)("the %s card", (_label, Node, type) => {
	it("carries the To fill in badge and a dashed outline while it is a placeholder", () => {
		const { container } = renderWithReactFlow(
			<Node
				{...nodeProps(type, { isPlaceholder: true, placeholderHint: HINT })}
			/>
		);

		expect(screen.getByText("To fill in")).toBeVisible();
		expect(container.querySelector(".border-dashed")).not.toBeNull();
	});

	it("carries neither once it is not a placeholder", () => {
		const { container } = renderWithReactFlow(
			<Node
				{...nodeProps(type, {
					description: "Already written",
					placeholderHint: HINT,
				})}
			/>
		);

		expect(screen.queryByText("To fill in")).toBeNull();
		expect(container.querySelector(".border-dashed")).toBeNull();
	});

	it("carries one badge, whatever other badges the card shows", () => {
		renderWithReactFlow(
			<Node
				{...nodeProps(type, {
					isPlaceholder: true,
					assertionStatus: "NEEDS_SUPPORT",
				})}
			/>
		);

		expect(screen.getAllByText("To fill in")).toHaveLength(1);
	});
});
