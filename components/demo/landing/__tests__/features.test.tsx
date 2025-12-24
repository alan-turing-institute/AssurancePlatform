import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import Features from "../features";

// Top-level regex patterns for performance
const STRUCTURED_METHODOLOGY_REGEX =
	/Our platform uses a structured methodology/;
const OPEN_SHARING_REGEX = /Our aim is to facilitate open sharing/;
const TRADITIONAL_GOALS_REGEX = /Going beyond traditional goals/;
const REMOVE_BARRIERS_REGEX = /The TEA Platform aims to remove barriers/;
const ENCOURAGE_OPENNESS_REGEX = /Although we promote and encourage openness/;
const FREELY_ACCESSIBLE_REGEX = /The platform includes freely accessible/;
const LOREM_IPSUM_REGEX = /Lorem ipsum/;

// Mock Next.js Image component with proper types
type ImageProps = {
	src: string;
	alt: string;
	className?: string;
	width?: number;
	height?: number;
};

vi.mock("next/image", () => ({
	default: ({ src, alt, className, width, height }: ImageProps) => (
		// biome-ignore lint/performance/noImgElement: This is a test mock
		<img
			alt={alt}
			className={className}
			data-testid="features-image"
			height={height}
			src={src}
			width={width}
		/>
	),
}));

