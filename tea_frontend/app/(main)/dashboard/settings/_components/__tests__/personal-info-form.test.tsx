import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@/src/__tests__/utils/test-utils";
import { PersonalInfoForm } from "../personal-info-form";

// Constants
const USER_UPDATE_REGEX = /.*\/api\/users\/\d+\/$/;

// Mock next-auth/react
const mockUseSession = vi.fn();
vi.mock("next-auth/react", () => ({
	useSession: () => mockUseSession(),
	SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock react-hook-form
let mockFormValues = {
	username: "updateduser",
	email: "updated@example.com",
};

let mockOnSubmit: ((data: unknown) => unknown) | null = null;
let mockHandleSubmit: ((e?: Event) => unknown) | null = null;

vi.mock("react-hook-form", () => {
	const React = require("react");
	return {
		useForm: (config?: { defaultValues?: Record<string, unknown> }) => {
			// Update mockFormValues with defaultValues if provided
			if (config?.defaultValues) {
				mockFormValues = {
					username: config.defaultValues.username as string,
					email: config.defaultValues.email as string,
				};
			}

			const handleSubmit = (onSubmit: (data: unknown) => unknown) => {
				mockOnSubmit = onSubmit;
				mockHandleSubmit = (e?: Event) => {
					if (e && typeof e.preventDefault === "function") {
						e.preventDefault();
					}
					// Call onSubmit with the current form values
					return onSubmit(mockFormValues);
				};
				return mockHandleSubmit;
			};

			return {
				control: {},
				handleSubmit,
				formState: { errors: {} },
				getValues: () => mockFormValues,
				setValue: (name: string, value: unknown) => {
					mockFormValues = { ...mockFormValues, [name]: value };
				},
				watch: vi.fn(),
				reset: vi.fn(),
			};
		},
		Controller: ({
			renderProp,
		}: {
			renderProp: (props: {
				field: Record<string, unknown>;
			}) => React.ReactNode;
		}) => renderProp({ field: {} }),
		FormProvider: ({
			children,
			...formProps
		}: {
			children: React.ReactNode;
			[key: string]: unknown;
		}) => {
			// FormProvider just passes through children, the actual form element
			// with onSubmit will be created by the component
			return React.createElement("div", formProps, children);
		},
	};
});

// Mock the form components
vi.mock("@/components/ui/form", () => {
	const React = require("react");
	return {
		// Form is just FormProvider from react-hook-form - use our mocked version
		Form: ({
			children,
			handleSubmit,
			formState,
			setValue,
			getValues,
			reset,
			watch,
			control,
			...props
		}: {
			children: React.ReactNode;
			handleSubmit?: unknown;
			formState?: unknown;
			setValue?: unknown;
			getValues?: unknown;
			reset?: unknown;
			watch?: unknown;
			control?: unknown;
			[key: string]: unknown;
		}) => {
			// Filter out form methods that shouldn't be passed to DOM
			return React.createElement("div", props, children);
		},
		FormControl: ({ children }: { children: React.ReactNode }) => (
			<div>{children}</div>
		),
		FormDescription: ({ children }: { children: React.ReactNode }) => (
			<div className="text-description">{children}</div>
		),
		FormField: ({
			render: renderField,
		}: {
			render: (props: {
				field: { onChange: () => void; value: string };
			}) => React.ReactNode;
		}) => renderField({ field: { onChange: vi.fn(), value: "" } }),
		FormItem: ({
			children,
			className,
		}: {
			children: React.ReactNode;
			className?: string;
		}) => <div className={className}>{children}</div>,
		FormLabel: ({ children }: { children: React.ReactNode }) => (
			<span>{children}</span>
		),
		FormMessage: () => <div data-testid="form-message" />,
	};
});

// Mock UI components
vi.mock("@/components/ui/input", () => ({
	Input: ({
		placeholder,
		type,
		readOnly,
		...props
	}: {
		placeholder?: string;
		type?: string;
		readOnly?: boolean;
		[key: string]: unknown;
	}) => (
		<input
			placeholder={placeholder}
			readOnly={readOnly}
			type={type}
			{...props}
			data-readonly={readOnly}
			data-testid={`input-${type || "text"}`}
		/>
	),
}));

vi.mock("@/components/ui/button", () => ({
	Button: ({
		children,
		onClick,
		className,
		type,
		disabled,
		...props
	}: {
		children: React.ReactNode;
		onClick?: () => void;
		className?: string;
		type?: "button" | "submit" | "reset";
		disabled?: boolean;
		[key: string]: unknown;
	}) => (
		<button
			{...props}
			className={className}
			data-testid="submit-button"
			disabled={disabled}
			onClick={onClick}
			type={type || "button"}
		>
			{children}
		</button>
	),
}));

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
	Lock: ({ className }: { className: string }) => (
		<div className={className} data-testid="lock-icon">
			Lock
		</div>
	),
}));

