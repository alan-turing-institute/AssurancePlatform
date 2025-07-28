import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@/src/__tests__/utils/test-utils";
import { PasswordForm } from "../password-form";

// Mock next-auth/react
const mockUseSession = vi.fn();
vi.mock("next-auth/react", () => ({
	useSession: () => mockUseSession(),
	SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock react-hook-form
const mockReset = vi.fn();
vi.mock("react-hook-form", async (importOriginal) => {
	const actual = await importOriginal() as any;
	return {
		...actual,
		useForm: () => ({
			control: {},
			handleSubmit: (fn: any) => async (e: any) => {
				if (e && e.preventDefault) e.preventDefault();
				await fn({
					currentPassword: "oldpassword123",
					newPassword: "NewPassword123!",
					confirmPassword: "NewPassword123!",
				});
			},
			formState: { errors: {} },
			reset: mockReset,
		}),
	};
});

// Mock the form components
vi.mock("@/components/ui/form", () => ({
	Form: ({ children, ...props }: { children: React.ReactNode }) => <form role="form" {...props}>{children}</form>,
	FormControl: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
	FormDescription: ({ children }: { children: React.ReactNode }) => <div className="text-description">{children}</div>,
	FormField: ({ render }: { render: any }) => render({ field: { onChange: vi.fn(), value: "" } }),
	FormItem: ({ children, className }: { children: React.ReactNode; className?: string }) => (
		<div className={className}>{children}</div>
	),
	FormLabel: ({ children }: { children: React.ReactNode }) => <label>{children}</label>,
	FormMessage: () => <div data-testid="form-message" />,
}));

// Mock UI components
vi.mock("@/components/ui/input", () => ({
	Input: ({ type, ...props }: any) => <input type={type} {...props} data-testid={`input-${type}`} />,
}));

vi.mock("@/components/ui/button", () => ({
	Button: ({ children, onClick, className, type, disabled, ...props }: any) => (
		<button
			{...props}
			onClick={onClick}
			className={className}
			type={type || "button"}
			disabled={disabled}
			data-testid="submit-button"
		>
			{children}
		</button>
	),
}));

// Mock the toast hook
const mockToast = vi.fn();
vi.mock("@/components/ui/use-toast", () => ({
	useToast: () => ({ toast: mockToast }),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("PasswordForm", () => {
	const mockUser = {
		id: 123,
		username: "testuser",
		email: "test@example.com",
	};

	const mockCredentialsSession = {
		key: "test-session-key",
		provider: "credentials",
	};

	const mockOAuthSession = {
		key: "test-session-key",
		provider: "google",
	};

	beforeEach(() => {
		vi.clearAllMocks();
		process.env.NEXT_PUBLIC_API_URL = "https://api.example.com";
	});

	describe("Component Rendering", () => {
		it("should render password form for credentials provider", () => {
			mockUseSession.mockReturnValue({ data: mockCredentialsSession });
			render(<PasswordForm data={mockUser} />);

			expect(screen.getByText("Change password")).toBeInTheDocument();
			expect(screen.getByText("Update your password associated with your account.")).toBeInTheDocument();
		});

		it("should render OAuth message for non-credentials provider", () => {
			mockUseSession.mockReturnValue({ data: mockOAuthSession });
			render(<PasswordForm data={mockUser} />);

			expect(screen.getByText(/You are logged in with a/)).toBeInTheDocument();
			expect(screen.getByText("google")).toBeInTheDocument();
			expect(screen.getByText(/therefore you cannot change your password here/)).toBeInTheDocument();
		});

		it("should have proper grid layout styling", () => {
			mockUseSession.mockReturnValue({ data: mockCredentialsSession });
			const { container } = render(<PasswordForm data={mockUser} />);

			const gridContainer = container.querySelector(".grid");
			expect(gridContainer).toHaveClass(
				"grid",
				"max-w-7xl",
				"grid-cols-1",
				"gap-x-8",
				"gap-y-10",
				"px-4",
				"py-16",
				"sm:px-6",
				"md:grid-cols-3",
				"lg:px-8"
			);
		});

		it("should have proper heading styling", () => {
			mockUseSession.mockReturnValue({ data: mockCredentialsSession });
			render(<PasswordForm data={mockUser} />);

			const heading = screen.getByText("Change password");
			expect(heading).toHaveClass(
				"font-semibold",
				"text-base",
				"text-foreground",
				"leading-7"
			);
		});
	});

	describe("Form Fields for Credentials Provider", () => {
		beforeEach(() => {
			mockUseSession.mockReturnValue({ data: mockCredentialsSession });
		});

		it("should render all password fields", () => {
			render(<PasswordForm data={mockUser} />);

			expect(screen.getByText("Current Password")).toBeInTheDocument();
			expect(screen.getByText("New Password")).toBeInTheDocument();
			expect(screen.getByText("Confirm Password")).toBeInTheDocument();
		});

		it("should render password input fields", () => {
			render(<PasswordForm data={mockUser} />);

			const passwordInputs = screen.getAllByTestId("input-password");
			expect(passwordInputs).toHaveLength(3);
		});

		it("should have proper form field descriptions", () => {
			render(<PasswordForm data={mockUser} />);

			expect(screen.getByText("Please enter your existing password.")).toBeInTheDocument();
		});

		it("should render submit button", () => {
			render(<PasswordForm data={mockUser} />);

			const submitButton = screen.getByTestId("submit-button");
			expect(submitButton).toHaveTextContent("Update");
			expect(submitButton).toHaveAttribute("type", "submit");
		});

		it("should have proper submit button styling", () => {
			render(<PasswordForm data={mockUser} />);

			const submitButton = screen.getByTestId("submit-button");
			expect(submitButton).toHaveClass(
				"bg-indigo-600",
				"text-white",
				"hover:bg-indigo-700"
			);
		});
	});

	describe("OAuth Provider Display", () => {
		it("should display provider name with proper styling", () => {
			mockUseSession.mockReturnValue({ data: mockOAuthSession });
			render(<PasswordForm data={mockUser} />);

			const providerSpan = screen.getByText("google");
			expect(providerSpan).toHaveClass("text-indigo-500");
		});

		it("should have proper OAuth message styling", () => {
			mockUseSession.mockReturnValue({ data: mockOAuthSession });
			render(<PasswordForm data={mockUser} />);

			const message = screen.getByText(/You are logged in with a/);
			// The message itself is a <p> element, not its parent
			expect(message).toHaveClass("w-1/2", "text-muted-foreground", "text-sm");
		});

		it("should handle different OAuth providers", () => {
			mockUseSession.mockReturnValue({
				data: { ...mockOAuthSession, provider: "github" }
			});
			render(<PasswordForm data={mockUser} />);

			expect(screen.getByText("github")).toBeInTheDocument();
		});
	});

	describe("Form Submission", () => {
		beforeEach(() => {
			mockUseSession.mockReturnValue({ data: mockCredentialsSession });
		});

		it("should make PUT request to correct endpoint on form submission", async () => {
			const user = userEvent.setup();
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({}),
			});

			render(<PasswordForm data={mockUser} />);

			const submitButton = screen.getByTestId("submit-button");
			await user.click(submitButton);

			await waitFor(() => {
				expect(mockFetch).toHaveBeenCalledWith(
					"https://api.example.com/api/users/123/change-password",
					expect.objectContaining({
						method: "PUT",
						headers: {
							Authorization: "Token test-session-key",
							"Content-Type": "application/json",
						},
						body: JSON.stringify({
							password: "oldpassword123",
							new_password: "NewPassword123!",
						}),
					})
				);
			});
		});

		it("should use staging URL when primary URL is not available", async () => {
			const user = userEvent.setup();
			process.env.NEXT_PUBLIC_API_URL = undefined;
			process.env.NEXT_PUBLIC_API_URL_STAGING = "https://staging.example.com";

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({}),
			});

			render(<PasswordForm data={mockUser} />);

			await user.click(screen.getByTestId("submit-button"));

			expect(mockFetch).toHaveBeenCalledWith(
				"https://staging.example.com/api/users/123/change-password",
				expect.any(Object)
			);
		});

		it("should show success toast on successful password change", async () => {
			const user = userEvent.setup();
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({}),
			});

			render(<PasswordForm data={mockUser} />);

			await user.click(screen.getByTestId("submit-button"));

			await waitFor(() => {
				expect(mockToast).toHaveBeenCalledWith({
					description: "Password Updated Successfully!",
				});
			});
		});
	});

	describe("Error Handling", () => {
		beforeEach(() => {
			mockUseSession.mockReturnValue({ data: mockCredentialsSession });
		});

		it("should display server error from 400 response", async () => {
			const user = userEvent.setup();
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 400,
				json: async () => ({ error: "Current password is incorrect" }),
			});

			render(<PasswordForm data={mockUser} />);

			await user.click(screen.getByTestId("submit-button"));

			await waitFor(() => {
				expect(screen.getByText("Current password is incorrect, Please try again.")).toBeInTheDocument();
			});
		});

		it("should handle 400 response without error field", async () => {
			const user = userEvent.setup();
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 400,
				json: async () => ({}),
			});

			render(<PasswordForm data={mockUser} />);

			await user.click(screen.getByTestId("submit-button"));

			// Should not show error message if no error field
			await waitFor(() => {
				expect(screen.queryByText(/Please try again/)).not.toBeInTheDocument();
			});
		});

		it("should handle network errors gracefully", async () => {
			const user = userEvent.setup();
			mockFetch.mockRejectedValueOnce(new Error("Network error"));

			render(<PasswordForm data={mockUser} />);

			await user.click(screen.getByTestId("submit-button"));

			// Should not crash, error is silently handled
			await waitFor(() => {
				expect(screen.getByTestId("submit-button")).toBeInTheDocument();
			});
		});

		it("should clear error state when form is resubmitted", async () => {
			const user = userEvent.setup();

			// First submission with error
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 400,
				json: async () => ({ error: "Current password is incorrect" }),
			});

			render(<PasswordForm data={mockUser} />);

			await user.click(screen.getByTestId("submit-button"));

			await waitFor(() => {
				expect(screen.getByText("Current password is incorrect, Please try again.")).toBeInTheDocument();
			});

			// Second submission successful
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({}),
			});

			await user.click(screen.getByTestId("submit-button"));

			await waitFor(() => {
				expect(screen.queryByText("Current password is incorrect, Please try again.")).not.toBeInTheDocument();
			});
		});
	});

	describe("Loading States", () => {
		beforeEach(() => {
			mockUseSession.mockReturnValue({ data: mockCredentialsSession });
		});

		it("should show loading text during form submission", async () => {
			const user = userEvent.setup();
			let resolvePromise: (value: any) => void;
			mockFetch.mockImplementation(() =>
				new Promise(resolve => {
					resolvePromise = resolve;
				})
			);

			render(<PasswordForm data={mockUser} />);

			await user.click(screen.getByTestId("submit-button"));

			// Should show loading state
			expect(screen.getByText("Updating")).toBeInTheDocument();

			// Resolve the promise
			resolvePromise!({ ok: true, json: async () => ({}) });

			await waitFor(() => {
				expect(screen.getByText("Update")).toBeInTheDocument();
			});
		});

		it("should disable button during loading", async () => {
			const user = userEvent.setup();
			let resolvePromise: (value: any) => void;
			mockFetch.mockImplementation(() =>
				new Promise(resolve => {
					resolvePromise = resolve;
				})
			);

			render(<PasswordForm data={mockUser} />);

			const submitButton = screen.getByTestId("submit-button");
			await user.click(submitButton);

			// Button should be disabled during loading
			expect(submitButton).toBeDisabled();

			// Resolve the promise
			resolvePromise!({ ok: true, json: async () => ({}) });

			await waitFor(() => {
				expect(submitButton).not.toBeDisabled();
			});
		});
	});

	describe("Session Handling", () => {
		it("should handle missing session", () => {
			mockUseSession.mockReturnValue({ data: null });
			render(<PasswordForm data={mockUser} />);

			// Should still render the form structure
			expect(screen.getByText("Change password")).toBeInTheDocument();
		});

		it("should handle session without provider", () => {
			mockUseSession.mockReturnValue({
				data: { key: "test-key" } // No provider field
			});
			render(<PasswordForm data={mockUser} />);

			// Should render form fields (defaults to credentials-like behavior)
			expect(screen.getByText("Current Password")).toBeInTheDocument();
		});

		it("should handle session without key", async () => {
			const user = userEvent.setup();
			mockUseSession.mockReturnValue({
				data: { provider: "credentials" } // No key field
			});

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({}),
			});

			render(<PasswordForm data={mockUser} />);

			await user.click(screen.getByTestId("submit-button"));

			expect(mockFetch).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					headers: expect.objectContaining({
						Authorization: "Token undefined",
					}),
				})
			);
		});
	});

	describe("User Data Handling", () => {
		beforeEach(() => {
			mockUseSession.mockReturnValue({ data: mockCredentialsSession });
		});

		it("should work with different user IDs", async () => {
			const user = userEvent.setup();
			const differentUser = { ...mockUser, id: 456 };

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({}),
			});

			render(<PasswordForm data={differentUser} />);

			await user.click(screen.getByTestId("submit-button"));

			expect(mockFetch).toHaveBeenCalledWith(
				"https://api.example.com/api/users/456/change-password",
				expect.any(Object)
			);
		});

		it("should handle string user IDs", async () => {
			const user = userEvent.setup();
			const stringIdUser = { ...mockUser, id: "789" };

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({}),
			});

			render(<PasswordForm data={stringIdUser} />);

			await user.click(screen.getByTestId("submit-button"));

			expect(mockFetch).toHaveBeenCalledWith(
				"https://api.example.com/api/users/789/change-password",
				expect.any(Object)
			);
		});
	});

	describe("Accessibility", () => {
		beforeEach(() => {
			mockUseSession.mockReturnValue({ data: mockCredentialsSession });
		});

		it("should have proper heading hierarchy", () => {
			render(<PasswordForm data={mockUser} />);

			const heading = screen.getByRole("heading", { level: 2 });
			expect(heading).toHaveTextContent("Change password");
		});

		it("should have proper form labels", () => {
			render(<PasswordForm data={mockUser} />);

			expect(screen.getByText("Current Password")).toBeInTheDocument();
			expect(screen.getByText("New Password")).toBeInTheDocument();
			expect(screen.getByText("Confirm Password")).toBeInTheDocument();
		});

		it("should be keyboard navigable", async () => {
			const user = userEvent.setup();
			render(<PasswordForm data={mockUser} />);

			// Tab to first input
			await user.tab();
			const passwordInputs = screen.getAllByTestId("input-password");
			expect(passwordInputs[0]).toHaveFocus();
		});

		it("should have form validation messages", () => {
			render(<PasswordForm data={mockUser} />);

			const formMessages = screen.getAllByTestId("form-message");
			expect(formMessages.length).toBeGreaterThan(0);
		});
	});

	describe("Form Validation", () => {
		beforeEach(() => {
			mockUseSession.mockReturnValue({ data: mockCredentialsSession });
		});

		it("should have proper form structure", () => {
			render(<PasswordForm data={mockUser} />);

			const form = screen.getByRole("form");
			expect(form).toBeInTheDocument();
		});

		it("should have proper grid layout for form fields", () => {
			render(<PasswordForm data={mockUser} />);

			const gridContainer = screen.getByRole("form").querySelector(".grid");
			expect(gridContainer).toBeInTheDocument();
		});

		it("should span full width for form fields", () => {
			render(<PasswordForm data={mockUser} />);

			const formItems = screen.getByRole("form").querySelectorAll(".col-span-full");
			expect(formItems.length).toBeGreaterThanOrEqual(3); // At least three password fields
		});
	});
});
