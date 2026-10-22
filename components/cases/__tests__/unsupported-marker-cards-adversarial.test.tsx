import { act, render, screen, within } from "@testing-library/react";
import type React from "react";
import type { Node, NodeProps } from "reactflow";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convertAssuranceCase } from "@/lib/case/convert-case";
import useStore from "@/store/store";
import { nodeTypes } from "../node-type-resolver";

vi.mock("@/hooks/use-plugin-enablement", () => ({
	useEnabledPluginIds: () => ({ enabledPluginIds: new Set(), loading: false }),
}));

// The repo-wide reactflow mock lacks what the node's action menu needs, so
// this restores it for this file only.
vi.mock("reactflow", async () => {
	const actual = await vi.importActual<typeof import("reactflow")>("reactflow");
	const ReactLib: typeof React = require("react");
	return {
		...actual,
		useNodes: () => [],
		useEdges: () => [],
		useReactFlow: () => ({
			fitView: vi.fn(),
			getNodes: vi.fn(() => []),
			getEdges: vi.fn(() => []),
		}),
		Handle: ({ id }: { id?: string }) =>
			ReactLib.createElement("div", { "data-handle": id }),
	};
});

type Item = Record<string, unknown>;

const CASE = {
	id: "case-1",
	goals: [
		{
			id: "g",
			name: "G",
			type: "TopLevelNormativeGoal",
			strategies: [{ id: "s-empty", name: "S empty", type: "Strategy" }],
			propertyClaims: [
				{
					id: "p-evidence",
					name: "P evidence",
					type: "PropertyClaim",
					evidence: [{ id: "e", name: "E", type: "Evidence" }],
				},
				{ id: "p-empty", name: "P empty", type: "PropertyClaim" },
				{
					id: "p-assumed",
					name: "P assumed",
					type: "PropertyClaim",
					assertionStatus: "ASSUMED",
				},
				{
					id: "p-needs",
					name: "P needs",
					type: "PropertyClaim",
					assertionStatus: "NEEDS_SUPPORT",
				},
				{
					id: "p-defeated-only",
					name: "P challenged",
					type: "PropertyClaim",
					propertyClaims: [
						{
							id: "p-challenger",
							name: "P challenger",
							type: "PropertyClaim",
							isDefeater: true,
							defeatsElementId: "p-defeated-only",
							assertionStatus: "ASSUMED",
						},
					],
				},
				{
					id: "p-collapsed",
					name: "P collapsed",
					type: "PropertyClaim",
					evidence: [
						{
							id: "e-hidden",
							name: "E hidden",
							type: "Evidence",
							hidden: true,
						},
					],
				},
				{
					id: "p-away",
					name: "P away",
					type: "PropertyClaim",
					awayGoals: [{ id: "away", name: "Away", type: "AwayGoal" }],
				},
				{
					id: "p-module",
					name: "P module",
					type: "PropertyClaim",
					modules: [{ id: "mod", name: "Mod", type: "Module" }],
				},
			],
		},
	],
} as Item;

function cardProps(node: Node): NodeProps {
	return {
		id: node.id,
		data: node.data,
		type: node.type,
		selected: false,
		zIndex: 0,
		isConnectable: true,
		xPos: 0,
		yPos: 0,
		dragging: false,
	} as NodeProps;
}

function drawCards(nodes: Node[]) {
	useStore.setState({ nodes });
	return render(
		<div>
			{nodes.map((node) => {
				const Card = nodeTypes[node.type as string];
				if (!Card) {
					throw new Error(`no card is drawn for a ${node.type} node`);
				}
				// Evidence shared by two claims is held twice under one id.
				const key = `${node.id}/${node.data.parentId}`;
				return (
					<div data-testid={key} key={key}>
						<Card {...cardProps(node)} />
					</div>
				);
			})}
		</div>
	);
}

/** The node ids whose card shows the Unsupported word. */
function cardsShowingMarker(nodes: Node[]): string[] {
	return nodes
		.filter(
			(node) =>
				within(
					screen.getByTestId(`${node.id}/${node.data.parentId}`)
				).queryByText("Unsupported") !== null
		)
		.map((node) => node.id);
}

let nodes: Node[];

