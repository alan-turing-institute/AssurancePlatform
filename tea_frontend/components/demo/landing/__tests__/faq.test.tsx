import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import FAQ from "../faq";

// Top-level regex patterns for performance
const DIFFERENT_QUESTION_REGEX = /Have a different question/;
const TEA_PLATFORM_DEFINITION_REGEX =
	/TEA, short for Transformative Evidential Assurance Platform/;
const EVIDENTIAL_FRAMEWORK_REGEX = /TEA employs a robust evidential framework/;
const VERSATILE_DESIGN_REGEX = /Absolutely! TEA is designed to be versatile/;
const CUSTOMIZABLE_WORKFLOWS_REGEX =
	/Yes, you can! TEA offers customizable workflows/;
const STRAIGHTFORWARD_INTEGRATION_REGEX =
	/Integrating TEA is straightforward and seamless/;

describe("FAQ", () => {
	describe("Component Rendering", () => {
		it("should render the FAQ component", () => {
			render(<FAQ />);

			expect(
				screen.getByRole("heading", { name: "Frequently asked questions" })
			).toBeInTheDocument();
		});

		it("should display the main heading", () => {
			render(<FAQ />);

			const heading = screen.getByRole("heading", { level: 2 });
			expect(heading).toHaveTextContent("Frequently asked questions");
		});

		it("should display the support message", () => {
			render(<FAQ />);

			const supportText = screen.getByText(DIFFERENT_QUESTION_REGEX);
			expect(supportText).toBeInTheDocument();
		});

		it("should render all 5 FAQ items", () => {
			render(<FAQ />);

			const questions = [
				"What is TEA?",
				"How does TEA ensure evidential assurance?",
				"Is TEA suitable for my organization?",
				"Can I customize TEA to fit my workflow?",
				"How easy is it to integrate TEA into my existing systems?",
			];

			for (const question of questions) {
				expect(screen.getByText(question)).toBeInTheDocument();
			}
		});
	});

	describe("FAQ Content", () => {
		it("should display question and answer for TEA definition", () => {
			render(<FAQ />);

			expect(screen.getByText("What is TEA?")).toBeInTheDocument();
			expect(
				screen.getByText(TEA_PLATFORM_DEFINITION_REGEX)
			).toBeInTheDocument();
		});

		it("should display question and answer for evidential assurance", () => {
			render(<FAQ />);

			expect(
				screen.getByText("How does TEA ensure evidential assurance?")
			).toBeInTheDocument();
			expect(screen.getByText(EVIDENTIAL_FRAMEWORK_REGEX)).toBeInTheDocument();
		});

		it("should display question and answer for organization suitability", () => {
			render(<FAQ />);

			expect(
				screen.getByText("Is TEA suitable for my organization?")
			).toBeInTheDocument();
			expect(screen.getByText(VERSATILE_DESIGN_REGEX)).toBeInTheDocument();
		});

		it("should display question and answer for customization", () => {
			render(<FAQ />);

			expect(
				screen.getByText("Can I customize TEA to fit my workflow?")
			).toBeInTheDocument();
			expect(
				screen.getByText(CUSTOMIZABLE_WORKFLOWS_REGEX)
			).toBeInTheDocument();
		});

		it("should display question and answer for integration", () => {
			render(<FAQ />);

			expect(
				screen.getByText(
					"How easy is it to integrate TEA into my existing systems?"
				)
			).toBeInTheDocument();
			expect(
				screen.getByText(STRAIGHTFORWARD_INTEGRATION_REGEX)
			).toBeInTheDocument();
		});
	});

	describe("Support Email Link", () => {
		it("should render email link", () => {
			render(<FAQ />);

			const emailLink = screen.getByRole("link", {
				name: "sending us an email",
			});
			expect(emailLink).toBeInTheDocument();
		});

		it("should have correct mailto URL", () => {
			render(<FAQ />);

			const emailLink = screen.getByRole("link", {
				name: "sending us an email",
			});
			expect(emailLink).toHaveAttribute("href", "mailto:tea@turing.ac.uk");
		});

		it("should have correct styling for email link", () => {
			render(<FAQ />);

			const emailLink = screen.getByRole("link", {
				name: "sending us an email",
			});
			expect(emailLink).toHaveClass(
				"font-semibold",
				"text-indigo-600",
				"hover:text-indigo-500"
			);
		});
	});

	describe("Layout and Styling", () => {
		it("should have white background", () => {
			const { container } = render(<FAQ />);

			const mainContainer = container.querySelector(".bg-white");
			expect(mainContainer).toBeInTheDocument();
		});

		it("should have correct container constraints", () => {
			const { container } = render(<FAQ />);

			const contentContainer = container.querySelector(".mx-auto.max-w-7xl");
			expect(contentContainer).toBeInTheDocument();
		});

		it("should center the header section", () => {
			const { container } = render(<FAQ />);

			const headerSection = container.querySelector(
				".mx-auto.max-w-2xl.text-center"
			);
			expect(headerSection).toBeInTheDocument();
		});

		it("should style heading correctly", () => {
			render(<FAQ />);

			const heading = screen.getByRole("heading", { level: 2 });
			expect(heading).toHaveClass("font-bold", "text-2xl", "text-gray-900");
		});

		it("should style support text correctly", () => {
			render(<FAQ />);

			const supportText = screen.getByText(DIFFERENT_QUESTION_REGEX);
			expect(supportText).toHaveClass("text-base", "text-gray-600", "mt-6");
		});

		it("should have proper spacing for FAQ list", () => {
			const { container } = render(<FAQ />);

			const faqList = container.querySelector("dl");
			expect(faqList?.parentElement).toHaveClass("mt-20");
		});

		it("should use description list for semantic HTML", () => {
			const { container } = render(<FAQ />);

			const dl = container.querySelector("dl");
			const dt = container.querySelector("dt");
			const dd = container.querySelector("dd");

			expect(dl).toBeInTheDocument();
			expect(dt).toBeInTheDocument();
			expect(dd).toBeInTheDocument();
		});
	});

	describe("Responsive Design", () => {
		it("should have responsive padding", () => {
			const { container } = render(<FAQ />);

			const paddingContainer = container.querySelector(
				".px-6.py-16.sm\\:py-24.lg\\:px-8"
			);
			expect(paddingContainer).toBeInTheDocument();
		});

		it("should have responsive grid layout", () => {
			const { container } = render(<FAQ />);

			const gridContainer = container.querySelector(
				".sm\\:grid.sm\\:grid-cols-2.lg\\:grid-cols-3"
			);
			expect(gridContainer).toBeInTheDocument();
		});

		it("should have responsive gap spacing", () => {
			const { container } = render(<FAQ />);

			const gridContainer = container.querySelector(
				".sm\\:gap-x-6.sm\\:gap-y-16.lg\\:gap-x-10"
			);
			expect(gridContainer).toBeInTheDocument();
		});

		it("should reset space-y on larger screens", () => {
			const { container } = render(<FAQ />);

			const gridContainer = container.querySelector(
				".space-y-16.sm\\:space-y-0"
			);
			expect(gridContainer).toBeInTheDocument();
		});
	});

	describe("FAQ Item Structure", () => {
		it("should style questions as definition terms", () => {
			const { container } = render(<FAQ />);

			const questions = container.querySelectorAll("dt");
			expect(questions).toHaveLength(5);

			for (const dt of questions) {
				expect(dt).toHaveClass("font-semibold", "text-base", "text-gray-900");
			}
		});

		it("should style answers as definition descriptions", () => {
			const { container } = render(<FAQ />);

			const answers = container.querySelectorAll("dd");
			expect(answers).toHaveLength(5);

			for (const dd of answers) {
				expect(dd).toHaveClass("mt-2", "text-base", "text-gray-600");
			}
		});

		it("should have proper spacing between question and answer", () => {
			const { container } = render(<FAQ />);

			const answers = container.querySelectorAll("dd");
			for (const dd of answers) {
				expect(dd).toHaveClass("mt-2");
			}
		});
	});

	describe("Accessibility", () => {
		it("should have no accessibility violations", async () => {
			const { container } = render(<FAQ />);
			const results = await axe(container, {
				rules: {
					// Disable color contrast check due to jsdom limitations
					"color-contrast": { enabled: false },
				},
			});

			expect(results.violations).toHaveLength(0);
		});

		it("should use semantic HTML structure", () => {
			const { container } = render(<FAQ />);

			expect(container.querySelector("h2")).toBeInTheDocument();
			expect(container.querySelector("dl")).toBeInTheDocument();
			expect(container.querySelectorAll("dt")).toHaveLength(5);
			expect(container.querySelectorAll("dd")).toHaveLength(5);
		});

		it("should have descriptive link text for email", () => {
			render(<FAQ />);

			const emailLink = screen.getByRole("link", {
				name: "sending us an email",
			});
			expect(emailLink).toBeInTheDocument();
		});

		it("should maintain proper heading hierarchy", () => {
			render(<FAQ />);

			const h2 = screen.getByRole("heading", { level: 2 });
			expect(h2).toBeInTheDocument();

			// Should not have any h1 or h3 headings
			expect(
				screen.queryByRole("heading", { level: 1 })
			).not.toBeInTheDocument();
			expect(
				screen.queryByRole("heading", { level: 3 })
			).not.toBeInTheDocument();
		});
	});

	describe("Edge Cases", () => {
		it("should handle all FAQ items having unique keys", () => {
			const { container } = render(<FAQ />);

			const faqItems = container.querySelectorAll("dl > div");
			expect(faqItems).toHaveLength(5);
		});

		it("should render complete support message with proper spacing", () => {
			render(<FAQ />);

			const supportParagraph = screen.getByText(DIFFERENT_QUESTION_REGEX);
			const fullText = supportParagraph.textContent;

			expect(fullText).toContain("Have a different question");
			expect(fullText).toContain("sending us an email");
			expect(fullText).toContain("as soon as we can");
		});

		it("should have consistent text styling across all FAQ items", () => {
			const { container } = render(<FAQ />);

			const questions = container.querySelectorAll("dt");
			const answers = container.querySelectorAll("dd");

			for (const q of questions) {
				expect(q.className).toBe(
					"font-semibold text-base text-gray-900 leading-7"
				);
			}

			for (const a of answers) {
				expect(a.className).toBe("mt-2 text-base text-gray-600 leading-7");
			}
		});
	});
});
