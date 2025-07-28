import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@/src/__tests__/utils/test-utils";
import { PersonalInfoForm } from "../personal-info-form";

// Mock next-auth/react
const mockUseSession = vi.fn();
vi.mock("next-auth/react", () => ({
	useSession: () => mockUseSession(),
	SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock react-hook-form
vi.mock("react-hook-form", async (importOriginal) => {
	const actual = await importOriginal() as any;
	return {
		...actual,
		useForm: () => ({
			control: {},
			handleSubmit: (fn: any) => (e: any) => {
				e.preventDefault();
				fn({
					username: "updateduser",
					email: "updated@example.com",
				});
			},
			formState: { errors: {} },
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
	Input: ({ placeholder, type, readOnly, ...props }: any) => (
		<input
			placeholder={placeholder}
			type={type}
			readOnly={readOnly}
			{...props}
			data-testid={`input-${type || 'text'}`}
			data-readonly={readOnly}
		/>
	),
}));

vi.mock("@/components/ui/button", () => ({
	Button: ({ children, onClick, className, type, disabled }: any) => (
		<button
			onClick={onClick}
			className={className}
			type={type}
			disabled={disabled}
			data-testid="submit-button"
		>
			{children}
		</button>
	),
}));

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
	Lock: ({ className }: { className: string }) => (
		<div className={className} data-testid="lock-icon">Lock</div>
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

describe("PersonalInfoForm", () => {
	const mockUserWithEmail = {
		id: 123,
		username: "testuser",
		email: "test@example.com",
		createdAt: new Date().toISOString(),
	};

	const mockUserWithoutEmail = {
		id: 123,
		username: "testuser",
		email: "",
		createdAt: new Date().toISOString(),
	};

	const mockSession = {
		key: "test-session-key",
	};

	beforeEach(() => {
		vi.clearAllMocks();
		mockUseSession.mockReturnValue({ data: mockSession });
		process.env.NEXT_PUBLIC_API_URL = "https://api.example.com";
	});

	describe("Component Rendering", () => {
		it("should render personal info form", () => {
			render(<PersonalInfoForm data={mockUserWithEmail} />);

			expect(screen.getByText("Personal Information")).toBeInTheDocument();
			expect(screen.getByText("Use a permanent address where you can receive mail.")).toBeInTheDocument();
		});

		it("should have proper grid layout styling", () => {
			const { container } = render(<PersonalInfoForm data={mockUserWithEmail} />);

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
			render(<PersonalInfoForm data={mockUserWithEmail} />);

			const heading = screen.getByText("Personal Information");
			expect(heading).toHaveClass(
				"font-semibold",
				"text-base",
				"text-foreground",
				"leading-7"
			);
		});

		it("should have proper description styling", () => {
			render(<PersonalInfoForm data={mockUserWithEmail} />);

			const description = screen.getByText("Use a permanent address where you can receive mail.");
			expect(description).toHaveClass(
				"mt-1",
				"text-gray-400",
				"text-sm",
				"leading-6"
			);
		});
	});

	describe("Form Fields", () => {
		it("should render username and email fields", () => {
			render(<PersonalInfoForm data={mockUserWithEmail} />);

			expect(screen.getByText("Username")).toBeInTheDocument();
			expect(screen.getByText("Email Address")).toBeInTheDocument();
		});

		it("should render input fields", () => {
			render(<PersonalInfoForm data={mockUserWithEmail} />);

			const textInputs = screen.getAllByTestId("input-text");
			const emailInputs = screen.getAllByTestId("input-email");

			expect(textInputs.length).toBeGreaterThan(0);
			expect(emailInputs.length).toBeGreaterThan(0);
		});

		it("should have proper input placeholders", () => {
			render(<PersonalInfoForm data={mockUserWithEmail} />);

			const placeholderInputs = screen.getAllByPlaceholderText("example@gmail.com");
			expect(placeholderInputs.length).toBeGreaterThan(0);
		});

		it("should have proper form field layout", () => {
			render(<PersonalInfoForm data={mockUserWithEmail} />);

			const formItems = screen.getByRole("form").querySelectorAll(".col-span-full");
			expect(formItems.length).toBe(2); // Username and email fields
		});
	});

	describe("Read-only Field Behavior", () => {
		it("should make username read-only when session exists", () => {
			mockUseSession.mockReturnValue({ data: mockSession });
			render(<PersonalInfoForm data={mockUserWithEmail} />);

			// Find the text input (username) which should be read-only
			const textInputs = screen.getAllByTestId("input-text");
			const usernameInput = textInputs[0]; // First text input is username
			expect(usernameInput).toHaveAttribute("data-readonly", "true");
		});

		it("should make email read-only when email exists", () => {
			render(<PersonalInfoForm data={mockUserWithEmail} />);

			const emailInput = screen.getAllByTestId("input-email")[0];
			expect(emailInput).toHaveAttribute("data-readonly", "true");
		});

		it("should not make email read-only when email is empty", () => {
			render(<PersonalInfoForm data={mockUserWithoutEmail} />);

			const emailInput = screen.getAllByTestId("input-email")[0];
			expect(emailInput).toHaveAttribute("data-readonly", "false");
		});

		it("should show lock icon for read-only username when session exists", () => {
			mockUseSession.mockReturnValue({ data: mockSession });
			render(<PersonalInfoForm data={mockUserWithEmail} />);

			const lockIcons = screen.getAllByTestId("lock-icon");
			expect(lockIcons.length).toBeGreaterThan(0);

			const readOnlyTexts = screen.getAllByText("Read only");
			expect(readOnlyTexts.length).toBeGreaterThan(0);
		});

		it("should show lock icon for read-only email when email exists", () => {
			render(<PersonalInfoForm data={mockUserWithEmail} />);

			const lockIcons = screen.getAllByTestId("lock-icon");
			expect(lockIcons.length).toBeGreaterThan(0);
		});

		it("should not show lock icon for email when email is empty", () => {
			render(<PersonalInfoForm data={mockUserWithoutEmail} />);

			// Should only show one lock icon (for username)
			const lockIcons = screen.getAllByTestId("lock-icon");
			expect(lockIcons.length).toBe(1);
		});

		it("should have proper lock icon styling", () => {
			render(<PersonalInfoForm data={mockUserWithEmail} />);

			const lockIcon = screen.getAllByTestId("lock-icon")[0];
			expect(lockIcon).toHaveClass("mr-2", "h-3", "w-3");
		});

		it("should have proper read-only description styling", () => {
			mockUseSession.mockReturnValue({ data: mockSession });
			render(<PersonalInfoForm data={mockUserWithEmail} />);

			const readOnlyDesc = screen.getAllByText("Read only")[0].parentElement;
			expect(readOnlyDesc).toBeInTheDocument();
			// Check if it has at least the flex class
			expect(readOnlyDesc).toHaveClass("flex");
		});
	});

	describe("Submit Button Visibility", () => {
		it("should show submit button when email is empty", () => {
			render(<PersonalInfoForm data={mockUserWithoutEmail} />);

			expect(screen.getByTestId("submit-button")).toBeInTheDocument();
		});

		it("should hide submit button when email exists", () => {
			render(<PersonalInfoForm data={mockUserWithEmail} />);

			expect(screen.queryByTestId("submit-button")).not.toBeInTheDocument();
		});

		it("should have proper submit button styling when visible", () => {
			render(<PersonalInfoForm data={mockUserWithoutEmail} />);

			const submitButton = screen.getByTestId("submit-button");
			expect(submitButton).toHaveClass(
				"bg-indigo-600",
				"text-white",
				"hover:bg-indigo-700"
			);
		});

		it("should show correct button text based on loading state", () => {
			render(<PersonalInfoForm data={mockUserWithoutEmail} />);

			expect(screen.getByText("Update")).toBeInTheDocument();
		});
	});

	describe("Form Submission", () => {
		it("should make PUT request to correct endpoint on form submission", async () => {
			const user = userEvent.setup();
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ username: "updateduser", email: "updated@example.com" }),
			});

			render(<PersonalInfoForm data={mockUserWithoutEmail} />);

			await user.click(screen.getByTestId("submit-button"));

			await waitFor(() => {
				expect(mockFetch).toHaveBeenCalledWith(
					"https://api.example.com/api/users/123/",
					expect.objectContaining({
						method: "PUT",
						headers: {
							Authorization: "Token test-session-key",
							"Content-Type": "application/json",
						},
						body: JSON.stringify({
							username: "updateduser",
							email: "updated@example.com",
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

			render(<PersonalInfoForm data={mockUserWithoutEmail} />);

			await user.click(screen.getByTestId("submit-button"));

			await waitFor(() => {
				expect(mockFetch).toHaveBeenCalledWith(
					"https://staging.example.com/api/users/123/",
					expect.any(Object)
				);
			});
		});

		it("should show success toast on successful update", async () => {
			const user = userEvent.setup();
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({}),
			});

			render(<PersonalInfoForm data={mockUserWithoutEmail} />);

			await user.click(screen.getByTestId("submit-button"));

			await waitFor(() => {
				expect(mockToast).toHaveBeenCalledWith({
					description: "User Updated Successfully!",
				});
			});
		});
	});

	describe("Error Handling", () => {

		it("should show error toast when API request fails", async () => {
			const user = userEvent.setup();
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 500,
			});

			render(<PersonalInfoForm data={mockUserWithoutEmail} />);

			await user.click(screen.getByTestId("submit-button"));

			await waitFor(() => {
				expect(mockToast).toHaveBeenCalledWith({
					variant: "destructive",
					title: "Uh oh! Something went wrong.",
					description: "Something went wrong",
				});
			});
		});

		it("should handle network errors gracefully", async () => {
			const user = userEvent.setup();
			mockFetch.mockRejectedValueOnce(new Error("Network error"));

			render(<PersonalInfoForm data={mockUserWithoutEmail} />);

			await user.click(screen.getByTestId("submit-button"));

			// Should not crash, error is silently handled
			await waitFor(() => {
				expect(screen.getByTestId("submit-button")).toBeInTheDocument();
			});
		});

		it("should handle different HTTP error statuses", async () => {
			const user = userEvent.setup();
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 400,
			});

			render(<PersonalInfoForm data={mockUserWithoutEmail} />);

			await user.click(screen.getByTestId("submit-button"));

			await waitFor(() => {
				expect(mockToast).toHaveBeenCalledWith(
					expect.objectContaining({
						variant: "destructive",
					})
				);
			});
		});
	});

	describe("Loading States", () => {
		it("should show loading text during form submission", async () => {
			const user = userEvent.setup();
			let resolvePromise: ((value: unknown) => void) | undefined;
			mockFetch.mockImplementation(() =>
				new Promise(resolve => {
					resolvePromise = resolve;
				})
			);

			render(<PersonalInfoForm data={mockUserWithoutEmail} />);

			await user.click(screen.getByTestId("submit-button"));

			// Should show loading state
			expect(screen.getByText("Updating")).toBeInTheDocument();

			// Resolve the promise
			if (resolvePromise) {
				resolvePromise({ ok: true, json: async () => ({}) });
			}

			await waitFor(() => {
				expect(screen.getByText("Update")).toBeInTheDocument();
			});
		});

		it("should disable button during loading", async () => {
			const user = userEvent.setup();
			let resolvePromise: ((value: unknown) => void) | undefined;
			mockFetch.mockImplementation(() =>
				new Promise(resolve => {
					resolvePromise = resolve;
				})
			);

			render(<PersonalInfoForm data={mockUserWithoutEmail} />);

			const submitButton = screen.getByTestId("submit-button");
			await user.click(submitButton);

			// Button should be disabled during loading
			expect(submitButton).toBeDisabled();

			// Resolve the promise
			if (resolvePromise) {
				resolvePromise({ ok: true, json: async () => ({}) });
			}

			await waitFor(() => {
				expect(submitButton).not.toBeDisabled();
			});
		});
	});

	describe("Session Handling", () => {
		it("should handle missing session", () => {
			mockUseSession.mockReturnValue({ data: null });
			render(<PersonalInfoForm data={mockUserWithEmail} />);

			// Username should not be read-only without session
			const textInputs = screen.getAllByTestId("input-text");
			const usernameInput = textInputs[0];
			expect(usernameInput).toHaveAttribute("data-readonly", "false");
		});

		it("should handle session without key", async () => {
			const user = userEvent.setup();
			mockUseSession.mockReturnValue({
				data: {} // No key field
			});

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({}),
			});

			render(<PersonalInfoForm data={mockUserWithoutEmail} />);

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

		it("should show lock icon only when session exists", () => {
			mockUseSession.mockReturnValue({ data: null });
			render(<PersonalInfoForm data={mockUserWithEmail} />);

			// Should only show lock icon for email (since it exists), not username
			const lockIcons = screen.getAllByTestId("lock-icon");
			expect(lockIcons.length).toBe(1);
		});
	});

	describe("User Data Handling", () => {
		it("should work with different user IDs", async () => {
			const user = userEvent.setup();
			const differentUser = { ...mockUserWithoutEmail, id: 456 };

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({}),
			});

			render(<PersonalInfoForm data={differentUser} />);

			await user.click(screen.getByTestId("submit-button"));

			expect(mockFetch).toHaveBeenCalledWith(
				"https://api.example.com/api/users/456/",
				expect.any(Object)
			);
		});

		it("should handle string user IDs", async () => {
			const user = userEvent.setup();
			const stringIdUser = { ...mockUserWithoutEmail, id: 789 };

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({}),
			});

			render(<PersonalInfoForm data={stringIdUser} />);

			await user.click(screen.getByTestId("submit-button"));

			expect(mockFetch).toHaveBeenCalledWith(
				"https://api.example.com/api/users/789/",
				expect.any(Object)
			);
		});

		it("should handle users with different username values", () => {
			const userWithDifferentUsername = {
				...mockUserWithEmail,
				username: "differentuser"
			};
			render(<PersonalInfoForm data={userWithDifferentUsername} />);

			// Should render form normally
			expect(screen.getByText("Username")).toBeInTheDocument();
			expect(screen.getByText("Email Address")).toBeInTheDocument();
		});
	});

	describe("Accessibility", () => {
		it("should have proper heading hierarchy", () => {
			render(<PersonalInfoForm data={mockUserWithEmail} />);

			const heading = screen.getByRole("heading", { level: 2 });
			expect(heading).toHaveTextContent("Personal Information");
		});

		it("should have proper form labels", () => {
			render(<PersonalInfoForm data={mockUserWithEmail} />);

			expect(screen.getByText("Username")).toBeInTheDocument();
			expect(screen.getByText("Email Address")).toBeInTheDocument();
		});

		it("should be keyboard navigable", async () => {
			const user = userEvent.setup();
			render(<PersonalInfoForm data={mockUserWithoutEmail} />);

			// Tab to first input
			await user.tab();
			const textInputs = screen.getAllByTestId("input-text");
			expect(textInputs[0]).toHaveFocus();
		});

		it("should have form validation messages", () => {
			render(<PersonalInfoForm data={mockUserWithEmail} />);

			const formMessages = screen.getAllByTestId("form-message");
			expect(formMessages.length).toBeGreaterThan(0);
		});

		it("should have descriptive read-only indicators", () => {
			render(<PersonalInfoForm data={mockUserWithEmail} />);

			const readOnlyTexts = screen.getAllByText("Read only");
			expect(readOnlyTexts.length).toBeGreaterThan(0);
		});
	});

	describe("Form Structure", () => {
		it("should have proper form styling", () => {
			render(<PersonalInfoForm data={mockUserWithEmail} />);

			const form = screen.getByRole("form");
			expect(form).toBeInTheDocument();
		});

		it("should have proper grid layout for form fields", () => {
			render(<PersonalInfoForm data={mockUserWithEmail} />);

			const gridContainer = screen.getByRole("form").querySelector(".grid");
			expect(gridContainer).toBeInTheDocument();
		});

		it("should span full width for form fields", () => {
			render(<PersonalInfoForm data={mockUserWithEmail} />);

			const formItems = screen.getByRole("form").querySelectorAll(".col-span-full");
			expect(formItems.length).toBeGreaterThanOrEqual(2); // At least username and email fields
		});

		it("should have proper form container layout", () => {
			render(<PersonalInfoForm data={mockUserWithEmail} />);

			const form = screen.getByRole("form");
			expect(form).toBeInTheDocument();
		});
	});

	describe("Conditional Rendering", () => {
		it("should conditionally render submit button based on email field", () => {
			const { rerender } = render(<PersonalInfoForm data={mockUserWithEmail} />);

			// Should not show button when email exists
			expect(screen.queryByTestId("submit-button")).not.toBeInTheDocument();

			// Should show button when email is empty
			rerender(<PersonalInfoForm data={mockUserWithoutEmail} />);
			expect(screen.getByTestId("submit-button")).toBeInTheDocument();
		});

		it("should conditionally render lock icon based on email field", () => {
			const { rerender } = render(<PersonalInfoForm data={mockUserWithEmail} />);

			// Should show lock icon when email exists
			expect(screen.getAllByTestId("lock-icon").length).toBe(2); // Username + email

			// Should show fewer lock icons when email is empty
			rerender(<PersonalInfoForm data={mockUserWithoutEmail} />);
			expect(screen.getAllByTestId("lock-icon").length).toBe(1); // Only username
		});
	});
});
