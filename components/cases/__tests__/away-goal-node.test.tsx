import type React from "react";
import type { NodeProps } from "reactflow";
import { describe, expect, it, vi } from "vitest";
import { renderWithReactFlow, screen } from "@/src/__tests__/utils/test-utils";
import AwayGoalNode from "../away-goal-node";

// The repo-wide reactflow mock (src/__tests__/setup/component-mocks.tsx)
// doesn't stub `useNodes`/`useEdges`, which NodeOptionsMenu (always mounted
// inside NodeActionGroup) calls directly — extend it locally with those,
// alongside everything BaseNode itself needs (Handle, Position,
// useReactFlow, ReactFlowProvider).
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

const VIEW_CITED_CASE_LINK_PATTERN = /View cited case/;

function nodeProps(data: Record<string, unknown>): NodeProps {
	return {
		id: "away-goal-1",
		data,
		type: "awayGoal",
		selected: false,
		zIndex: 0,
		isConnectable: true,
		xPos: 0,
		yPos: 0,
		dragging: false,
	} as NodeProps;
}

describe("AwayGoalNode (ADR 0005 D3)", () => {
	it("shows the cited case and goal names, and links to the cited case, when resolved and accessible", () => {
		renderWithReactFlow(
			<AwayGoalNode
				{...nodeProps({
					id: "el-1",
					name: "AG1",
					description: "An away goal",
					citedCaseName: "Cited Case",
					citedElementName: "G3",
					citedCaseAccessible: true,
					moduleReferenceId: "case-2",
					citedElementId: "goal-3",
				})}
			/>
		);

		expect(screen.getByText("Cited Case — G3")).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: VIEW_CITED_CASE_LINK_PATTERN })
		).toHaveAttribute("href", "/case/case-2");
	});

	it("hides the link when the viewer cannot access the cited case", () => {
		renderWithReactFlow(
			<AwayGoalNode
				{...nodeProps({
					id: "el-1",
					name: "AG1",
					description: "An away goal",
					citedCaseName: "Cited Case",
					citedElementName: "G3",
					citedCaseAccessible: false,
					moduleReferenceId: "case-2",
					citedElementId: "goal-3",
				})}
			/>
		);

		expect(screen.getByText("Cited Case — G3")).toBeInTheDocument();
		expect(
			screen.queryByRole("link", { name: VIEW_CITED_CASE_LINK_PATTERN })
		).not.toBeInTheDocument();
	});

	it("says the cited element is unresolved when citedElementId is null (dangling citation)", () => {
		renderWithReactFlow(
			<AwayGoalNode
				{...nodeProps({
					id: "el-1",
					name: "AG1",
					description: "An away goal",
					citedCaseName: "Cited Case",
					citedElementName: null,
					citedCaseAccessible: true,
					moduleReferenceId: "case-2",
					citedElementId: null,
					citationDangling: true,
				})}
			/>
		);

		expect(screen.getByText("Cited element not resolved")).toBeInTheDocument();
		expect(screen.queryByText("Cited Case — G3")).not.toBeInTheDocument();
	});

	it("shows 'Cited case not available' and no link when moduleReferenceDangling is set, even though citedElementId is also null (Chris's ruling, 2026-09-16)", () => {
		renderWithReactFlow(
			<AwayGoalNode
				{...nodeProps({
					id: "el-1",
					name: "AG1",
					description: "An away goal",
					citedCaseName: null,
					citedElementName: null,
					citedCaseAccessible: false,
					moduleReferenceId: null,
					citedElementId: null,
					citationDangling: true,
					moduleReferenceDangling: true,
				})}
			/>
		);

		expect(screen.getByText("Cited case not available")).toBeInTheDocument();
		expect(
			screen.queryByText("Cited element not resolved")
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("link", { name: VIEW_CITED_CASE_LINK_PATTERN })
		).not.toBeInTheDocument();
	});
});
