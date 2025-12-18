import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import MailingList from "../mailing-list";

// Top-level regex patterns for performance
const LAUNCHING_NOTIFICATION_REGEX = /Get notified when we.*re launching/;
const LOREM_DESCRIPTION_REGEX = /Sagittis scelerisque nulla cursus/;

describe("MailingList", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("Component Rendering", () => {
		it("should render the mailing list component", () => {
			render(<MailingList />);

			expect(
				screen.getByText(LAUNCHING_NOTIFICATION_REGEX)
			).toBeInTheDocument();
		});

		it("should display the description text", () => {
			render(<MailingList />);

			const description = screen.getByText(LOREM_DESCRIPTION_REGEX);
			expect(description).toBeInTheDocument();
			expect(description).toHaveTextContent(
				"Sagittis scelerisque nulla cursus in enim consectetur quam. Dictum urna sed consectetur neque tristique pellentesque."
			);
		});

		it("should render the email input field", () => {
			render(<MailingList />);

			const emailInput = screen.getByPlaceholderText("Enter your email");
			expect(emailInput).toBeInTheDocument();
			expect(emailInput).toHaveAttribute("type", "email");
			expect(emailInput).toHaveAttribute("id", "cta-email");
		});

		it("should render the submit button", () => {
			render(<MailingList />);

			const submitButton = screen.getByRole("button", { name: "Notify me" });
			expect(submitButton).toBeInTheDocument();
			expect(submitButton).toHaveAttribute("type", "submit");
		});
	});

	describe("Form Structure", () => {
		it("should have a form element with correct action", () => {
			const { container } = render(<MailingList />);

			const form = container.querySelector("form");
			expect(form).toBeInTheDocument();
			expect(form).toHaveAttribute("action", "#");
		});

		it("should have proper label for email input", () => {
			render(<MailingList />);

			const label = screen.getByLabelText("Email address");
			expect(label).toBeInTheDocument();
			expect(label).toHaveAttribute("id", "cta-email");
		});

		it("should have screen reader only label", () => {
			const { container } = render(<MailingList />);

			const label = container.querySelector('label[for="cta-email"]');
			expect(label).toHaveClass("sr-only");
		});
	});

	describe("User Interactions", () => {
		it("should allow typing in email input", async () => {
			const user = userEvent.setup();
			render(<MailingList />);

			const emailInput = screen.getByPlaceholderText("Enter your email");
			await user.type(emailInput, "test@example.com");

			expect(emailInput).toHaveValue("test@example.com");
		});

		it("should submit form when button is clicked", async () => {
			const user = userEvent.setup();
			const mockSubmit = vi.fn((e) => e.preventDefault());

			const { container } = render(<MailingList />);
			const form = container.querySelector("form");
			if (!form) {
				throw new Error("Form not found");
			}
			form.addEventListener("submit", mockSubmit);

			const submitButton = screen.getByRole("button", { name: "Notify me" });
			await user.click(submitButton);

			expect(mockSubmit).toHaveBeenCalled();
		});

		it("should submit form when Enter key is pressed in email input", async () => {
			const user = userEvent.setup();
			const mockSubmit = vi.fn((e) => e.preventDefault());

			const { container } = render(<MailingList />);
			const form = container.querySelector("form");
			if (!form) {
				throw new Error("Form not found");
			}
			form.addEventListener("submit", mockSubmit);

			const emailInput = screen.getByPlaceholderText("Enter your email");
			await user.type(emailInput, "test@example.com{Enter}");

			expect(mockSubmit).toHaveBeenCalled();
		});
	});

	describe("Styling and Layout", () => {
		it("should have correct background color classes", () => {
			const { container } = render(<MailingList />);

			const mainContainer = container.querySelector(".bg-white");
			expect(mainContainer).toBeInTheDocument();

			const ctaContainer = container.querySelector(".bg-indigo-600");
			expect(ctaContainer).toBeInTheDocument();
		});

		it("should have correct padding classes", () => {
			const { container } = render(<MailingList />);

			const mainContainer = container.querySelector(".py-16.sm\\:py-24");
			expect(mainContainer).toBeInTheDocument();
		});

		it("should apply correct text colors", () => {
			render(<MailingList />);

			const heading = screen.getByText(LAUNCHING_NOTIFICATION_REGEX);
			expect(heading).toHaveClass("text-white");

			const description = screen.getByText(LOREM_DESCRIPTION_REGEX);
			expect(description).toHaveClass("text-indigo-200");
		});

		it("should have responsive layout classes", () => {
			const { container } = render(<MailingList />);

			const form = container.querySelector("form");
			expect(form).toHaveClass("mt-12", "sm:mx-auto", "sm:flex", "sm:max-w-lg");
		});

		it("should style email input correctly", () => {
			render(<MailingList />);

			const emailInput = screen.getByPlaceholderText("Enter your email");
			expect(emailInput).toHaveClass(
				"block",
				"w-full",
				"rounded-md",
				"border",
				"border-transparent",
				"px-5",
				"py-3",
				"text-base",
				"text-gray-900"
			);
		});

		it("should style submit button correctly", () => {
			render(<MailingList />);

			const submitButton = screen.getByRole("button", { name: "Notify me" });
			expect(submitButton).toHaveClass(
				"block",
				"w-full",
				"rounded-md",
				"bg-indigo-500",
				"text-white"
			);
		});
	});

	describe("Decorative Elements", () => {
		it("should render decorative SVG patterns", () => {
			const { container } = render(<MailingList />);

			const svgs = container.querySelectorAll("svg");
			expect(svgs.length).toBeGreaterThan(0);
		});

		it("should include title elements for SVGs", () => {
			const { container } = render(<MailingList />);

			const titles = container.querySelectorAll("svg title");
			expect(titles.length).toBeGreaterThan(0);
			expect(titles[0]).toHaveTextContent("Decorative background pattern");
		});

		it("should have aria-hidden on decorative elements", () => {
			const { container } = render(<MailingList />);

			const decorativeElements = container.querySelectorAll(
				'[aria-hidden="true"]'
			);
			expect(decorativeElements.length).toBeGreaterThan(0);
		});

		it("should render gray background section", () => {
			const { container } = render(<MailingList />);

			const grayBg = container.querySelector(".bg-gray-50");
			expect(grayBg).toBeInTheDocument();
		});
	});

	describe("Focus States", () => {
		it("should show focus styles on email input", () => {
			render(<MailingList />);

			const emailInput = screen.getByPlaceholderText("Enter your email");
			expect(emailInput).toHaveClass(
				"focus:border-transparent",
				"focus:outline-hidden",
				"focus:ring-2",
				"focus:ring-white"
			);
		});

		it("should show focus styles on submit button", () => {
			render(<MailingList />);

			const submitButton = screen.getByRole("button", { name: "Notify me" });
			expect(submitButton).toHaveClass(
				"focus:outline-hidden",
				"focus:ring-2",
				"focus:ring-white"
			);
		});

		it("should apply hover styles on submit button", () => {
			render(<MailingList />);

			const submitButton = screen.getByRole("button", { name: "Notify me" });
			expect(submitButton).toHaveClass("hover:bg-indigo-400");
		});
	});

	describe("Accessibility", () => {
		it("should have no accessibility violations", async () => {
			const { container } = render(<MailingList />);
			const results = await axe(container, {
				rules: {
					// Disable color contrast check due to jsdom limitations with pseudo-elements
					"color-contrast": { enabled: false },
				},
			});

			expect(results.violations).toHaveLength(0);
		});

		it("should have proper form structure for screen readers", () => {
			const { container } = render(<MailingList />);

			const form = container.querySelector("form");
			expect(form).toBeInTheDocument();
			expect(form).toHaveAttribute("action", "#");
		});

		it("should have accessible heading hierarchy", () => {
			render(<MailingList />);

			const heading = screen.getByRole("heading", { level: 2 });
			expect(heading).toHaveTextContent(LAUNCHING_NOTIFICATION_REGEX);
		});

		it("should have proper contrast ratios", () => {
			render(<MailingList />);

			// White text on indigo-600 background
			const heading = screen.getByText(LAUNCHING_NOTIFICATION_REGEX);
			expect(heading).toHaveClass("text-white");
			expect(heading.closest(".bg-indigo-600")).toBeInTheDocument();
		});
	});

	describe("Responsive Design", () => {
		it("should have mobile-first responsive classes", () => {
			const { container } = render(<MailingList />);

			const form = container.querySelector("form");
			const emailContainer = form?.querySelector(".min-w-0.flex-1");
			const buttonContainer = form?.querySelector(".mt-4.sm\\:mt-0");

			expect(emailContainer).toBeInTheDocument();
			expect(buttonContainer).toBeInTheDocument();
		});

		it("should hide decorative elements on mobile", () => {
			const { container } = render(<MailingList />);

			const hiddenOnMobile = container.querySelector(".hidden.sm\\:block");
			expect(hiddenOnMobile).toBeInTheDocument();
		});

		it("should have responsive padding", () => {
			const { container } = render(<MailingList />);

			const ctaSection = container.querySelector(".px-6.sm\\:px-12");
			expect(ctaSection).toBeInTheDocument();

			const paddingY = container.querySelector(".py-10.sm\\:py-20");
			expect(paddingY).toBeInTheDocument();
		});

		it("should have responsive text alignment", () => {
			const { container } = render(<MailingList />);

			const textCenter = container.querySelector(".sm\\:text-center");
			expect(textCenter).toBeInTheDocument();
		});
	});

	describe("Edge Cases", () => {
		it("should handle empty form submission", async () => {
			const user = userEvent.setup();
			const mockSubmit = vi.fn((e) => e.preventDefault());

			const { container } = render(<MailingList />);
			const form = container.querySelector("form");
			if (!form) {
				throw new Error("Form not found");
			}
			form.addEventListener("submit", mockSubmit);

			const submitButton = screen.getByRole("button", { name: "Notify me" });
			await user.click(submitButton);

			expect(mockSubmit).toHaveBeenCalled();
			const emailInput = screen.getByPlaceholderText("Enter your email");
			expect(emailInput).toHaveValue("");
		});

		it("should preserve input value after blur-sm", async () => {
			const user = userEvent.setup();
			render(<MailingList />);

			const emailInput = screen.getByPlaceholderText("Enter your email");
			await user.type(emailInput, "test@example.com");
			await user.tab(); // Blur the input

			expect(emailInput).toHaveValue("test@example.com");
		});

		it("should handle special characters in email input", async () => {
			const user = userEvent.setup();
			render(<MailingList />);

			const emailInput = screen.getByPlaceholderText("Enter your email");
			await user.type(emailInput, "test+special@example.com");

			expect(emailInput).toHaveValue("test+special@example.com");
		});
	});
});
