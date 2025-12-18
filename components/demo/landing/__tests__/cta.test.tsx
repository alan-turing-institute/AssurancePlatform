import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import CTA from "../cta";

// Top-level regex patterns for performance
const TEA_PLATFORM_DESCRIPTION_REGEX =
	/You can sign up and test the TEA platform/;

describe("CTA", () => {
	describe("Component Rendering", () => {
		it("should render the CTA component", () => {
			render(<CTA />);

			expect(screen.getByRole("heading")).toBeInTheDocument();
		});

		it("should display the main heading text", () => {
			render(<CTA />);

			const heading = screen.getByRole("heading", { level: 2 });
			expect(heading).toHaveTextContent(
				"Boost your assurance case process.Start using TEA today."
			);
		});

		it("should display the description paragraph", () => {
			render(<CTA />);

			const description = screen.getByText(TEA_PLATFORM_DESCRIPTION_REGEX);
			expect(description).toBeInTheDocument();
			expect(description).toHaveTextContent(
				"You can sign up and test the TEA platform in action today. If would like to set up the platform in your own, private environment, please get in touch!"
			);
		});

		it("should render the action button", () => {
			render(<CTA />);

			const actionButton = screen.getByRole("link", {
				name: "See it in action",
			});
			expect(actionButton).toBeInTheDocument();
		});
	});

	describe("Link Behavior", () => {
		it("should link to the correct documentation URL", () => {
			render(<CTA />);

			const actionButton = screen.getByRole("link", {
				name: "See it in action",
			});
			expect(actionButton).toHaveAttribute(
				"href",
				"/docs/curriculum/quick-reference/01-platform-basics"
			);
		});

		it("should have correct link styling", () => {
			render(<CTA />);

			const actionButton = screen.getByRole("link", {
				name: "See it in action",
			});
			expect(actionButton).toHaveClass(
				"rounded-md",
				"bg-white",
				"px-3.5",
				"py-2.5",
				"font-semibold",
				"text-indigo-600",
				"text-sm",
				"shadow-xs"
			);
		});

		it("should have hover styles", () => {
			render(<CTA />);

			const actionButton = screen.getByRole("link", {
				name: "See it in action",
			});
			expect(actionButton).toHaveClass("hover:bg-indigo-50");
		});

		it("should have focus styles", () => {
			render(<CTA />);

			const actionButton = screen.getByRole("link", {
				name: "See it in action",
			});
			expect(actionButton).toHaveClass(
				"focus-visible:outline-solid",
				"focus-visible:outline-2",
				"focus-visible:outline-white",
				"focus-visible:outline-offset-2"
			);
		});
	});

	describe("Layout and Styling", () => {
		it("should have indigo background", () => {
			const { container } = render(<CTA />);

			const mainContainer = container.querySelector(".bg-indigo-700");
			expect(mainContainer).toBeInTheDocument();
		});

		it("should have correct padding classes", () => {
			const { container } = render(<CTA />);

			const paddingContainer = container.querySelector(
				".px-6.py-24.sm\\:px-6.sm\\:py-32"
			);
			expect(paddingContainer).toBeInTheDocument();
		});

		it("should center content with max width", () => {
			const { container } = render(<CTA />);

			const contentContainer = container.querySelector(
				".mx-auto.max-w-2xl.text-center"
			);
			expect(contentContainer).toBeInTheDocument();
		});

		it("should style heading with white text", () => {
			render(<CTA />);

			const heading = screen.getByRole("heading", { level: 2 });
			expect(heading).toHaveClass(
				"text-white",
				"font-bold",
				"text-3xl",
				"sm:text-4xl"
			);
		});

		it("should style description with indigo-200 text", () => {
			render(<CTA />);

			const description = screen.getByText(TEA_PLATFORM_DESCRIPTION_REGEX);
			expect(description).toHaveClass("text-indigo-200", "text-lg");
		});

		it("should have proper spacing between elements", () => {
			render(<CTA />);

			const description = screen.getByText(TEA_PLATFORM_DESCRIPTION_REGEX);
			expect(description).toHaveClass("mt-6");

			const buttonContainer = screen.getByRole("link").parentElement;
			expect(buttonContainer).toHaveClass("mt-10");
		});

		it("should center the action button", () => {
			render(<CTA />);

			const buttonContainer = screen.getByRole("link").parentElement;
			expect(buttonContainer).toHaveClass(
				"flex",
				"items-center",
				"justify-center"
			);
		});
	});

	describe("Responsive Design", () => {
		it("should have responsive padding", () => {
			const { container } = render(<CTA />);

			const paddingContainer = container.querySelector(
				".px-6.py-24.sm\\:px-6.sm\\:py-32.lg\\:px-8"
			);
			expect(paddingContainer).toBeInTheDocument();
		});

		it("should have responsive heading text size", () => {
			render(<CTA />);

			const heading = screen.getByRole("heading", { level: 2 });
			expect(heading).toHaveClass("text-3xl", "sm:text-4xl");
		});

		it("should have max width constraints for description", () => {
			render(<CTA />);

			const description = screen.getByText(TEA_PLATFORM_DESCRIPTION_REGEX);
			expect(description).toHaveClass("mx-auto", "max-w-xl");
		});
	});

	describe("Accessibility", () => {
		it("should have no accessibility violations", async () => {
			const { container } = render(<CTA />);
			const results = await axe(container, {
				rules: {
					// Disable color contrast check due to jsdom limitations
					"color-contrast": { enabled: false },
				},
			});

			expect(results.violations).toHaveLength(0);
		});

		it("should have semantic heading structure", () => {
			render(<CTA />);

			const heading = screen.getByRole("heading", { level: 2 });
			expect(heading).toBeInTheDocument();
		});

		it("should have descriptive link text", () => {
			render(<CTA />);

			const actionButton = screen.getByRole("link", {
				name: "See it in action",
			});
			expect(actionButton).toBeInTheDocument();
		});

		it("should have proper text hierarchy", () => {
			const { container } = render(<CTA />);

			const h2 = container.querySelector("h2");
			const p = container.querySelector("p");

			expect(h2).toBeInTheDocument();
			expect(p).toBeInTheDocument();
		});
	});

	describe("Edge Cases", () => {
		it("should not render commented out Learn more link", () => {
			render(<CTA />);

			expect(screen.queryByText("Learn more")).not.toBeInTheDocument();
			expect(screen.queryByText("→")).not.toBeInTheDocument();
		});

		it("should handle line breaks in heading", () => {
			render(<CTA />);

			const heading = screen.getByRole("heading", { level: 2 });
			const br = heading.querySelector("br");
			expect(br).toBeInTheDocument();
		});

		it("should maintain button gap spacing", () => {
			render(<CTA />);

			const buttonContainer = screen.getByRole("link").parentElement;
			expect(buttonContainer).toHaveClass("gap-x-6");
		});
	});
});
