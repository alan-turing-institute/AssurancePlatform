import { render, renderHook, screen } from "@testing-library/react";
import type { Node } from "reactflow";
import { afterEach, describe, expect, it, vi } from "vitest";
import useStore from "@/store/store";
import { useNodeTopRightActions } from "../use-node-top-right-actions";

// The plugin badge slot is not under test; it has its own tests.
vi.mock("../use-element-badge-slot", () => ({
	useElementBadgeSlot: () => null,
}));

const EMPTY_GOAL: Node[] = [
	{
		id: "goal-1",
		type: "goal",
		position: { x: 0, y: 0 },
		data: { id: "1", parentId: null },
	},
];

function Actions({ data }: { data: Record<string, unknown> }) {
	return useNodeTopRightActions({ id: "1", ...data }, "goal", "goal-1");
}

afterEach(() => {
	useStore.setState({ nodes: [], showUnsupportedMarkers: null });
});

describe("useNodeTopRightActions — the unsupported marker", () => {
	it("shows the marker on an element with nothing beneath it", () => {
		useStore.setState({ nodes: EMPTY_GOAL, showUnsupportedMarkers: true });

		render(<Actions data={{}} />);

		expect(screen.getByText("Unsupported")).toBeInTheDocument();
	});

	it("shows the author's status badge instead of the marker, never both", () => {
		useStore.setState({ nodes: EMPTY_GOAL, showUnsupportedMarkers: true });

		render(<Actions data={{ assertionStatus: "NEEDS_SUPPORT" }} />);

		expect(screen.getByText("Needs support")).toBeInTheDocument();
		expect(screen.queryByText("Unsupported")).not.toBeInTheDocument();
	});

	it("shows the marker when the status value is not a status, since no status badge is drawn", () => {
		useStore.setState({ nodes: EMPTY_GOAL, showUnsupportedMarkers: true });

		render(<Actions data={{ assertionStatus: "NOT_A_STATUS" }} />);

		expect(screen.getByText("Unsupported")).toBeInTheDocument();
	});

	it("returns null, so the card renders no wrapper, when the setting is off", () => {
		useStore.setState({ nodes: EMPTY_GOAL, showUnsupportedMarkers: false });

		const { result } = renderHook(() =>
			useNodeTopRightActions({ id: "1" }, "goal", "goal-1")
		);

		expect(result.current).toBeNull();
	});

	it("returns null while the setting has not loaded", () => {
		useStore.setState({ nodes: EMPTY_GOAL, showUnsupportedMarkers: null });

		const { result } = renderHook(() =>
			useNodeTopRightActions({ id: "1" }, "goal", "goal-1")
		);

		expect(result.current).toBeNull();
	});

	it("draws nothing for an element that has something beneath it", () => {
		useStore.setState({
			nodes: [
				...EMPTY_GOAL,
				{
					id: "property-1",
					type: "property",
					position: { x: 0, y: 0 },
					data: { id: "2", parentId: "goal-1" },
				},
			],
			showUnsupportedMarkers: true,
		});

		const { container } = render(<Actions data={{}} />);

		expect(container).toBeEmptyDOMElement();
	});
});
