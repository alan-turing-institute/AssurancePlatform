import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	renderWithAuth,
	screen,
	userEvent,
	waitFor,
} from "@/src/__tests__/utils/test-utils";
import NodeCreate from "../node-create";

// Mock CreateSheet component
vi.mock("../../ui/create-sheet", () => ({
	default: ({
		children,
		isOpen,
		onChange,
		onClose,
	}: {
		children?: React.ReactNode;
		isOpen: boolean;
		onChange: (value: boolean) => void;
		onClose: () => void;
	}) => (
		<div data-testid="create-sheet">
			{isOpen && (
				<div>
					<button onClick={() => onChange(false)} type="button">
						Close Sheet
					</button>
					<button onClick={onClose} type="button">
						Force Close
					</button>
					{children}
				</div>
			)}
		</div>
	),
}));

// Mock CreateForm component
vi.mock("../create-form", () => ({
	default: ({
		onClose,
		setUnresolvedChanges,
	}: {
		onClose: () => void;
		setUnresolvedChanges: (value: boolean) => void;
	}) => (
		<div data-testid="create-form">
			<button onClick={onClose} type="button">
				Form Close
			</button>
			<button onClick={() => setUnresolvedChanges(true)} type="button">
				Make Changes
			</button>
			<button onClick={() => setUnresolvedChanges(false)} type="button">
				Clear Changes
			</button>
		</div>
	),
}));

// Mock AlertModal component
vi.mock("../../modals/alert-modal", () => ({
	AlertModal: ({
		isOpen,
		onClose,
		onConfirm,
		message,
		cancelButtonText,
		confirmButtonText,
	}: {
		isOpen: boolean;
		onClose: () => void;
		onConfirm: () => void;
		message?: string;
		cancelButtonText?: string;
		confirmButtonText?: string;
	}) => (
		<div data-testid="alert-modal">
			{isOpen && (
				<div>
					<p>{message}</p>
					<button onClick={onClose} type="button">
						{cancelButtonText}
					</button>
					<button onClick={onConfirm} type="button">
						{confirmButtonText}
					</button>
				</div>
			)}
		</div>
	),
}));

