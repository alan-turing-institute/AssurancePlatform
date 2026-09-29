import { waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Node } from "reactflow";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithReactFlow, screen } from "@/src/__tests__/utils/test-utils";
import useStore from "@/store/store";
import AddCitedElementForm from "../add-cited-element-form";

vi.mock("@/actions/cited-element-picker", () => ({
	listCitableCases: vi.fn(),
	listCitableGoals: vi.fn(),
}));

vi.mock("@/lib/case", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/case")>();
	return { ...actual, createAssuranceCaseNode: vi.fn() };
});

import {
	listCitableCases,
	listCitableGoals,
} from "@/actions/cited-element-picker";
import { createAssuranceCaseNode } from "@/lib/case";
import { toast } from "@/lib/toast";

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
		},
	});
}

describe("AddCitedElementForm (ADR 0005 D7)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		resetStore();
		vi.mocked(listCitableCases).mockResolvedValue({
			success: true,
			data: [{ id: "cited-case-1", name: "Cited Case" }],
		});
		vi.mocked(listCitableGoals).mockResolvedValue({
			success: true,
			data: [{ id: "cited-goal-1", name: "G1", description: "The cited goal" }],
		});
		vi.mocked(createAssuranceCaseNode).mockResolvedValue({
			data: { id: "new-1", name: "AG1", description: "", type: "away_goal" },
		});
	});

	it("has no name input — identifiers are always assigned by the server (Chris's ruling, 2026-09-15)", async () => {
		renderWithReactFlow(
			<AddCitedElementForm kind="away-goal" node={NODE} onClose={vi.fn()} />
		);

		await waitFor(() =>
			expect(
				screen.getAllByRole("combobox")[0]
			).not.toHaveAccessibleDescription("Loading cases…")
		);

		expect(screen.queryByLabelText(NAME_LABEL_PATTERN)).not.toBeInTheDocument();
	});

	it("shows the Goal step only for an away goal, not for a module", async () => {
		renderWithReactFlow(
			<AddCitedElementForm kind="module" node={NODE} onClose={vi.fn()} />
		);

		await waitFor(() =>
			expect(screen.getByRole("combobox")).not.toHaveAccessibleDescription(
				"Loading cases…"
			)
		);

		expect(screen.queryByLabelText("Goal")).not.toBeInTheDocument();
	});

	it("prefills the description from the selected goal for an away goal, and submits the discriminated payload", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		renderWithReactFlow(
			<AddCitedElementForm kind="away-goal" node={NODE} onClose={onClose} />
		);

		const caseSelect = await screen.findByLabelText("Case");
		await user.click(caseSelect);
		await user.click(await screen.findByRole("option", { name: "Cited Case" }));

		const goalSelect = await screen.findByLabelText("Goal");
		await user.click(goalSelect);
		await user.click(await screen.findByRole("option", { name: "G1" }));

		// Prefilled from the cited goal's own description.
		await waitFor(() =>
			expect(screen.getByLabelText("Description")).toHaveValue("The cited goal")
		);

		await user.click(screen.getByRole("button", { name: "Add Away Goal" }));

		await waitFor(() => expect(createAssuranceCaseNode).toHaveBeenCalled());
		const [entity, payload] = vi.mocked(createAssuranceCaseNode).mock.calls[0]!;
		expect(entity).toBe("awaygoals");
		expect(payload).toMatchObject({
			moduleReferenceId: "cited-case-1",
			citedElementId: "cited-goal-1",
			parentId: "element-1",
			assuranceCaseId: "case-1",
		});
		expect(payload).not.toHaveProperty("moduleEmbedType");
		expect(onClose).toHaveBeenCalled();
	});

	it("submits a module payload with moduleEmbedType: COPY and no citedElementId", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		renderWithReactFlow(
			<AddCitedElementForm kind="module" node={NODE} onClose={onClose} />
		);

		const caseSelect = await screen.findByLabelText("Case");
		await user.click(caseSelect);
		await user.click(await screen.findByRole("option", { name: "Cited Case" }));

		await user.click(screen.getByRole("button", { name: "Add Module" }));

		await waitFor(() => expect(createAssuranceCaseNode).toHaveBeenCalled());
		const [entity, payload] = vi.mocked(createAssuranceCaseNode).mock.calls[0]!;
		expect(entity).toBe("modules");
		expect(payload).toMatchObject({
			moduleReferenceId: "cited-case-1",
			moduleEmbedType: "COPY",
		});
		expect(payload).not.toHaveProperty("citedElementId");
		expect(onClose).toHaveBeenCalled();
	});

	it("shows the server's error message verbatim and does not close when creation fails", async () => {
		vi.mocked(createAssuranceCaseNode).mockResolvedValue({ error: "boom" });
		const user = userEvent.setup();
		const onClose = vi.fn();
		renderWithReactFlow(
			<AddCitedElementForm kind="module" node={NODE} onClose={onClose} />
		);

		const caseSelect = await screen.findByLabelText("Case");
		await user.click(caseSelect);
		await user.click(await screen.findByRole("option", { name: "Cited Case" }));

		await user.click(screen.getByRole("button", { name: "Add Module" }));

		await waitFor(() => expect(createAssuranceCaseNode).toHaveBeenCalled());
		expect(onClose).not.toHaveBeenCalled();
		// Verbatim server message, not a generic "cannot create …" line
		// (walkthrough finding 7).
		expect(toast).toHaveBeenCalledWith(
			expect.objectContaining({ variant: "destructive", description: "boom" })
		);
	});
});
