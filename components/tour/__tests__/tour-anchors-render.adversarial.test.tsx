import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import type { NodeProps } from "reactflow";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	resetTourControls,
	useTourControls,
} from "@/lib/tours/tour-controls.ts";
import { renderWithReactFlow } from "@/src/__tests__/utils/test-utils.tsx";

const pathnameRef = { current: "/dashboard" };

vi.mock("next/navigation", async () => {
	const actual =
		await vi.importActual<typeof import("next/navigation")>("next/navigation");
	return {
		...actual,
		usePathname: () => pathnameRef.current,
		useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
	};
});

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
		Handle: ({ type, position }: { position: string; type: string }) =>
			ReactLib.createElement("div", {
				"data-testid": `handle-${type}-${position}`,
			}),
		Position: { Top: "top", Right: "right", Bottom: "bottom", Left: "left" },
	};
});

const { default: CaseCard } = await import("@/components/cases/case-card.tsx");
const { default: GoalNode } = await import("@/components/cases/goal-node.tsx");
const { Navbar } = await import("@/components/navigation/navbar.tsx");

function goalProps(data: Record<string, unknown>): NodeProps {
	return {
		id: "goal-1",
		data,
		type: "goal",
		selected: false,
		zIndex: 0,
		isConnectable: true,
		xPos: 0,
		yPos: 0,
		dragging: false,
	} as NodeProps;
}

describe("tour anchors (adversarial)", () => {
	beforeEach(() => {
		resetTourControls();
		pathnameRef.current = "/dashboard";
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) }))
		);
	});

	it("marks the demo case card as the tutorial case and no other card", () => {
		const { container, rerender } = render(
			<CaseCard assuranceCase={{ id: 1, name: "Demo", isDemo: true }} />
		);
		expect(
			container.querySelectorAll("[data-tour='tutorial-case']")
		).toHaveLength(1);
		rerender(
			<CaseCard assuranceCase={{ id: 2, name: "Mine", isDemo: false }} />
		);
		expect(container.querySelector("[data-tour]")).toBeNull();
		rerender(<CaseCard assuranceCase={{ id: 3, name: "Plain" }} />);
		expect(container.querySelector("[data-tour]")).toBeNull();
	});

	it("marks a root goal as top-goal", () => {
		const { container } = renderWithReactFlow(
			<GoalNode {...goalProps({ id: "e1", name: "G1", isDemo: false })} />
		);
		expect(container.querySelector("[data-tour='top-goal']")).not.toBeNull();
		expect(container.querySelector("[data-tour='demo-goal']")).toBeNull();
	});

	it("marks a demo root goal as demo-goal rather than top-goal", () => {
		const { container } = renderWithReactFlow(
			<GoalNode {...goalProps({ id: "e1", name: "G1", isDemo: true })} />
		);
		expect(container.querySelector("[data-tour='demo-goal']")).not.toBeNull();
		expect(container.querySelector("[data-tour='top-goal']")).toBeNull();
	});

	it("does not mark a goal that has a parent", () => {
		const { container } = renderWithReactFlow(
			<GoalNode
				{...goalProps({ id: "e2", name: "G2", isDemo: false, parentId: 7 })}
			/>
		);
		expect(container.querySelector("[data-tour]")).toBeNull();
	});

	it("shows 'Take the tour' on /dashboard and starts the dashboard tour", async () => {
		const startTour = vi.fn();
		useTourControls.setState({ startTour });
		render(
			<Navbar teams={[]}>
				<div />
			</Navbar>
		);
		await userEvent.click(
			screen.getByRole("button", { name: "Take the tour" })
		);
		expect(startTour).toHaveBeenCalledWith("dashboard");
	});

	it.each([
		"/dashboard/teams/abc",
		"/case/12",
		"/dashboard/shared",
	])("does not show 'Take the tour' on %s", (path) => {
		pathnameRef.current = path;
		render(
			<Navbar teams={[]}>
				<div />
			</Navbar>
		);
		expect(screen.queryByRole("button", { name: "Take the tour" })).toBeNull();
	});
});
