import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { signIn } from "next-auth/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SignInForm from "@/components/auth/sign-in-form";
import {
	mockUseSearchParams,
	resetNavigationMocks,
} from "@/src/__tests__/mocks/next-navigation-mocks";

const IDENTIFIER_PLACEHOLDER = "alan.turing@example.com or aturing";
const INVALID_CREDENTIALS = /Invalid credentials/;

async function failSignInWith(error: string | undefined) {
	vi.mocked(signIn).mockResolvedValue({
		ok: false,
		error,
		status: 401,
		url: null,
	} as never);

	const user = userEvent.setup();
	const { container } = render(<SignInForm />);
	await user.type(screen.getByPlaceholderText(IDENTIFIER_PLACEHOLDER), "alice");
	const password = container.querySelector('input[type="password"]');
	if (!password) {
		throw new Error("the password field is missing");
	}
	await user.type(password, "Passw0rd!Passw0rd");
	await user.click(screen.getByRole("button", { name: "Login" }));
	await waitFor(() => expect(signIn).toHaveBeenCalled());
}

beforeEach(() => {
	resetNavigationMocks();
	mockUseSearchParams.mockReturnValue(new URLSearchParams());
	vi.mocked(signIn).mockReset();
});

describe("sign-in form when sign-in is paused", () => {
	it("says how many minutes to wait and points to a password reset", async () => {
		await failSignInWith("SignInRateLimited:5");

		expect(
			await screen.findByText(
				"Too many sign-in attempts. Try again in 5 minutes, or reset your password."
			)
		).toBeTruthy();
		expect(screen.queryByText(INVALID_CREDENTIALS)).toBeNull();
	});

	it("never shows fewer than one minute", async () => {
		await failSignInWith("SignInRateLimited:0");

		expect(
			await screen.findByText(
				"Too many sign-in attempts. Try again in 1 minute, or reset your password."
			)
		).toBeTruthy();
	});

	it("shows a generic message, not the raw text, for an error it does not know", async () => {
		await failSignInWith("Configuration");

		expect(
			await screen.findByText("Unable to log in. Please try again.")
		).toBeTruthy();
		expect(screen.queryByText("Configuration")).toBeNull();
	});
});
