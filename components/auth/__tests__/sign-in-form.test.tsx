import { waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { signIn } from "next-auth/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	mockPush,
	mockReplace,
	mockUseSearchParams,
	resetNavigationMocks,
} from "@/src/__tests__/mocks/next-navigation-mocks";
import {
	renderWithoutProviders,
	screen,
} from "@/src/__tests__/utils/test-utils";
import SignInForm from "../sign-in-form";

const IDENTIFIER_REGEX = /email or username/i;
const LOGIN_BUTTON_REGEX = /^login$/i;

async function signInWith(query: string) {
	mockUseSearchParams.mockReturnValue(new URLSearchParams(query));
	vi.mocked(signIn).mockResolvedValue({
		ok: true,
		error: null,
		status: 200,
		url: null,
	});

	const user = userEvent.setup();
	const { container } = renderWithoutProviders(<SignInForm />);
	await user.type(screen.getByLabelText(IDENTIFIER_REGEX), "alice");
	// The password label is attached to a wrapper element, not the input.
	const passwordInput = container.querySelector('input[type="password"]');
	if (!passwordInput) {
		throw new Error("password input not rendered");
	}
	await user.type(passwordInput, "Passw0rd!Passw0rd");
	await user.click(screen.getByRole("button", { name: LOGIN_BUTTON_REGEX }));
	await waitFor(() => {
		expect(signIn).toHaveBeenCalled();
	});
}

describe("SignInForm redirect after sign-in", () => {
	beforeEach(() => {
		resetNavigationMocks();
		vi.mocked(signIn).mockReset();
	});

	it("replaces the sign-in page with the same-site path from redirect", async () => {
		await signInWith(`redirect=${encodeURIComponent("/discover/p?use=1")}`);

		await waitFor(() => {
			expect(mockReplace).toHaveBeenCalledWith("/discover/p?use=1");
		});
		expect(mockPush).not.toHaveBeenCalled();
	});

	it.each([
		"//evil.example/x",
		"https://evil.example",
		"/\\evil.example",
		"javascript:alert(1)",
	])("goes to /dashboard when redirect is %s", async (target) => {
		await signInWith(`redirect=${encodeURIComponent(target)}`);

		await waitFor(() => {
			expect(mockReplace).toHaveBeenCalledWith("/dashboard");
		});
		expect(mockPush).not.toHaveBeenCalled();
	});

	it("goes to /dashboard when no redirect is given", async () => {
		await signInWith("");

		await waitFor(() => {
			expect(mockReplace).toHaveBeenCalledWith("/dashboard");
		});
	});

	it("returns to the invitation when the auth proxy supplied callbackUrl", async () => {
		const invitation = "/invites/0b0c58c3-6a6f-4f2b-9c63-0d2f3a1f6b11";
		await signInWith(`callbackUrl=${encodeURIComponent(invitation)}`);

		await waitFor(() => {
			expect(mockReplace).toHaveBeenCalledWith(invitation);
		});
	});

	it("applies the same check to callbackUrl", async () => {
		await signInWith(
			`callbackUrl=${encodeURIComponent("https://evil.example/x")}`
		);

		await waitFor(() => {
			expect(mockReplace).toHaveBeenCalledWith("/dashboard");
		});
	});

	it("prefers redirect over callbackUrl", async () => {
		await signInWith("redirect=%2Fcases%2F1&callbackUrl=%2Fcases%2F2");

		await waitFor(() => {
			expect(mockReplace).toHaveBeenCalledWith("/cases/1");
		});
	});
});