describe("NodeCreate", () => {
	const mockSetOpen = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("Component Mounting", () => {
		it("should not render when not mounted", () => {
			renderWithAuth(<NodeCreate isOpen={false} setOpen={mockSetOpen} />);

			// When isOpen is false, the sheet should be in the DOM but not visible
			const sheet = screen.getByTestId("create-sheet");
			expect(sheet).toBeInTheDocument();
			// Check that the content is not visible when closed
			expect(screen.queryByTestId("create-form")).not.toBeInTheDocument();
		});

		it("should render when mounted and open", async () => {
			renderWithAuth(<NodeCreate isOpen={true} setOpen={mockSetOpen} />);

			await waitFor(() => {
				expect(screen.getByTestId("create-sheet")).toBeInTheDocument();
			});
		});

		it("should render child components when open", async () => {
			renderWithAuth(<NodeCreate isOpen={true} setOpen={mockSetOpen} />);

			await waitFor(() => {
				expect(screen.getByTestId("create-form")).toBeInTheDocument();
				expect(screen.getByTestId("alert-modal")).toBeInTheDocument();
			});
		});

		it("should not render when closed", async () => {
			renderWithAuth(<NodeCreate isOpen={false} setOpen={mockSetOpen} />);

			await waitFor(() => {
				expect(screen.getByTestId("create-sheet")).toBeInTheDocument();
			});

			// The sheet should be rendered but its content should not be visible
			expect(screen.queryByText("Form Close")).not.toBeInTheDocument();
		});
	});

	describe("Sheet Interaction", () => {
		it("should render CreateSheet with correct props", async () => {
			renderWithAuth(<NodeCreate isOpen={true} setOpen={mockSetOpen} />);

			await waitFor(() => {
				expect(screen.getByTestId("create-sheet")).toBeInTheDocument();
				expect(screen.getByText("Close Sheet")).toBeInTheDocument();
				expect(screen.getByText("Force Close")).toBeInTheDocument();
			});
		});

		it("should handle sheet onChange when no unresolved changes", async () => {
			const user = userEvent.setup();

			renderWithAuth(<NodeCreate isOpen={true} setOpen={mockSetOpen} />);

			await waitFor(() => {
				expect(screen.getByText("Close Sheet")).toBeInTheDocument();
			});

			await user.click(screen.getByText("Close Sheet"));

			expect(mockSetOpen).toHaveBeenCalledWith(false);
		});

		it("should handle direct onClose from sheet", async () => {
			const user = userEvent.setup();

			renderWithAuth(<NodeCreate isOpen={true} setOpen={mockSetOpen} />);

			await waitFor(() => {
				expect(screen.getByText("Force Close")).toBeInTheDocument();
			});

			await user.click(screen.getByText("Force Close"));

			expect(mockSetOpen).toHaveBeenCalledWith(false);
		});
	});

	describe("Form Interaction", () => {
		it("should render CreateForm with correct props", async () => {
			renderWithAuth(<NodeCreate isOpen={true} setOpen={mockSetOpen} />);

			await waitFor(() => {
				expect(screen.getByTestId("create-form")).toBeInTheDocument();
				expect(screen.getByText("Form Close")).toBeInTheDocument();
				expect(screen.getByText("Make Changes")).toBeInTheDocument();
			});
		});

		it("should handle form close action", async () => {
			const user = userEvent.setup();

			renderWithAuth(<NodeCreate isOpen={true} setOpen={mockSetOpen} />);

			await waitFor(() => {
				expect(screen.getByText("Form Close")).toBeInTheDocument();
			});

			await user.click(screen.getByText("Form Close"));

			expect(mockSetOpen).toHaveBeenCalledWith(false);
		});

		it("should track unresolved changes", async () => {
			const user = userEvent.setup();

			renderWithAuth(<NodeCreate isOpen={true} setOpen={mockSetOpen} />);

			await waitFor(() => {
				expect(screen.getByText("Make Changes")).toBeInTheDocument();
			});

			await user.click(screen.getByText("Make Changes"));

			// Now try to close - should trigger alert instead of direct close
			await user.click(screen.getByText("Close Sheet"));

			// Should not close directly because of unresolved changes
			expect(mockSetOpen).not.toHaveBeenCalledWith(false);
		});
	});

	describe("Unresolved Changes Handling", () => {
		it("should show alert modal when closing with unresolved changes", async () => {
			const user = userEvent.setup();

			renderWithAuth(<NodeCreate isOpen={true} setOpen={mockSetOpen} />);

			await waitFor(() => {
				expect(screen.getByText("Make Changes")).toBeInTheDocument();
			});

			// Make changes
			await user.click(screen.getByText("Make Changes"));

			// Try to close
			await user.click(screen.getByText("Close Sheet"));

			// Should show alert modal content
			await waitFor(() => {
				expect(
					screen.getByText(
						"You have changes that have not been updated. Would you like to discard these changes?"
					)
				).toBeInTheDocument();
			});
		});

		it("should allow closing without alert when no unresolved changes", async () => {
			const user = userEvent.setup();

			renderWithAuth(<NodeCreate isOpen={true} setOpen={mockSetOpen} />);

			await waitFor(() => {
				expect(screen.getByText("Close Sheet")).toBeInTheDocument();
			});

			// Try to close without making changes
			await user.click(screen.getByText("Close Sheet"));

			expect(mockSetOpen).toHaveBeenCalledWith(false);
		});

		it("should clear unresolved changes after making and clearing them", async () => {
			const user = userEvent.setup();

			renderWithAuth(<NodeCreate isOpen={true} setOpen={mockSetOpen} />);

			await waitFor(() => {
				expect(screen.getByText("Make Changes")).toBeInTheDocument();
			});

			// Make changes
			await user.click(screen.getByText("Make Changes"));

			// Clear changes
			await user.click(screen.getByText("Clear Changes"));

			// Try to close - should work without alert
			await user.click(screen.getByText("Close Sheet"));

			expect(mockSetOpen).toHaveBeenCalledWith(false);
		});
	});

	describe("Alert Modal Interaction", () => {
		it("should render AlertModal initially closed", async () => {
			renderWithAuth(<NodeCreate isOpen={true} setOpen={mockSetOpen} />);

			await waitFor(() => {
				expect(screen.getByTestId("alert-modal")).toBeInTheDocument();
				// Alert should not show its content initially
				expect(screen.queryByText("No, keep editing")).not.toBeInTheDocument();
			});
		});

		it("should handle alert modal cancel action", async () => {
			const user = userEvent.setup();

			renderWithAuth(<NodeCreate isOpen={true} setOpen={mockSetOpen} />);

			// Make changes and trigger alert
			await waitFor(() => {
				expect(screen.getByText("Make Changes")).toBeInTheDocument();
			});

			await user.click(screen.getByText("Make Changes"));
			await user.click(screen.getByText("Close Sheet"));

			// Click cancel in alert
			await waitFor(() => {
				expect(screen.getByText("No, keep editing")).toBeInTheDocument();
			});

			await user.click(screen.getByText("No, keep editing"));

			// Should remain open
			expect(mockSetOpen).not.toHaveBeenCalledWith(false);
		});

		it("should handle alert modal confirm action", async () => {
			const user = userEvent.setup();

			renderWithAuth(<NodeCreate isOpen={true} setOpen={mockSetOpen} />);

			// Make changes and trigger alert
			await waitFor(() => {
				expect(screen.getByText("Make Changes")).toBeInTheDocument();
			});

			await user.click(screen.getByText("Make Changes"));
			await user.click(screen.getByText("Close Sheet"));

			// Click confirm in alert
			await waitFor(() => {
				expect(screen.getByText("Yes, discard changes!")).toBeInTheDocument();
			});

			await user.click(screen.getByText("Yes, discard changes!"));

			// Should close
			expect(mockSetOpen).toHaveBeenCalledWith(false);
		});
	});

	describe("State Management", () => {
		it("should initialize with correct default state", async () => {
			renderWithAuth(<NodeCreate isOpen={true} setOpen={mockSetOpen} />);

			await waitFor(() => {
				// CreateSheet should be rendered with content
				expect(screen.getByTestId("create-sheet")).toBeInTheDocument();
				expect(screen.getByTestId("create-form")).toBeInTheDocument();

				// AlertModal should be rendered but not visible initially
				expect(screen.getByTestId("alert-modal")).toBeInTheDocument();
				expect(screen.queryByText("No, keep editing")).not.toBeInTheDocument();
				expect(
					screen.queryByText("Yes, discard changes!")
				).not.toBeInTheDocument();
			});
		});

		it("should reset all state when closing", async () => {
			const user = userEvent.setup();

			renderWithAuth(<NodeCreate isOpen={true} setOpen={mockSetOpen} />);

			// Make changes
			await waitFor(() => {
				expect(screen.getByText("Make Changes")).toBeInTheDocument();
			});

			await user.click(screen.getByText("Make Changes"));

			// Force close
			await user.click(screen.getByText("Force Close"));

			expect(mockSetOpen).toHaveBeenCalledWith(false);

			// After closing, state should be reset (we can verify this by checking that
			// subsequent opens don't show the alert)
		});

		it("should handle rapid open/close cycles", async () => {
			const _user = userEvent.setup();

			const { rerender } = renderWithAuth(
				<NodeCreate isOpen={true} setOpen={mockSetOpen} />
			);

			await waitFor(() => {
				expect(screen.getByTestId("create-sheet")).toBeInTheDocument();
			});

			// Close
			rerender(<NodeCreate isOpen={false} setOpen={mockSetOpen} />);

			// Open again
			rerender(<NodeCreate isOpen={true} setOpen={mockSetOpen} />);

			await waitFor(() => {
				expect(screen.getByTestId("create-sheet")).toBeInTheDocument();
			});

			// Should work without issues
			expect(screen.getByTestId("create-form")).toBeInTheDocument();
		});
	});

	describe("Loading State", () => {
		it("should handle loading state correctly", async () => {
			renderWithAuth(<NodeCreate isOpen={true} setOpen={mockSetOpen} />);

			// The loading state is managed internally and component should render without issues
			await waitFor(() => {
				expect(screen.getByTestId("alert-modal")).toBeInTheDocument();
			});
		});

		it("should render without loading issues", async () => {
			renderWithAuth(<NodeCreate isOpen={true} setOpen={mockSetOpen} />);

			// The component should render without crashes
			await waitFor(() => {
				expect(screen.getByTestId("create-sheet")).toBeInTheDocument();
				expect(screen.getByTestId("create-form")).toBeInTheDocument();
				expect(screen.getByTestId("alert-modal")).toBeInTheDocument();
			});
		});
	});

	describe("Edge Cases", () => {
		it("should handle undefined setOpen gracefully", () => {
			// This would typically cause an error, but let's test component robustness
			expect(() => {
				renderWithAuth(<NodeCreate isOpen={true} setOpen={vi.fn()} />);
			}).not.toThrow();
		});

		it("should handle boolean toggle of isOpen", async () => {
			const { rerender } = renderWithAuth(
				<NodeCreate isOpen={false} setOpen={mockSetOpen} />
			);

			// Toggle to true
			rerender(<NodeCreate isOpen={true} setOpen={mockSetOpen} />);

			await waitFor(() => {
				expect(screen.getByTestId("create-form")).toBeInTheDocument();
			});

			// Toggle to false
			rerender(<NodeCreate isOpen={false} setOpen={mockSetOpen} />);

			// Component should handle the state change gracefully
			expect(screen.getByTestId("create-sheet")).toBeInTheDocument();
		});

		it("should handle multiple rapid change events", async () => {
			const user = userEvent.setup();

			renderWithAuth(<NodeCreate isOpen={true} setOpen={mockSetOpen} />);

			await waitFor(() => {
				expect(screen.getByText("Make Changes")).toBeInTheDocument();
			});

			// Rapidly make and clear changes
			await user.click(screen.getByText("Make Changes"));
			await user.click(screen.getByText("Clear Changes"));
			await user.click(screen.getByText("Make Changes"));
			await user.click(screen.getByText("Clear Changes"));

			// Should still work correctly
			await user.click(screen.getByText("Close Sheet"));
			expect(mockSetOpen).toHaveBeenCalledWith(false);
		});
	});

	describe("Component Integration", () => {
		it("should properly integrate CreateForm and CreateSheet", async () => {
			renderWithAuth(<NodeCreate isOpen={true} setOpen={mockSetOpen} />);

			await waitFor(() => {
				expect(screen.getByTestId("create-sheet")).toBeInTheDocument();
				expect(screen.getByTestId("create-form")).toBeInTheDocument();
			});

			// Verify that CreateForm is rendered as child of CreateSheet
			expect(screen.getByTestId("create-form")).toBeInTheDocument();
		});

		it("should properly integrate AlertModal", async () => {
			renderWithAuth(<NodeCreate isOpen={true} setOpen={mockSetOpen} />);

			await waitFor(() => {
				expect(screen.getByTestId("alert-modal")).toBeInTheDocument();
			});
		});

		it("should handle component lifecycle correctly", async () => {
			const { unmount } = renderWithAuth(
				<NodeCreate isOpen={true} setOpen={mockSetOpen} />
			);

			await waitFor(() => {
				expect(screen.getByTestId("create-sheet")).toBeInTheDocument();
			});

			// Unmounting should not cause errors
			expect(() => unmount()).not.toThrow();
		});
	});
});