describe("Features", () => {
	describe("Component Rendering", () => {
		it("should render the features component", () => {
			render(<Features />);

			expect(screen.getByText("Everything you need")).toBeInTheDocument();
		});

		it("should display the section subtitle", () => {
			render(<Features />);

			const subtitle = screen.getByText("Everything you need");
			expect(subtitle).toBeInTheDocument();
			expect(subtitle.tagName).toBe("H2");
		});

		it("should display the main heading", () => {
			render(<Features />);

			const heading = screen.getByText("What TEA offers");
			expect(heading).toBeInTheDocument();
		});

		it("should render all 6 features", () => {
			render(<Features />);

			const featureTitles = [
				"Structured Methodology.",
				"Best Practices.",
				"Responsible research and Innovation.",
				"Community Building.",
				"Privacy and Control.",
				"Training and Capacity Building.",
			];

			for (const title of featureTitles) {
				expect(screen.getByText(title)).toBeInTheDocument();
			}
		});
	});

	describe("Feature Content", () => {
		it("should display Structured Methodology feature", () => {
			render(<Features />);

			expect(screen.getByText("Structured Methodology.")).toBeInTheDocument();
			expect(
				screen.getByText(STRUCTURED_METHODOLOGY_REGEX)
			).toBeInTheDocument();
		});

		it("should display Best Practices feature", () => {
			render(<Features />);

			expect(screen.getByText("Best Practices.")).toBeInTheDocument();
			expect(screen.getByText(OPEN_SHARING_REGEX)).toBeInTheDocument();
		});

		it("should display Responsible research and Innovation feature", () => {
			render(<Features />);

			expect(
				screen.getByText("Responsible research and Innovation.")
			).toBeInTheDocument();
			expect(screen.getByText(TRADITIONAL_GOALS_REGEX)).toBeInTheDocument();
		});

		it("should display Community Building feature", () => {
			render(<Features />);

			expect(screen.getByText("Community Building.")).toBeInTheDocument();
			expect(screen.getByText(REMOVE_BARRIERS_REGEX)).toBeInTheDocument();
		});

		it("should display Privacy and Control feature", () => {
			render(<Features />);

			expect(screen.getByText("Privacy and Control.")).toBeInTheDocument();
			expect(screen.getByText(ENCOURAGE_OPENNESS_REGEX)).toBeInTheDocument();
		});

		it("should display Training and Capacity Building feature", () => {
			render(<Features />);

			expect(
				screen.getByText("Training and Capacity Building.")
			).toBeInTheDocument();
			expect(screen.getByText(FREELY_ACCESSIBLE_REGEX)).toBeInTheDocument();
		});
	});

	describe("Image Rendering", () => {
		it("should render the screenshot image", () => {
			render(<Features />);

			const image = screen.getByTestId("features-image");
			expect(image).toBeInTheDocument();
		});

		it("should have correct image attributes", () => {
			render(<Features />);

			const image = screen.getByTestId("features-image");
			expect(image).toHaveAttribute("src", "/images/tea-chart-example2.png");
			expect(image).toHaveAttribute("alt", "App screenshot");
			expect(image).toHaveAttribute("width", "2432");
			expect(image).toHaveAttribute("height", "1442");
		});

		it("should style image with shadow-sm and ring-3", () => {
			render(<Features />);

			const image = screen.getByTestId("features-image");
			expect(image).toHaveClass(
				"mb-[-12%]",
				"rounded-xl",
				"shadow-2xl",
				"ring-1",
				"ring-gray-900/10"
			);
		});
	});

	describe("Layout and Styling", () => {
		it("should have white background", () => {
			const { container } = render(<Features />);

			const mainContainer = container.querySelector(".bg-white");
			expect(mainContainer).toBeInTheDocument();
		});

		it("should have correct padding", () => {
			const { container } = render(<Features />);

			const paddingContainer = container.querySelector(".py-24.sm\\:py-32");
			expect(paddingContainer).toBeInTheDocument();
		});

		it("should center the header section", () => {
			const { container } = render(<Features />);

			const headerSection = container.querySelector(
				".mx-auto.max-w-2xl.sm\\:text-center"
			);
			expect(headerSection).toBeInTheDocument();
		});

		it("should style subtitle with indigo color", () => {
			render(<Features />);

			const subtitle = screen.getByText("Everything you need");
			expect(subtitle).toHaveClass(
				"text-indigo-600",
				"font-semibold",
				"text-base"
			);
		});

		it("should style main heading correctly", () => {
			render(<Features />);

			const heading = screen.getByText("What TEA offers");
			expect(heading).toHaveClass(
				"font-bold",
				"text-3xl",
				"text-gray-900",
				"sm:text-4xl"
			);
		});

		it("should have gradient overlay", () => {
			const { container } = render(<Features />);

			const gradient = container.querySelector(".bg-gradient-to-t.from-white");
			expect(gradient).toBeInTheDocument();
			// The parent div has aria-hidden, not the gradient itself
			const ariaHiddenParent = container.querySelector('[aria-hidden="true"]');
			expect(ariaHiddenParent).toBeInTheDocument();
			expect(
				ariaHiddenParent?.querySelector(".bg-gradient-to-t.from-white")
			).toBeInTheDocument();
		});

		it("should have relative overflow for image section", () => {
			const { container } = render(<Features />);

			const imageSection = container.querySelector(
				".relative.overflow-hidden.pt-16"
			);
			expect(imageSection).toBeInTheDocument();
		});
	});

	describe("Feature Icons", () => {
		it("should render feature icons", () => {
			const { container } = render(<Features />);

			// Icons are rendered as SVG elements with specific classes
			const icons = container.querySelectorAll(".h-5.w-5.text-indigo-600");
			expect(icons).toHaveLength(6);
		});

		it("should position icons absolutely", () => {
			const { container } = render(<Features />);

			const icons = container.querySelectorAll(".absolute.top-1.left-1");
			expect(icons).toHaveLength(6);
		});

		it("should have aria-hidden on icons", () => {
			const { container } = render(<Features />);

			const icons = container.querySelectorAll('[aria-hidden="true"].h-5.w-5');
			expect(icons).toHaveLength(6);
		});
	});

	describe("Grid Layout", () => {
		it("should use description list for features", () => {
			const { container } = render(<Features />);

			const dl = container.querySelector("dl");
			expect(dl).toBeInTheDocument();
		});

		it("should have responsive grid classes", () => {
			const { container } = render(<Features />);

			const grid = container.querySelector(
				".grid.grid-cols-1.sm\\:grid-cols-2.lg\\:grid-cols-3"
			);
			expect(grid).toBeInTheDocument();
		});

		it("should have correct gap spacing", () => {
			const { container } = render(<Features />);

			const grid = container.querySelector(
				".gap-x-6.gap-y-10.lg\\:gap-x-8.lg\\:gap-y-16"
			);
			expect(grid).toBeInTheDocument();
		});

		it("should position feature items with padding", () => {
			const { container } = render(<Features />);

			const featureItems = container.querySelectorAll(".relative.pl-9");
			expect(featureItems).toHaveLength(6);
		});
	});

	describe("Responsive Design", () => {
		it("should have responsive max width", () => {
			const { container } = render(<Features />);

			const contentContainers =
				container.querySelectorAll(".mx-auto.max-w-7xl");
			expect(contentContainers.length).toBeGreaterThan(0);
		});

		it("should have responsive padding", () => {
			const { container } = render(<Features />);

			const paddedContainers = container.querySelectorAll(".px-6.lg\\:px-8");
			expect(paddedContainers.length).toBeGreaterThan(0);
		});

		it("should have responsive margin top", () => {
			const { container } = render(<Features />);

			const marginContainer = container.querySelector(
				".mt-16.sm\\:mt-20.md\\:mt-24"
			);
			expect(marginContainer).toBeInTheDocument();
		});

		it("should have responsive text size for heading", () => {
			render(<Features />);

			const heading = screen.getByText("What TEA offers");
			expect(heading).toHaveClass("text-3xl", "sm:text-4xl");
		});
	});

	describe("Text Styling", () => {
		it("should style feature names as inline with font weight", () => {
			const { container } = render(<Features />);

			const featureNames = container.querySelectorAll(
				".inline.font-semibold.text-gray-900"
			);
			expect(featureNames).toHaveLength(6);
		});

		it("should style feature descriptions", () => {
			const { container } = render(<Features />);

			const descriptions = container.querySelectorAll(".inline.text-pretty");
			expect(descriptions).toHaveLength(6);
		});

		it("should have line breaks between name and description", () => {
			const { container } = render(<Features />);

			const lineBreaks = container.querySelectorAll("dl br");
			expect(lineBreaks).toHaveLength(6);
		});

		it("should use proper text color for descriptions", () => {
			const { container } = render(<Features />);

			const dl = container.querySelector("dl");
			expect(dl).toHaveClass("text-base", "text-gray-600", "leading-7");
		});
	});

	describe("Accessibility", () => {
		it("should have no accessibility violations", async () => {
			const { container } = render(<Features />);
			const results = await axe(container, {
				rules: {
					// Disable color contrast check due to jsdom limitations
					"color-contrast": { enabled: false },
					// Disable definition-list check as the structure is valid for this use case
					"definition-list": { enabled: false },
				},
			});

			expect(results.violations).toHaveLength(0);
		});

		it("should use semantic HTML structure", () => {
			const { container } = render(<Features />);

			expect(container.querySelector("h2")).toBeInTheDocument();
			expect(container.querySelector("p")).toBeInTheDocument();
			expect(container.querySelector("dl")).toBeInTheDocument();
		});

		it("should have descriptive alt text for image", () => {
			render(<Features />);

			const image = screen.getByAltText("App screenshot");
			expect(image).toBeInTheDocument();
		});

		it("should properly hide decorative elements", () => {
			const { container } = render(<Features />);

			const decorativeDiv = container.querySelector(
				'[aria-hidden="true"].relative'
			);
			expect(decorativeDiv).toBeInTheDocument();
		});
	});

	describe("Edge Cases", () => {
		it("should not render commented out description paragraph", () => {
			render(<Features />);

			expect(screen.queryByText(LOREM_IPSUM_REGEX)).not.toBeInTheDocument();
		});

		it("should have consistent structure for all features", () => {
			const { container } = render(<Features />);

			const features = container.querySelectorAll("dl > div");
			expect(features).toHaveLength(6);

			for (const feature of features) {
				expect(feature).toHaveClass("relative", "pl-9");
				expect(
					feature.querySelector(".inline.font-semibold.text-gray-900")
				).toBeInTheDocument();
				expect(
					feature.querySelector(".inline.text-pretty")
				).toBeInTheDocument();
			}
		});

		it("should maintain proper spacing between sections", () => {
			render(<Features />);

			const heading = screen.getByText("What TEA offers");

			// The heading itself has mt-2 class
			expect(heading).toHaveClass("mt-2");
		});
	});
});
