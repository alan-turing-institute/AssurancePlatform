import type React from "react";
import type { NodeProps } from "reactflow";
import { describe, expect, it, vi } from "vitest";
import { renderWithReactFlow, screen } from "@/src/__tests__/utils/test-utils";
import EvidenceNode from "../evidence-node";

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

function nodeProps(data: Record<string, unknown>): NodeProps {
	return {
		id: "evidence-1",
		data,
		type: "evidence",
		selected: false,
		zIndex: 0,
		isConnectable: true,
		xPos: 0,
		yPos: 0,
		dragging: false,
	} as NodeProps;
}

const WINDOW = {
	id: "k3f9x2m7qa",
	name: "window",
	text: "the moving interval",
	definedOn: { elementId: "g1", elementName: "G1" },
};

describe("EvidenceNode", () => {
	it("resolves a reference with the terms in reach and highlights it", () => {
		const { container } = renderWithReactFlow(
			<EvidenceNode
				{...nodeProps({
					id: "el-1",
					name: "E1",
					description: "Measured over the {win#k3f9x2m7qa}",
					termsInReach: [WINDOW],
				})}
			/>
		);

		const word = container.querySelector("[data-reference-id]");
		expect(word).toHaveTextContent("window");
		expect(word).toHaveAttribute("data-reference-state", "found");
	});

	it("shows a variable's value, and [name] while it has none", () => {
		const system = { ...WINDOW, name: "system", variable: true as const };
		const { container, rerender } = renderWithReactFlow(
			<EvidenceNode
				{...nodeProps({
					id: "el-1",
					name: "E1",
					description: "Tested on {system#k3f9x2m7qa}",
					termsInReach: [{ ...system, value: "AcmeBot" }],
				})}
			/>
		);
		expect(screen.getByText("AcmeBot")).toBeInTheDocument();

		rerender(
			<EvidenceNode
				{...nodeProps({
					id: "el-1",
					name: "E1",
					description: "Tested on {system#k3f9x2m7qa}",
					termsInReach: [system],
				})}
			/>
		);
		expect(
			container.querySelector("[data-reference-unfilled]")
		).toHaveTextContent("[system]");
	});
});
