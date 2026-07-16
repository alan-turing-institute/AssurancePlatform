import { waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IntegrationListItem } from "@/lib/schemas/integration";
import { server } from "@/src/__tests__/mocks/server";
import {
	renderWithoutProviders,
	screen,
	within,
} from "@/src/__tests__/utils/test-utils";
import { IntegrationCard } from "../integration-card";

const SUSPEND_BUTTON_REGEX = /suspend/i;
const REACTIVATE_BUTTON_REGEX = /reactivate/i;
const REVOKE_INTEGRATION_TRIGGER_REGEX = /revoke this integration/i;
const REVOKE_INTEGRATION_CONFIRM_REGEX = /revoke integration/i;
const REVOKE_TOKEN_TRIGGER_REGEX = /revoke this token/i;
const REVOKE_TOKEN_CONFIRM_REGEX = /revoke token/i;
const CANCEL_BUTTON_REGEX = /cancel/i;
const DELETE_TRIGGER_REGEX = /^delete$/i;
const DELETE_CONFIRM_REGEX = /delete integration/i;
const DELETE_TOOLTIP_TEXT = "Revoke first — delete is permanent";
const TYPE_NAME_LABEL_REGEX = /type.*to confirm/i;
const ISSUE_TOKEN_BUTTON_REGEX = /issue new token/i;
const PERMANENT_TEXT_REGEX = /permanent/i;
const CANNOT_BE_UNDONE_TEXT_REGEX = /cannot be undone/i;
const DONE_BUTTON_REGEX = /done.*stored it/i;
const TOKEN_ROW_TEST_ID_REGEX = /^token-row-/;
const GRANT_TRIGGER_REGEX = /grant access to a case/i;
const GRANT_SUBMIT_REGEX = /^grant access$/i;
const CASE_COMBOBOX_REGEX = /^case$/i;
const PERMISSION_COMBOBOX_REGEX = /permission level/i;
const DELETING_LABEL_REGEX = /deleting…/i;
const REACTIVATE_IT_TEXT_REGEX = /reactivate it/i;
const REVOKED_SECTION_BUTTON_REGEX = /^revoked/i;
const ROTATE_BUTTON_REGEX = /^rotate$/i;
const REVOKE_TOKEN_BUTTON_REGEX = /revoke this token/i;

vi.mock("@/actions/assurance-cases", () => ({
	fetchAssuranceCases: vi
		.fn()
		.mockResolvedValue([{ id: "case-9", name: "Assurance" }]),
}));

function makeIntegration(
	overrides: Partial<IntegrationListItem> = {}
): IntegrationListItem {
	return {
		id: "integration-1",
		name: "darter-evidence-pipeline",
		description: "Evidence collection pipeline",
		scopes: ["case:read"],
		status: "ACTIVE",
		createdAt: "2026-06-01T00:00:00.000Z",
		updatedAt: "2026-06-01T00:00:00.000Z",
		lastSeenAt: null,
		tokens: [
			{
				id: "token-1",
				tokenPrefix: "tea_live_ab12",
				createdAt: "2026-06-01T00:00:00.000Z",
				lastUsedAt: null,
				expiresAt: null,
				revokedAt: null,
			},
		],
		...overrides,
	};
}

const baseProps = {
	deleting: false,
	onDelete: vi.fn(),
	onIssueToken: vi.fn().mockResolvedValue(null),
	onReactivate: vi.fn(),
	onRevoke: vi.fn(),
	onRevokeToken: vi.fn(),
	onRotateToken: vi.fn().mockResolvedValue(null),
	onSuspend: vi.fn(),
	pending: false,
	pendingTokenKey: null,
};

// Every render of `IntegrationCard` now fires its own
// `GET .../case-grants` (see `useIntegrationCaseGrants`, called directly
// from `IntegrationCard` — one hook per card instance, not per list). None
// of the pre-existing tests below care about case access, so this default
// keeps them exercising exactly what they did before that section existed;
// the dedicated case-access describe block overrides it per scenario.
beforeEach(() => {
	server.use(
		http.get("/api/integrations/:id/case-grants", () =>
			HttpResponse.json({ grants: [] })
		)
	);
});

