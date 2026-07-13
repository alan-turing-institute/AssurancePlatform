import { waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { IntegrationCaseGrant } from "@/lib/schemas/integration";
import {
	renderWithoutProviders,
	screen,
} from "@/src/__tests__/utils/test-utils";
import { CaseAccessSection } from "../case-access-section";

const GRANT_TRIGGER_REGEX = /grant access to a case/i;
const GRANT_SUBMIT_REGEX = /^grant access$/i;
const CASE_ROW_TEST_ID_REGEX = /^case-access-row-/;
const CASE_COMBOBOX_REGEX = /^case$/i;
const PERMISSION_COMBOBOX_REGEX = /permission level/i;
const REMOVE_ALPHA_TRIGGER_REGEX = /remove access to alpha/i;
const REMOVE_CONFIRM_TEXT_REGEX = /remove access\?/i;
const CONFIRM_BUTTON_REGEX = /^confirm$/i;
const CANCEL_BUTTON_REGEX = /^cancel$/i;
const EMPTY_STATE_TEXT_REGEX =
	/which cases this integration's machine user can touch/i;
const INTEGRATION_MUST_BE_ACTIVE_REGEX = /integration must be active/i;

vi.mock("@/actions/assurance-cases", () => ({
	fetchAssuranceCases: vi.fn().mockResolvedValue([
		{ id: "case-9", name: "Assurance" },
		{ id: "case-10", name: "DARTER Demo — Automated Inspection" },
	]),
}));

function makeGrant(
	overrides: Partial<IntegrationCaseGrant> = {}
): IntegrationCaseGrant {
	return {
		caseId: "case-1",
		caseName: "DARTER Demo — Automated Inspection",
		permission: "EDIT",
		grantedAt: "2026-07-10T00:00:00.000Z",
		...overrides,
	};
}

const baseProps = {
	granting: false,
	grantError: null,
	loadError: null,
	loading: false,
	onGrant: vi.fn().mockResolvedValue(true),
	onRemove: vi.fn(),
	removingCaseId: null,
};

describe("CaseAccessSection", () => {
	describe("ordering and empty state", () => {
		it("renders grants in the order given, each with its permission badge", () => {
			renderWithoutProviders(
				<CaseAccessSection
					{...baseProps}
					grants={[
						makeGrant({
							caseId: "case-1",
							caseName: "Alpha",
							permission: "VIEW",
						}),
						makeGrant({
							caseId: "case-2",
							caseName: "Beta",
							permission: "EDIT",
						}),
					]}
				/>
			);

			const rows = screen.getAllByTestId(CASE_ROW_TEST_ID_REGEX);
			expect(rows).toHaveLength(2);
			expect(rows[0]).toHaveAttribute("data-testid", "case-access-row-case-1");
			expect(rows[1]).toHaveAttribute("data-testid", "case-access-row-case-2");
			expect(rows[0]).toHaveTextContent("VIEW");
			expect(rows[1]).toHaveTextContent("EDIT");
		});

		it("shows the empty-state explanation and the grant button when there are no grants", () => {
			renderWithoutProviders(<CaseAccessSection {...baseProps} grants={[]} />);

			expect(screen.getByText(EMPTY_STATE_TEXT_REGEX)).toBeInTheDocument();
			expect(
				screen.getByRole("button", { name: GRANT_TRIGGER_REGEX })
			).toBeInTheDocument();
			expect(
				screen.queryByTestId(CASE_ROW_TEST_ID_REGEX)
			).not.toBeInTheDocument();
		});
	});

	describe("grant flow", () => {
		it("happy path: opens the form, picks a case and permission, and calls onGrant — then closes the form", async () => {
			const onGrant = vi.fn().mockResolvedValue(true);
			const user = userEvent.setup();
			renderWithoutProviders(
				<CaseAccessSection {...baseProps} grants={[]} onGrant={onGrant} />
			);

			await user.click(
				screen.getByRole("button", { name: GRANT_TRIGGER_REGEX })
			);

			await waitFor(() =>
				expect(
					screen.getByRole("combobox", { name: CASE_COMBOBOX_REGEX })
				).toBeInTheDocument()
			);

			await user.click(
				screen.getByRole("combobox", { name: CASE_COMBOBOX_REGEX })
			);
			await user.click(screen.getByRole("option", { name: "Assurance" }));

			await user.click(
				screen.getByRole("combobox", { name: PERMISSION_COMBOBOX_REGEX })
			);
			await user.click(screen.getByRole("option", { name: "Can edit" }));

			await user.click(
				screen.getByRole("button", { name: GRANT_SUBMIT_REGEX })
			);

			expect(onGrant).toHaveBeenCalledWith("case-9", "EDIT");

			// A successful grant closes the form back to its trigger button.
			await waitFor(() =>
				expect(
					screen.getByRole("button", { name: GRANT_TRIGGER_REGEX })
				).toBeInTheDocument()
			);
			expect(
				screen.queryByRole("button", { name: GRANT_SUBMIT_REGEX })
			).not.toBeInTheDocument();
		});

		it("keeps the form open and surfaces the mapped 409 message without swallowing the error", async () => {
			const onGrant = vi.fn().mockResolvedValue(false);
			const user = userEvent.setup();
			const { rerender } = renderWithoutProviders(
				<CaseAccessSection
					{...baseProps}
					grantError={null}
					grants={[]}
					onGrant={onGrant}
				/>
			);

			await user.click(
				screen.getByRole("button", { name: GRANT_TRIGGER_REGEX })
			);
			await waitFor(() =>
				expect(
					screen.getByRole("combobox", { name: CASE_COMBOBOX_REGEX })
				).toBeInTheDocument()
			);
			await user.click(
				screen.getByRole("combobox", { name: CASE_COMBOBOX_REGEX })
			);
			await user.click(screen.getByRole("option", { name: "Assurance" }));

			await user.click(
				screen.getByRole("button", { name: GRANT_SUBMIT_REGEX })
			);

			expect(onGrant).toHaveBeenCalledWith("case-9", "VIEW");

			// The real hook (`useIntegrationCaseGrants`) sets `grantError` only
			// once the rejected promise's `.catch` runs, which lands as a prop
			// update from `IntegrationCard` a render after the failed attempt —
			// this rerender is that update, not a contrived shortcut.
			rerender(
				<CaseAccessSection
					{...baseProps}
					grantError="This integration must be ACTIVE before it can be granted access to a case. Reactivate it, then try again."
					grants={[]}
					onGrant={onGrant}
				/>
			);

			expect(screen.getByRole("alert")).toHaveTextContent(
				INTEGRATION_MUST_BE_ACTIVE_REGEX
			);
			// Not swallowed, and the form stays open for a retry — never silently
			// reverts to the collapsed trigger button on failure.
			expect(
				screen.getByRole("button", { name: GRANT_SUBMIT_REGEX })
			).toBeInTheDocument();
		});
	});

	describe("remove flow", () => {
		it("requires an inline confirm click before calling onRemove", async () => {
			const onRemove = vi.fn();
			const user = userEvent.setup();
			renderWithoutProviders(
				<CaseAccessSection
					{...baseProps}
					grants={[makeGrant({ caseId: "case-1", caseName: "Alpha" })]}
					onRemove={onRemove}
				/>
			);

			await user.click(
				screen.getByRole("button", { name: REMOVE_ALPHA_TRIGGER_REGEX })
			);
			expect(onRemove).not.toHaveBeenCalled();
			expect(screen.getByText(REMOVE_CONFIRM_TEXT_REGEX)).toBeInTheDocument();

			await user.click(
				screen.getByRole("button", { name: CONFIRM_BUTTON_REGEX })
			);
			expect(onRemove).toHaveBeenCalledWith("case-1");
		});

		it("does not call onRemove when the inline confirm is cancelled", async () => {
			const onRemove = vi.fn();
			const user = userEvent.setup();
			renderWithoutProviders(
				<CaseAccessSection
					{...baseProps}
					grants={[makeGrant({ caseId: "case-1", caseName: "Alpha" })]}
					onRemove={onRemove}
				/>
			);

			await user.click(
				screen.getByRole("button", { name: REMOVE_ALPHA_TRIGGER_REGEX })
			);
			await user.click(
				screen.getByRole("button", { name: CANCEL_BUTTON_REGEX })
			);

			expect(onRemove).not.toHaveBeenCalled();
			expect(
				screen.queryByText(REMOVE_CONFIRM_TEXT_REGEX)
			).not.toBeInTheDocument();
		});
	});
});
