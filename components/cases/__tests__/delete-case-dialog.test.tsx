import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DeleteCaseDialog } from "../delete-case-dialog";

const OWNER_REMOVES_PATTERN = /You can remove it later from your Trash page/;
const CASE_OWNER_REMOVES_PATTERN =
	/The case owner can remove it later from their Trash page/;

describe("DeleteCaseDialog", () => {
	it("sends 'archive' when Keep as archived is clicked", async () => {
		const user = userEvent.setup();
		const onConfirm = vi.fn();
		render(
			<DeleteCaseDialog
				isOpen
				isOwner
				loading={false}
				onCancel={vi.fn()}
				onConfirm={onConfirm}
			/>
		);

		await user.click(screen.getByRole("button", { name: "Keep as archived" }));

		expect(onConfirm).toHaveBeenCalledWith("archive");
	});

	it("sends 'remove' when Remove from Discover is clicked", async () => {
		const user = userEvent.setup();
		const onConfirm = vi.fn();
		render(
			<DeleteCaseDialog
				isOpen
				isOwner
				loading={false}
				onCancel={vi.fn()}
				onConfirm={onConfirm}
			/>
		);

		await user.click(
			screen.getByRole("button", { name: "Remove from Discover" })
		);

		expect(onConfirm).toHaveBeenCalledWith("remove");
	});

	it("tells the owner they can remove the archived copy themselves", () => {
		render(
			<DeleteCaseDialog
				isOpen
				isOwner
				loading={false}
				onCancel={vi.fn()}
				onConfirm={vi.fn()}
			/>
		);

		expect(screen.getByText(OWNER_REMOVES_PATTERN)).toBeInTheDocument();
	});

	it("tells a non-owner collaborator that the case owner removes it instead", () => {
		render(
			<DeleteCaseDialog
				isOpen
				isOwner={false}
				loading={false}
				onCancel={vi.fn()}
				onConfirm={vi.fn()}
			/>
		);

		expect(screen.getByText(CASE_OWNER_REMOVES_PATTERN)).toBeInTheDocument();
	});
});