beforeEach(() => {
	nodes = convertAssuranceCase(CASE as never).caseNodes;
	useStore.setState({
		readOnlyCanvas: false,
		showUnsupportedMarkers: true,
		// A card re-lays the diagram out when its animation ends, from the nodes
		// the stand-in canvas reports (none); this keeps that from emptying the store.
		layoutNodes: vi.fn(async () => undefined),
	});
});

afterEach(() => {
	useStore.setState({
		nodes: [],
		readOnlyCanvas: false,
		showUnsupportedMarkers: null,
	});
});

describe("the real cards on a diagram", () => {
	it("mark exactly the goal, strategy and claim cards with nothing beneath them", () => {
		drawCards(nodes);

		expect(cardsShowingMarker(nodes)).toEqual([
			"strategy-s-empty",
			"property-p-empty",
			"property-p-defeated-only",
		]);
	});

	it("never mark an evidence, away goal or module card", () => {
		drawCards(nodes);

		const shown = cardsShowingMarker(nodes);
		for (const id of ["evidence-e", "awayGoal-away", "module-mod"]) {
			expect(nodes.some((n) => n.id === id)).toBe(true);
			expect(shown).not.toContain(id);
		}
	});

	it("do not mark a claim whose only evidence is hidden by collapsing", () => {
		drawCards(nodes);

		expect(nodes.find((n) => n.id === "evidence-e-hidden")?.hidden).toBe(true);
		expect(cardsShowingMarker(nodes)).not.toContain("property-p-collapsed");
	});

	it("never mark the goal above a gap", () => {
		drawCards(nodes);

		expect(cardsShowingMarker(nodes)).not.toContain("goal-g");
	});

	it("show the author's status badge and not the marker on a claim with a status", () => {
		drawCards(nodes);

		const assumed = within(screen.getByTestId("property-p-assumed/goal-g"));
		const needs = within(screen.getByTestId("property-p-needs/goal-g"));
		expect(assumed.getByText("Assumed")).toBeInTheDocument();
		expect(assumed.queryByText("Unsupported")).toBeNull();
		expect(needs.getByText("Needs support")).toBeInTheDocument();
		expect(needs.queryByText("Unsupported")).toBeNull();
	});

	it("draw one Unsupported badge on a marked card and one top-right wrapper more than an unmarked one", () => {
		drawCards(nodes);

		const wrappers = (id: string) =>
			screen
				.getByTestId(id)
				.querySelectorAll('[data-testid="node-top-right-actions"]').length;
		const marked = within(screen.getByTestId("property-p-empty/goal-g"));
		expect(marked.getAllByText("Unsupported")).toHaveLength(1);
		expect(wrappers("property-p-empty/goal-g")).toBe(
			wrappers("property-p-evidence/goal-g") + 1
		);
	});

	it("draw no markers while the setting has not loaded", () => {
		useStore.setState({ showUnsupportedMarkers: null });
		drawCards(nodes);

		expect(cardsShowingMarker(nodes)).toEqual([]);
	});

	it("draw no markers when the viewer has switched them off", () => {
		useStore.setState({ showUnsupportedMarkers: false });
		drawCards(nodes);

		expect(cardsShowingMarker(nodes)).toEqual([]);
	});

	it("draw no markers on the read-only canvas", () => {
		useStore.setState({ readOnlyCanvas: true });
		drawCards(nodes);

		expect(cardsShowingMarker(nodes)).toEqual([]);
	});

	it("draw no wrapper in the corner of a supported card with no status", () => {
		drawCards(nodes);

		const supported = screen.getByTestId("property-p-evidence/goal-g");
		expect(
			supported.querySelectorAll('[data-testid="node-top-right-actions"]')
		).toHaveLength(0);
	});

	it("follow the store as a gap is filled and reopened, without the card being drawn again by its parent", () => {
		drawCards(nodes);
		const card = () => within(screen.getByTestId("property-p-empty/goal-g"));
		expect(card().queryByText("Unsupported")).not.toBeNull();

		const filled: Node[] = [
			...nodes,
			{
				id: "evidence-new",
				type: "evidence",
				position: { x: 0, y: 0 },
				data: { id: "new", parentId: "property-p-empty" },
			},
		];
		act(() => {
			useStore.setState({ nodes: filled });
		});
		expect(card().queryByText("Unsupported")).toBeNull();

		act(() => {
			useStore.setState({ nodes });
		});
		expect(card().queryByText("Unsupported")).not.toBeNull();
	});
});
