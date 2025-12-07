import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import Footer from "../footer";

// Move regex to top level for performance
const COPYRIGHT_FULL_REGEX = /© 2024 Your Company, Inc. All rights reserved./;
const COPYRIGHT_PARTIAL_REGEX = /© 2024 Your Company, Inc./;
const COPYRIGHT_SYMBOL_REGEX = /©/;

describe("Footer", () => {
	describe("Component Rendering", () => {
		it("should render the footer component", () => {
			render(<Footer />);

			expect(screen.getByRole("contentinfo")).toBeInTheDocument();
		});

		it("should render all main navigation links", () => {
			render(<Footer />);

			expect(
				screen.getByRole("link", { name: "Platform" })
			).toBeInTheDocument();
			expect(
				screen.getByRole("link", { name: "Discover" })
			).toBeInTheDocument();
			expect(
				screen.getByRole("link", { name: "Documentation" })
			).toBeInTheDocument();
			expect(
				screen.getByRole("link", { name: "Cookie Policy" })
			).toBeInTheDocument();
		});

		it("should render social media links", () => {
			render(<Footer />);

			expect(screen.getByRole("link", { name: "X" })).toBeInTheDocument();
			expect(screen.getByRole("link", { name: "GitHub" })).toBeInTheDocument();
		});

		it("should render copyright text", () => {
			render(<Footer />);

			expect(screen.getByText(COPYRIGHT_FULL_REGEX)).toBeInTheDocument();
		});
	});

	describe("Navigation Links", () => {
		it("should link to correct internal pages", () => {
			render(<Footer />);

			expect(screen.getByRole("link", { name: "Platform" })).toHaveAttribute(
				"href",
				"/dashboard"
			);
			expect(screen.getByRole("link", { name: "Discover" })).toHaveAttribute(
				"href",
				"/discover"
			);
			expect(
				screen.getByRole("link", { name: "Documentation" })
			).toHaveAttribute("href", "/documentation");
			expect(
				screen.getByRole("link", { name: "Cookie Policy" })
			).toHaveAttribute("href", "/cookie-policy");
		});

		it("should style navigation links correctly", () => {
			render(<Footer />);

			const platformLink = screen.getByRole("link", { name: "Platform" });
			expect(platformLink).toHaveClass("text-gray-600", "hover:text-gray-900");
		});

		it("should have proper navigation aria-label", () => {
			render(<Footer />);

			const nav = screen.getByRole("navigation", { name: "Footer" });
			expect(nav).toBeInTheDocument();
		});
	});

	describe("Social Media Links", () => {
		it("should link to correct external URLs", () => {
			render(<Footer />);

			expect(screen.getByRole("link", { name: "X" })).toHaveAttribute(
				"href",
				"https://x.com/turinginst"
			);
			expect(screen.getByRole("link", { name: "GitHub" })).toHaveAttribute(
				"href",
				"https://github.com/alan-turing-institute/AssurancePlatform"
			);
		});

		it("should style social links correctly", () => {
			render(<Footer />);

			const xLink = screen.getByRole("link", { name: "X" });
			expect(xLink).toHaveClass("text-gray-600", "hover:text-gray-800");
		});

		it("should have screen reader text for social links", () => {
			render(<Footer />);

			const xLink = screen.getByRole("link", { name: "X" });
			const srText = xLink.querySelector(".sr-only");
			expect(srText).toBeInTheDocument();
			expect(srText).toHaveTextContent("X");
		});
	});

	describe("Icons", () => {
		it("should render social media icons", () => {
			const { container } = render(<Footer />);

			const svgs = container.querySelectorAll("svg");
			expect(svgs).toHaveLength(2);
		});

		it("should have correct icon size", () => {
			const { container } = render(<Footer />);

			const icons = container.querySelectorAll(".size-6");
			expect(icons).toHaveLength(2);
		});

		it("should have aria-hidden on icons", () => {
			const { container } = render(<Footer />);

			const icons = container.querySelectorAll('svg[aria-hidden="true"]');
			expect(icons).toHaveLength(2);
		});

		it("should have title elements for icons", () => {
			const { container } = render(<Footer />);

			const xTitle = container.querySelector("svg title");
			expect(xTitle).toHaveTextContent("X (formerly Twitter)");

			const githubTitle = container.querySelectorAll("svg title")[1];
			expect(githubTitle).toHaveTextContent("GitHub");
		});
	});

	describe("Layout and Styling", () => {
		it("should have white background", () => {
			const { container } = render(<Footer />);

			const footer = container.querySelector("footer");
			expect(footer).toHaveClass("bg-white");
		});

		it("should have correct container constraints", () => {
			const { container } = render(<Footer />);

			const contentContainer = container.querySelector(".mx-auto.max-w-7xl");
			expect(contentContainer).toBeInTheDocument();
		});

		it("should have proper padding", () => {
			const { container } = render(<Footer />);

			const paddedContainer = container.querySelector(".px-6.py-20.sm\\:py-24");
			expect(paddedContainer).toBeInTheDocument();
		});

		it("should center navigation links", () => {
			render(<Footer />);

			const nav = screen.getByRole("navigation");
			expect(nav).toHaveClass("justify-center");
		});

		it("should have flex layout for navigation", () => {
			render(<Footer />);

			const nav = screen.getByRole("navigation");
			expect(nav).toHaveClass("flex", "flex-wrap");
		});

		it("should have correct gap spacing for navigation", () => {
			render(<Footer />);

			const nav = screen.getByRole("navigation");
			expect(nav).toHaveClass("gap-x-12", "gap-y-3");
		});

		it("should center social links", () => {
			const { container } = render(<Footer />);

			const socialContainer = container.querySelector(
				".flex.justify-center.gap-x-10"
			);
			expect(socialContainer).toBeInTheDocument();
		});

		it("should have correct spacing between sections", () => {
			const { container } = render(<Footer />);

			const socialContainer = container.querySelector(".mt-16");
			expect(socialContainer).toBeInTheDocument();

			const copyrightText = container.querySelector(".mt-10");
			expect(copyrightText).toBeInTheDocument();
		});
	});

	describe("Typography", () => {
		it("should style navigation links with correct text size", () => {
			render(<Footer />);

			const nav = screen.getByRole("navigation");
			expect(nav).toHaveClass("text-sm/6");
		});

		it("should style copyright text correctly", () => {
			render(<Footer />);

			const copyright = screen.getByText(COPYRIGHT_PARTIAL_REGEX);
			expect(copyright).toHaveClass(
				"text-center",
				"text-gray-600",
				"text-sm/6"
			);
		});

		it("should center copyright text", () => {
			render(<Footer />);

			const copyright = screen.getByText(COPYRIGHT_PARTIAL_REGEX);
			expect(copyright).toHaveClass("text-center");
		});
	});

	describe("Responsive Design", () => {
		it("should have responsive padding", () => {
			const { container } = render(<Footer />);

			const paddedContainer = container.querySelector(".py-20.sm\\:py-24");
			expect(paddedContainer).toBeInTheDocument();
		});

		it("should have responsive padding for large screens", () => {
			const { container } = render(<Footer />);

			const paddedContainer = container.querySelector(".px-6.lg\\:px-6");
			expect(paddedContainer).toBeInTheDocument();
		});

		it("should handle overflow", () => {
			const { container } = render(<Footer />);

			const overflowContainer = container.querySelector(".overflow-hidden");
			expect(overflowContainer).toBeInTheDocument();
		});
	});

	describe("Accessibility", () => {
		it("should have no accessibility violations", async () => {
			const { container } = render(<Footer />);
			const results = await axe(container, {
				rules: {
					// Disable color contrast check due to jsdom limitations
					"color-contrast": { enabled: false },
				},
			});

			expect(results.violations).toHaveLength(0);
		});

		it("should have proper semantic structure", () => {
			const { container } = render(<Footer />);

			expect(container.querySelector("footer")).toBeInTheDocument();
			expect(container.querySelector("nav")).toBeInTheDocument();
		});

		it("should have accessible link names", () => {
			render(<Footer />);

			// All links should have accessible names
			const links = screen.getAllByRole("link");
			for (const link of links) {
				expect(link).toHaveAccessibleName();
			}
		});

		it("should use contentinfo landmark", () => {
			render(<Footer />);

			const footer = screen.getByRole("contentinfo");
			expect(footer).toBeInTheDocument();
		});
	});

	describe("Edge Cases", () => {
		it("should render exactly 6 links total", () => {
			render(<Footer />);

			const links = screen.getAllByRole("link");
			expect(links).toHaveLength(6); // 4 main nav + 2 social
		});

		it("should have negative margin for layout adjustment", () => {
			render(<Footer />);

			const nav = screen.getByRole("navigation");
			expect(nav).toHaveClass("-mb-6");
		});

		it("should render copyright symbol correctly", () => {
			render(<Footer />);

			const copyright = screen.getByText(COPYRIGHT_SYMBOL_REGEX);
			expect(copyright).toBeInTheDocument();
		});

		it("should have consistent hover states", () => {
			render(<Footer />);

			// Main nav links
			const mainLinks = screen.getByRole("link", { name: "Platform" });
			expect(mainLinks).toHaveClass("hover:text-gray-900");

			// Social links
			const socialLinks = screen.getByRole("link", { name: "X" });
			expect(socialLinks).toHaveClass("hover:text-gray-800");
		});
	});
});
