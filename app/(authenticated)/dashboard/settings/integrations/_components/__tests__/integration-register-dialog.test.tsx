import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
	renderWithoutProviders,
	screen,
} from "@/src/__tests__/utils/test-utils";
import { IntegrationRegisterDialog } from "../integration-register-dialog";

const NAME_LABEL_REGEX = /^name$/i;
const DESCRIPTION_LABEL_REGEX = /description/i;
const READ_CASES_CHECKBOX_REGEX = /read cases/i;
const SUBMIT_BUTTON_REGEX = /register integration/i;
const CANCEL_BUTTON_REGEX = /cancel/i;
const NAME_REQUIRED_REGEX = /name is required/i;
const SCOPE_REQUIRED_REGEX = /at least one scope is required/i;

describe("IntegrationRegisterDialog", () => {
	it("renders nothing when closed", () => {
		renderWithoutProviders(
			<IntegrationRegisterDialog
				onOpenChange={vi.fn()}
				onSubmit={vi.fn()}
				open={false}
				submitting={false}
			/>
		);

		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
	});

	it("renders the name, description, and every closed-vocabulary scope as a checkbox when open", () => {
		renderWithoutProviders(
			<IntegrationRegisterDialog
				onOpenChange={vi.fn()}
				onSubmit={vi.fn()}
				open
				submitting={false}
			/>
		);

		expect(screen.getByLabelText(NAME_LABEL_REGEX)).toBeInTheDocument();
		expect(screen.getByLabelText(DESCRIPTION_LABEL_REGEX)).toBeInTheDocument();
		expect(screen.getAllByRole("checkbox")).toHaveLength(3);
		expect(screen.getByText("case:read")).toBeInTheDocument();
		expect(screen.getByText("health:evidence:read")).toBeInTheDocument();
		expect(screen.getByText("health:evidence:write")).toBeInTheDocument();
	});

	it("blocks submission and shows inline errors when name is empty and no scope is selected", async () => {
		const onSubmit = vi.fn();
		const user = userEvent.setup();

		renderWithoutProviders(
			<IntegrationRegisterDialog
				onOpenChange={vi.fn()}
				onSubmit={onSubmit}
				open
				submitting={false}
			/>
		);

		await user.click(screen.getByRole("button", { name: SUBMIT_BUTTON_REGEX }));

		expect(await screen.findByText(NAME_REQUIRED_REGEX)).toBeInTheDocument();
		expect(screen.getByText(SCOPE_REQUIRED_REGEX)).toBeInTheDocument();
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("submits the parsed values (name, description, scopes) and closes on success", async () => {
		const onSubmit = vi.fn().mockResolvedValue(true);
		const onOpenChange = vi.fn();
		const user = userEvent.setup();

		renderWithoutProviders(
			<IntegrationRegisterDialog
				onOpenChange={onOpenChange}
				onSubmit={onSubmit}
				open
				submitting={false}
			/>
		);

		await user.type(
			screen.getByLabelText(NAME_LABEL_REGEX),
			"darter-evidence-pipeline"
		);
		await user.type(
			screen.getByLabelText(DESCRIPTION_LABEL_REGEX),
			"Evidence collection pipeline"
		);
		await user.click(
			screen.getByRole("checkbox", { name: READ_CASES_CHECKBOX_REGEX })
		);

		await user.click(screen.getByRole("button", { name: SUBMIT_BUTTON_REGEX }));

		await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
		expect(onSubmit).toHaveBeenCalledWith({
			name: "darter-evidence-pipeline",
			description: "Evidence collection pipeline",
			scopes: ["case:read"],
		});
		await vi.waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
	});

	it("does not close the dialog when the submission fails", async () => {
		const onSubmit = vi.fn().mockResolvedValue(false);
		const onOpenChange = vi.fn();
		const user = userEvent.setup();

		renderWithoutProviders(
			<IntegrationRegisterDialog
				onOpenChange={onOpenChange}
				onSubmit={onSubmit}
				open
				submitting={false}
			/>
		);

		await user.type(screen.getByLabelText(NAME_LABEL_REGEX), "already-exists");
		await user.click(
			screen.getByRole("checkbox", { name: READ_CASES_CHECKBOX_REGEX })
		);
		await user.click(screen.getByRole("button", { name: SUBMIT_BUTTON_REGEX }));

		await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
		expect(onOpenChange).not.toHaveBeenCalled();
	});

	it("calls onOpenChange(false) from Cancel without submitting", async () => {
		const onSubmit = vi.fn();
		const onOpenChange = vi.fn();
		const user = userEvent.setup();

		renderWithoutProviders(
			<IntegrationRegisterDialog
				onOpenChange={onOpenChange}
				onSubmit={onSubmit}
				open
				submitting={false}
			/>
		);

		await user.click(screen.getByRole("button", { name: CANCEL_BUTTON_REGEX }));

		expect(onOpenChange).toHaveBeenCalledWith(false);
		expect(onSubmit).not.toHaveBeenCalled();
	});
});
