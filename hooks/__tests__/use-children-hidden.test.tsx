import { act, renderHook } from "@testing-library/react";
import type { Node } from "reactflow";
import { afterEach, describe, expect, it, vi } from "vitest";
import useStore from "@/store/store";
import { useChildrenHidden } from "../use-children-hidden";

vi.mock("reactflow", async (importOriginal) => {
	const actual = await importOriginal<typeof import("reactflow")>();
	return { ...actual, useNodeId: () => "property-claim" };
});

function node(id: string, parentId: string | null, hidden?: boolean): Node {
	return {
		id,
		position: { x: 0, y: 0 },
		data: { parentId },
		hidden,
	};
}

afterEach(() => {
	useStore.setState({ nodes: [] });
});

describe("useChildrenHidden", () => {
	it("is false for a node with no children", () => {
		useStore.setState({ nodes: [node("property-claim", "goal-g")] });

		const { result } = renderHook(() => useChildrenHidden());

		expect(result.current).toBe(false);
	});

	it("is false while any child is drawn", () => {
		useStore.setState({
			nodes: [
				node("property-claim", "goal-g"),
				node("evidence-e1", "property-claim", true),
				node("evidence-e2", "property-claim", false),
			],
		});

		const { result } = renderHook(() => useChildrenHidden());

		expect(result.current).toBe(false);
	});

	it("is true when every child is hidden, even when the children are only evidence", () => {
		useStore.setState({
			nodes: [
				node("property-claim", "goal-g"),
				node("evidence-e1", "property-claim", true),
				node("property-other", "goal-g", false),
			],
		});

		const { result } = renderHook(() => useChildrenHidden());

		expect(result.current).toBe(true);
	});

	it("follows the nodes as the canvas collapses and expands", () => {
		useStore.setState({
			nodes: [
				node("property-claim", "goal-g"),
				node("evidence-e1", "property-claim", false),
			],
		});
		const { result } = renderHook(() => useChildrenHidden());
		expect(result.current).toBe(false);

		act(() => {
			useStore.setState({
				nodes: [
					node("property-claim", "goal-g"),
					node("evidence-e1", "property-claim", true),
				],
			});
		});
		expect(result.current).toBe(true);

		act(() => {
			useStore.setState({
				nodes: [
					node("property-claim", "goal-g"),
					node("evidence-e1", "property-claim", false),
				],
			});
		});
		expect(result.current).toBe(false);
	});
});
