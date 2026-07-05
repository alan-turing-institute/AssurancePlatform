import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { IntegrationListItem } from "@/lib/schemas/integration";
import {
	renderWithoutProviders,
	screen,
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
const ISSUE_TOKEN_BUTTON_REGEX = /issue new token/i;
const PERMANENT_TEXT_REGEX = /permanent/i;
const CANNOT_BE_UNDONE_TEXT_REGEX = /cannot be undone/i;
const DONE_BUTTON_REGEX = /done.*stored it/i;
const TOKEN_ROW_TEST_ID_REGEX = /^token-row-/;

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

		it("does not call onDelete until the delete confirm dialog is accepted", async () => {
			const onDelete = vi.fn();
			const user = userEvent.setup();
			renderWithoutProviders(
				<IntegrationCard
					{...baseProps}
					integration={makeIntegration()}
					onDelete={onDelete}
				/>
			);

			await user.click(
				screen.getByRole("button", { name: DELETE_TRIGGER_REGEX })
			);
			expect(onDelete).not.toHaveBeenCalled();

			const dialog = await screen.findByRole("dialog");
			expect(dialog).toHaveTextContent(CANNOT_BE_UNDONE_TEXT_REGEX);

			await user.click(
				screen.getByRole("button", { name: DELETE_CONFIRM_REGEX })
			);
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
});
