import { act, renderHook } from "@testing-library/react";
import type { Node } from "reactflow";
import { afterEach, describe, expect, it } from "vitest";
import useStore from "@/store/store";
import { useChildrenHidden } from "../use-children-hidden";

/**
 * Collapsing a claim writes `hidden` on every one of its descendants, so a
 * claim is collapsed when it has children and none of them is drawn. The test
 * nodes are shaped as the canvas builds them: ids like `property-<id>`, with
 * `data.parentId` naming the parent's node id.
 */

function child(id: string, parent: string, hidden?: boolean): Node {
	return {
		id,
		position: { x: 0, y: 0 },
		data: { parentId: parent },
		hidden,
	};
}

function claim(id: string): Node {
	return { id, position: { x: 0, y: 0 }, data: {} };
}

function show(nodes: Node[]) {
	act(() => useStore.setState({ nodes }));
}

afterEach(() => {
	useStore.setState({ nodes: [] });
});

describe("whether a node is collapsed on the canvas", () => {
	it("is not collapsed when it has no children", () => {
		show([claim("property-p1")]);

		const { result } = renderHook(() => useChildrenHidden("property-p1"));

		expect(result.current).toBe(false);
	});

	it("is not collapsed while its only child, an evidence node, is drawn", () => {
		show([claim("property-p1"), child("evidence-e1", "property-p1", false)]);

		const { result } = renderHook(() => useChildrenHidden("property-p1"));

		expect(result.current).toBe(false);
	});

	it("is not collapsed when the child has no hidden flag at all", () => {
		show([claim("property-p1"), child("evidence-e1", "property-p1")]);

		const { result } = renderHook(() => useChildrenHidden("property-p1"));

		expect(result.current).toBe(false);
	});

	it("is collapsed when its only child, an evidence node, is hidden", () => {
		show([claim("property-p1"), child("evidence-e1", "property-p1", true)]);

		const { result } = renderHook(() => useChildrenHidden("property-p1"));

		expect(result.current).toBe(true);
	});

	it("is collapsed when every one of several children is hidden", () => {
		show([
			claim("property-p1"),
			child("evidence-e1", "property-p1", true),
			child("property-p2", "property-p1", true),
			child("strategy-s1", "property-p1", true),
		]);

		const { result } = renderHook(() => useChildrenHidden("property-p1"));

		expect(result.current).toBe(true);
	});

	it("is not collapsed when any child is still drawn", () => {
		show([
			claim("property-p1"),
			child("evidence-e1", "property-p1", true),
			child("property-p2", "property-p1", false),
		]);

		const { result } = renderHook(() => useChildrenHidden("property-p1"));

		expect(result.current).toBe(false);
	});

	it("ignores nodes that belong to another parent", () => {
		show([
			claim("property-p1"),
			claim("property-p2"),
			child("evidence-e1", "property-p1", false),
			child("evidence-e2", "property-p2", true),
		]);

		const first = renderHook(() => useChildrenHidden("property-p1"));
		const second = renderHook(() => useChildrenHidden("property-p2"));

		expect(first.result.current).toBe(false);
		expect(second.result.current).toBe(true);
	});

	it("follows the canvas as it is collapsed and expanded", () => {
		show([claim("property-p1"), child("evidence-e1", "property-p1", false)]);
		const { result } = renderHook(() => useChildrenHidden("property-p1"));
		expect(result.current).toBe(false);

		show([claim("property-p1"), child("evidence-e1", "property-p1", true)]);
		expect(result.current).toBe(true);

		show([claim("property-p1"), child("evidence-e1", "property-p1", false)]);
		expect(result.current).toBe(false);
	});
});
