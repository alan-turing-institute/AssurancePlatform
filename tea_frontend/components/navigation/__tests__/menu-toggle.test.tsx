import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/src/__tests__/utils/test-utils";
import { MenuToggleButton } from "../menu-toggle";

// Mock the Heroicons component
vi.mock("@heroicons/react/24/outline", () => ({
	Bars3Icon: ({
		className,
		"aria-hidden": ariaHidden,
	}: {
		className: string;
		"aria-hidden": boolean;
	}) => (
		<div
			aria-hidden={ariaHidden}
			className={className}
			data-testid="bars3-icon"
		>
			Bars3Icon
		</div>
	),
}));

describe("MenuToggleButton", () => {
	const mockSetSidebarOpen = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("Component Rendering", () => {
		it("should render the toggle button", () => {
			render(<MenuToggleButton setSidebarOpen={mockSetSidebarOpen} />);

			const button = screen.getByRole("button");
			expect(button).toBeInTheDocument();
		});

		it("should have proper button attributes", () => {
			render(<MenuToggleButton setSidebarOpen={mockSetSidebarOpen} />);

			const button = screen.getByRole("button");
			expect(button).toHaveAttribute("type", "button");
		});

		it("should render the Bars3Icon", () => {
			render(<MenuToggleButton setSidebarOpen={mockSetSidebarOpen} />);

			const icon = screen.getByTestId("bars3-icon");
			expect(icon).toBeInTheDocument();
			expect(icon).toHaveTextContent("Bars3Icon");
		});

		it("should have proper CSS classes", () => {
			render(<MenuToggleButton setSidebarOpen={mockSetSidebarOpen} />);

			const button = screen.getByRole("button");
			expect(button).toHaveClass(
				"-m-2.5",
				"p-2.5",
				"text-foreground",
				"lg:hidden"
			);
		});
	});

	describe("Icon Styling", () => {
		it("should apply correct icon classes", () => {
			render(<MenuToggleButton setSidebarOpen={mockSetSidebarOpen} />);

			const icon = screen.getByTestId("bars3-icon");
			expect(icon).toHaveClass("h-6", "w-6");
		});

		it("should have proper aria-hidden attribute on icon", () => {
			render(<MenuToggleButton setSidebarOpen={mockSetSidebarOpen} />);

			const icon = screen.getByTestId("bars3-icon");
			expect(icon).toHaveAttribute("aria-hidden", "true");
		});
	});

	describe("Accessibility", () => {
		it("should have screen reader text", () => {
			render(<MenuToggleButton setSidebarOpen={mockSetSidebarOpen} />);

			const srText = screen.getByText("Open sidebar");
			expect(srText).toBeInTheDocument();
			expect(srText).toHaveClass("sr-only");
		});

		it("should be keyboard accessible", async () => {
			const user = userEvent.setup();
			render(<MenuToggleButton setSidebarOpen={mockSetSidebarOpen} />);

			const button = screen.getByRole("button");
			await user.tab();

			expect(button).toHaveFocus();
		});

		it("should be activatable with Enter key", async () => {
			const user = userEvent.setup();
			render(<MenuToggleButton setSidebarOpen={mockSetSidebarOpen} />);

			const button = screen.getByRole("button");
			button.focus();
			await user.keyboard("{Enter}");

			expect(mockSetSidebarOpen).toHaveBeenCalledWith(true);
		});

		it("should be activatable with Space key", async () => {
			const user = userEvent.setup();
			render(<MenuToggleButton setSidebarOpen={mockSetSidebarOpen} />);

			const button = screen.getByRole("button");
			button.focus();
			await user.keyboard(" ");

			expect(mockSetSidebarOpen).toHaveBeenCalledWith(true);
		});
	});

	describe("Click Functionality", () => {
		it("should call setSidebarOpen with true when clicked", async () => {
			const user = userEvent.setup();
			render(<MenuToggleButton setSidebarOpen={mockSetSidebarOpen} />);

			const button = screen.getByRole("button");
			await user.click(button);

			expect(mockSetSidebarOpen).toHaveBeenCalledTimes(1);
			expect(mockSetSidebarOpen).toHaveBeenCalledWith(true);
		});

		it("should handle multiple clicks", async () => {
			const user = userEvent.setup();
			render(<MenuToggleButton setSidebarOpen={mockSetSidebarOpen} />);

			const button = screen.getByRole("button");
			await user.click(button);
			await user.click(button);
			await user.click(button);

			expect(mockSetSidebarOpen).toHaveBeenCalledTimes(3);
			expect(mockSetSidebarOpen).toHaveBeenNthCalledWith(1, true);
			expect(mockSetSidebarOpen).toHaveBeenNthCalledWith(2, true);
			expect(mockSetSidebarOpen).toHaveBeenNthCalledWith(3, true);
		});

		it("should not prevent event propagation by default", async () => {
			const user = userEvent.setup();
			const parentClickHandler = vi.fn();

			render(
				<div onClick={parentClickHandler} role="none">
					<MenuToggleButton setSidebarOpen={mockSetSidebarOpen} />
				</div>
			);

			const button = screen.getByRole("button");
			await user.click(button);

			expect(mockSetSidebarOpen).toHaveBeenCalledWith(true);
			expect(parentClickHandler).toHaveBeenCalledTimes(1);
		});
	});

	describe("Responsive Design", () => {
		it("should be hidden on large screens", () => {
			render(<MenuToggleButton setSidebarOpen={mockSetSidebarOpen} />);

			const button = screen.getByRole("button");
			expect(button).toHaveClass("lg:hidden");
		});

		it("should have proper mobile styling", () => {
			render(<MenuToggleButton setSidebarOpen={mockSetSidebarOpen} />);

			const button = screen.getByRole("button");
			expect(button).toHaveClass("-m-2.5", "p-2.5");
		});
	});

	describe("Props Interface", () => {
		it("should accept setSidebarOpen prop as function", () => {
			const customHandler = vi.fn();

			expect(() => {
				render(<MenuToggleButton setSidebarOpen={customHandler} />);
			}).not.toThrow();
		});

		it("should work with different setSidebarOpen implementations", async () => {
			const user = userEvent.setup();
			let sidebarState = false;
			const customHandler = vi.fn(
				(value: boolean | ((prev: boolean) => boolean)) => {
					sidebarState =
						typeof value === "function" ? value(sidebarState) : value;
				}
			);

			render(<MenuToggleButton setSidebarOpen={customHandler} />);

			const button = screen.getByRole("button");
			await user.click(button);

			expect(sidebarState).toBe(true);
		});
	});

	describe("Component Integration", () => {
		it("should work as a controlled component", async () => {
			const user = userEvent.setup();
			let isOpen = false;
			const toggleSidebar = vi.fn(
				(value: boolean | ((prev: boolean) => boolean)) => {
					isOpen = typeof value === "function" ? value(isOpen) : value;
				}
			);

			render(<MenuToggleButton setSidebarOpen={toggleSidebar} />);

			expect(isOpen).toBe(false);

			const button = screen.getByRole("button");
			await user.click(button);

			expect(isOpen).toBe(true);
		});

		it("should maintain consistent behavior across re-renders", async () => {
			const user = userEvent.setup();
			const { rerender } = render(
				<MenuToggleButton setSidebarOpen={mockSetSidebarOpen} />
			);

			const button = screen.getByRole("button");
			await user.click(button);

			expect(mockSetSidebarOpen).toHaveBeenCalledWith(true);

			// Re-render with same props
			rerender(<MenuToggleButton setSidebarOpen={mockSetSidebarOpen} />);

			await user.click(button);

			expect(mockSetSidebarOpen).toHaveBeenCalledTimes(2);
			expect(mockSetSidebarOpen).toHaveBeenNthCalledWith(2, true);
		});
	});

	describe("Performance", () => {
		it("should not cause unnecessary re-renders", () => {
			const renderCount = vi.fn();

			const TestComponent = ({
				setSidebarOpen,
			}: {
				setSidebarOpen: (value: boolean | ((prev: boolean) => boolean)) => void;
			}) => {
				renderCount();
				return <MenuToggleButton setSidebarOpen={setSidebarOpen} />;
			};

			const { rerender } = render(
				<TestComponent setSidebarOpen={mockSetSidebarOpen} />
			);

			expect(renderCount).toHaveBeenCalledTimes(1);

			// Re-render with same function reference
			rerender(<TestComponent setSidebarOpen={mockSetSidebarOpen} />);

			expect(renderCount).toHaveBeenCalledTimes(2);
		});
	});
});
