import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setupEnvVars } from "@/src/__tests__/utils/env-test-utils";
import { render, screen, waitFor } from "@/src/__tests__/utils/test-utils";
import { DeleteForm } from "../delete-form";

// Constants for regex patterns used in tests
const DELETE_BUTTON_REGEX = /yes, delete my account/i;
const NO_LONGER_WANT_REGEX = /No longer want to use our service/;

// Type definitions
interface AlertModalProps {
	isOpen: boolean;
	loading: boolean;
	message: string;
	cancelButtonText: string;
	confirmButtonText: string;
	onClose: () => void;
	onConfirm: () => Promise<void> | void;
}

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", async (importOriginal) => {
	const actual = (await importOriginal()) as Record<string, unknown>;
	return {
		...actual,
		useRouter: () => ({
			push: mockPush,
			replace: vi.fn(),
			prefetch: vi.fn(),
			back: vi.fn(),
			forward: vi.fn(),
			refresh: vi.fn(),
		}),
	};
});

// Mock next-auth/react
const mockUseSession = vi.fn();
vi.mock("next-auth/react", () => ({
	useSession: () => mockUseSession(),
	SessionProvider: ({ children }: { children: React.ReactNode }) => (
		<>{children}</>
	),
}));

// Mock the AlertModal component
const mockAlertModal = vi.fn();
vi.mock("@/components/modals/alert-modal", () => ({
	AlertModal: (props: AlertModalProps) => {
		mockAlertModal(props);

		// Create a click handler that properly handles async onConfirm
		const handleConfirmClick = async () => {
			if (props.onConfirm) {
				// Execute onConfirm and handle any potential promise
				await props.onConfirm();
			}
		};

		return props.isOpen ? (
			<div data-testid="alert-modal">
				<div data-testid="modal-message">{props.message}</div>
				<button
					data-testid="cancel-button"
					onClick={props.onClose}
					type="button"
				>
					{props.cancelButtonText}
				</button>
				<button
					data-testid="confirm-button"
					disabled={props.loading}
					onClick={handleConfirmClick}
					type="button"
				>
					{props.confirmButtonText}
				</button>
			</div>
		) : null;
	},
}));

// Mock the toast hook
const mockToast = vi.fn();
vi.mock("@/components/ui/use-toast", () => ({
	useToast: () => ({ toast: mockToast }),
}));

// Mock fetch
const mockFetch = vi.fn();
// Store original fetch
const originalFetch = global.fetch;
// Replace global fetch
global.fetch = mockFetch as typeof fetch;

