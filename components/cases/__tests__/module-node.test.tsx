import type React from "react";
import type { NodeProps } from "reactflow";
import { describe, expect, it, vi } from "vitest";
import { renderWithReactFlow, screen } from "@/src/__tests__/utils/test-utils";
import ModuleNode from "../module-node";

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

const VIEW_REFERENCED_CASE_LINK_PATTERN = /View referenced case/;

function nodeProps(data: Record<string, unknown>): NodeProps {
	return {
		id: "module-1",
		data,
		type: "module",
		selected: false,
		zIndex: 0,
		isConnectable: true,
		xPos: 0,
		yPos: 0,
		dragging: false,
	} as NodeProps;
}

describe("ModuleNode (ADR 0005 D3)", () => {
	it("shows the referenced case's name and links to it when accessible", () => {
		renderWithReactFlow(
			<ModuleNode
				{...nodeProps({
					id: "el-1",
					name: "M1",
					description: "A module",
					moduleCaseName: "Referenced Case",
					moduleCaseAccessible: true,
					moduleReferenceId: "case-2",
				})}
			/>
		);

		expect(screen.getByText("Referenced Case")).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: VIEW_REFERENCED_CASE_LINK_PATTERN })
		).toHaveAttribute("href", "/case/case-2");
	});

	it("hides the link when the viewer cannot access the referenced case", () => {
		renderWithReactFlow(
			<ModuleNode
				{...nodeProps({
					id: "el-1",
					name: "M1",
					description: "A module",
					moduleCaseName: "Referenced Case",
					moduleCaseAccessible: false,
					moduleReferenceId: "case-2",
				})}
			/>
		);

		expect(screen.getByText("Referenced Case")).toBeInTheDocument();
		expect(
			screen.queryByRole("link", { name: VIEW_REFERENCED_CASE_LINK_PATTERN })
		).not.toBeInTheDocument();
	});

	it("falls back to 'Unknown case' when the referenced case name didn't resolve", () => {
		renderWithReactFlow(
			<ModuleNode
				{...nodeProps({
					id: "el-1",
					name: "M1",
					description: "A module",
					moduleCaseName: null,
					moduleCaseAccessible: false,
					moduleReferenceId: "case-2",
				})}
			/>
		);

		expect(screen.getByText("Unknown case")).toBeInTheDocument();
	});
});
