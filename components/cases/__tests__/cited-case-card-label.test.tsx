import type React from "react";
import type { NodeProps } from "reactflow";
import { describe, expect, it, vi } from "vitest";
import { renderWithReactFlow, screen } from "@/src/__tests__/utils/test-utils";
import AwayGoalNode from "../away-goal-node";
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

const STALE_CASE = "StaleCaseName-9f3a21";
const STALE_ELEMENT = "StaleElement-7c1b44";
const UNAVAILABLE = "Cited case not available";
const ELEMENT_UNRESOLVED = "Cited element not resolved";
const ANY_LINK = /View (cited|referenced) case/;
const UNKNOWN_CASE = /Unknown case/;

function props(type: string, data: Record<string, unknown>): NodeProps {
	return {
		id: `${type}-1`,
		data: { id: "el-1", name: "X1", description: "A card", ...data },
		type,
		selected: false,
		zIndex: 0,
		isConnectable: true,
		xPos: 0,
		yPos: 0,
		dragging: false,
	} as NodeProps;
}

function awayGoal(data: Record<string, unknown>) {
	return <AwayGoalNode {...props("awayGoal", data)} />;
}

function moduleCard(data: Record<string, unknown>) {
	return <ModuleNode {...props("module", data)} />;
}

/** The data the cards get, with stale names left in it, for each way the viewer can lack access. */
const STALE_AWAY_GOAL = {
	citedCaseName: STALE_CASE,
	citedElementName: STALE_ELEMENT,
	moduleReferenceId: "case-2",
	citedElementId: "goal-3",
};
const STALE_MODULE = {
	moduleCaseName: STALE_CASE,
	moduleReferenceId: "case-2",
};

describe("an away goal card the viewer cannot open the cited case of", () => {
	it.each([
		["the flag is false", { citedCaseAccessible: false }],
		["the flag is missing", {}],
		["the flag is null", { citedCaseAccessible: null }],
	])("says the case is not available and shows no stale name when %s", (_how, flag) => {
		const { container } = renderWithReactFlow(
			awayGoal({ ...STALE_AWAY_GOAL, ...flag })
		);

		expect(screen.getByText(UNAVAILABLE)).toBeInTheDocument();
		expect(container.innerHTML).not.toContain(STALE_CASE);
		expect(container.innerHTML).not.toContain(STALE_ELEMENT);
		expect(document.body.innerHTML).not.toContain(STALE_CASE);
		expect(document.body.innerHTML).not.toContain(STALE_ELEMENT);
		expect(screen.queryByText(UNKNOWN_CASE)).not.toBeInTheDocument();
		expect(screen.queryByRole("link", { name: ANY_LINK })).toBeNull();
	});

	it("says the case is not available, not that the element is unresolved, when the citation is also dangling", () => {
		const { container } = renderWithReactFlow(
			awayGoal({
				...STALE_AWAY_GOAL,
				citedCaseAccessible: false,
				citedElementId: null,
				citationDangling: true,
			})
		);

		expect(screen.getByText(UNAVAILABLE)).toBeInTheDocument();
		expect(screen.queryByText(ELEMENT_UNRESOLVED)).not.toBeInTheDocument();
		expect(container.innerHTML).not.toContain(STALE_CASE);
	});

	it("says the case is not available when the reference is gone altogether", () => {
		renderWithReactFlow(
			awayGoal({
				citedCaseName: null,
				citedElementName: null,
				citedCaseAccessible: false,
				moduleReferenceId: null,
				citedElementId: null,
			})
		);

		expect(screen.getByText(UNAVAILABLE)).toBeInTheDocument();
		expect(screen.queryByText(UNKNOWN_CASE)).not.toBeInTheDocument();
	});

	it("says the case is not available when the reference was cleared and marked dangling", () => {
		const { container } = renderWithReactFlow(
			awayGoal({
				...STALE_AWAY_GOAL,
				citedCaseAccessible: false,
				moduleReferenceDangling: true,
				moduleReferenceId: null,
			})
		);

		expect(screen.getByText(UNAVAILABLE)).toBeInTheDocument();
		expect(container.innerHTML).not.toContain(STALE_CASE);
	});

	it("drops the name when the same card is drawn again without access", () => {
		const { container, rerender } = renderWithReactFlow(
			awayGoal({ ...STALE_AWAY_GOAL, citedCaseAccessible: true })
		);
		expect(container.innerHTML).toContain(STALE_CASE);

		rerender(awayGoal({ ...STALE_AWAY_GOAL, citedCaseAccessible: false }));

		expect(container.innerHTML).not.toContain(STALE_CASE);
		expect(container.innerHTML).not.toContain(STALE_ELEMENT);
		expect(screen.getByText(UNAVAILABLE)).toBeInTheDocument();
		expect(screen.queryByRole("link", { name: ANY_LINK })).toBeNull();
	});
});