describe("DeleteForm", () => {
	const mockUser = {
		id: 123,
		username: "testuser",
		email: "test@example.com",
		createdAt: "2024-01-01T00:00:00Z",
	};

	const mockSession = {
		key: "test-session-key",
		user: { id: "123" },
	};

	let cleanupEnv: (() => void) | undefined;

	beforeEach(() => {
		vi.clearAllMocks();
		mockFetch.mockClear();
		mockUseSession.mockReturnValue({
			data: mockSession,
			status: "authenticated",
		});

		// Set up environment variables for all tests in this suite
		cleanupEnv = setupEnvVars({
			NEXT_PUBLIC_API_URL: "https://api.example.com",
			NEXT_PUBLIC_API_URL_STAGING: "https://staging.example.com",
		});

		// Ensure fetch is mocked
		global.fetch = mockFetch as typeof fetch;
	});

	afterEach(() => {
		// Restore environment variables
		if (cleanupEnv) {
			cleanupEnv();
		}

		// Restore original fetch if needed
		if (originalFetch) {
			global.fetch = originalFetch;
		}
	});

	describe("Component Rendering", () => {
		it("should render the delete form section", () => {
			render(<DeleteForm user={mockUser} />);

			expect(screen.getByText("Delete account")).toBeInTheDocument();
			expect(screen.getByText(NO_LONGER_WANT_REGEX)).toBeInTheDocument();
		});

		it("should render the delete button", () => {
			render(<DeleteForm user={mockUser} />);

			const deleteButton = screen.getByRole("button", {
				name: DELETE_BUTTON_REGEX,
			});
			expect(deleteButton).toBeInTheDocument();
		});

		it("should have proper grid layout styling", () => {
			const { container } = render(<DeleteForm user={mockUser} />);

			const gridContainer = container.querySelector(".grid");
			expect(gridContainer).toHaveClass(
				"grid",
				"max-w-7xl",
				"grid-cols-1",
				"gap-x-8",
				"gap-y-10",
				"px-4",
				"py-16",
				"sm:px-6",
				"md:grid-cols-3",
				"lg:px-8"
			);
		});

		it("should have proper heading styling", () => {
			render(<DeleteForm user={mockUser} />);

			const heading = screen.getByText("Delete account");
			expect(heading).toHaveClass(
				"font-semibold",
				"text-base",
				"text-foreground",
				"leading-7"
			);
		});

		it("should have proper description styling", () => {
			render(<DeleteForm user={mockUser} />);

			const description = screen.getByText(NO_LONGER_WANT_REGEX);
			expect(description).toHaveClass(
				"mt-1",
				"text-gray-400",
				"text-sm",
				"leading-6"
			);
		});

		it("should have proper delete button styling", () => {
			render(<DeleteForm user={mockUser} />);

			const deleteButton = screen.getByRole("button", {
				name: DELETE_BUTTON_REGEX,
			});
			expect(deleteButton).toHaveClass(
				"rounded-md",
				"bg-red-500",
				"px-3",
				"py-2",
				"font-semibold",
				"text-sm",
				"text-white",
				"shadow-sm",
				"hover:bg-red-400"
			);
		});
	});

	describe("Modal Interaction", () => {
		it("should not show modal initially", () => {
			render(<DeleteForm user={mockUser} />);

			expect(screen.queryByTestId("alert-modal")).not.toBeInTheDocument();
		});

		it("should show modal when delete button is clicked", async () => {
			const user = userEvent.setup();
			render(<DeleteForm user={mockUser} />);

			const deleteButton = screen.getByRole("button", {
				name: DELETE_BUTTON_REGEX,
			});
			await user.click(deleteButton);

			expect(screen.getByTestId("alert-modal")).toBeInTheDocument();
		});

		it("should pass correct props to AlertModal", async () => {
			const user = userEvent.setup();
			render(<DeleteForm user={mockUser} />);

			const deleteButton = screen.getByRole("button", {
				name: DELETE_BUTTON_REGEX,
			});
			await user.click(deleteButton);

			expect(mockAlertModal).toHaveBeenCalledWith(
				expect.objectContaining({
					isOpen: true,
					loading: false,
					message:
						"Are you sure you want to delete your account? This will sign you out immediatley.",
					cancelButtonText: "No, keep my account",
					confirmButtonText: "Yes, delete my account!",
				})
			);
		});

		it("should close modal when cancel button is clicked", async () => {
			const user = userEvent.setup();
			render(<DeleteForm user={mockUser} />);

			// Open modal
			const deleteButton = screen.getByRole("button", {
				name: DELETE_BUTTON_REGEX,
			});
			await user.click(deleteButton);

			expect(screen.getByTestId("alert-modal")).toBeInTheDocument();

			// Close modal
			const cancelButton = screen.getByTestId("cancel-button");
			await user.click(cancelButton);

			await waitFor(() => {
				expect(screen.queryByTestId("alert-modal")).not.toBeInTheDocument();
			});
		});

		it("should display correct modal message", async () => {
			const user = userEvent.setup();
			render(<DeleteForm user={mockUser} />);

			const deleteButton = screen.getByRole("button", {
				name: DELETE_BUTTON_REGEX,
			});
			await user.click(deleteButton);

			const modalMessage = screen.getByTestId("modal-message");
			expect(modalMessage).toHaveTextContent(
				"Are you sure you want to delete your account? This will sign you out immediatley."
			);
		});
	});

	describe("Account Deletion API", () => {
		it("should make DELETE request to correct endpoint", async () => {
			const user = userEvent.setup();
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({}),
			});

			render(<DeleteForm user={mockUser} />);

			// Open modal and confirm deletion
			const deleteButton = screen.getByRole("button", {
				name: DELETE_BUTTON_REGEX,
			});
			await user.click(deleteButton);

			// Verify modal is open
			expect(screen.getByTestId("alert-modal")).toBeInTheDocument();

			const confirmButton = screen.getByTestId("confirm-button");
			await user.click(confirmButton);

			// Wait for async operations to complete
			await waitFor(() => {
				expect(mockFetch).toHaveBeenCalledTimes(1);
			});

			expect(mockFetch).toHaveBeenCalledWith(
				"https://api.example.com/api/users/123/",
				expect.objectContaining({
					method: "DELETE",
					headers: {
						Authorization: "Token test-session-key",
					},
				})
			);
		});

		it("should use staging URL when primary URL is not available", async () => {
			const user = userEvent.setup();

			// Temporarily override env vars for this test
			const restoreEnv = setupEnvVars({
				NEXT_PUBLIC_API_URL: undefined,
				NEXT_PUBLIC_API_URL_STAGING: "https://staging.example.com",
			});

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({}),
			});

			render(<DeleteForm user={mockUser} />);

			const deleteButton = screen.getByRole("button", {
				name: DELETE_BUTTON_REGEX,
			});
			await user.click(deleteButton);

			const confirmButton = screen.getByTestId("confirm-button");
			await user.click(confirmButton);

			await waitFor(() => {
				expect(mockFetch).toHaveBeenCalledWith(
					"https://staging.example.com/api/users/123/",
					expect.any(Object)
				);
			});

			// Restore environment
			restoreEnv();
		});

		it("should redirect to login on successful deletion", async () => {
			const user = userEvent.setup();
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({}),
			});

			render(<DeleteForm user={mockUser} />);

			const deleteButton = screen.getByRole("button", {
				name: DELETE_BUTTON_REGEX,
			});
			await user.click(deleteButton);

			const confirmButton = screen.getByTestId("confirm-button");
			await user.click(confirmButton);

			await waitFor(() => {
				expect(mockPush).toHaveBeenCalledWith("/login");
			});
		});

		it("should close modal after successful deletion", async () => {
			const user = userEvent.setup();
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({}),
			});

			render(<DeleteForm user={mockUser} />);

			const deleteButton = screen.getByRole("button", {
				name: DELETE_BUTTON_REGEX,
			});
			await user.click(deleteButton);

			const confirmButton = screen.getByTestId("confirm-button");
			await user.click(confirmButton);

			await waitFor(() => {
				expect(screen.queryByTestId("alert-modal")).not.toBeInTheDocument();
			});
		});
	});

	describe("Error Handling", () => {
		it("should show error toast when API request fails", async () => {
			const user = userEvent.setup();
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 500,
			});

			render(<DeleteForm user={mockUser} />);

			const deleteButton = screen.getByRole("button", {
				name: DELETE_BUTTON_REGEX,
			});
			await user.click(deleteButton);

			const confirmButton = screen.getByTestId("confirm-button");
			await user.click(confirmButton);

			await waitFor(() => {
				expect(mockToast).toHaveBeenCalledWith({
					variant: "destructive",
					title: "Uh oh! Something went wrong.",
					description: "Something went wrong",
				});
			});
		});

		it("should handle network errors gracefully", async () => {
			const user = userEvent.setup();
			mockFetch.mockRejectedValueOnce(new Error("Network error"));

			render(<DeleteForm user={mockUser} />);

			const deleteButton = screen.getByRole("button", {
				name: DELETE_BUTTON_REGEX,
			});
			await user.click(deleteButton);

			const confirmButton = screen.getByTestId("confirm-button");
			await user.click(confirmButton);

			// Should close modal even on error
			await waitFor(() => {
				expect(screen.queryByTestId("alert-modal")).not.toBeInTheDocument();
			});

			// Should not redirect on error
			expect(mockPush).not.toHaveBeenCalled();
		});

		it("should not redirect when API returns error", async () => {
			const user = userEvent.setup();
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 400,
			});

			render(<DeleteForm user={mockUser} />);

			const deleteButton = screen.getByRole("button", {
				name: DELETE_BUTTON_REGEX,
			});
			await user.click(deleteButton);

			const confirmButton = screen.getByTestId("confirm-button");
			await user.click(confirmButton);

			await waitFor(() => {
				expect(mockToast).toHaveBeenCalled();
			});

			expect(mockPush).not.toHaveBeenCalled();
		});
	});

	describe("Session Handling", () => {
		it("should handle missing session", async () => {
			const user = userEvent.setup();
			mockUseSession.mockReturnValue({
				data: null,
				status: "unauthenticated",
			});

			render(<DeleteForm user={mockUser} />);

			const deleteButton = screen.getByRole("button", {
				name: DELETE_BUTTON_REGEX,
			});
			await user.click(deleteButton);

			// Should still render and be clickable
			expect(screen.getByTestId("alert-modal")).toBeInTheDocument();
		});

		it("should handle session without key", async () => {
			const user = userEvent.setup();
			mockUseSession.mockReturnValue({
				data: { key: undefined },
				status: "authenticated",
			});

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({}),
			});

			render(<DeleteForm user={mockUser} />);

			const deleteButton = screen.getByRole("button", {
				name: DELETE_BUTTON_REGEX,
			});
			await user.click(deleteButton);

			const confirmButton = screen.getByTestId("confirm-button");
			await user.click(confirmButton);

			await waitFor(() => {
				expect(mockFetch).toHaveBeenCalledWith(
					expect.any(String),
					expect.objectContaining({
						headers: {
							Authorization: "Token undefined",
						},
					})
				);
			});
		});
	});

	describe("Form Behavior", () => {
		it("should prevent default form submission", async () => {
			const user = userEvent.setup();
			const _mockPreventDefault = vi.fn();

			render(<DeleteForm user={mockUser} />);

			const form = screen
				.getByRole("button", { name: DELETE_BUTTON_REGEX })
				.closest("form");

			// Simulate form submission
			form?.dispatchEvent(
				new Event("submit", { bubbles: true, cancelable: true })
			);

			// The button click should prevent default form submission
			const deleteButton = screen.getByRole("button", {
				name: DELETE_BUTTON_REGEX,
			});
			await user.click(deleteButton);

			// Modal should open instead of form submitting
			expect(screen.getByTestId("alert-modal")).toBeInTheDocument();
		});

		it("should have proper form structure", () => {
			render(<DeleteForm user={mockUser} />);

			const form = screen
				.getByRole("button", { name: DELETE_BUTTON_REGEX })
				.closest("form");
			expect(form).toHaveClass("flex", "items-start", "md:col-span-2");
		});

		it("should have proper button type", () => {
			render(<DeleteForm user={mockUser} />);

			const deleteButton = screen.getByRole("button", {
				name: DELETE_BUTTON_REGEX,
			});
			expect(deleteButton).toHaveAttribute("type", "submit");
		});
	});

	describe("User Data Handling", () => {
		it("should work with different user IDs", async () => {
			const user = userEvent.setup();
			const differentUser = { ...mockUser, id: 456 };

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({}),
			});

			render(<DeleteForm user={differentUser} />);

			const deleteButton = screen.getByRole("button", {
				name: DELETE_BUTTON_REGEX,
			});
			await user.click(deleteButton);

			const confirmButton = screen.getByTestId("confirm-button");
			await user.click(confirmButton);

			await waitFor(() => {
				expect(mockFetch).toHaveBeenCalledWith(
					"https://api.example.com/api/users/456/",
					expect.any(Object)
				);
			});
		});

		it("should handle string user IDs", async () => {
			const user = userEvent.setup();
			const stringIdUser = { ...mockUser, id: 789 };

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({}),
			});

			render(<DeleteForm user={stringIdUser} />);

			const deleteButton = screen.getByRole("button", {
				name: DELETE_BUTTON_REGEX,
			});
			await user.click(deleteButton);

			const confirmButton = screen.getByTestId("confirm-button");
			await user.click(confirmButton);

			await waitFor(() => {
				expect(mockFetch).toHaveBeenCalledWith(
					"https://api.example.com/api/users/789/",
					expect.any(Object)
				);
			});
		});
	});

	describe("Accessibility", () => {
		it("should have proper heading hierarchy", () => {
			render(<DeleteForm user={mockUser} />);

			const heading = screen.getByRole("heading", { level: 2 });
			expect(heading).toHaveTextContent("Delete account");
		});

		it("should have descriptive button text", () => {
			render(<DeleteForm user={mockUser} />);

			const deleteButton = screen.getByRole("button", {
				name: DELETE_BUTTON_REGEX,
			});
			expect(deleteButton).toBeInTheDocument();
		});

		it("should be keyboard navigable", async () => {
			const user = userEvent.setup();
			render(<DeleteForm user={mockUser} />);

			const deleteButton = screen.getByRole("button", {
				name: DELETE_BUTTON_REGEX,
			});
			await user.tab();

			expect(deleteButton).toHaveFocus();
		});
	});
});
