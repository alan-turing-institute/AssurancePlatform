import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import useStore from "@/store/store";
import type { CaseExportNested } from "@/types/curriculum";
import ReadOnlyCaseCanvas from "../read-only-case-canvas";

const CASE_DATA: CaseExportNested = {
	version: "1.0",
	exportedAt: "2025-12-17T10:00:00.000Z",
	case: { name: "Fair Recruitment AI System", description: "A case" },
	tree: {
		id: "g1",
		type: "GOAL",
		name: "G1",
		description: "The goal",
		inSandbox: false,
		children: [
			{
				id: "s1",
				type: "STRATEGY",
				name: "S1",
				description: "The strategy",
				inSandbox: false,
				children: [
					{
						id: "p1",
						type: "PROPERTY_CLAIM",
						name: "P1",
						description: "The claim",
						inSandbox: false,
						level: 1,
						children: [
							{
								id: "e1",
								type: "EVIDENCE",
								name: "E1",
								description: "The evidence",
								inSandbox: false,
								url: "https://example.com/e1",
								children: [],
							},
						],
					},
				],
			},
		],
	},
};

afterEach(() => {
	useStore.getState().setAssuranceCase(null);
	useStore.getState().setNodes([]);
	useStore.getState().setEdges([]);
});

describe("ReadOnlyCaseCanvas", () => {
	it("loads the case into the shared store as view-only and lays out every element", async () => {
		render(<ReadOnlyCaseCanvas caseData={CASE_DATA} />);

		await waitFor(() => {
			expect(useStore.getState().nodes.length).toBe(4);
		});

		expect(useStore.getState().assuranceCase?.permissions).toBe("view");
		expect(useStore.getState().edges.length).toBe(3);
	});

	it("clears the shared store on unmount, so a later /case/<id> visit does not inherit it", async () => {
		const { unmount } = render(<ReadOnlyCaseCanvas caseData={CASE_DATA} />);

		await waitFor(() => {
			expect(useStore.getState().nodes.length).toBe(4);
		});

		unmount();

		expect(useStore.getState().assuranceCase).toBeNull();
		expect(useStore.getState().nodes).toEqual([]);
		expect(useStore.getState().edges).toEqual([]);
	});
});
