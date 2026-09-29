import { render, screen, waitFor } from "@testing-library/react";
import type { Node } from "reactflow";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NodeActionGroup } from "@/components/shared/nodes";
import useStore from "@/store/store";
import type { CaseExportNested } from "@/types/curriculum";
import ReadOnlyCaseCanvas from "../read-only-case-canvas";

/**
 * The repo-wide reactflow mock (`src/__tests__/setup/component-mocks.tsx`)
 * covers `ReadOnlyCaseCanvas`'s own needs (`default`, `Background`,
 * `Controls`, `ReactFlowProvider`, `useReactFlow`) but not `useNodes`/
 * `useEdges`, which `NodeOptionsMenu` (always mounted inside
 * `NodeActionGroup` when not read-only) calls directly — the same gap
 * `components/cases/__tests__/away-goal-node.test.tsx` documents. A
 * per-file `vi.mock` replaces the global one rather than extending it, so
 * this reproduces the pieces both this file's components need.
 */
vi.mock("reactflow", () => ({
	default: ({
		children,
		...props
	}: {
		children?: React.ReactNode;
		[key: string]: unknown;
	}) => (
		<div data-testid="react-flow" {...props}>
			{children}
		</div>
	),
	ReactFlowProvider: ({ children }: { children: React.ReactNode }) => (
		<div data-testid="react-flow-provider">{children}</div>
	),
	Background: () => <div data-testid="react-flow-background" />,
	Controls: () => <div data-testid="react-flow-controls" />,
	useReactFlow: () => ({ fitView: vi.fn() }),
	useNodes: () => [],
	useEdges: () => [],
}));

const COMMENT_BUTTON_NAME = /view comments/i;

function renderNodeActionGroup() {
	const node = {
		id: "p1",
		position: { x: 0, y: 0 },
		data: { id: "p1", name: "P1", type: "property" },
	} as unknown as Node;

	return render(
		<NodeActionGroup
			node={node}
			nodeType="property"
			onEditClick={() => {
				// no-op: not under test here
			}}
			showAdd={false}
		/>
	);
}

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

	it("hides NodeActionGroup's comment button while mounted, and restores it on unmount (so /case/<id>, which never sets this flag, is unaffected)", async () => {
		const { unmount } = render(<ReadOnlyCaseCanvas caseData={CASE_DATA} />);

		await waitFor(() => {
			expect(useStore.getState().readOnlyCanvas).toBe(true);
		});

		const firstActionGroup = renderNodeActionGroup();
		expect(
			screen.queryByRole("button", { name: COMMENT_BUTTON_NAME })
		).not.toBeInTheDocument();
		firstActionGroup.unmount();

		unmount();
		expect(useStore.getState().readOnlyCanvas).toBe(false);

		renderNodeActionGroup();
		expect(
			screen.getByRole("button", { name: COMMENT_BUTTON_NAME })
		).toBeInTheDocument();
	});
});
