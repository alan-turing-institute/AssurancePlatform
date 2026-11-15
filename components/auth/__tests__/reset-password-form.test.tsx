import { beforeEach, describe, expect, it, vi } from "vitest";
import { validatePasswordResetToken } from "@/actions/auth";
import {
	mockUseSearchParams,
	resetNavigationMocks,
} from "@/src/__tests__/mocks/next-navigation-mocks";
import {
	renderWithoutProviders,
	screen,
} from "@/src/__tests__/utils/test-utils";
import ResetPasswordForm from "../reset-password-form";

vi.mock("@/actions/auth", () => ({
	validatePasswordResetToken: vi
		.fn()
		.mockResolvedValue({ valid: true, email: "alan@example.test" }),
}));

const UNUSABLE_LINK_REGEX = /can't be used\. It may have expired or already/;

const STRENGTH_RULES_REGEX = /at least 8 characters.*uppercase.*number/;

describe("ResetPasswordForm labels", () => {
	beforeEach(() => {
		resetNavigationMocks();
		mockUseSearchParams.mockReturnValue(new URLSearchParams("token=abc"));
	});

	it("finds each password box by its label", async () => {
		renderWithoutProviders(<ResetPasswordForm />);

		const password = await screen.findByLabelText("New password");
		const confirm = screen.getByLabelText("Confirm new password");

		expect(password.tagName).toBe("INPUT");
		expect(confirm.tagName).toBe("INPUT");
		expect(password).not.toBe(confirm);
	});

	it("describes the first box by the password strength rules", async () => {
		renderWithoutProviders(<ResetPasswordForm />);

		const password = await screen.findByLabelText("New password");

		expect(password).toHaveAccessibleDescription(STRENGTH_RULES_REGEX);
	});
});

describe("ResetPasswordForm unusable links", () => {
	beforeEach(() => {
		resetNavigationMocks();
	});

	it.each([
		{
			name: "the action refuses the link",
			query: "token=abc",
			arrange: () =>
				vi.mocked(validatePasswordResetToken).mockResolvedValueOnce({
					valid: false,
					error: "Invalid or expired reset token",
				}),
		},
		{
			name: "the URL has no token",
			query: "",
			arrange: () => undefined,
		},
		{
			name: "the action throws",
			query: "token=abc",
			arrange: () =>
				vi
					.mocked(validatePasswordResetToken)
					.mockRejectedValueOnce(new Error("boom")),
		},
	])("shows the one message when $name", async ({ query, arrange }) => {
		mockUseSearchParams.mockReturnValue(new URLSearchParams(query));
		arrange();
		renderWithoutProviders(<ResetPasswordForm />);

		expect(await screen.findByText(UNUSABLE_LINK_REGEX)).toBeInTheDocument();
		expect(screen.queryByText("Link expired")).not.toBeInTheDocument();
		expect(screen.queryByText("Invalid reset link")).not.toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: "Request new reset link" })
		).toHaveAttribute("href", "/forgot-password");
	});
});
