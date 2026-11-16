import { act } from "@testing-library/react";
import { Profiler } from "react";
import type { NodeProps } from "reactflow";
import { afterEach, describe, expect, it, vi } from "vitest";
import EvidenceNode from "@/components/cases/evidence-node";
import type { AssuranceCaseResponse } from "@/lib/services/case-response-types";
import { renderWithReactFlow } from "@/src/__tests__/utils/test-utils";
import useStore from "@/store/store";

// The repo-wide reactflow mock does not stub `useNodes`/`useEdges`, which the
// editor menus call.
vi.mock("reactflow", async (importOriginal) => ({
	...(await importOriginal<typeof import("reactflow")>()),
	useNodes: () => [],
	useEdges: () => [],
}));

const SETTLE_MS = 500;

const props = {
	id: "evidence-1",
	data: { id: "el-1", name: "E1", description: "Measured" },
	type: "evidence",
	selected: false,
	zIndex: 0,
	isConnectable: true,
	xPos: 0,
	yPos: 0,
	dragging: false,
} as NodeProps;

describe("card render count", () => {
	afterEach(() => {
		useStore.setState({
			assuranceCase: null,
			activeUsers: [],
			readOnlyCanvas: false,
		});
	});

	it("does not re-render a card for a store write that changes nothing it shows", async () => {
		useStore.setState({
			assuranceCase: {
				id: 1,
				kind: "CASE",
				permissions: "view",
			} as unknown as AssuranceCaseResponse,
			readOnlyCanvas: true,
		});
		let commits = 0;
		renderWithReactFlow(
			<Profiler
				id="card"
				onRender={() => {
					commits += 1;
				}}
			>
				<EvidenceNode {...props} />
			</Profiler>
		);
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));
		});
		const before = commits;

		act(() => {
			useStore.getState().setActiveUsers([]);
		});
		act(() => {
			useStore.getState().setActiveUsers([]);
		});

		expect(commits).toBe(before);
	});
});
