import { act } from "@testing-library/react";
import { Profiler } from "react";
import type { NodeProps } from "reactflow";
import { afterEach, describe, expect, it } from "vitest";
import EvidenceNode from "@/components/cases/evidence-node";
import type { AssuranceCaseResponse } from "@/lib/services/case-response-types";
import { renderWithReactFlow } from "@/src/__tests__/utils/test-utils";
import useStore from "@/store/store";

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
		// A view-only canvas: the editor menus, which subscribe to the canvas
		// store in their own right, are not mounted, so the card's own
		// subscriptions are what is measured.
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
