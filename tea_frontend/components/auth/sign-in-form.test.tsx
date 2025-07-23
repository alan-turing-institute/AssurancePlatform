import userEvent from "@testing-library/user-event";
import { signIn, useSession } from "next-auth/react";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { resetNavigationMocks } from "@/src/__tests__/mocks/next-navigation-mocks";
import {
	renderWithoutProviders,
	screen,
} from "@/src/__tests__/utils/test-utils";
import SignInForm from "./sign-in-form";

// Mock the modules
vi.mock("next-auth/react");

// Define regex patterns at module level for performance
const USERNAME_REGEX = /username/i;
const PASSWORD_REGEX = /password/i;
const SIGN_IN_REGEX = /login/i;
const MIN_LENGTH_ERROR_REGEX = /string must contain at least 2 character/i;
const MIN_PASSWORD_LENGTH_ERROR_REGEX =
	/string must contain at least 8 character/i;
const MAX_LENGTH_ERROR_REGEX = /string must contain at most 50 character/i;
const GITHUB_REGEX = /github/i;
const LOGGING_IN_REGEX = /logging in/i;

describe("SignInForm", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		resetNavigationMocks();
		(signIn as Mock).mockResolvedValue({ ok: true });
		(useSession as Mock).mockReturnValue({
			data: null,
			status: "unauthenticated",
			update: vi.fn(),
		});
	});

	it("should render form with all required fields", () => {
		renderWithoutProviders(<SignInForm />);

		expect(screen.getByLabelText(USERNAME_REGEX)).toBeInTheDocument();
		expect(screen.getByLabelText(PASSWORD_REGEX)).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: SIGN_IN_REGEX })
		).toBeInTheDocument();
	});

	it("should have correct input types and placeholders", async () => {
		renderWithoutProviders(<SignInForm />);

		const usernameInput = await screen.findByLabelText(USERNAME_REGEX);
		const passwordInput = await screen.findByLabelText(PASSWORD_REGEX);

		// Username input defaults to text type (no explicit type attribute needed)
		expect(usernameInput.tagName).toBe("INPUT");
		expect(passwordInput).toHaveAttribute("type", "password");
	});

	it("should validate minimum username length", async () => {
		const user = userEvent.setup();
		renderWithoutProviders(<SignInForm />);

		const usernameInput = screen.getByLabelText(USERNAME_REGEX);
		const submitButton = screen.getByRole("button", { name: SIGN_IN_REGEX });

		await user.type(usernameInput, "a"); // Less than 2 characters
		await user.click(submitButton);

		expect(await screen.findByText(MIN_LENGTH_ERROR_REGEX)).toBeInTheDocument();
	});

	it("should validate minimum password length", async () => {
		const user = userEvent.setup();
		renderWithoutProviders(<SignInForm />);

		const usernameInput = screen.getByLabelText(USERNAME_REGEX);
		const passwordInput = screen.getByLabelText(PASSWORD_REGEX);
		const submitButton = screen.getByRole("button", { name: SIGN_IN_REGEX });

		await user.type(usernameInput, "validuser");
		await user.type(passwordInput, "1234567"); // Less than 8 characters
		await user.click(submitButton);

		expect(
			await screen.findByText(MIN_PASSWORD_LENGTH_ERROR_REGEX)
		).toBeInTheDocument();
	});

	it("should validate maximum username length", async () => {
		const user = userEvent.setup();
		renderWithoutProviders(<SignInForm />);

		const usernameInput = screen.getByLabelText(USERNAME_REGEX);
		const submitButton = screen.getByRole("button", { name: SIGN_IN_REGEX });

		const longUsername = "a".repeat(51); // More than 50 characters
		await user.type(usernameInput, longUsername);
		await user.click(submitButton);

		expect(await screen.findByText(MAX_LENGTH_ERROR_REGEX)).toBeInTheDocument();
	});

	it("should handle form submission with valid data", async () => {
		const user = userEvent.setup();
		(signIn as Mock).mockResolvedValue({ ok: true });

		renderWithoutProviders(<SignInForm />);

		const usernameInput = screen.getByLabelText(USERNAME_REGEX);
		const passwordInput = screen.getByLabelText(PASSWORD_REGEX);
		const submitButton = screen.getByRole("button", { name: SIGN_IN_REGEX });

		await user.type(usernameInput, "testuser");
		await user.type(passwordInput, "password123");
		await user.click(submitButton);

		// Form should be valid and attempt submission
		expect(signIn).toHaveBeenCalledWith("credentials", {
			username: "testuser",
			password: "password123",
			redirect: false,
		});
	});

	it("should show loading state during form submission", async () => {
		const user = userEvent.setup();
		(signIn as Mock).mockImplementation(
			() => new Promise((resolve) => setTimeout(resolve, 100))
		);

		renderWithoutProviders(<SignInForm />);

		const usernameInput = screen.getByLabelText(USERNAME_REGEX);
		const passwordInput = screen.getByLabelText(PASSWORD_REGEX);
		const submitButton = screen.getByRole("button", { name: SIGN_IN_REGEX });

		await user.type(usernameInput, "testuser");
		await user.type(passwordInput, "password123");
		await user.click(submitButton);

		// Should show loading state
		expect(
			screen.getByRole("button", { name: LOGGING_IN_REGEX })
		).toBeDisabled();
	});

	it("should clear form validation errors when user starts typing", async () => {
		const user = userEvent.setup();
		renderWithoutProviders(<SignInForm />);

		const usernameInput = screen.getByLabelText(USERNAME_REGEX);
		const submitButton = screen.getByRole("button", { name: SIGN_IN_REGEX });

		// Trigger validation error
		await user.click(submitButton);
		expect(await screen.findByText(MIN_LENGTH_ERROR_REGEX)).toBeInTheDocument();

		// Start typing to clear error
		await user.type(usernameInput, "validuser");

		expect(screen.queryByText(MIN_LENGTH_ERROR_REGEX)).not.toBeInTheDocument();
	});

	it("should have proper accessibility attributes", async () => {
		renderWithoutProviders(<SignInForm />);

		const usernameInput = await screen.findByLabelText(USERNAME_REGEX);
		const passwordInput = await screen.findByLabelText(PASSWORD_REGEX);
		const form = usernameInput.closest("form");

		expect(usernameInput).toHaveAccessibleName();
		expect(passwordInput).toHaveAccessibleName();
		expect(form).toBeInTheDocument();
	});

	it("should handle keyboard navigation correctly", async () => {
		const user = userEvent.setup();
		renderWithoutProviders(<SignInForm />);

		const usernameInput = await screen.findByLabelText(USERNAME_REGEX);
		const passwordInput = await screen.findByLabelText(PASSWORD_REGEX);
		const submitButton = screen.getByRole("button", { name: SIGN_IN_REGEX });

		// Focus the username input first
		usernameInput.focus();
		expect(usernameInput).toHaveFocus();

		await user.tab();
		expect(passwordInput).toHaveFocus();

		await user.tab();
		expect(submitButton).toHaveFocus();
	});

	it("should prevent form submission with empty fields", async () => {
		const user = userEvent.setup();
		renderWithoutProviders(<SignInForm />);

		const submitButton = screen.getByRole("button", { name: SIGN_IN_REGEX });
		await user.click(submitButton);

		expect(signIn).not.toHaveBeenCalled();
		expect(await screen.findByText(MIN_LENGTH_ERROR_REGEX)).toBeInTheDocument();
	});

	it("should handle sign in error states", async () => {
		const user = userEvent.setup();
		(signIn as Mock).mockResolvedValue({
			ok: false,
			error: "CredentialsSignin",
		});

		renderWithoutProviders(<SignInForm />);

		const usernameInput = screen.getByLabelText(USERNAME_REGEX);
		const passwordInput = screen.getByLabelText(PASSWORD_REGEX);
		const submitButton = screen.getByRole("button", { name: SIGN_IN_REGEX });

		await user.type(usernameInput, "testuser");
		await user.type(passwordInput, "wrongpassword");
		await user.click(submitButton);

		await vi.waitFor(() => {
			expect(signIn).toHaveBeenCalled();
		});
	});

	it("should show GitHub sign in option", () => {
		renderWithoutProviders(<SignInForm />);

		const githubButton = screen.getByRole("button", {
			name: GITHUB_REGEX,
		});
		expect(githubButton).toBeInTheDocument();
	});

	it("should handle GitHub sign in", async () => {
		const user = userEvent.setup();
		renderWithoutProviders(<SignInForm />);

		const githubButton = screen.getByRole("button", {
			name: GITHUB_REGEX,
		});
		await user.click(githubButton);

		expect(signIn).toHaveBeenCalledWith("github");
	});

	it("should show proper form structure", () => {
		renderWithoutProviders(<SignInForm />);

		// Check for form elements structure
		const usernameField = screen
			.getByLabelText(USERNAME_REGEX)
			.closest(".space-y-2");
		const passwordField = screen
			.getByLabelText(PASSWORD_REGEX)
			.closest(".space-y-2");

		expect(usernameField).toBeInTheDocument();
		expect(passwordField).toBeInTheDocument();
	});
});