describe("an away goal card the viewer can open the cited case of", () => {
	it("shows the case name, the element name and a working link", () => {
		renderWithReactFlow(
			awayGoal({ ...STALE_AWAY_GOAL, citedCaseAccessible: true })
		);

		expect(
			screen.getByText(`${STALE_CASE} — ${STALE_ELEMENT}`)
		).toBeInTheDocument();
		expect(screen.getByRole("link", { name: ANY_LINK })).toHaveAttribute(
			"href",
			"/case/case-2"
		);
		expect(screen.queryByText(UNAVAILABLE)).not.toBeInTheDocument();
	});

	it("says the element is unresolved when there is none, and does not call the case unavailable", () => {
		renderWithReactFlow(
			awayGoal({
				...STALE_AWAY_GOAL,
				citedCaseAccessible: true,
				citedElementId: null,
				citedElementName: null,
				citationDangling: true,
			})
		);

		expect(screen.getByText(ELEMENT_UNRESOLVED)).toBeInTheDocument();
		expect(screen.queryByText(UNAVAILABLE)).not.toBeInTheDocument();
		expect(screen.getByRole("link", { name: ANY_LINK })).toBeInTheDocument();
	});

	it("shows the case name alone when the element has no name", () => {
		renderWithReactFlow(
			awayGoal({
				...STALE_AWAY_GOAL,
				citedCaseAccessible: true,
				citedElementName: null,
			})
		);

		expect(screen.getByText(STALE_CASE)).toBeInTheDocument();
		expect(screen.queryByText(UNAVAILABLE)).not.toBeInTheDocument();
	});
});

describe("a module card the viewer cannot open the referenced case of", () => {
	it.each([
		["the flag is false", { moduleCaseAccessible: false }],
		["the flag is missing", {}],
		["the flag is null", { moduleCaseAccessible: null }],
	])("says the case is not available and shows no stale name when %s", (_how, flag) => {
		const { container } = renderWithReactFlow(
			moduleCard({ ...STALE_MODULE, ...flag })
		);

		expect(screen.getByText(UNAVAILABLE)).toBeInTheDocument();
		expect(container.innerHTML).not.toContain(STALE_CASE);
		expect(document.body.innerHTML).not.toContain(STALE_CASE);
		expect(screen.queryByText(UNKNOWN_CASE)).not.toBeInTheDocument();
		expect(screen.queryByRole("link", { name: ANY_LINK })).toBeNull();
	});

	it("says the case is not available when the reference is gone altogether", () => {
		renderWithReactFlow(
			moduleCard({
				moduleCaseName: null,
				moduleCaseAccessible: false,
				moduleReferenceId: null,
			})
		);

		expect(screen.getByText(UNAVAILABLE)).toBeInTheDocument();
		expect(screen.queryByText(UNKNOWN_CASE)).not.toBeInTheDocument();
	});

	it("says the case is not available when the reference was cleared and marked dangling", () => {
		const { container } = renderWithReactFlow(
			moduleCard({
				...STALE_MODULE,
				moduleCaseAccessible: false,
				moduleReferenceDangling: true,
				moduleReferenceId: null,
			})
		);

		expect(screen.getByText(UNAVAILABLE)).toBeInTheDocument();
		expect(container.innerHTML).not.toContain(STALE_CASE);
	});

	it("drops the name when the same card is drawn again without access", () => {
		const { container, rerender } = renderWithReactFlow(
			moduleCard({ ...STALE_MODULE, moduleCaseAccessible: true })
		);
		expect(container.innerHTML).toContain(STALE_CASE);

		rerender(moduleCard({ ...STALE_MODULE, moduleCaseAccessible: false }));

		expect(container.innerHTML).not.toContain(STALE_CASE);
		expect(screen.getByText(UNAVAILABLE)).toBeInTheDocument();
		expect(screen.queryByRole("link", { name: ANY_LINK })).toBeNull();
	});
});

describe("a module card the viewer can open the referenced case of", () => {
	it("shows the case name and a working link", () => {
		renderWithReactFlow(
			moduleCard({ ...STALE_MODULE, moduleCaseAccessible: true })
		);

		expect(screen.getByText(STALE_CASE)).toBeInTheDocument();
		expect(screen.getByRole("link", { name: ANY_LINK })).toHaveAttribute(
			"href",
			"/case/case-2"
		);
		expect(screen.queryByText(UNAVAILABLE)).not.toBeInTheDocument();
	});
});
