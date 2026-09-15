import type { Node } from "reactflow";
import { describe, expect, it, vi } from "vitest";
import { renderWithReactFlow, screen } from "@/src/__tests__/utils/test-utils";
import useStore from "@/store/store";
import NewLinkForm from "../new-link-form";

const NAME_LABEL_PATTERN = /^Name/i;

const NODE: Node = {
	id: "goal-1",
	type: "goal",
	position: { x: 0, y: 0 },
	data: { id: "element-1", name: "G1" },
};

function resetStore(): void {
	useStore.setState({
		assuranceCase: {
			id: "case-1",
			name: "Test Case",
			type: "assurance-case",
			permissions: "manage",
			createdDate: new Date().toISOString(),
			comments: [],
			goals: [{ id: "element-1", name: "G1" }],
		} as never,
	});
}

/**
 * The defeater creation dialog (`node-add-dialog.tsx` -> `NewLinkForm` with
 * `linkType="defeater"`, `hooks/use-new-link-form.ts`): identifiers are
 * always assigned by the server — there is no name field here, matching the
 * away-goal/module dialog (Chris's ruling, 2026-09-15).
 */
describe("NewLinkForm (defeater path, ADR 0005 D7)", () => {
	it("has no name input for a defeater", () => {
		resetStore();
		renderWithReactFlow(
			<NewLinkForm
				actions={{
					setSelectedLink: vi.fn(),
					setLinkToCreate: vi.fn(),
					handleClose: vi.fn(),
				}}
				linkType="defeater"
				node={NODE}
				setUnresolvedChanges={vi.fn()}
			/>
		);

		expect(screen.queryByLabelText(NAME_LABEL_PATTERN)).not.toBeInTheDocument();
		expect(screen.getByLabelText("Description")).toBeInTheDocument();
	});
});
