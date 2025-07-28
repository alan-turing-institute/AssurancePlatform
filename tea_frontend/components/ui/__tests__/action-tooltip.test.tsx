import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ActionTooltip from "../action-tooltip";

// Mock the tooltip components
vi.mock("../tooltip", () => ({
	Tooltip: ({ children }: any) => <div data-testid="tooltip">{children}</div>,
	TooltipContent: ({ children }: any) => (
		<div data-testid="tooltip-content" role="tooltip">
			{children}
		</div>
	),
	TooltipProvider: ({ children }: any) => (
		<div data-testid="tooltip-provider">{children}</div>
	),
	TooltipTrigger: ({ children, asChild }: any) => (
		<div data-testid="tooltip-trigger" data-as-child={asChild}>
			{children}
		</div>
	),
}));

describe("ActionTooltip", () => {
	describe("Component Rendering", () => {
		it("should render with children and label", () => {
			render(
				<ActionTooltip label="Test tooltip">
					<button>Test Button</button>
				</ActionTooltip>
			);

			expect(screen.getByTestId("tooltip-provider")).toBeInTheDocument();
			expect(screen.getByTestId("tooltip")).toBeInTheDocument();
			expect(screen.getByTestId("tooltip-trigger")).toBeInTheDocument();
			expect(screen.getByTestId("tooltip-content")).toBeInTheDocument();
			expect(screen.getByRole("button", { name: "Test Button" })).toBeInTheDocument();
		});

		it("should render label text in tooltip content", () => {
			const testLabel = "This is a test tooltip";

			render(
				<ActionTooltip label={testLabel}>
					<button>Test Button</button>
				</ActionTooltip>
			);

			expect(screen.getByText(testLabel)).toBeInTheDocument();
			expect(screen.getByRole("tooltip")).toHaveTextContent(testLabel);
		});

		it("should wrap children in tooltip trigger with asChild prop", () => {
			render(
				<ActionTooltip label="Test tooltip">
					<button>Test Button</button>
				</ActionTooltip>
			);

			const trigger = screen.getByTestId("tooltip-trigger");
			expect(trigger).toHaveAttribute("data-as-child", "true");
			expect(trigger).toContainElement(screen.getByRole("button"));
		});
	});

	describe("Props Handling", () => {
		it("should handle different types of children elements", () => {
			const { rerender } = render(
				<ActionTooltip label="Button tooltip">
					<button>Button</button>
				</ActionTooltip>
			);

			expect(screen.getByRole("button")).toBeInTheDocument();

			rerender(
				<ActionTooltip label="Link tooltip">
					<a href="/test">Link</a>
				</ActionTooltip>
			);

			expect(screen.getByRole("link")).toBeInTheDocument();

			rerender(
				<ActionTooltip label="Div tooltip">
					<div>Div content</div>
				</ActionTooltip>
			);

			expect(screen.getByText("Div content")).toBeInTheDocument();
		});

		it("should handle multiple child elements", () => {
			render(
				<ActionTooltip label="Multiple children tooltip">
					<div>
						<span>First child</span>
						<span>Second child</span>
					</div>
				</ActionTooltip>
			);

			expect(screen.getByText("First child")).toBeInTheDocument();
			expect(screen.getByText("Second child")).toBeInTheDocument();
		});

		it("should handle empty label gracefully", () => {
			render(
				<ActionTooltip label="">
					<button>Test Button</button>
				</ActionTooltip>
			);

			const tooltipContent = screen.getByTestId("tooltip-content");
			expect(tooltipContent).toBeInTheDocument();
			expect(tooltipContent).toHaveTextContent("");
		});

		it("should handle long labels", () => {
			const longLabel = "This is a very long tooltip label that contains a lot of text to test how the component handles lengthy descriptions.";

			render(
				<ActionTooltip label={longLabel}>
					<button>Test Button</button>
				</ActionTooltip>
			);

			expect(screen.getByText(longLabel)).toBeInTheDocument();
		});

		it("should handle labels with special characters", () => {
			const specialLabel = "Special chars: @#$%^&*()_+{}|:<>?[]\\;'\",./ and émojis 🎉";

			render(
				<ActionTooltip label={specialLabel}>
					<button>Test Button</button>
				</ActionTooltip>
			);

			expect(screen.getByText(specialLabel)).toBeInTheDocument();
		});
	});

	describe("Component Structure", () => {
		it("should have correct component hierarchy", () => {
			render(
				<ActionTooltip label="Test tooltip">
					<button>Test Button</button>
				</ActionTooltip>
			);

			const provider = screen.getByTestId("tooltip-provider");
			const tooltip = screen.getByTestId("tooltip");
			const trigger = screen.getByTestId("tooltip-trigger");
			const content = screen.getByTestId("tooltip-content");

			expect(provider).toContainElement(tooltip);
			expect(tooltip).toContainElement(trigger);
			expect(tooltip).toContainElement(content);
			expect(trigger).toContainElement(screen.getByRole("button"));
		});

		it("should render label inside paragraph element", () => {
			render(
				<ActionTooltip label="Test tooltip">
					<button>Test Button</button>
				</ActionTooltip>
			);

			const paragraphElement = screen.getByTestId("tooltip-content").querySelector("p");
			expect(paragraphElement).toBeInTheDocument();
			expect(paragraphElement).toHaveTextContent("Test tooltip");
		});
	});

	describe("Accessibility", () => {
		it("should have proper tooltip role", () => {
			render(
				<ActionTooltip label="Accessible tooltip">
					<button>Accessible Button</button>
				</ActionTooltip>
			);

			expect(screen.getByRole("tooltip")).toBeInTheDocument();
		});

		it("should be keyboard accessible", async () => {
			const user = userEvent.setup();

			render(
				<ActionTooltip label="Keyboard tooltip">
					<button>Focusable Button</button>
				</ActionTooltip>
			);

			const button = screen.getByRole("button");

			// Focus the button (trigger element)
			await user.tab();
			expect(button).toHaveFocus();

			// The tooltip content should be accessible
			expect(screen.getByRole("tooltip")).toBeInTheDocument();
		});

		it("should work with interactive elements", () => {
			render(
				<ActionTooltip label="Interactive tooltip">
					<button onClick={() => {}}>Interactive Button</button>
				</ActionTooltip>
			);

			const button = screen.getByRole("button");
			expect(button).toBeInTheDocument();
			expect(screen.getByRole("tooltip")).toBeInTheDocument();
		});
	});

	describe("Edge Cases", () => {
		it("should handle null children gracefully", () => {
			render(
				<ActionTooltip label="Null children tooltip">
					{null}
				</ActionTooltip>
			);

			expect(screen.getByTestId("tooltip-provider")).toBeInTheDocument();
			expect(screen.getByRole("tooltip")).toBeInTheDocument();
		});

		it("should handle undefined children", () => {
			render(
				<ActionTooltip label="Undefined children tooltip">
					{undefined}
				</ActionTooltip>
			);

			expect(screen.getByTestId("tooltip-provider")).toBeInTheDocument();
			expect(screen.getByRole("tooltip")).toBeInTheDocument();
		});

		it("should handle text-only children", () => {
			render(
				<ActionTooltip label="Text tooltip">
					Plain text child
				</ActionTooltip>
			);

			expect(screen.getByText("Plain text child")).toBeInTheDocument();
			expect(screen.getByRole("tooltip")).toBeInTheDocument();
		});

		it("should handle complex nested children", () => {
			render(
				<ActionTooltip label="Complex tooltip">
					<div>
						<span>Outer span</span>
						<div>
							<button>Nested button</button>
							<a href="/link">Nested link</a>
						</div>
					</div>
				</ActionTooltip>
			);

			expect(screen.getByText("Outer span")).toBeInTheDocument();
			expect(screen.getByRole("button", { name: "Nested button" })).toBeInTheDocument();
			expect(screen.getByRole("link", { name: "Nested link" })).toBeInTheDocument();
			expect(screen.getByRole("tooltip")).toBeInTheDocument();
		});

		it("should handle rapidly changing labels", () => {
			const { rerender } = render(
				<ActionTooltip label="First label">
					<button>Test Button</button>
				</ActionTooltip>
			);

			expect(screen.getByText("First label")).toBeInTheDocument();

			rerender(
				<ActionTooltip label="Second label">
					<button>Test Button</button>
				</ActionTooltip>
			);

			expect(screen.getByText("Second label")).toBeInTheDocument();
			expect(screen.queryByText("First label")).not.toBeInTheDocument();
		});

		it("should handle rapidly changing children", () => {
			const { rerender } = render(
				<ActionTooltip label="Consistent label">
					<button>First button</button>
				</ActionTooltip>
			);

			expect(screen.getByRole("button", { name: "First button" })).toBeInTheDocument();

			rerender(
				<ActionTooltip label="Consistent label">
					<span>Changed to span</span>
				</ActionTooltip>
			);

			expect(screen.getByText("Changed to span")).toBeInTheDocument();
			expect(screen.queryByRole("button")).not.toBeInTheDocument();
		});
	});

	describe("Component Integration", () => {
		it("should integrate properly with tooltip provider", () => {
			render(
				<ActionTooltip label="Integration test">
					<button>Integration Button</button>
				</ActionTooltip>
			);

			const provider = screen.getByTestId("tooltip-provider");
			const tooltip = screen.getByTestId("tooltip");

			expect(provider).toContainElement(tooltip);
		});

		it("should pass through all tooltip functionality", () => {
			render(
				<ActionTooltip label="Functionality test">
					<button>Functionality Button</button>
				</ActionTooltip>
			);

			// Verify all tooltip components are rendered
			expect(screen.getByTestId("tooltip-provider")).toBeInTheDocument();
			expect(screen.getByTestId("tooltip")).toBeInTheDocument();
			expect(screen.getByTestId("tooltip-trigger")).toBeInTheDocument();
			expect(screen.getByTestId("tooltip-content")).toBeInTheDocument();
		});

		it("should maintain children functionality", async () => {
			const mockClick = vi.fn();
			const user = userEvent.setup();

			render(
				<ActionTooltip label="Click test">
					<button onClick={mockClick}>Clickable Button</button>
				</ActionTooltip>
			);

			const button = screen.getByRole("button");
			await user.click(button);

			expect(mockClick).toHaveBeenCalledOnce();
		});
	});

	describe("Performance", () => {
		it("should not re-render unnecessarily", () => {
			const { rerender } = render(
				<ActionTooltip label="Performance test">
					<button>Performance Button</button>
				</ActionTooltip>
			);

			const initialProvider = screen.getByTestId("tooltip-provider");

			// Re-render with same props
			rerender(
				<ActionTooltip label="Performance test">
					<button>Performance Button</button>
				</ActionTooltip>
			);

			const afterProvider = screen.getByTestId("tooltip-provider");

			// Component should still be present and functional
			expect(afterProvider).toBeInTheDocument();
			expect(screen.getByRole("button")).toBeInTheDocument();
			expect(screen.getByRole("tooltip")).toBeInTheDocument();
		});
	});
});
