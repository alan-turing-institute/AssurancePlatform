import { render, screen } from "@testing-library/react";
import type React from "react";
import type { NodeProps } from "reactflow";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	type CanvasWorld,
	enablePlugins,
	installCanvasWorld,
	registerHealthOnly,
	removeCanvasWorld,
	settle,
} from "@/src/__tests__/utils/live-node-canvas-kit";
import {
	healthStatus,
	liveNodeItem,
} from "@/src/__tests__/utils/live-node-ui-kit";
import useStore from "@/store/store";
import PropertyNode from "../property-node";

vi.mock("@/hooks/use-plugin-enablement", () => ({
	useEnabledPluginIds: vi.fn(),
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

const NODE_ID = "property-p1";
const PROPS = {
	id: NODE_ID,
	data: { id: "p1", name: "P1", description: "A claim" },
	type: "property",
	selected: false,
	zIndex: 0,
	isConnectable: true,
	xPos: 0,
	yPos: 0,
	dragging: false,
} as NodeProps;

/** Puts the claim's evidence node on the canvas, hidden or not, as a collapse leaves it. */
function placeEvidenceNode(hidden: boolean) {
	useStore.setState({
		nodes: [
			{
				id: "evidence-e1",
				position: { x: 0, y: 0 },
				data: { parentId: NODE_ID },
				hidden,
			},
		],
	});
}

let world: CanvasWorld;

beforeEach(() => {
	world = installCanvasWorld();
	enablePlugins(["tea.health"]);
	registerHealthOnly();
	world.list = [liveNodeItem({ id: "e1", claim_id: "p1", claim_name: "P1" })];
	world.statuses.p1 = healthStatus({ verdict: "pass" });
});

afterEach(() => {
	removeCanvasWorld();
});

describe("a property node whose claim has a live evidence node", () => {
	it("hides its own health dot while expanded and shows it while collapsed", async () => {
		placeEvidenceNode(false);
		render(<PropertyNode {...PROPS} />);
		await settle();
		expect(screen.queryByTestId("health-badge-dot")).toBeNull();

		placeEvidenceNode(true);
		await settle();
		expect(screen.queryByTestId("health-badge-dot")).not.toBeNull();
	});
});
