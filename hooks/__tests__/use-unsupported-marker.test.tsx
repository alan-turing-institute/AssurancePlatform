import { act, renderHook } from "@testing-library/react";
import type { Node } from "reactflow";
import { afterEach, describe, expect, it } from "vitest";
import useStore from "@/store/store";
import { useUnsupportedMarker } from "../use-unsupported-marker";

function node(
	id: string,
	type: string,
	parentId: string | null,
	data: Record<string, unknown> = {}
): Node {
	return { id, type, position: { x: 0, y: 0 }, data: { parentId, ...data } };
}

const EMPTY_GOAL = [node("goal-1", "goal", null)];

afterEach(() => {
	useStore.setState({
		nodes: [],
		readOnlyCanvas: false,
		showUnsupportedMarkers: null,
	});
});

describe("useUnsupportedMarker", () => {
	it("marks an element with nothing beneath it when the viewer's setting is on", () => {
		useStore.setState({ nodes: EMPTY_GOAL, showUnsupportedMarkers: true });

		const { result } = renderHook(() => useUnsupportedMarker("goal-1"));

		expect(result.current).toBe(true);
	});

	it("draws no marker when the viewer has switched the setting off", () => {
		useStore.setState({ nodes: EMPTY_GOAL, showUnsupportedMarkers: false });

		const { result } = renderHook(() => useUnsupportedMarker("goal-1"));

		expect(result.current).toBe(false);
	});

	it("draws no marker while the setting has not loaded, so nothing flashes on", () => {
		useStore.setState({ nodes: EMPTY_GOAL, showUnsupportedMarkers: null });

		const { result } = renderHook(() => useUnsupportedMarker("goal-1"));

		expect(result.current).toBe(false);
	});

	it("draws no marker on the read-only documentation canvas, even with the setting on", () => {
		useStore.setState({
			nodes: EMPTY_GOAL,
			readOnlyCanvas: true,
			showUnsupportedMarkers: true,
		});

		const { result } = renderHook(() => useUnsupportedMarker("goal-1"));

		expect(result.current).toBe(false);
	});

	it("follows the setting and the nodes as they change", () => {
		useStore.setState({ nodes: EMPTY_GOAL, showUnsupportedMarkers: null });
		const { result } = renderHook(() => useUnsupportedMarker("goal-1"));
		expect(result.current).toBe(false);

		act(() => useStore.setState({ showUnsupportedMarkers: true }));
		expect(result.current).toBe(true);

		act(() =>
			useStore.setState({
				nodes: [...EMPTY_GOAL, node("strategy-1", "strategy", "goal-1")],
			})
		);
		expect(result.current).toBe(false);

		act(() => useStore.setState({ nodes: EMPTY_GOAL }));
		expect(result.current).toBe(true);
	});

	it("does not re-render a card when the diagram changes elsewhere", () => {
		useStore.setState({
			nodes: [...EMPTY_GOAL, node("property-1", "property", "goal-1")],
			showUnsupportedMarkers: true,
		});
		let renders = 0;
		renderHook(() => {
			renders += 1;
			return useUnsupportedMarker("property-1");
		});
		const rendersBefore = renders;

		act(() =>
			useStore.setState((state) => ({
				nodes: [...state.nodes, node("evidence-9", "evidence", "goal-1")],
			}))
		);

		expect(renders).toBe(rendersBefore);
	});
});
