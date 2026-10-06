import { render, waitFor } from "@testing-library/react";
import type { Node, OnSelectionChangeParams } from "reactflow";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useStore from "@/store/store";
import type { CaseExportNested } from "@/types/curriculum";
import ReadOnlyCaseCanvas from "../read-only-case-canvas";

const captured: Array<(params: OnSelectionChangeParams) => void> = [];

vi.mock("reactflow", () => ({
	default: ({
		children,
		onSelectionChange,
	}: {
		children?: React.ReactNode;
		onSelectionChange?: (params: OnSelectionChangeParams) => void;
	}) => {
		if (onSelectionChange) {
			captured.push(onSelectionChange);
		}
		return <div data-testid="react-flow">{children}</div>;
	},
	ReactFlowProvider: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	Background: () => null,
	Controls: () => null,
	useReactFlow: () => ({ fitView: vi.fn() }),
	useNodes: () => [],
	useEdges: () => [],
}));

const makeCase = (goalName: string): CaseExportNested => ({
	version: "1.0",
	exportedAt: "2025-12-17T10:00:00.000Z",
	case: { name: "Case", description: "A case" },
	tree: {
		id: "g1",
		type: "GOAL",
		name: goalName,
		description: "The goal",
		inSandbox: false,
		children: [
			{
				id: "s1",
				type: "STRATEGY",
				name: "S1",
				description: "The strategy",
				inSandbox: false,
				children: [],
			},
		],
	},
});

const latest = () => {
	const handler = captured.at(-1);
	if (!handler) {
		throw new Error("no selection handler captured");
	}
	return handler;
};

beforeEach(() => {
	captured.length = 0;
	useStore.getState().setAssuranceCase(null);
	useStore.getState().setNodes([]);
	useStore.getState().setEdges([]);
});

describe("ReadOnlyCaseCanvas selection (adversarial)", () => {
	it("keeps one handler identity across re-renders yet calls the newest prop", async () => {
		const data = makeCase("G1");
		const first = vi.fn();
		const second = vi.fn();
		const { rerender } = render(
			<ReadOnlyCaseCanvas caseData={data} onSelectedElementChange={first} />
		);
		await waitFor(() => expect(captured.length).toBeGreaterThan(0));
		await waitFor(() => expect(useStore.getState().nodes.length).toBe(2));

		rerender(
			<ReadOnlyCaseCanvas caseData={data} onSelectedElementChange={second} />
		);
		rerender(
			<ReadOnlyCaseCanvas caseData={data} onSelectedElementChange={second} />
		);

		expect(new Set(captured).size).toBe(1);

		const selected = useStore.getState().nodes[0] as Node;
		first.mockClear();
		latest()({ nodes: [selected], edges: [] });
		expect(second).toHaveBeenCalledTimes(1);
		expect(first).not.toHaveBeenCalled();
	});

	it("reports null when the selection is empty", async () => {
		const spy = vi.fn();
		render(
			<ReadOnlyCaseCanvas
				caseData={makeCase("G1")}
				onSelectedElementChange={spy}
			/>
		);
		await waitFor(() => expect(captured.length).toBeGreaterThan(0));
		spy.mockClear();
		latest()({ nodes: [], edges: [] });
		expect(spy).toHaveBeenCalledTimes(1);
		expect(spy).toHaveBeenCalledWith(null);
	});

	it("reports a summary of the selected node", async () => {
		const spy = vi.fn();
		render(
			<ReadOnlyCaseCanvas
				caseData={makeCase("G1")}
				onSelectedElementChange={spy}
			/>
		);
		await waitFor(() => expect(useStore.getState().nodes.length).toBe(2));
		await waitFor(() => expect(captured.length).toBeGreaterThan(0));
		const strategy = useStore
			.getState()
			.nodes.find((n) => n.type === "strategy");
		if (!strategy) {
			throw new Error("strategy node missing");
		}
		latest()({ nodes: [strategy], edges: [] });
		expect(spy).toHaveBeenLastCalledWith(
			expect.objectContaining({
				name: "S1",
				type: "strategy",
				parent: { name: "G1", type: "goal" },
			})
		);
	});

	it("tells the parent nothing is selected when the case changes", async () => {
		const spy = vi.fn();
		const { rerender } = render(
			<ReadOnlyCaseCanvas
				caseData={makeCase("G1")}
				onSelectedElementChange={spy}
			/>
		);
		await waitFor(() => expect(useStore.getState().nodes.length).toBe(2));
		await waitFor(() => expect(captured.length).toBeGreaterThan(0));
		latest()({ nodes: [useStore.getState().nodes[0] as Node], edges: [] });
		expect(spy).toHaveBeenLastCalledWith(
			expect.objectContaining({ name: "G1" })
		);

		spy.mockClear();
		rerender(
			<ReadOnlyCaseCanvas
				caseData={makeCase("G9")}
				onSelectedElementChange={spy}
			/>
		);
		expect(spy).toHaveBeenCalledWith(null);
	});
});
