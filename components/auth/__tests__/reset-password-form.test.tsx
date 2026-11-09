import { beforeEach, describe, expect, it, vi } from "vitest";
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
