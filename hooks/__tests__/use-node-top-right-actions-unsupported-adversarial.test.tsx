import { render, renderHook, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import type { Node } from "reactflow";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useStore from "@/store/store";
import { useNodeTopRightActions } from "../use-node-top-right-actions";

vi.mock("@/hooks/use-plugin-enablement", () => ({
	useEnabledPluginIds: () => ({ enabledPluginIds: new Set(), loading: false }),
}));

const STATUS_LABELS: [string, string][] = [
	["NEEDS_SUPPORT", "Needs support"],
	["ASSUMED", "Assumed"],
	["AXIOMATIC", "Axiomatic"],
	["DEFEATED", "Defeated"],
	["AS_CITED", "As cited"],
];

function nodes(claimData: Record<string, unknown> = {}): Node[] {
	return [
		{
			id: "goal-g",
			type: "goal",
			position: { x: 0, y: 0 },
			data: { parentId: null },
		},
		{
			id: "property-p",
			type: "property",
			position: { x: 0, y: 0 },
			data: { parentId: "goal-g", ...claimData },
		},
	];
}

function show(content: ReactNode) {
	return render(<div>{content}</div>);
}

function corner(data: Record<string, unknown>) {
	const { result } = renderHook(() =>
		useNodeTopRightActions({ id: "p", ...data }, "property", "property-p")
	);
	return result.current;
}

beforeEach(() => {
	useStore.setState({
		assuranceCase: null,
		nodes: nodes(),
		readOnlyCanvas: false,
		showUnsupportedMarkers: true,
	});
});

afterEach(() => {
	useStore.setState({
		nodes: [],
		readOnlyCanvas: false,
		showUnsupportedMarkers: null,
	});
});

describe("useNodeTopRightActions with the unsupported marker", () => {
	it.each(
		STATUS_LABELS
	)("draws only the status badge, never both, when the card's data says %s", (status, label) => {
		// The store still says the claim is plain: the two sources can disagree
		// for a moment while the card is redrawn.
		show(corner({ assertionStatus: status }));

		expect(screen.getByText(label)).toBeInTheDocument();
		expect(screen.queryByText("Unsupported")).toBeNull();
	});

	it.each(
		STATUS_LABELS
	)("draws only the status badge when both the store and the card say %s", (status, label) => {
		useStore.setState({ nodes: nodes({ assertionStatus: status }) });

		show(corner({ assertionStatus: status }));

		expect(screen.getByText(label)).toBeInTheDocument();
		expect(screen.queryByText("Unsupported")).toBeNull();
	});
});