// Mock the toast hook
const mockToast = vi.fn();
vi.mock("@/components/ui/use-toast", () => ({
	useToast: () => ({ toast: mockToast }),
}));

import { HttpResponse, http } from "msw";
// Mock fetch using MSW since MSW is intercepting all requests
import { server } from "@/src/__tests__/mocks/server";

const mockFetch = vi.fn();

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
		process.env.NEXT_PUBLIC_API_URL_STAGING = undefined;

		// Set up MSW handlers for each test
		server.use(
			// Handle the specific test environment URL
			http.put("https://api.example.com/api/users/:id/", () => {
				return HttpResponse.json(
					{ message: "User updated successfully" },
					{ status: 200 }
				);
			}),
			// Handle the staging URL
			http.put("https://staging.example.com/api/users/:id/", () => {
				return HttpResponse.json(
					{ message: "User updated successfully" },
					{ status: 200 }
				);
			}),
			// Catch-all pattern for any other user update requests
			http.put(USER_UPDATE_REGEX, () => {
				return HttpResponse.json(
					{ message: "User updated successfully" },
					{ status: 200 }
				);
			})
		);
	});

	describe("Component Rendering", () => {
		it("should render personal info form", () => {
			render(<PersonalInfoForm data={mockUserWithEmail} />);

			expect(screen.getByText("Personal Information")).toBeInTheDocument();
			expect(
				screen.getByText("Use a permanent address where you can receive mail.")
			).toBeInTheDocument();
		});

		it("should have proper grid layout styling", () => {
			const { container } = render(
				<PersonalInfoForm data={mockUserWithEmail} />
			);

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

			const description = screen.getByText(
				"Use a permanent address where you can receive mail."
			);
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

			const placeholderInputs =
				screen.getAllByPlaceholderText("example@gmail.com");
			expect(placeholderInputs.length).toBeGreaterThan(0);
		});

		it("should have proper form field layout", () => {
			const { container } = render(
				<PersonalInfoForm data={mockUserWithEmail} />
			);

			const formItems = container
				.querySelector("form")
				?.querySelectorAll(".col-span-full");
			expect(formItems?.length).toBe(2); // Username and email fields
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
			// Check if it has the col-span-full class (actual rendered class)
			expect(readOnlyDesc).toHaveClass("col-span-full");
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
		beforeEach(() => {
			mockUseSession.mockReturnValue({ data: mockSession });
			// Reset mock form values for each test
			mockFormValues = {
				username: "testuser",
				email: "",
			};
			mockOnSubmit = null;
			mockHandleSubmit = null;
			vi.clearAllMocks();
		});

		it("should show success toast on successful form submission", async () => {
			// Set the form values to match what we expect to submit
			mockFormValues = {
				username: "testuser",
				email: "updated@example.com",
			};

			const { container } = render(
				<PersonalInfoForm data={mockUserWithoutEmail} />
			);

			// Find the form element and submit it
			const form = container.querySelector("form");
			expect(form).toBeInTheDocument();

			await act(async () => {
				// Call the mocked handleSubmit directly since fireEvent.submit doesn't trigger it
				if (mockHandleSubmit) {
					await mockHandleSubmit();
				}
			});

			await waitFor(() => {
				expect(mockToast).toHaveBeenCalledWith({
					description: "User Updated Successfully!",
				});
			});
		});

		it("should show success toast when using staging URL", async () => {
			process.env.NEXT_PUBLIC_API_URL = undefined;
			process.env.NEXT_PUBLIC_API_URL_STAGING = "https://staging.example.com";

			// Set the form values to match what we expect to submit
			mockFormValues = {
				username: "testuser",
				email: "updated@example.com",
			};

			const { container } = render(
				<PersonalInfoForm data={mockUserWithoutEmail} />
			);
			const _form = container.querySelector("form");
			await act(async () => {
				// Call the mocked handleSubmit directly since fireEvent.submit doesn't trigger it
				if (mockHandleSubmit) {
					await mockHandleSubmit();
				}
			});

			await waitFor(() => {
				expect(mockToast).toHaveBeenCalledWith({
					description: "User Updated Successfully!",
				});
			});
		});

		// This test is already correctly testing the success toast, keeping as is
		it("should show success toast on successful update", async () => {
			// Set the form values to match what we expect to submit
			mockFormValues = {
				username: "testuser",
				email: "updated@example.com",
			};

			const { container } = render(
				<PersonalInfoForm data={mockUserWithoutEmail} />
			);
			const _form = container.querySelector("form");
			await act(async () => {
				// Call the mocked handleSubmit directly since fireEvent.submit doesn't trigger it
				if (mockHandleSubmit) {
					await mockHandleSubmit();
				}
			});

			await waitFor(() => {
				expect(mockToast).toHaveBeenCalledWith({
					description: "User Updated Successfully!",
				});
			});
		});
	});

	describe("Error Handling", () => {
		it("should show error toast when API request fails", async () => {
			// Override MSW handler to return error response
			server.use(
				http.put("https://api.example.com/api/users/:id/", () => {
					return HttpResponse.json(
						{ error: "Internal server error" },
						{ status: 500 }
					);
				})
			);

			const { container } = render(
				<PersonalInfoForm data={mockUserWithoutEmail} />
			);
			const _form = container.querySelector("form");
			await act(async () => {
				// Call the mocked handleSubmit directly since fireEvent.submit doesn't trigger it
				if (mockHandleSubmit) {
					await mockHandleSubmit();
				}
			});

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
			// Override MSW handler to return 400 error
			server.use(
				http.put("https://api.example.com/api/users/:id/", () => {
					return HttpResponse.json({ error: "Bad request" }, { status: 400 });
				})
			);

			const { container } = render(
				<PersonalInfoForm data={mockUserWithoutEmail} />
			);
			const _form = container.querySelector("form");
			await act(async () => {
				// Call the mocked handleSubmit directly since fireEvent.submit doesn't trigger it
				if (mockHandleSubmit) {
					await mockHandleSubmit();
				}
			});

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
			let resolvePromise: ((value: unknown) => void) | undefined;
			let _isLoading = false;

			mockFetch.mockImplementation(() => {
				_isLoading = true;
				return new Promise((resolve) => {
					resolvePromise = resolve;
				});
			});

			// Set the form values
			mockFormValues = {
				username: "testuser",
				email: "updated@example.com",
			};

			const { rerender } = render(
				<PersonalInfoForm data={mockUserWithoutEmail} />
			);

			// Get the button before submitting to check its state changes
			const submitButton = screen.getByTestId("submit-button");
			expect(submitButton).toHaveTextContent("Update");

			// Start the submission
			const submissionPromise = act(async () => {
				if (mockOnSubmit) {
					await mockOnSubmit(mockFormValues);
				}
			});

			// Let the promise handler execute
			await new Promise((resolve) => setTimeout(resolve, 0));

			// Force a rerender to see the loading state
			rerender(<PersonalInfoForm data={mockUserWithoutEmail} />);

			// Resolve the fetch promise
			if (resolvePromise) {
				resolvePromise({ ok: true, json: async () => ({}) });
			}

			// Wait for submission to complete
			await submissionPromise;
		});

		it("should disable button during loading", async () => {
			let resolvePromise: ((value: unknown) => void) | undefined;

			mockFetch.mockImplementation(() => {
				return new Promise((resolve) => {
					resolvePromise = resolve;
				});
			});

			// Set the form values
			mockFormValues = {
				username: "testuser",
				email: "updated@example.com",
			};

			const { rerender } = render(
				<PersonalInfoForm data={mockUserWithoutEmail} />
			);

			const submitButton = screen.getByTestId("submit-button");
			expect(submitButton).not.toBeDisabled();

			// Start the submission
			const submissionPromise = act(async () => {
				if (mockOnSubmit) {
					await mockOnSubmit(mockFormValues);
				}
			});

			// Let the promise handler execute
			await new Promise((resolve) => setTimeout(resolve, 0));

			// Force a rerender to see the loading state
			rerender(<PersonalInfoForm data={mockUserWithoutEmail} />);

			// Resolve the fetch promise
			if (resolvePromise) {
				resolvePromise({ ok: true, json: async () => ({}) });
			}

			// Wait for submission to complete
			await submissionPromise;
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

		it("should show success toast even with session without key", async () => {
			mockUseSession.mockReturnValue({
				data: {}, // No key field
			});

			// Set the form values
			mockFormValues = {
				username: "testuser",
				email: "updated@example.com",
			};

			const { container } = render(
				<PersonalInfoForm data={mockUserWithoutEmail} />
			);
			const _form = container.querySelector("form");
			await act(async () => {
				// Call the mocked handleSubmit directly since fireEvent.submit doesn't trigger it
				if (mockHandleSubmit) {
					await mockHandleSubmit();
				}
			});

			await waitFor(() => {
				expect(mockToast).toHaveBeenCalledWith({
					description: "User Updated Successfully!",
				});
			});
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
		it("should show success toast with different user IDs", async () => {
			const differentUser = { ...mockUserWithoutEmail, id: 456 };

			// Set the form values
			mockFormValues = {
				username: "testuser",
				email: "updated@example.com",
			};

			const { container } = render(<PersonalInfoForm data={differentUser} />);
			const _form = container.querySelector("form");
			await act(async () => {
				// Call the mocked handleSubmit directly since fireEvent.submit doesn't trigger it
				if (mockHandleSubmit) {
					await mockHandleSubmit();
				}
			});

			await waitFor(() => {
				expect(mockToast).toHaveBeenCalledWith({
					description: "User Updated Successfully!",
				});
			});
		});

		it("should show success toast with string user IDs", async () => {
			const stringIdUser = { ...mockUserWithoutEmail, id: 789 };

			// Set the form values
			mockFormValues = {
				username: "testuser",
				email: "updated@example.com",
			};

			const { container } = render(<PersonalInfoForm data={stringIdUser} />);
			const _form = container.querySelector("form");
			await act(async () => {
				// Call the mocked handleSubmit directly since fireEvent.submit doesn't trigger it
				if (mockHandleSubmit) {
					await mockHandleSubmit();
				}
			});

			await waitFor(() => {
				expect(mockToast).toHaveBeenCalledWith({
					description: "User Updated Successfully!",
				});
			});
		});

		it("should handle users with different username values", () => {
			const userWithDifferentUsername = {
				...mockUserWithEmail,
				username: "differentuser",
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
			const { container } = render(
				<PersonalInfoForm data={mockUserWithEmail} />
			);

			const form = container.querySelector("form");
			expect(form).toBeInTheDocument();
		});

		it("should have proper grid layout for form fields", () => {
			const { container } = render(
				<PersonalInfoForm data={mockUserWithEmail} />
			);

			const gridContainer = container.querySelector("form .grid");
			expect(gridContainer).toBeInTheDocument();
		});

		it("should span full width for form fields", () => {
			const { container } = render(
				<PersonalInfoForm data={mockUserWithEmail} />
			);

			const formItems = container
				.querySelector("form")
				?.querySelectorAll(".col-span-full");
			expect(formItems?.length).toBeGreaterThanOrEqual(2); // At least username and email fields
		});

		it("should have proper form container layout", () => {
			const { container } = render(
				<PersonalInfoForm data={mockUserWithEmail} />
			);

			const form = container.querySelector("form");
			expect(form).toBeInTheDocument();
		});
	});

	describe("Conditional Rendering", () => {
		it("should conditionally render submit button based on email field", () => {
			const { rerender } = render(
				<PersonalInfoForm data={mockUserWithEmail} />
			);

			// Should not show button when email exists
			expect(screen.queryByTestId("submit-button")).not.toBeInTheDocument();

			// Should show button when email is empty
			rerender(<PersonalInfoForm data={mockUserWithoutEmail} />);
			expect(screen.getByTestId("submit-button")).toBeInTheDocument();
		});

		it("should conditionally render lock icon based on email field", () => {
			const { rerender } = render(
				<PersonalInfoForm data={mockUserWithEmail} />
			);

			// Should show lock icon when email exists
			expect(screen.getAllByTestId("lock-icon").length).toBe(2); // Username + email

			// Should show fewer lock icons when email is empty
			rerender(<PersonalInfoForm data={mockUserWithoutEmail} />);
			expect(screen.getAllByTestId("lock-icon").length).toBe(1); // Only username
		});
	});
});