describe("IntegrationCard", () => {
	describe("status-gated lifecycle actions", () => {
		it("shows Suspend and Revoke (not Reactivate) for an ACTIVE integration", () => {
			renderWithoutProviders(
				<IntegrationCard
					{...baseProps}
					integration={makeIntegration({ status: "ACTIVE" })}
				/>
			);

			expect(
				screen.getByRole("button", { name: SUSPEND_BUTTON_REGEX })
			).toBeInTheDocument();
			expect(
				screen.getByRole("button", { name: REVOKE_INTEGRATION_TRIGGER_REGEX })
			).toBeInTheDocument();
			expect(
				screen.queryByRole("button", { name: REACTIVATE_BUTTON_REGEX })
			).not.toBeInTheDocument();
		});

		it("shows Reactivate and Revoke (not Suspend) for a SUSPENDED integration", () => {
			renderWithoutProviders(
				<IntegrationCard
					{...baseProps}
					integration={makeIntegration({ status: "SUSPENDED" })}
				/>
			);

			expect(
				screen.getByRole("button", { name: REACTIVATE_BUTTON_REGEX })
			).toBeInTheDocument();
			expect(
				screen.getByRole("button", { name: REVOKE_INTEGRATION_TRIGGER_REGEX })
			).toBeInTheDocument();
			expect(
				screen.queryByRole("button", { name: SUSPEND_BUTTON_REGEX })
			).not.toBeInTheDocument();
		});

		it("shows neither Suspend, Reactivate, nor Revoke for a REVOKED integration — only Delete remains", () => {
			renderWithoutProviders(
				<IntegrationCard
					{...baseProps}
					integration={makeIntegration({ status: "REVOKED" })}
				/>
			);

			expect(
				screen.queryByRole("button", { name: SUSPEND_BUTTON_REGEX })
			).not.toBeInTheDocument();
			expect(
				screen.queryByRole("button", { name: REACTIVATE_BUTTON_REGEX })
			).not.toBeInTheDocument();
			expect(
				screen.queryByRole("button", { name: REVOKE_INTEGRATION_TRIGGER_REGEX })
			).not.toBeInTheDocument();
			expect(
				screen.getByRole("button", { name: DELETE_TRIGGER_REGEX })
			).toBeInTheDocument();
		});
	});

	describe("delete needs a guard — revoke first", () => {
		it("disables Delete with an explanatory tooltip for an ACTIVE integration", () => {
			renderWithoutProviders(
				<IntegrationCard
					{...baseProps}
					integration={makeIntegration({ status: "ACTIVE" })}
				/>
			);

			const deleteButton = screen.getByRole("button", {
				name: DELETE_TRIGGER_REGEX,
			});
			expect(deleteButton).toBeDisabled();
			expect(deleteButton).toHaveAttribute("title", DELETE_TOOLTIP_TEXT);
		});

		it("disables Delete with an explanatory tooltip for a SUSPENDED integration", () => {
			renderWithoutProviders(
				<IntegrationCard
					{...baseProps}
					integration={makeIntegration({ status: "SUSPENDED" })}
				/>
			);

			const deleteButton = screen.getByRole("button", {
				name: DELETE_TRIGGER_REGEX,
			});
			expect(deleteButton).toBeDisabled();
			expect(deleteButton).toHaveAttribute("title", DELETE_TOOLTIP_TEXT);
		});

		it("enables Delete with no tooltip for a REVOKED integration", () => {
			renderWithoutProviders(
				<IntegrationCard
					{...baseProps}
					integration={makeIntegration({ status: "REVOKED" })}
				/>
			);

			const deleteButton = screen.getByRole("button", {
				name: DELETE_TRIGGER_REGEX,
			});
			expect(deleteButton).toBeEnabled();
			expect(deleteButton).not.toHaveAttribute("title");
		});

		it("keeps the destructive confirm button disabled when the typed text doesn't exactly match the integration's name", async () => {
			const onDelete = vi.fn();
			const user = userEvent.setup();
			const integration = makeIntegration({ status: "REVOKED" });
			renderWithoutProviders(
				<IntegrationCard
					{...baseProps}
					integration={integration}
					onDelete={onDelete}
				/>
			);

			await user.click(
				screen.getByRole("button", { name: DELETE_TRIGGER_REGEX })
			);
			await screen.findByRole("alertdialog");

			const confirmButton = screen.getByRole("button", {
				name: DELETE_CONFIRM_REGEX,
			});
			await user.type(
				screen.getByLabelText(TYPE_NAME_LABEL_REGEX),
				`${integration.name}-typo`
			);
			expect(confirmButton).toBeDisabled();

			await user.click(confirmButton);
			expect(onDelete).not.toHaveBeenCalled();
		});

		it("calls onDelete neither on cancel, nor before the dialog is confirmed, and closes the dialog", async () => {
			const onDelete = vi.fn();
			const user = userEvent.setup();
			const integration = makeIntegration({ status: "REVOKED" });
			renderWithoutProviders(
				<IntegrationCard
					{...baseProps}
					integration={integration}
					onDelete={onDelete}
				/>
			);

			await user.click(
				screen.getByRole("button", { name: DELETE_TRIGGER_REGEX })
			);
			await screen.findByRole("alertdialog");
			await user.type(
				screen.getByLabelText(TYPE_NAME_LABEL_REGEX),
				integration.name
			);
			await user.click(
				screen.getByRole("button", { name: CANCEL_BUTTON_REGEX })
			);

			expect(onDelete).not.toHaveBeenCalled();
			expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
		});
	});

	describe("delete dialog — QA probe regressions", () => {
		it("disables both Cancel and the destructive confirm, and relabels the confirm button, while a delete is in flight", async () => {
			const user = userEvent.setup();
			const integration = makeIntegration({ status: "REVOKED" });
			const { rerender } = renderWithoutProviders(
				<IntegrationCard
					{...baseProps}
					deleting={false}
					integration={integration}
				/>
			);

			await user.click(
				screen.getByRole("button", { name: DELETE_TRIGGER_REGEX })
			);
			await screen.findByRole("alertdialog");

			const cancelButton = screen.getByRole("button", {
				name: CANCEL_BUTTON_REGEX,
			});
			const confirmButton = screen.getByRole("button", {
				name: DELETE_CONFIRM_REGEX,
			});

			rerender(
				<IntegrationCard
					{...baseProps}
					deleting={true}
					integration={integration}
				/>
			);

			expect(cancelButton).toBeDisabled();
			expect(confirmButton).toBeDisabled();
			expect(confirmButton).toHaveTextContent(DELETING_LABEL_REGEX);
		});

		it("resets the typed name when the dialog is cancelled and reopened — a remembered name must never pre-enable delete", async () => {
			const user = userEvent.setup();
			const integration = makeIntegration({ status: "REVOKED" });
			renderWithoutProviders(
				<IntegrationCard {...baseProps} integration={integration} />
			);

			await user.click(
				screen.getByRole("button", { name: DELETE_TRIGGER_REGEX })
			);
			await screen.findByRole("alertdialog");
			await user.type(
				screen.getByLabelText(TYPE_NAME_LABEL_REGEX),
				integration.name
			);
			expect(
				screen.getByRole("button", { name: DELETE_CONFIRM_REGEX })
			).toBeEnabled();

			await user.click(
				screen.getByRole("button", { name: CANCEL_BUTTON_REGEX })
			);
			expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

			await user.click(
				screen.getByRole("button", { name: DELETE_TRIGGER_REGEX })
			);
			await screen.findByRole("alertdialog");

			expect(screen.getByLabelText(TYPE_NAME_LABEL_REGEX)).toHaveValue("");
			expect(
				screen.getByRole("button", { name: DELETE_CONFIRM_REGEX })
			).toBeDisabled();
		});

		it("keeps the confirm button disabled when the typed name has trailing whitespace the real name doesn't have", async () => {
			const user = userEvent.setup();
			const integration = makeIntegration({ status: "REVOKED" });
			renderWithoutProviders(
				<IntegrationCard {...baseProps} integration={integration} />
			);

			await user.click(
				screen.getByRole("button", { name: DELETE_TRIGGER_REGEX })
			);
			await screen.findByRole("alertdialog");
			await user.type(
				screen.getByLabelText(TYPE_NAME_LABEL_REGEX),
				`${integration.name}  `
			);

			expect(
				screen.getByRole("button", { name: DELETE_CONFIRM_REGEX })
			).toBeDisabled();
		});

		it("keeps the confirm button disabled when the typed name differs only in case", async () => {
			const user = userEvent.setup();
			const integration = makeIntegration({ status: "REVOKED" });
			renderWithoutProviders(
				<IntegrationCard {...baseProps} integration={integration} />
			);

			await user.click(
				screen.getByRole("button", { name: DELETE_TRIGGER_REGEX })
			);
			await screen.findByRole("alertdialog");
			await user.type(
				screen.getByLabelText(TYPE_NAME_LABEL_REGEX),
				integration.name.toUpperCase()
			);

			expect(
				screen.getByRole("button", { name: DELETE_CONFIRM_REGEX })
			).toBeDisabled();
		});

		it("keeps the confirm button disabled when the typed text is a proper prefix of the name", async () => {
			const user = userEvent.setup();
			const integration = makeIntegration({ status: "REVOKED" });
			renderWithoutProviders(
				<IntegrationCard {...baseProps} integration={integration} />
			);

			await user.click(
				screen.getByRole("button", { name: DELETE_TRIGGER_REGEX })
			);
			await screen.findByRole("alertdialog");
			await user.type(
				screen.getByLabelText(TYPE_NAME_LABEL_REGEX),
				integration.name.slice(0, -1)
			);

			expect(
				screen.getByRole("button", { name: DELETE_CONFIRM_REGEX })
			).toBeDisabled();
		});

		it("matches an integration name containing regex metacharacters only by exact literal equality", async () => {
			const user = userEvent.setup();
			const integration = makeIntegration({
				status: "REVOKED",
				name: "pipe.line(v2)+",
			});
			renderWithoutProviders(
				<IntegrationCard {...baseProps} integration={integration} />
			);

			await user.click(
				screen.getByRole("button", { name: DELETE_TRIGGER_REGEX })
			);
			await screen.findByRole("alertdialog");

			const confirmButton = screen.getByRole("button", {
				name: DELETE_CONFIRM_REGEX,
			});
			const input = screen.getByLabelText(TYPE_NAME_LABEL_REGEX);

			// If the comparison were ever refactored into a regex test instead of
			// `===`, the "." here would match any character and this string
			// would wrongly enable the button.
			await user.type(input, "pipeXline(v2)+");
			expect(confirmButton).toBeDisabled();

			await user.clear(input);
			await user.type(input, integration.name);
			expect(confirmButton).toBeEnabled();
		});

		it("closes the dialog on Escape without calling onDelete", async () => {
			const onDelete = vi.fn();
			const user = userEvent.setup();
			const integration = makeIntegration({ status: "REVOKED" });
			renderWithoutProviders(
				<IntegrationCard
					{...baseProps}
					integration={integration}
					onDelete={onDelete}
				/>
			);

			await user.click(
				screen.getByRole("button", { name: DELETE_TRIGGER_REGEX })
			);
			await screen.findByRole("alertdialog");

			await user.keyboard("{Escape}");

			expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
			expect(onDelete).not.toHaveBeenCalled();
		});
	});

	describe("confirm dialogs gate destructive actions", () => {
		it("does not call onRevoke until the confirm dialog is accepted", async () => {
			const onRevoke = vi.fn();
			const user = userEvent.setup();
			renderWithoutProviders(
				<IntegrationCard
					{...baseProps}
					integration={makeIntegration()}
					onRevoke={onRevoke}
				/>
			);

			await user.click(
				screen.getByRole("button", { name: REVOKE_INTEGRATION_TRIGGER_REGEX })
			);
			expect(onRevoke).not.toHaveBeenCalled();

			const dialog = await screen.findByRole("dialog");
			expect(dialog).toHaveTextContent(PERMANENT_TEXT_REGEX);

			await user.click(
				screen.getByRole("button", { name: REVOKE_INTEGRATION_CONFIRM_REGEX })
			);
			expect(onRevoke).toHaveBeenCalledWith("integration-1");
		});

		it("does not revoke when the confirm dialog is cancelled", async () => {
			const onRevoke = vi.fn();
			const user = userEvent.setup();
			renderWithoutProviders(
				<IntegrationCard
					{...baseProps}
					integration={makeIntegration()}
					onRevoke={onRevoke}
				/>
			);

			await user.click(
				screen.getByRole("button", { name: REVOKE_INTEGRATION_TRIGGER_REGEX })
			);
			await screen.findByRole("dialog");
			await user.click(
				screen.getByRole("button", { name: CANCEL_BUTTON_REGEX })
			);

			expect(onRevoke).not.toHaveBeenCalled();
			expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
		});

		it("does not call onDelete until the delete confirm dialog is accepted with the exact name typed", async () => {
			const onDelete = vi.fn();
			const user = userEvent.setup();
			const integration = makeIntegration({ status: "REVOKED" });
			renderWithoutProviders(
				<IntegrationCard
					{...baseProps}
					integration={integration}
					onDelete={onDelete}
				/>
			);

			await user.click(
				screen.getByRole("button", { name: DELETE_TRIGGER_REGEX })
			);
			expect(onDelete).not.toHaveBeenCalled();

			const dialog = await screen.findByRole("alertdialog");
			expect(dialog).toHaveTextContent(CANNOT_BE_UNDONE_TEXT_REGEX);

			const confirmButton = screen.getByRole("button", {
				name: DELETE_CONFIRM_REGEX,
			});
			expect(confirmButton).toBeDisabled();

			await user.type(
				screen.getByLabelText(TYPE_NAME_LABEL_REGEX),
				integration.name
			);
			expect(confirmButton).toBeEnabled();

			await user.click(confirmButton);
			expect(onDelete).toHaveBeenCalledTimes(1);
			expect(onDelete).toHaveBeenCalledWith("integration-1");
		});

		it("does not call onRevokeToken until the token revoke confirm dialog is accepted", async () => {
			const onRevokeToken = vi.fn();
			const user = userEvent.setup();
			renderWithoutProviders(
				<IntegrationCard
					{...baseProps}
					integration={makeIntegration()}
					onRevokeToken={onRevokeToken}
				/>
			);

			await user.click(
				screen.getByRole("button", { name: REVOKE_TOKEN_TRIGGER_REGEX })
			);
			expect(onRevokeToken).not.toHaveBeenCalled();

			await screen.findByRole("dialog");
			await user.click(
				screen.getByRole("button", { name: REVOKE_TOKEN_CONFIRM_REGEX })
			);

			expect(onRevokeToken).toHaveBeenCalledWith("integration-1", "token-1");
		});

		it("does not call onRevokeToken when the token revoke confirm dialog is cancelled", async () => {
			const onRevokeToken = vi.fn();
			const user = userEvent.setup();
			renderWithoutProviders(
				<IntegrationCard
					{...baseProps}
					integration={makeIntegration()}
					onRevokeToken={onRevokeToken}
				/>
			);

			await user.click(
				screen.getByRole("button", { name: REVOKE_TOKEN_TRIGGER_REGEX })
			);
			await screen.findByRole("dialog");
			await user.click(
				screen.getByRole("button", { name: CANCEL_BUTTON_REGEX })
			);

			expect(onRevokeToken).not.toHaveBeenCalled();
			expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
		});
	});

	describe("tokens", () => {
		it("disables Issue new token when the integration isn't ACTIVE", () => {
			renderWithoutProviders(
				<IntegrationCard
					{...baseProps}
					integration={makeIntegration({ status: "SUSPENDED" })}
				/>
			);

			expect(
				screen.getByRole("button", { name: ISSUE_TOKEN_BUTTON_REGEX })
			).toBeDisabled();
		});

		it("shows a token-shown-once modal after issuing succeeds", async () => {
			const onIssueToken = vi.fn().mockResolvedValue({
				secret: "tea_live_freshsecret",
				token: {
					id: "token-2",
					tokenPrefix: "tea_live_cd34",
					createdAt: "2026-07-05T00:00:00.000Z",
					expiresAt: null,
				},
			});
			const user = userEvent.setup();
			renderWithoutProviders(
				<IntegrationCard
					{...baseProps}
					integration={makeIntegration()}
					onIssueToken={onIssueToken}
				/>
			);

			await user.click(
				screen.getByRole("button", { name: ISSUE_TOKEN_BUTTON_REGEX })
			);

			expect(await screen.findByTestId("token-secret-value")).toHaveTextContent(
				"tea_live_freshsecret"
			);
		});

		it("clears the revealed secret from the DOM once Done is clicked — IntegrationCard's own onClose wiring, not just the modal's isolated behaviour", async () => {
			const onIssueToken = vi.fn().mockResolvedValue({
				secret: "tea_live_freshsecret",
				token: {
					id: "token-2",
					tokenPrefix: "tea_live_cd34",
					createdAt: "2026-07-05T00:00:00.000Z",
					expiresAt: null,
				},
			});
			const user = userEvent.setup();
			renderWithoutProviders(
				<IntegrationCard
					{...baseProps}
					integration={makeIntegration()}
					onIssueToken={onIssueToken}
				/>
			);

			await user.click(
				screen.getByRole("button", { name: ISSUE_TOKEN_BUTTON_REGEX })
			);
			expect(await screen.findByTestId("token-secret-value")).toHaveTextContent(
				"tea_live_freshsecret"
			);

			await user.click(screen.getByRole("button", { name: DONE_BUTTON_REGEX }));

			// A regression to `onClose={() => {}}` (a no-op) would leave this
			// element in the DOM — `IntegrationTokenSecretModal`'s own isolated
			// test cannot catch that, since it only ever rerenders with a
			// directly-supplied `reveal` prop rather than exercising
			// `IntegrationCard`'s `setTokenReveal(null)` handler.
			expect(
				screen.queryByTestId("token-secret-value")
			).not.toBeInTheDocument();
			expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
		});

		it("shows an empty-tokens message and no token rows when the integration has none issued", () => {
			renderWithoutProviders(
				<IntegrationCard
					{...baseProps}
					integration={makeIntegration({ tokens: [] })}
				/>
			);

			expect(screen.getByText("No tokens issued yet.")).toBeInTheDocument();
			expect(
				screen.queryByTestId(TOKEN_ROW_TEST_ID_REGEX)
			).not.toBeInTheDocument();
		});
	});

	describe("case access (wired to the real hook)", () => {
		it("full grant round trip through the actual UI: card, real useIntegrationCaseGrants, and MSW — the row appears and the form closes (card↔hook wiring seam, nanaki G3 probe)", async () => {
			let grants: Array<{
				caseId: string;
				caseName: string;
				permission: string;
				grantedAt: string;
			}> = [];
			server.use(
				http.get("/api/integrations/:id/case-grants", () =>
					HttpResponse.json({ grants })
				),
				http.post("/api/integrations/:id/case-grants", async ({ request }) => {
					const body = (await request.json()) as {
						caseId: string;
						permission: string;
					};
					const grant = {
						caseId: body.caseId,
						caseName: "Assurance",
						permission: body.permission,
						grantedAt: "2026-07-13T00:00:00.000Z",
					};
					grants = [...grants, grant];
					return HttpResponse.json({ grant }, { status: 201 });
				})
			);

			const user = userEvent.setup();
			// No `onGrant`/`grants` props here — this test does NOT stub
			// `useIntegrationCaseGrants` or pass case-access state down by
			// hand. `IntegrationCard` calls the real hook itself, exactly as
			// it does in production; a swapped/miswired prop between the card
			// and the hook would pass every OTHER test in this file (they
			// never touch case access) but fail here.
			renderWithoutProviders(
				<IntegrationCard
					{...baseProps}
					integration={makeIntegration({ status: "ACTIVE" })}
				/>
			);

			await waitFor(() =>
				expect(
					screen.getByRole("button", { name: GRANT_TRIGGER_REGEX })
				).toBeInTheDocument()
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

			expect(
				await screen.findByTestId("case-access-row-case-9")
			).toBeInTheDocument();
			await waitFor(() =>
				expect(
					screen.getByRole("button", { name: GRANT_TRIGGER_REGEX })
				).toBeInTheDocument()
			);
			expect(
				screen.queryByRole("button", { name: GRANT_SUBMIT_REGEX })
			).not.toBeInTheDocument();
		});

		it("closes the open grant form and never POSTs when the same card's integration is revoked out from under it (stale-form path, real hook)", async () => {
			let postCalls = 0;
			server.use(
				http.get("/api/integrations/:id/case-grants", () =>
					HttpResponse.json({ grants: [] })
				),
				http.post("/api/integrations/:id/case-grants", () => {
					postCalls += 1;
					return HttpResponse.json(
						{ error: "Cannot grant case access for a non-active integration" },
						{ status: 409 }
					);
				})
			);

			const user = userEvent.setup();
			const { rerender } = renderWithoutProviders(
				<IntegrationCard
					{...baseProps}
					integration={makeIntegration({ status: "ACTIVE" })}
				/>
			);

			await waitFor(() =>
				expect(
					screen.getByRole("button", { name: GRANT_TRIGGER_REGEX })
				).toBeInTheDocument()
			);
			await user.click(
				screen.getByRole("button", { name: GRANT_TRIGGER_REGEX })
			);
			await waitFor(() =>
				expect(
					screen.getByRole("combobox", { name: CASE_COMBOBOX_REGEX })
				).toBeInTheDocument()
			);

			// Revoked from the same card: `IntegrationCard` re-renders with the
			// integration's new status, exactly as it would after
			// `useIntegrations`'s `revokeIntegration` resolves and refetches.
			rerender(
				<IntegrationCard
					{...baseProps}
					integration={makeIntegration({ status: "REVOKED" })}
				/>
			);

			await waitFor(() =>
				expect(
					screen.queryByRole("combobox", { name: CASE_COMBOBOX_REGEX })
				).not.toBeInTheDocument()
			);
			expect(
				screen.queryByRole("button", { name: GRANT_SUBMIT_REGEX })
			).not.toBeInTheDocument();
			expect(postCalls).toBe(0);
		});

		it("surfaces the server's revoked-integration copy even though this card's own status prop still says ACTIVE (cross-tab revoke, real hook probe)", async () => {
			server.use(
				http.get("/api/integrations/:id/case-grants", () =>
					HttpResponse.json({ grants: [] })
				),
				http.post("/api/integrations/:id/case-grants", () =>
					HttpResponse.json(
						{ error: "Cannot grant case access for a revoked integration" },
						{ status: 409 }
					)
				)
			);

			// The card itself still renders `status: "ACTIVE"` — another tab (or
			// another admin) revoked the integration server-side after this
			// card's last render, so the prop is stale. The grant form is
			// reachable (the button isn't disabled) precisely because this card
			// doesn't know yet.
			const user = userEvent.setup();
			renderWithoutProviders(
				<IntegrationCard
					{...baseProps}
					integration={makeIntegration({ status: "ACTIVE" })}
				/>
			);

			await waitFor(() =>
				expect(
					screen.getByRole("button", { name: GRANT_TRIGGER_REGEX })
				).toBeInTheDocument()
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

			expect(await screen.findByRole("alert")).toHaveTextContent(
				"Revoked integrations cannot be restored"
			);
			expect(screen.queryByRole("alert")).not.toHaveTextContent(
				REACTIVATE_IT_TEXT_REGEX
			);
		});

		it("clears the stale error banner on close and doesn't show it again on reopen without a new attempt (real hook probe)", async () => {
			server.use(
				http.get("/api/integrations/:id/case-grants", () =>
					HttpResponse.json({ grants: [] })
				),
				http.post("/api/integrations/:id/case-grants", () =>
					HttpResponse.json(
						{ error: "Cannot grant case access for a revoked integration" },
						{ status: 409 }
					)
				)
			);

			const user = userEvent.setup();
			renderWithoutProviders(
				<IntegrationCard
					{...baseProps}
					integration={makeIntegration({ status: "ACTIVE" })}
				/>
			);

			await waitFor(() =>
				expect(
					screen.getByRole("button", { name: GRANT_TRIGGER_REGEX })
				).toBeInTheDocument()
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
			expect(await screen.findByRole("alert")).toBeInTheDocument();

			await user.click(
				screen.getByRole("button", { name: CANCEL_BUTTON_REGEX })
			);
			await waitFor(() =>
				expect(
					screen.getByRole("button", { name: GRANT_TRIGGER_REGEX })
				).toBeInTheDocument()
			);

			await user.click(
				screen.getByRole("button", { name: GRANT_TRIGGER_REGEX })
			);
			await waitFor(() =>
				expect(
					screen.getByRole("combobox", { name: CASE_COMBOBOX_REGEX })
				).toBeInTheDocument()
			);
			expect(screen.queryByRole("alert")).not.toBeInTheDocument();
		});
	});

	describe("token list auto-tuck (revoked tokens collapse out of the active list)", () => {
		function makeToken(
			id: string,
			createdAt: string,
			revokedAt: string | null = null
		) {
			return {
				id,
				tokenPrefix: `tea_live_${id}`,
				createdAt,
				lastUsedAt: null,
				expiresAt: null,
				revokedAt,
			};
		}

		it("sorts active tokens newest-issued-first, regardless of API order", () => {
			renderWithoutProviders(
				<IntegrationCard
					{...baseProps}
					integration={makeIntegration({
						tokens: [
							makeToken("a", "2026-06-01T00:00:00.000Z"),
							makeToken("b", "2026-07-01T00:00:00.000Z"),
							makeToken("c", "2026-06-15T00:00:00.000Z"),
						],
					})}
				/>
			);

			const rows = screen
				.getAllByTestId(TOKEN_ROW_TEST_ID_REGEX)
				.map((row) => row.getAttribute("data-testid"));
			expect(rows).toEqual(["token-row-b", "token-row-c", "token-row-a"]);
		});

		it("never shows a revoked token above an active token — revoked stays collapsed under the disclosure", () => {
			renderWithoutProviders(
				<IntegrationCard
					{...baseProps}
					integration={makeIntegration({
						tokens: [
							makeToken(
								"old-revoked",
								"2026-01-01T00:00:00.000Z",
								"2026-02-01T00:00:00.000Z"
							),
							makeToken("active", "2026-01-15T00:00:00.000Z"),
						],
					})}
				/>
			);

			// Only the active token renders as a visible row; the revoked one is
			// mounted (the disclosure panel stays in the DOM so `aria-controls`
			// always resolves) but hidden behind the still-collapsed disclosure,
			// even though it's chronologically irrelevant to prove the point
			// either way.
			expect(screen.getByTestId("token-row-active")).toBeVisible();
			expect(screen.getByTestId("token-row-old-revoked")).not.toBeVisible();
		});

		it("collapses the revoked section by default, with an accurate count", () => {
			renderWithoutProviders(
				<IntegrationCard
					{...baseProps}
					integration={makeIntegration({
						tokens: [
							makeToken("active", "2026-06-01T00:00:00.000Z"),
							makeToken(
								"r1",
								"2026-05-01T00:00:00.000Z",
								"2026-05-10T00:00:00.000Z"
							),
							makeToken(
								"r2",
								"2026-04-01T00:00:00.000Z",
								"2026-04-10T00:00:00.000Z"
							),
							makeToken(
								"r3",
								"2026-03-01T00:00:00.000Z",
								"2026-03-10T00:00:00.000Z"
							),
						],
					})}
				/>
			);

			const toggle = screen.getByRole("button", {
				name: REVOKED_SECTION_BUTTON_REGEX,
			});
			expect(toggle).toHaveTextContent("Revoked (3)");
			expect(toggle).toHaveAttribute("aria-expanded", "false");
			expect(screen.getByTestId("token-row-r1")).not.toBeVisible();
		});

		it("expands the revoked section on click, and collapses again on a second click", async () => {
			const user = userEvent.setup();
			renderWithoutProviders(
				<IntegrationCard
					{...baseProps}
					integration={makeIntegration({
						tokens: [
							makeToken("active", "2026-06-01T00:00:00.000Z"),
							makeToken(
								"r1",
								"2026-05-01T00:00:00.000Z",
								"2026-05-10T00:00:00.000Z"
							),
						],
					})}
				/>
			);

			const toggle = screen.getByRole("button", {
				name: REVOKED_SECTION_BUTTON_REGEX,
			});

			await user.click(toggle);
			expect(screen.getByTestId("token-row-r1")).toBeVisible();
			expect(toggle).toHaveAttribute("aria-expanded", "true");

			await user.click(toggle);
			expect(screen.getByTestId("token-row-r1")).not.toBeVisible();
			expect(toggle).toHaveAttribute("aria-expanded", "false");
		});

		it("renders no rotate/revoke actions on an expanded revoked row", async () => {
			const user = userEvent.setup();
			renderWithoutProviders(
				<IntegrationCard
					{...baseProps}
					integration={makeIntegration({
						tokens: [
							makeToken(
								"r1",
								"2026-05-01T00:00:00.000Z",
								"2026-05-10T00:00:00.000Z"
							),
						],
					})}
				/>
			);

			await user.click(
				screen.getByRole("button", { name: REVOKED_SECTION_BUTTON_REGEX })
			);

			const row = screen.getByTestId("token-row-r1");
			expect(
				within(row).queryByRole("button", { name: ROTATE_BUTTON_REGEX })
			).not.toBeInTheDocument();
			expect(
				within(row).queryByRole("button", { name: REVOKE_TOKEN_BUTTON_REGEX })
			).not.toBeInTheDocument();
		});

		it("shows no revoked section at all when there are zero revoked tokens", () => {
			renderWithoutProviders(
				<IntegrationCard
					{...baseProps}
					integration={makeIntegration({
						tokens: [makeToken("active", "2026-06-01T00:00:00.000Z")],
					})}
				/>
			);

			expect(
				screen.queryByRole("button", { name: REVOKED_SECTION_BUTTON_REGEX })
			).not.toBeInTheDocument();
		});

		it("shows a 'No active tokens.' message (not 'No tokens issued yet.') when every token has been revoked", () => {
			renderWithoutProviders(
				<IntegrationCard
					{...baseProps}
					integration={makeIntegration({
						tokens: [
							makeToken(
								"r1",
								"2026-05-01T00:00:00.000Z",
								"2026-05-10T00:00:00.000Z"
							),
						],
					})}
				/>
			);

			expect(screen.getByText("No active tokens.")).toBeInTheDocument();
			expect(
				screen.queryByText("No tokens issued yet.")
			).not.toBeInTheDocument();
		});

		it("keeps input order among active tokens that share the same createdAt (stable sort)", () => {
			renderWithoutProviders(
				<IntegrationCard
					{...baseProps}
					integration={makeIntegration({
						tokens: [
							makeToken("x", "2026-06-01T00:00:00.000Z"),
							makeToken("y", "2026-06-01T00:00:00.000Z"),
							makeToken("z", "2026-06-01T00:00:00.000Z"),
						],
					})}
				/>
			);

			const rows = screen
				.getAllByTestId(TOKEN_ROW_TEST_ID_REGEX)
				.map((row) => row.getAttribute("data-testid"));
			expect(rows).toEqual(["token-row-x", "token-row-y", "token-row-z"]);
		});

		it("keeps the disclosure expanded across a parent re-render that adds a newly-revoked token", async () => {
			const user = userEvent.setup();
			const integration = makeIntegration({
				tokens: [
					makeToken("active", "2026-06-01T00:00:00.000Z"),
					makeToken(
						"r1",
						"2026-05-01T00:00:00.000Z",
						"2026-05-10T00:00:00.000Z"
					),
				],
			});
			const { rerender } = renderWithoutProviders(
				<IntegrationCard {...baseProps} integration={integration} />
			);

			const toggle = screen.getByRole("button", {
				name: REVOKED_SECTION_BUTTON_REGEX,
			});
			await user.click(toggle);
			expect(toggle).toHaveAttribute("aria-expanded", "true");

			rerender(
				<IntegrationCard
					{...baseProps}
					integration={{
						...integration,
						tokens: [
							...integration.tokens,
							makeToken(
								"r2",
								"2026-05-02T00:00:00.000Z",
								"2026-05-11T00:00:00.000Z"
							),
						],
					}}
				/>
			);

			const toggleAfterRerender = screen.getByRole("button", {
				name: REVOKED_SECTION_BUTTON_REGEX,
			});
			expect(toggleAfterRerender).toHaveTextContent("Revoked (2)");
			expect(toggleAfterRerender).toHaveAttribute("aria-expanded", "true");
			expect(screen.getByTestId("token-row-r1")).toBeVisible();
			expect(screen.getByTestId("token-row-r2")).toBeVisible();
		});

		it("wires aria-controls to the id of the real, always-mounted disclosure region", () => {
			renderWithoutProviders(
				<IntegrationCard
					{...baseProps}
					integration={makeIntegration({
						tokens: [
							makeToken(
								"r1",
								"2026-05-01T00:00:00.000Z",
								"2026-05-10T00:00:00.000Z"
							),
						],
					})}
				/>
			);

			const toggle = screen.getByRole("button", {
				name: REVOKED_SECTION_BUTTON_REGEX,
			});
			const controlsId = toggle.getAttribute("aria-controls");
			expect(controlsId).toBeTruthy();
			if (!controlsId) {
				throw new Error("expected aria-controls to be set");
			}

			const region = document.getElementById(controlsId);
			expect(region).not.toBeNull();
			if (!region) {
				throw new Error("expected the disclosure region to be mounted");
			}
			expect(within(region).getByTestId("token-row-r1")).toBeInTheDocument();
		});

		it("toggles via keyboard — Enter opens, Space closes", async () => {
			const user = userEvent.setup();
			renderWithoutProviders(
				<IntegrationCard
					{...baseProps}
					integration={makeIntegration({
						tokens: [
							makeToken(
								"r1",
								"2026-05-01T00:00:00.000Z",
								"2026-05-10T00:00:00.000Z"
							),
						],
					})}
				/>
			);

			const toggle = screen.getByRole("button", {
				name: REVOKED_SECTION_BUTTON_REGEX,
			});
			toggle.focus();
			expect(toggle).toHaveFocus();

			await user.keyboard("{Enter}");
			expect(toggle).toHaveAttribute("aria-expanded", "true");
			expect(screen.getByTestId("token-row-r1")).toBeVisible();

			await user.keyboard(" ");
			expect(toggle).toHaveAttribute("aria-expanded", "false");
			expect(screen.getByTestId("token-row-r1")).not.toBeVisible();
		});
	});
});
