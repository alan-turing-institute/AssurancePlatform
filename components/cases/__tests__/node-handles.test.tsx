import type React from "react";
import type { NodeProps } from "reactflow";
import { describe, expect, it, vi } from "vitest";
import { renderWithReactFlow } from "@/src/__tests__/utils/test-utils";
import PropertyNode from "../property-node";

// See away-goal-node.test.tsx for why this local mock is needed. Its Handle
// also reports the two props under test.
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
			className,
			id,
			isConnectable,
		}: {
			className?: string;
			id?: string;
			isConnectable?: boolean;
		}) =>
			ReactLib.createElement("div", {
				className,
				"data-connectable": String(isConnectable ?? true),
				"data-handle": id,
			}),
		Position: { Top: "top", Right: "right", Bottom: "bottom", Left: "left" },
	};
});

const PROPS = {
	id: "property-p1",
	data: { id: "p1", name: "P1", description: "A claim" },
	type: "property",
	selected: false,
	zIndex: 0,
	isConnectable: true,
	xPos: 0,
	yPos: 0,
	dragging: false,
} as NodeProps;

describe("a node's connection handles", () => {
	it("are all drawn invisible, ignore the pointer and refuse connections", () => {
		const { container } = renderWithReactFlow(<PropertyNode {...PROPS} />);

		const handles = [...container.querySelectorAll("[data-handle]")];

		expect(handles.map((handle) => handle.getAttribute("data-handle"))).toEqual(
			["target", "side-target", "side-source", "c"]
		);
		for (const handle of handles) {
			expect(handle).toHaveClass("opacity-0", "pointer-events-none");
			expect(handle).toHaveAttribute("data-connectable", "false");
		}
	});
});
