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
const TRY_AGAIN_BUTTON_REGEX = /^try again$/i;
const ADMIN_OPTION_REGEX = /admin/i;
const GRANTING_BUTTON_REGEX = /^granting…$/i;

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
	integrationActive: true,
	loadError: null,
	loading: false,
	onClearGrantError: vi.fn(),
	onGrant: vi.fn().mockResolvedValue(true),
	onRemove: vi.fn(),
	onRetry: vi.fn(),
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

	describe("activation gating", () => {
		it("disables the grant trigger with a tooltip when the integration isn't ACTIVE", () => {
			renderWithoutProviders(
				<CaseAccessSection
					{...baseProps}
					grants={[]}
					integrationActive={false}
				/>
			);

			const trigger = screen.getByRole("button", { name: GRANT_TRIGGER_REGEX });
			expect(trigger).toBeDisabled();
			expect(trigger).toHaveAttribute(
				"title",
				"Only an ACTIVE integration can be granted access to a case"
			);
		});

		it("leaves existing grants' remove action enabled when the integration isn't ACTIVE — only the grant trigger is gated (N1: GET/DELETE deliberately ungated)", () => {
			renderWithoutProviders(
				<CaseAccessSection
					{...baseProps}
					grants={[makeGrant({ caseId: "case-1", caseName: "Alpha" })]}
					integrationActive={false}
				/>
			);

			expect(
				screen.getByRole("button", { name: REMOVE_ALPHA_TRIGGER_REGEX })
			).not.toBeDisabled();
		});
	});

	describe("stale-form path (revoke/suspend while the grant form is open)", () => {
		// `CaseAccessSection` itself carries no logic to force its own `addOpen`
		// state closed when `integrationActive` flips — that reset is owned by
		// `IntegrationCard`, which keys this component to activity so a
		// revoke/suspend remounts it (see `integration-card.tsx` and its own
		// "closes the open grant form..." test). This test exercises that exact
		// contract — a real key change across rerenders, matching how
		// `IntegrationCard` renders this component in production — rather than
		// a plain prop rerender, which would (correctly) leave `addOpen` alone
		// since React never remounts on a bare prop change.
		it("discards the open grant form when remounted via a key change on integrationActive, without ever calling onGrant", async () => {
			const onGrant = vi.fn().mockResolvedValue(true);
			const user = userEvent.setup();
			const { rerender } = renderWithoutProviders(
				<CaseAccessSection
					key="active"
					{...baseProps}
					grants={[]}
					integrationActive={true}
					onGrant={onGrant}
				/>
			);

			await user.click(
				screen.getByRole("button", { name: GRANT_TRIGGER_REGEX })
			);
			await waitFor(() =>
				expect(
					screen.getByRole("button", { name: GRANT_SUBMIT_REGEX })
				).toBeInTheDocument()
			);

			// Same card, same session: the integration is revoked/suspended out
			// from under the still-open form — `IntegrationCard` re-renders this
			// section with a new `key` once its status flips non-ACTIVE, forcing
			// exactly the remount this test performs directly.
			rerender(
				<CaseAccessSection
					key="inactive"
					{...baseProps}
					grants={[]}
					integrationActive={false}
					onGrant={onGrant}
				/>
			);

			await waitFor(() =>
				expect(
					screen.queryByRole("button", { name: GRANT_SUBMIT_REGEX })
				).not.toBeInTheDocument()
			);
			expect(
				screen.getByRole("button", { name: GRANT_TRIGGER_REGEX })
			).toBeDisabled();
			expect(onGrant).not.toHaveBeenCalled();
		});
	});

	describe("load error", () => {
		it("shows a Try again button wired to onRetry alongside the error message", async () => {
			const onRetry = vi.fn();
			const user = userEvent.setup();
			renderWithoutProviders(
				<CaseAccessSection
					{...baseProps}
					grants={[]}
					loadError="Failed to list case grants"
					onRetry={onRetry}
				/>
			);

			expect(
				screen.getByText("Failed to list case grants")
			).toBeInTheDocument();

			await user.click(
				screen.getByRole("button", { name: TRY_AGAIN_BUTTON_REGEX })
			);
			expect(onRetry).toHaveBeenCalledTimes(1);
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

		it("never offers ADMIN as a permission option — only VIEW/COMMENT/EDIT (a machine principal can never hold case-ADMIN)", async () => {
			const user = userEvent.setup();
			renderWithoutProviders(<CaseAccessSection {...baseProps} grants={[]} />);

			await user.click(
				screen.getByRole("button", { name: GRANT_TRIGGER_REGEX })
			);
			await waitFor(() =>
				expect(
					screen.getByRole("combobox", { name: CASE_COMBOBOX_REGEX })
				).toBeInTheDocument()
			);
			await user.click(
				screen.getByRole("combobox", { name: PERMISSION_COMBOBOX_REGEX })
			);

			const options = screen.getAllByRole("option");
			expect(options.map((option) => option.textContent)).toEqual([
				"Can view",
				"Can comment",
				"Can edit",
			]);
			expect(
				screen.queryByRole("option", { name: ADMIN_OPTION_REGEX })
			).not.toBeInTheDocument();
		});

		it("disables the submit button while a grant is in flight, so a further click fires nothing", async () => {
			const onGrant = vi.fn().mockResolvedValue(true);
			const user = userEvent.setup();
			const { rerender } = renderWithoutProviders(
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

			// Mirrors the real sequence: the instant `onGrant` (backed by the
			// real hook's `grantAccess`) goes in flight, `IntegrationCard` passes
			// down `granting: true` from `useIntegrationCaseGrants` a render
			// later — this rerender is that update, same convention as the 409
			// test above.
			rerender(
				<CaseAccessSection
					{...baseProps}
					granting={true}
					grants={[]}
					onGrant={onGrant}
				/>
			);

			// Its label switches to "Granting…" the instant `granting` flips —
			// same busy-label convention as the Issue-Token button.
			const submitButton = screen.getByRole("button", {
				name: GRANTING_BUTTON_REGEX,
			});
			expect(submitButton).toBeDisabled();

			await user.click(submitButton);
			expect(onGrant).not.toHaveBeenCalled();
		});
	});

	describe("stale grant-error banner (N2)", () => {
		it("calls onClearGrantError when the grant form is opened", async () => {
			const onClearGrantError = vi.fn();
			const user = userEvent.setup();
			renderWithoutProviders(
				<CaseAccessSection
					{...baseProps}
					grants={[]}
					onClearGrantError={onClearGrantError}
				/>
			);

			await user.click(
				screen.getByRole("button", { name: GRANT_TRIGGER_REGEX })
			);

			expect(onClearGrantError).toHaveBeenCalledTimes(1);
		});

		it("calls onClearGrantError when the grant form is cancelled, so a past attempt's banner doesn't resurface on the next open", async () => {
			const onClearGrantError = vi.fn();
			const user = userEvent.setup();
			renderWithoutProviders(
				<CaseAccessSection
					{...baseProps}
					grantError="Revoked integrations cannot be restored — register a new integration and grant it access instead."
					grants={[]}
					onClearGrantError={onClearGrantError}
				/>
			);

			await user.click(
				screen.getByRole("button", { name: GRANT_TRIGGER_REGEX })
			);
			onClearGrantError.mockClear();

			await waitFor(() =>
				expect(
					screen.getByRole("button", { name: CANCEL_BUTTON_REGEX })
				).toBeInTheDocument()
			);
			await user.click(
				screen.getByRole("button", { name: CANCEL_BUTTON_REGEX })
			);

			expect(onClearGrantError).toHaveBeenCalledTimes(1);
			expect(
				screen.getByRole("button", { name: GRANT_TRIGGER_REGEX })
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

		it("moves focus to the Confirm button the moment the inline confirm appears", async () => {
			const user = userEvent.setup();
			renderWithoutProviders(
				<CaseAccessSection
					{...baseProps}
					grants={[makeGrant({ caseId: "case-1", caseName: "Alpha" })]}
				/>
			);

			await user.click(
				screen.getByRole("button", { name: REMOVE_ALPHA_TRIGGER_REGEX })
			);

			await waitFor(() =>
				expect(
					screen.getByRole("button", { name: CONFIRM_BUTTON_REGEX })
				).toHaveFocus()
			);
		});

		it("returns focus to the Remove trigger when the inline confirm is cancelled", async () => {
			const user = userEvent.setup();
			renderWithoutProviders(
				<CaseAccessSection
					{...baseProps}
					grants={[makeGrant({ caseId: "case-1", caseName: "Alpha" })]}
				/>
			);

			await user.click(
				screen.getByRole("button", { name: REMOVE_ALPHA_TRIGGER_REGEX })
			);
			await user.click(
				screen.getByRole("button", { name: CANCEL_BUTTON_REGEX })
			);

			await waitFor(() =>
				expect(
					screen.getByRole("button", { name: REMOVE_ALPHA_TRIGGER_REGEX })
				).toHaveFocus()
			);
		});
	});
});
