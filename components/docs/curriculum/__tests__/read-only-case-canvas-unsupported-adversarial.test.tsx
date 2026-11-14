import { act, render, screen, waitFor } from "@testing-library/react";
import type React from "react";
import type { ComponentType, ReactNode } from "react";
import type { Node, NodeProps } from "reactflow";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useStore from "@/store/store";
import type { CaseExportNested } from "@/types/curriculum";
import ReadOnlyCaseCanvas from "../read-only-case-canvas";

vi.mock("@/hooks/use-plugin-enablement", () => ({
	useEnabledPluginIds: () => ({ enabledPluginIds: new Set(), loading: false }),
}));

/**
 * The shared reactflow mock draws no cards. This one draws every node through
 * the `nodeTypes` it is given, so the real goal, strategy and claim cards are
 * on the page, as they are on a documentation page.
 */
vi.mock("reactflow", async () => {
	const actual = await vi.importActual<typeof import("reactflow")>("reactflow");
	const ReactLib: typeof React = require("react");
	return {
		...actual,
		default: ({
			nodes,
			nodeTypes,
		}: {
			nodes: Node[];
			nodeTypes: Record<string, ComponentType<NodeProps>>;
		}) =>
			ReactLib.createElement(
				"div",
				{ "data-testid": "react-flow" },
				nodes.map((node) => {
					const Card = nodeTypes[node.type as string];
					if (!Card) {
						throw new Error(`no card is drawn for a ${node.type} node`);
					}
					return ReactLib.createElement(
						"div",
						{ key: node.id },
						ReactLib.createElement(Card, {
							id: node.id,
							data: node.data,
							type: node.type,
							selected: false,
							zIndex: 0,
							isConnectable: true,
							xPos: 0,
							yPos: 0,
							dragging: false,
						} as NodeProps)
					);
				})
			),
		ReactFlowProvider: ({ children }: { children: ReactNode }) => children,
		Background: () => null,
		Controls: () => null,
		useReactFlow: () => ({
			fitView: vi.fn(),
			getNodes: vi.fn(() => []),
			getEdges: vi.fn(() => []),
		}),
		useNodes: () => [],
		useEdges: () => [],
		Handle: () => null,
	};
});

const CASE_WITH_GAPS: CaseExportNested = {
	version: "1.0",
	exportedAt: "2025-12-17T10:00:00.000Z",
	case: { name: "Example", description: "A case" },
	tree: {
		id: "g1",
		type: "GOAL",
		name: "G1",
		description: "The goal",
		inSandbox: false,
		children: [
			{
				id: "s1",
				type: "STRATEGY",
				name: "S1",
				description: "An empty strategy",
				inSandbox: false,
				children: [],
			},
			{
				id: "p1",
				type: "PROPERTY_CLAIM",
				name: "P1",
				description: "An empty claim",
				inSandbox: false,
				level: 1,
				children: [],
			},
		],
	},
};

beforeEach(() => {
	// A card re-lays the diagram out when its animation ends, from the nodes
	// the stand-in canvas reports (none); this keeps that from emptying the store.
	useStore.setState({ layoutNodes: vi.fn(async () => undefined) });
});

afterEach(() => {
	useStore.getState().setAssuranceCase(null);
	useStore.getState().setNodes([]);
	useStore.getState().setEdges([]);
	useStore.setState({ readOnlyCanvas: false, showUnsupportedMarkers: null });
});

describe("a documentation page's example diagram", () => {
	it("draws no Unsupported marker even for a viewer whose setting is on", async () => {
		useStore.setState({ showUnsupportedMarkers: true });

		render(<ReadOnlyCaseCanvas caseData={CASE_WITH_GAPS} />);

		await waitFor(() => {
			expect(screen.getByText("P1")).toBeInTheDocument();
		});
		expect(screen.getByText("S1")).toBeInTheDocument();
		expect(screen.queryByText("Unsupported")).toBeNull();
	});

	it("would draw the markers on the same cards if the canvas were not read-only", async () => {
		useStore.setState({ showUnsupportedMarkers: true });
		render(<ReadOnlyCaseCanvas caseData={CASE_WITH_GAPS} />);
		await waitFor(() => {
			expect(screen.getByText("P1")).toBeInTheDocument();
		});
		expect(screen.queryByText("Unsupported")).toBeNull();

		act(() => {
			useStore.getState().setReadOnlyCanvas(false);
		});

		expect(screen.getAllByText("Unsupported").length).toBeGreaterThan(0);
	});

	it("draws no marker for a signed-out reader, whose setting is never loaded", async () => {
		useStore.setState({ showUnsupportedMarkers: null });

		render(<ReadOnlyCaseCanvas caseData={CASE_WITH_GAPS} />);

		await waitFor(() => {
			expect(screen.getByText("P1")).toBeInTheDocument();
		});
		expect(screen.queryByText("Unsupported")).toBeNull();
	});
});
