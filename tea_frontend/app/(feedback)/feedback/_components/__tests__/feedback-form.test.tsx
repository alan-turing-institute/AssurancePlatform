import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FeedbackForm } from "../feedback-form";

// Mock next/navigation
vi.mock("next/navigation", () => ({
	useRouter: vi.fn(),
}));

// Regex constants for performance optimization
const NAME_REGEX = /name/i;
const EMAIL_ADDRESS_REGEX = /email address/i;
const FEEDBACK_REGEX = /your feedback/i;
const CANCEL_BUTTON_REGEX = /cancel/i;
const SUBMIT_BUTTON_REGEX = /submit/i;

describe("FeedbackForm", () => {
	const mockPush = vi.fn();
	const mockRouter = {
		push: mockPush,
		replace: vi.fn(),
		prefetch: vi.fn(),
		back: vi.fn(),
		forward: vi.fn(),
		refresh: vi.fn(),
	};

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(useRouter).mockReturnValue(mockRouter);
	});

	describe("Form Rendering", () => {
		it("should render form with all required fields", () => {
			render(<FeedbackForm />);

			expect(screen.getByText("Feedback Form")).toBeInTheDocument();
			expect(
				screen.getByText(
					"We appreciate any type of feedback, please fill in the form below and let us know what you think of our product."
				)
			).toBeInTheDocument();

			expect(screen.getByLabelText(NAME_REGEX)).toBeInTheDocument();
			expect(screen.getByLabelText(EMAIL_ADDRESS_REGEX)).toBeInTheDocument();
			expect(screen.getByLabelText(FEEDBACK_REGEX)).toBeInTheDocument();

			expect(
				screen.getByRole("button", { name: CANCEL_BUTTON_REGEX })
			).toBeInTheDocument();
			expect(
				screen.getByRole("button", { name: SUBMIT_BUTTON_REGEX })
			).toBeInTheDocument();
		});

		it("should render form fields with correct placeholders", () => {
			render(<FeedbackForm />);

			expect(screen.getByPlaceholderText("Kai")).toBeInTheDocument();
			expect(
				screen.getByPlaceholderText("example@gmail.com")
			).toBeInTheDocument();
			expect(
				screen.getByPlaceholderText("Let us know what you think...")
			).toBeInTheDocument();
		});

		it("should render email field with correct type", () => {
			render(<FeedbackForm />);

			const emailField = screen.getByLabelText(EMAIL_ADDRESS_REGEX);
			expect(emailField).toHaveAttribute("type", "email");
		});

		it("should render textarea with correct attributes", () => {
			render(<FeedbackForm />);

			const feedbackField = screen.getByLabelText(FEEDBACK_REGEX);
			expect(feedbackField).toHaveAttribute("rows", "10");
			expect(feedbackField).toHaveClass("resize-none");
		});
	});

	describe("Form Validation", () => {
		it("should show validation error for name field when less than 2 characters", async () => {
			const user = userEvent.setup();
			render(<FeedbackForm />);

			const nameField = screen.getByLabelText(NAME_REGEX);
			const emailField = screen.getByLabelText(EMAIL_ADDRESS_REGEX);
			const feedbackField = screen.getByLabelText(FEEDBACK_REGEX);

			// Fill required fields to isolate name validation
			await user.type(emailField, "test@example.com");
			await user.type(feedbackField, "This is feedback");

			// Type invalid name and blur to trigger validation
			await user.type(nameField, "A");
			await user.tab(); // Trigger blur event

			await waitFor(() => {
				expect(
					screen.getByText("Name must be at least 2 characters.")
				).toBeInTheDocument();
			});
		});

		it("should show validation error for email field when less than 2 characters", async () => {
			const user = userEvent.setup();
			render(<FeedbackForm />);

			const emailField = screen.getByLabelText(EMAIL_ADDRESS_REGEX);
			const nameField = screen.getByLabelText(NAME_REGEX);
			const feedbackField = screen.getByLabelText(FEEDBACK_REGEX);

			// Fill other required fields
			await user.type(nameField, "John Doe");
			await user.type(feedbackField, "This is feedback");

			// Type invalid email and blur to trigger validation
			await user.type(emailField, "A");
			await user.tab(); // This triggers blur which should activate validation

			await waitFor(() => {
				expect(
					screen.getByText("Email must be at least 2 characters.")
				).toBeInTheDocument();
			});
		});

		it("should show validation error for feedback field when less than 2 characters", async () => {
			const user = userEvent.setup();
			render(<FeedbackForm />);

			const feedbackField = screen.getByLabelText(FEEDBACK_REGEX);
			const nameField = screen.getByLabelText(NAME_REGEX);
			const emailField = screen.getByLabelText(EMAIL_ADDRESS_REGEX);

			// Fill other required fields
			await user.type(nameField, "John Doe");
			await user.type(emailField, "john@example.com");

			// Type invalid feedback and blur to trigger validation
			await user.type(feedbackField, "A");
			await user.tab(); // This triggers blur which should activate validation

			await waitFor(() => {
				expect(
					screen.getByText("Feedback must be at least 2 characters.")
				).toBeInTheDocument();
			});
		});

		it("should show all validation errors when form is empty", async () => {
			const user = userEvent.setup();
			render(<FeedbackForm />);

			// Focus and blur each field to trigger validation
			const nameField = screen.getByLabelText(NAME_REGEX);
			const emailField = screen.getByLabelText(EMAIL_ADDRESS_REGEX);
			const feedbackField = screen.getByLabelText(FEEDBACK_REGEX);

			await user.click(nameField);
			await user.tab();
			await user.click(emailField);
			await user.tab();
			await user.click(feedbackField);
			await user.tab();

			await waitFor(() => {
				expect(
					screen.getByText("Name must be at least 2 characters.")
				).toBeInTheDocument();
				expect(
					screen.getByText("Email must be at least 2 characters.")
				).toBeInTheDocument();
				expect(
					screen.getByText("Feedback must be at least 2 characters.")
				).toBeInTheDocument();
			});
		});

		it("should not show validation errors when all fields have valid input", async () => {
			const user = userEvent.setup();
			render(<FeedbackForm />);

			const nameField = screen.getByLabelText(NAME_REGEX);
			const emailField = screen.getByLabelText(EMAIL_ADDRESS_REGEX);
			const feedbackField = screen.getByLabelText(FEEDBACK_REGEX);
			const submitButton = screen.getByRole("button", {
				name: SUBMIT_BUTTON_REGEX,
			});

			await user.type(nameField, "John Doe");
			await user.type(emailField, "john@example.com");
			await user.type(feedbackField, "This is great feedback");
			await user.click(submitButton);

			await waitFor(() => {
				expect(
					screen.queryByText("Name must be at least 2 characters.")
				).not.toBeInTheDocument();
				expect(
					screen.queryByText("Email must be at least 2 characters.")
				).not.toBeInTheDocument();
				expect(
					screen.queryByText("Feedback must be at least 2 characters.")
				).not.toBeInTheDocument();
			});
		});
	});

	describe("Form Interaction", () => {
		it("should allow typing in all form fields", async () => {
			const user = userEvent.setup();
			render(<FeedbackForm />);

			const nameField = screen.getByLabelText(NAME_REGEX);
			const emailField = screen.getByLabelText(EMAIL_ADDRESS_REGEX);
			const feedbackField = screen.getByLabelText(FEEDBACK_REGEX);

			await user.type(nameField, "John Doe");
			await user.type(emailField, "john@example.com");
			await user.type(feedbackField, "This is my feedback");

			expect(nameField).toHaveValue("John Doe");
			expect(emailField).toHaveValue("john@example.com");
			expect(feedbackField).toHaveValue("This is my feedback");
		});

		it("should clear field content when backspaced", async () => {
			const user = userEvent.setup();
			render(<FeedbackForm />);

			const nameField = screen.getByLabelText(NAME_REGEX);

			await user.type(nameField, "John");
			expect(nameField).toHaveValue("John");

			await user.clear(nameField);
			expect(nameField).toHaveValue("");
		});

		it("should handle tab navigation between fields", async () => {
			const user = userEvent.setup();
			render(<FeedbackForm />);

			const nameField = screen.getByLabelText(NAME_REGEX);
			const emailField = screen.getByLabelText(EMAIL_ADDRESS_REGEX);
			const feedbackField = screen.getByLabelText(FEEDBACK_REGEX);

			await user.click(nameField);
			expect(nameField).toHaveFocus();

			await user.tab();
			expect(emailField).toHaveFocus();

			await user.tab();
			expect(feedbackField).toHaveFocus();
		});
	});

	describe("Button Actions", () => {
		it("should navigate to home page when cancel button is clicked", async () => {
			const user = userEvent.setup();
			render(<FeedbackForm />);

			const cancelButton = screen.getByRole("button", {
				name: CANCEL_BUTTON_REGEX,
			});
			await user.click(cancelButton);

			expect(mockPush).toHaveBeenCalledWith("/");
		});

		it("should have correct styling for cancel button", () => {
			render(<FeedbackForm />);

			const cancelButton = screen.getByRole("button", {
				name: CANCEL_BUTTON_REGEX,
			});
			expect(cancelButton).toHaveTextContent("Cancel");

			// Check for icon presence
			const icon = cancelButton.querySelector("svg");
			expect(icon).toBeInTheDocument();
		});

		it("should have correct styling for submit button", () => {
			render(<FeedbackForm />);

			const submitButton = screen.getByRole("button", {
				name: SUBMIT_BUTTON_REGEX,
			});
			expect(submitButton).toHaveAttribute("type", "submit");
			expect(submitButton).toHaveClass(
				"bg-indigo-600",
				"text-white",
				"hover:bg-indigo-700"
			);
		});

		it("should submit form when submit button is clicked with valid data", async () => {
			const user = userEvent.setup();
			render(<FeedbackForm />);

			const nameField = screen.getByLabelText(NAME_REGEX);
			const emailField = screen.getByLabelText(EMAIL_ADDRESS_REGEX);
			const feedbackField = screen.getByLabelText(FEEDBACK_REGEX);
			const submitButton = screen.getByRole("button", {
				name: SUBMIT_BUTTON_REGEX,
			});

			await user.type(nameField, "John Doe");
			await user.type(emailField, "john@example.com");
			await user.type(feedbackField, "This is great feedback");
			await user.click(submitButton);

			// Since onSubmit is currently a TODO, we just verify no errors occur
			await waitFor(() => {
				expect(
					screen.queryByText("Name must be at least 2 characters.")
				).not.toBeInTheDocument();
			});
		});
	});

	describe("Form Layout", () => {
		it("should have correct form layout structure", () => {
			render(<FeedbackForm />);

			// Query by tag name since form elements don't always have role="form"
			const formElement = document.querySelector("form");
			expect(formElement).toBeInTheDocument();
			expect(formElement).toHaveClass("w-full", "space-y-6");

			const mainContainer = formElement?.closest("div");
			expect(mainContainer).toHaveClass(
				"mx-12",
				"w-full",
				"max-w-3xl",
				"rounded-md",
				"bg-background",
				"p-8",
				"shadow-xl"
			);
		});

		it("should have proper button layout", () => {
			render(<FeedbackForm />);

			const buttonContainer = screen
				.getByRole("button", { name: CANCEL_BUTTON_REGEX })
				.closest("div");
			expect(buttonContainer).toHaveClass(
				"flex",
				"items-center",
				"justify-between"
			);
		});
	});

	describe("Accessibility", () => {
		it("should have proper labels for all form fields", () => {
			render(<FeedbackForm />);

			expect(screen.getByLabelText(NAME_REGEX)).toBeInTheDocument();
			expect(screen.getByLabelText(EMAIL_ADDRESS_REGEX)).toBeInTheDocument();
			expect(screen.getByLabelText(FEEDBACK_REGEX)).toBeInTheDocument();
		});

		it("should have proper heading structure", () => {
			render(<FeedbackForm />);

			const heading = screen.getByRole("heading", { level: 1 });
			expect(heading).toHaveTextContent("Feedback Form");
		});

		it("should have form element", () => {
			render(<FeedbackForm />);

			// Query by tag name since form elements don't always have role="form"
			const formElement = document.querySelector("form");
			expect(formElement).toBeInTheDocument();
		});

		it("should have buttons with proper roles and accessible names", () => {
			render(<FeedbackForm />);

			expect(
				screen.getByRole("button", { name: CANCEL_BUTTON_REGEX })
			).toBeInTheDocument();
			expect(
				screen.getByRole("button", { name: SUBMIT_BUTTON_REGEX })
			).toBeInTheDocument();
		});
	});

	describe("Edge Cases", () => {
		it("should handle very long input in text fields", async () => {
			const user = userEvent.setup();
			render(<FeedbackForm />);

			const longText = "A".repeat(1000);
			const nameField = screen.getByLabelText(NAME_REGEX);
			const feedbackField = screen.getByLabelText(FEEDBACK_REGEX);

			await user.type(nameField, longText);
			await user.type(feedbackField, longText);

			expect(nameField).toHaveValue(longText);
			expect(feedbackField).toHaveValue(longText);
		});

		it("should handle special characters in input fields", async () => {
			const user = userEvent.setup();
			render(<FeedbackForm />);

			const specialText = "John@#$%^&*()_+;,./ Doe";
			const nameField = screen.getByLabelText(NAME_REGEX);

			// Use paste instead of type for special characters
			await user.click(nameField);
			await user.paste(specialText);
			expect(nameField).toHaveValue(specialText);
		});

		it("should maintain form state when interacting with different fields", async () => {
			const user = userEvent.setup();
			render(<FeedbackForm />);

			const nameField = screen.getByLabelText(NAME_REGEX);
			const emailField = screen.getByLabelText(EMAIL_ADDRESS_REGEX);
			const feedbackField = screen.getByLabelText(FEEDBACK_REGEX);

			await user.type(nameField, "John");
			await user.type(emailField, "john@test.com");
			await user.type(feedbackField, "Test feedback");

			// Click between fields and verify values persist
			await user.click(nameField);
			expect(nameField).toHaveValue("John");
			expect(emailField).toHaveValue("john@test.com");
			expect(feedbackField).toHaveValue("Test feedback");
		});
	});
});
