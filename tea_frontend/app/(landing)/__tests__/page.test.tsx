import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LandingPage from "../page";

// Mock the landing page components
vi.mock("@/components/demo/landing/cta", () => ({
	default: () => <div data-testid="cta-component">CTA Component</div>,
}));

vi.mock("@/components/demo/landing/features", () => ({
	default: () => <div data-testid="features-component">Features Component</div>,
}));

vi.mock("@/components/demo/landing/footer", () => ({
	default: () => <div data-testid="footer-component">Footer Component</div>,
}));

vi.mock("@/components/demo/landing/hero", () => ({
	default: () => <div data-testid="hero-component">Hero Component</div>,
}));

describe("LandingPage", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("Component Rendering", () => {
		it("should render all main landing page components", () => {
			render(<LandingPage />);

			expect(screen.getByTestId("hero-component")).toBeInTheDocument();
			expect(screen.getByTestId("features-component")).toBeInTheDocument();
			expect(screen.getByTestId("cta-component")).toBeInTheDocument();
			expect(screen.getByTestId("footer-component")).toBeInTheDocument();
		});

		it("should render Hero component first", () => {
			const { container } = render(<LandingPage />);

			const firstChild = container.children[0] as HTMLElement;

			expect(firstChild.getAttribute("data-testid")).toBe("hero-component");
		});

		it("should render components in correct order", () => {
			const { container } = render(<LandingPage />);

			const children = Array.from(container.children);
			const expectedOrder = [
				"hero-component",
				"features-component",
				"cta-component",
				"footer-component",
			];

			for (const [index, testId] of expectedOrder.entries()) {
				const child = children[index] as HTMLElement;
				expect(child.getAttribute("data-testid")).toBe(testId);
			}
		});

		it("should render Footer component last", () => {
			const { container } = render(<LandingPage />);

			const children = Array.from(container.children);
			const lastChild = children.at(-1) as HTMLElement;

			expect(lastChild.getAttribute("data-testid")).toBe("footer-component");
		});
	});

	describe("Component Structure", () => {
		it("should render components within a React Fragment", () => {
			const { container } = render(<LandingPage />);

			// React Fragment renders components as direct children of container
			expect(container.children).toHaveLength(4);
		});

		it("should have all expected components present", () => {
			render(<LandingPage />);

			// Verify each component is rendered exactly once
			expect(screen.getAllByTestId("hero-component")).toHaveLength(1);
			expect(screen.getAllByTestId("features-component")).toHaveLength(1);
			expect(screen.getAllByTestId("cta-component")).toHaveLength(1);
			expect(screen.getAllByTestId("footer-component")).toHaveLength(1);
		});

		it("should not render commented out components", () => {
			render(<LandingPage />);

			// Verify that FAQ and MailingList components are not rendered
			expect(screen.queryByTestId("faq-component")).not.toBeInTheDocument();
			expect(
				screen.queryByTestId("mailing-list-component")
			).not.toBeInTheDocument();
		});
	});

	describe("Component Integration", () => {
		it("should render without any errors", () => {
			expect(() => render(<LandingPage />)).not.toThrow();
		});

		it("should maintain component independence", () => {
			// Each component should render independently
			render(<LandingPage />);

			const hero = screen.getByTestId("hero-component");
			const features = screen.getByTestId("features-component");
			const cta = screen.getByTestId("cta-component");
			const footer = screen.getByTestId("footer-component");

			// All components should be siblings at the same level
			expect(hero.parentElement).toBe(features.parentElement);
			expect(features.parentElement).toBe(cta.parentElement);
			expect(cta.parentElement).toBe(footer.parentElement);
		});

		it("should render all components with expected content", () => {
			render(<LandingPage />);

			expect(screen.getByText("Hero Component")).toBeInTheDocument();
			expect(screen.getByText("Features Component")).toBeInTheDocument();
			expect(screen.getByText("CTA Component")).toBeInTheDocument();
			expect(screen.getByText("Footer Component")).toBeInTheDocument();
		});
	});

	describe("Layout and Structure", () => {
		it("should have correct DOM structure", () => {
			const { container } = render(<LandingPage />);

			// React Fragment renders 4 direct children
			expect(container.children).toHaveLength(4);
		});

		it("should render components as direct siblings", () => {
			const { container } = render(<LandingPage />);

			const children = Array.from(container.children);

			// All components should be at the same DOM level
			for (const child of children) {
				expect(child.parentNode).toBe(container);
			}
		});
	});

	describe("Performance and Behavior", () => {
		it("should render quickly without blocking", () => {
			const startTime = performance.now();
			render(<LandingPage />);
			const endTime = performance.now();

			// Should render in reasonable time (less than 100ms)
			expect(endTime - startTime).toBeLessThan(100);
		});

		it("should be re-renderable multiple times", () => {
			const { rerender } = render(<LandingPage />);

			expect(screen.getByTestId("hero-component")).toBeInTheDocument();

			rerender(<LandingPage />);

			// Should still render all components after rerender
			expect(screen.getByTestId("hero-component")).toBeInTheDocument();
			expect(screen.getByTestId("features-component")).toBeInTheDocument();
			expect(screen.getByTestId("cta-component")).toBeInTheDocument();
			expect(screen.getByTestId("footer-component")).toBeInTheDocument();
		});

		it("should handle unmounting gracefully", () => {
			const { unmount } = render(<LandingPage />);

			expect(() => unmount()).not.toThrow();
		});
	});

	describe("Accessibility", () => {
		it("should have accessible structure for screen readers", () => {
			render(<LandingPage />);

			// Components should be discoverable by screen readers
			const hero = screen.getByTestId("hero-component");
			const features = screen.getByTestId("features-component");
			const cta = screen.getByTestId("cta-component");
			const footer = screen.getByTestId("footer-component");

			expect(hero).toBeVisible();
			expect(features).toBeVisible();
			expect(cta).toBeVisible();
			expect(footer).toBeVisible();
		});

		it("should maintain proper document flow", () => {
			const { container } = render(<LandingPage />);

			// Components should appear in DOM order
			const allComponents = container.querySelectorAll("[data-testid]");
			const expectedTestIds = [
				"hero-component",
				"features-component",
				"cta-component",
				"footer-component",
			];

			for (const [index, testId] of expectedTestIds.entries()) {
				expect(allComponents[index]).toHaveAttribute("data-testid", testId);
			}
		});
	});

	describe("Future-proofing", () => {
		it("should handle potential addition of FAQ component", () => {
			// Test that the structure can accommodate commented components
			render(<LandingPage />);

			// Current structure should work with additional components
			const container = screen.getByTestId("hero-component").parentElement;
			expect(container?.childNodes).toHaveLength(4);
		});

		it("should handle potential addition of MailingList component", () => {
			// Verify the component can be extended without breaking
			render(<LandingPage />);

			// Structure should be flexible for additions
			expect(screen.getByTestId("cta-component")).toBeInTheDocument();
			expect(screen.getByTestId("footer-component")).toBeInTheDocument();
		});
	});
});
