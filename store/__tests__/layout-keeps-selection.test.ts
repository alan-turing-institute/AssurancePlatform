import type { Edge, Node } from "reactflow";
import { beforeEach, describe, expect, it, vi } from "vitest";

const layoutMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/case/layout-helper", () => ({
	getLayoutedElements: layoutMock,
}));

import useStore from "../store";

const node = (id: string, selected?: boolean): Node => ({
	id,
	position: { x: 0, y: 0 },
	data: {},
	selected,
});

const edges: Edge[] = [];

function deferredLayout() {
	let resolve!: (value: { nodes: Node[]; edges: Edge[] }) => void;
	const promise = new Promise<{ nodes: Node[]; edges: Edge[] }>((r) => {
		resolve = r;
	});
	layoutMock.mockReturnValueOnce(promise);
	return resolve;
}

const selectedIds = () =>
	useStore
		.getState()
		.nodes.filter((n) => n.selected)
		.map((n) => n.id);

describe("layout writes keep the live selection", () => {
	beforeEach(() => {
		layoutMock.mockReset();
		useStore.setState({ nodes: [], edges: [] });
	});

	describe("layoutNodes", () => {
		it("keeps a node selected in the store when the layout input carries no selection", async () => {
			useStore.setState({ nodes: [node("a", true), node("b")] });
			const finish = deferredLayout();
			const pending = useStore
				.getState()
				.layoutNodes([node("a"), node("b")], edges);
			finish({ nodes: [node("a"), node("b")], edges });
			await pending;
			expect(selectedIds()).toEqual(["a"]);
		});

		it("keeps a node deselected when the layout started from a selected snapshot", async () => {
			useStore.setState({ nodes: [node("a", true), node("b")] });
			const finish = deferredLayout();
			const pending = useStore
				.getState()
				.layoutNodes([node("a", true), node("b")], edges);
			useStore.setState({ nodes: [node("a", false), node("b")] });
			finish({ nodes: [node("a", true), node("b")], edges });
			await pending;
			expect(selectedIds()).toEqual([]);
		});
	});

	describe("layoutNodes edges", () => {
		it("hands the layout and the store edges without the display highlight", async () => {
			const highlighted: Edge = {
				id: "e1",
				source: "a",
				target: "b",
				className: "other case-edge--highlighted",
				data: {
					centerY: 120,
					sourceElementId: "a",
					targetElementId: "b",
					highlighted: true,
				},
			};
			layoutMock.mockImplementationOnce(
				(layoutNodes: Node[], layoutEdges: Edge[]) =>
					Promise.resolve({ nodes: layoutNodes, edges: layoutEdges })
			);
			await useStore
				.getState()
				.layoutNodes([node("a"), node("b")], [highlighted]);
			const stored = useStore.getState().edges[0];
			expect(stored?.className).toBe("other");
			expect(stored?.data).toEqual({
				centerY: 120,
				sourceElementId: "a",
				targetElementId: "b",
			});
		});
	});

	describe("triggerLayout", () => {
		it("keeps a node selected after the layout finishes", async () => {
			useStore.setState({ nodes: [node("a"), node("b")] });
			const finish = deferredLayout();
			const pending = useStore.getState().triggerLayout();
			useStore.setState({ nodes: [node("a", true), node("b")] });
			finish({ nodes: [node("a"), node("b")], edges });
			await pending;
			expect(selectedIds()).toEqual(["a"]);
		});

		it("keeps a node deselected when the layout started from a selected snapshot", async () => {
			useStore.setState({ nodes: [node("a", true), node("b")] });
			const finish = deferredLayout();
			const pending = useStore.getState().triggerLayout();
			useStore.setState({ nodes: [node("a", false), node("b")] });
			finish({ nodes: [node("a", true), node("b")], edges });
			await pending;
			expect(selectedIds()).toEqual([]);
		});
	});
});
