import { act, screen, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "@/src/__tests__/mocks/server";
import { renderWithAuth, userEvent } from "@/src/__tests__/utils/test-utils";
import LoginPage from "../login/page";
import RegisterPage from "../register/page";

// Define regex patterns at top level for performance
const PASSWORD_REGEX = /password/i;
const SUBMIT_REGEX = /submit/i;
const LOGIN_REGEX = /login/i;
const _CREATING_ACCOUNT_REGEX = /creating account/i;
const LOGGING_IN_REGEX = /logging in/i;
const USERNAME_EMPTY_REGEX = /string must contain at least 2 character/i;
const PASSWORD_REQUIREMENT_REGEX =
	/password must contain at least one uppercase letter, one number, and one special character/i;
const PASSWORD_MATCH_REGEX = /your passwords must match/i;
const INVALID_USERNAME_PASSWORD_REGEX = /invalid username or password/i;
const _UNABLE_TO_LOGIN_REGEX = /unable to log in with provided credentials/i;
const GITHUB_REGEX = /github/i;
const SIGN_UP_TODAY_REGEX = /sign up today/i;
const INVALID_CREDENTIALS_REGEX = /invalid credentials/i;
const SIGN_IN_TO_ACCOUNT_REGEX = /sign in to your account/i;

// Mock Next.js navigation
const mockPush = vi.fn();
const mockReplace = vi.fn();
const mockRefresh = vi.fn();

vi.mock("next/navigation", () => ({
	useRouter: vi.fn(() => ({
		push: mockPush,
		replace: mockReplace,
		refresh: mockRefresh,
		back: vi.fn(),
		forward: vi.fn(),
		prefetch: vi.fn(),
	})),
	usePathname: () => "/",
	useSearchParams: vi.fn(() => new URLSearchParams()),
}));

// Mock next-auth
vi.mock("next-auth/react", () => ({
	useSession: vi.fn(),
	signIn: vi.fn(),
	signOut: vi.fn(),
	getSession: vi.fn(),
	SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

describe("Authentication Flow Integration Tests", () => {
	beforeEach(() => {
		// Reset all mocks before each test
		vi.clearAllMocks();

		// Default mock for useSession - unauthenticated
		(useSession as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
			data: null,
			status: "unauthenticated",
		});
	});

	afterEach(() => {
		server.resetHandlers();
	});

	describe("User Registration Process", () => {
		it("should complete full registration flow and redirect to dashboard", async () => {
			const user = userEvent.setup();

			// Mock successful registration response
			server.use(
				http.post(
					`${API_BASE_URL}/api/auth/register/`,
					() => new HttpResponse(null, { status: 204 })
				)
			);

			// Registration redirects to login page, not dashboard
			renderWithAuth(<RegisterPage />);

			// Fill registration form
			const usernameInput = screen.getByPlaceholderText("Alan Turing");
			const emailInput = screen.getByPlaceholderText("example@gmail.com");
			const passwordInputs = screen.getAllByLabelText(PASSWORD_REGEX);
			const password1Input = passwordInputs[0];
			const password2Input = passwordInputs[1];

			await act(async () => {
				await user.type(usernameInput, "testuser");
				await user.type(emailInput, "test@example.com");
				await user.type(password1Input, "TestPassword123!");
				await user.type(password2Input, "TestPassword123!");
			});

			// Submit form
			const submitButton = screen.getByRole("button", { name: SUBMIT_REGEX });
			await act(async () => {
				await user.click(submitButton);
			});

			// Wait for the async operation to complete and verify redirect
			await waitFor(
				() => {
					expect(mockPush).toHaveBeenCalledWith("/login?registered=true");
				},
				{ timeout: 5000 }
			);
		});

		it("should show validation errors for invalid registration data", async () => {
			const user = userEvent.setup();

			// Mock registration error response
			server.use(
				http.post(`${API_BASE_URL}/api/auth/register/`, () =>
					HttpResponse.json(
						{
							username: ["A user with that username already exists."],
							email: ["Enter a valid email address."],
						},
						{ status: 400 }
					)
				)
			);

			renderWithAuth(<RegisterPage />);

			// Submit form without filling fields properly
			const submitButton = screen.getByRole("button", { name: SUBMIT_REGEX });
			await user.click(submitButton);

			// Verify validation messages - check for at least one validation error
			await waitFor(() => {
				expect(screen.getAllByText(USERNAME_EMPTY_REGEX)).toHaveLength(2); // Username and email both show same validation
			});
		});

		it("should validate password requirements", async () => {
			const user = userEvent.setup();

			renderWithAuth(<RegisterPage />);

			// Fill form with weak password and submit to trigger validation
			const usernameInput = screen.getByPlaceholderText("Alan Turing");
			const emailInput = screen.getByPlaceholderText("example@gmail.com");
			const passwordInputs = screen.getAllByLabelText(PASSWORD_REGEX);
			const password1Input = passwordInputs[0];
			const password2Input = passwordInputs[1];

			await user.type(usernameInput, "testuser");
			await user.type(emailInput, "test@example.com");
			await user.type(password1Input, "weakpass");
			await user.type(password2Input, "weakpass");

			// Submit form to trigger validation
			const submitButton = screen.getByRole("button", { name: SUBMIT_REGEX });
			await user.click(submitButton);

			// Check for password requirement message - both password fields show same validation
			await waitFor(() => {
				expect(screen.getAllByText(PASSWORD_REQUIREMENT_REGEX)).toHaveLength(2);
			});
		});

		it("should validate matching passwords", async () => {
			const user = userEvent.setup();

			renderWithAuth(<RegisterPage />);

			// Fill form with mismatched passwords
			const usernameInput = screen.getByPlaceholderText("Alan Turing");
			const emailInput = screen.getByPlaceholderText("example@gmail.com");
			const passwordInputs = screen.getAllByLabelText(PASSWORD_REGEX);
			const password1Input = passwordInputs[0];
			const password2Input = passwordInputs[1];

			await user.type(usernameInput, "testuser");
			await user.type(emailInput, "test@example.com");
			await user.type(password1Input, "TestPassword123!");
			await user.type(password2Input, "DifferentPassword123!");

			// Submit form
			const submitButton = screen.getByRole("button", { name: SUBMIT_REGEX });
			await user.click(submitButton);

			// Check for password mismatch error
			await waitFor(() => {
				expect(screen.getByText(PASSWORD_MATCH_REGEX)).toBeInTheDocument();
			});
		});
	});

	describe("Login with Credentials", () => {
		it("should successfully login and redirect to dashboard", async () => {
			const user = userEvent.setup();

			// Mock successful login
			(signIn as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
				ok: true,
			});

			renderWithAuth(<LoginPage />);

			// Fill login form
			const usernameInput = screen.getByPlaceholderText("Alan Turing");
			const passwordInput = screen.getByLabelText(PASSWORD_REGEX);

			await user.type(usernameInput, "testuser");
			await user.type(passwordInput, "TestPassword123!");

			// Submit form
			const submitButton = screen.getByRole("button", { name: LOGIN_REGEX });
			await user.click(submitButton);

			// Verify loading state
			expect(
				screen.getByRole("button", { name: LOGGING_IN_REGEX })
			).toBeInTheDocument();

			// Verify signIn was called with correct credentials
			await waitFor(() => {
				expect(signIn).toHaveBeenCalledWith("credentials", {
					redirect: false,
					username: "testuser",
					password: "TestPassword123!",
				});
			});

			// Verify redirect to dashboard
			await waitFor(() => {
				expect(mockPush).toHaveBeenCalledWith("/dashboard");
			});
		});

		it("should show error message for invalid credentials", async () => {
			const user = userEvent.setup();

			// Mock failed login
			(signIn as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
				ok: false,
				error: "Invalid username or password",
			});

			renderWithAuth(<LoginPage />);

			// Fill login form
			const usernameInput = screen.getByPlaceholderText("Alan Turing");
			const passwordInput = screen.getByLabelText(PASSWORD_REGEX);

			await user.type(usernameInput, "wronguser");
			await user.type(passwordInput, "WrongPassword123!");

			// Submit form
			const submitButton = screen.getByRole("button", { name: LOGIN_REGEX });
			await user.click(submitButton);

			// Check for error message
			await waitFor(() => {
				expect(
					screen.getByText(INVALID_USERNAME_PASSWORD_REGEX)
				).toBeInTheDocument();
			});

			// Verify no redirect occurred
			expect(mockPush).not.toHaveBeenCalled();
		});

		it("should handle network errors gracefully", async () => {
			const user = userEvent.setup();

			// Mock network error
			(signIn as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
				new Error("Network error")
			);

			renderWithAuth(<LoginPage />);

			// Fill and submit form
			const usernameInput = screen.getByPlaceholderText("Alan Turing");
			const passwordInput = screen.getByLabelText(PASSWORD_REGEX);

			await user.type(usernameInput, "testuser");
			await user.type(passwordInput, "TestPassword123!");

			const submitButton = screen.getByRole("button", { name: LOGIN_REGEX });
			await user.click(submitButton);

			// Check for generic error message
			await waitFor(() => {
				expect(
					screen.getByText(
						"Connection error. Please check your internet and try again."
					)
				).toBeInTheDocument();
			});
		});
	});

	describe("GitHub OAuth Flow", () => {
		it("should initiate GitHub OAuth login", async () => {
			const user = userEvent.setup();

			renderWithAuth(<LoginPage />);

			// Find and click GitHub login button
			const githubButton = screen.getByRole("button", { name: GITHUB_REGEX });
			await user.click(githubButton);

			// Verify loading state
			expect(githubButton.querySelector(".animate-spin")).toBeInTheDocument();

			// Verify signIn was called with GitHub provider
			expect(signIn).toHaveBeenCalledWith("github");
		});
	});

	describe("Session Persistence", () => {
		it("should redirect to dashboard if already logged in", () => {
			// Mock authenticated session
			(useSession as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
				data: {
					user: {
						id: "1",
						name: "Test User",
						email: "test@example.com",
					},
					key: "mock-session-key",
				},
				status: "authenticated",
			});

			renderWithAuth(<LoginPage />);

			// Should immediately redirect to dashboard
			expect(mockPush).toHaveBeenCalledWith("/dashboard");
		});

		it("should maintain session after page refresh", async () => {
			// Start with unauthenticated state
			(useSession as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
				data: null,
				status: "unauthenticated",
			});

			const { rerender } = renderWithAuth(<LoginPage />);

			// Simulate successful login
			act(() => {
				(useSession as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
					data: {
						user: {
							id: "1",
							name: "Test User",
							email: "test@example.com",
						},
						key: "mock-session-key",
					},
					status: "authenticated",
				});
			});

			// Re-render to simulate page refresh
			rerender(<LoginPage />);

			// Should redirect to dashboard
			await waitFor(() => {
				expect(mockPush).toHaveBeenCalledWith("/dashboard");
			});
		});

		it("should handle stale sessions without key", () => {
			// Mock session without key (stale session)
			(useSession as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
				data: {
					user: {
						id: "1",
						name: "Test User",
						email: "test@example.com",
					},
					// No key property - stale session
				},
				status: "authenticated",
			});

			renderWithAuth(<LoginPage />);

			// Should not redirect (middleware will handle this)
			expect(mockPush).not.toHaveBeenCalled();
		});
	});

	describe("Redirect After Authentication", () => {
		it("should redirect to original requested page after login", async () => {
			const user = userEvent.setup();

			// Mock URL with redirect parameter
			const mockSearchParams = new URLSearchParams("redirect=/cases/123");

			// Update existing mocks to use the redirect parameter
			const { useSearchParams } = await import("next/navigation");
			vi.mocked(useSearchParams).mockReturnValue(
				mockSearchParams as ReadonlyURLSearchParams
			);

			// Mock successful login
			(signIn as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
				ok: true,
			});

			renderWithAuth(<LoginPage />);

			// Perform login
			const usernameInput = screen.getByPlaceholderText("Alan Turing");
			const passwordInput = screen.getByLabelText(PASSWORD_REGEX);

			await user.type(usernameInput, "testuser");
			await user.type(passwordInput, "TestPassword123!");

			const submitButton = screen.getByRole("button", { name: LOGIN_REGEX });
			await user.click(submitButton);

			// Should redirect to original page instead of dashboard
			await waitFor(() => {
				expect(mockPush).toHaveBeenCalledWith("/cases/123");
			});

			// Reset the search params mock back to default
			vi.mocked(useSearchParams).mockReturnValue(
				new URLSearchParams() as ReadonlyURLSearchParams
			);
		});

		it("should show login page when accessing protected route while logged out", () => {
			// Ensure unauthenticated state
			(useSession as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
				data: null,
				status: "unauthenticated",
			});

			renderWithAuth(<LoginPage />);

			// Verify login form is displayed
			expect(screen.getByText(SIGN_IN_TO_ACCOUNT_REGEX)).toBeInTheDocument();
			expect(screen.getByPlaceholderText("Alan Turing")).toBeInTheDocument();
			expect(screen.getByLabelText(PASSWORD_REGEX)).toBeInTheDocument();
		});
	});

	describe("Form Interactions", () => {
		it("should navigate between login and register pages", () => {
			renderWithAuth(<LoginPage />);

			// Find and click the sign up link
			const signUpLink = screen.getByText(SIGN_UP_TODAY_REGEX);
			expect(signUpLink).toHaveAttribute("href", "/register");

			// Verify link exists and has correct href
			expect(signUpLink.closest("a")).toHaveAttribute("href", "/register");
		});

		it("should disable submit button while processing", async () => {
			const user = userEvent.setup();

			// Mock slow login response
			(signIn as unknown as ReturnType<typeof vi.fn>).mockImplementation(
				() =>
					new Promise((resolve) =>
						setTimeout(() => resolve({ ok: true }), 1000)
					)
			);

			renderWithAuth(<LoginPage />);

			// Fill and submit form
			const usernameInput = screen.getByPlaceholderText("Alan Turing");
			const passwordInput = screen.getByLabelText(PASSWORD_REGEX);

			await user.type(usernameInput, "testuser");
			await user.type(passwordInput, "TestPassword123!");

			const submitButton = screen.getByRole("button", { name: LOGIN_REGEX });
			await user.click(submitButton);

			// Button should be disabled during processing
			expect(submitButton).toBeDisabled();
			expect(
				screen.getByRole("button", { name: LOGGING_IN_REGEX })
			).toBeInTheDocument();
		});

		it("should clear errors when re-submitting form", async () => {
			const user = userEvent.setup();

			// First attempt fails
			(signIn as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
				ok: false,
				error: "Invalid credentials",
			});

			renderWithAuth(<LoginPage />);

			// First login attempt
			const usernameInput = screen.getByPlaceholderText("Alan Turing");
			const passwordInput = screen.getByLabelText(PASSWORD_REGEX);

			await user.type(usernameInput, "testuser");
			await user.type(passwordInput, "WrongPassword");

			const submitButton = screen.getByRole("button", { name: LOGIN_REGEX });
			await user.click(submitButton);

			// Wait for error
			await waitFor(() => {
				expect(screen.getByText(INVALID_CREDENTIALS_REGEX)).toBeInTheDocument();
			});

			// Second attempt succeeds
			(signIn as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
				ok: true,
			});

			await user.clear(passwordInput);
			await user.type(passwordInput, "CorrectPassword");
			await user.click(submitButton);

			// Error should be cleared
			await waitFor(() => {
				expect(
					screen.queryByText(INVALID_CREDENTIALS_REGEX)
				).not.toBeInTheDocument();
			});
		});
	});
});
