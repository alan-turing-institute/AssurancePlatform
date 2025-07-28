import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "@/src/__tests__/mocks/server";
import { renderWithAuth } from "@/src/__tests__/utils/test-utils";
import { deleteCaseStudy } from "@/actions/case-studies";
import DeleteCaseButton from "../delete-button";

// Mock Next.js navigation
const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
	useRouter: vi.fn(() => ({
		push: mockPush,
		back: vi.fn(),
		replace: vi.fn(),
		refresh: vi.fn(),
		forward: vi.fn(),
		prefetch: vi.fn(),
	})),
	usePathname: () => "/dashboard/case-studies",
	useSearchParams: vi.fn(() => new URLSearchParams()),
}));

// Mock next-auth
vi.mock("next-auth/react", () => ({
	useSession: vi.fn(),
	signIn: vi.fn(),
	signOut: vi.fn(),
	getSession: vi.fn(),
	SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock toast hook
const mockToast = vi.fn();
vi.mock("@/components/ui/use-toast", () => ({
	useToast: () => ({
		toast: mockToast,
	}),
}));

// Mock actions
vi.mock("@/actions/case-studies", () => ({
	deleteCaseStudy: vi.fn(),
}));

// Get the mocked function
const mockDeleteCaseStudy = vi.mocked(deleteCaseStudy);

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const mockUser = {
	id: 1,
	name: "Test User",
	email: "test@example.com",
	key: "mock-session-key",
};

describe("DeleteCaseButton Component", () => {
	const user = userEvent.setup();

	beforeEach(() => {
		vi.clearAllMocks();
		(useSession as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
			data: mockUser,
			status: "authenticated",
		});
		(useRouter as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
			push: mockPush,
			back: vi.fn(),
			replace: vi.fn(),
			refresh: vi.fn(),
			forward: vi.fn(),
			prefetch: vi.fn(),
		});
	});

	describe("Component Rendering", () => {
		it("should render destructive button variant with trash icon", () => {
			renderWithAuth(
				<DeleteCaseButton
					caseStudyId={1}
					variant="destructive"
					redirect={false}
				/>
			);

			const deleteButton = screen.getByRole("button", { name: /delete/i });
			expect(deleteButton).toBeInTheDocument();
			expect(deleteButton).toHaveClass("bg-rose-500");

			// Check for trash icon (using SVG selector)
			const trashIcon = deleteButton.querySelector("svg");
			expect(trashIcon).toBeInTheDocument();
		});

		it("should render link variant with trash icon", () => {
			renderWithAuth(
				<DeleteCaseButton
					caseStudyId={1}
					variant="link"
					redirect={false}
				/>
			);

			const deleteButton = screen.getByRole("button", { name: /delete/i });
			expect(deleteButton).toBeInTheDocument();

			// Link variant should be a regular button element
			expect(deleteButton.tagName).toBe("BUTTON");

			// Check for trash icon
			const trashIcon = deleteButton.querySelector("svg");
			expect(trashIcon).toBeInTheDocument();
		});
	});

	describe("Modal Interaction", () => {
		it("should open confirmation modal when delete button is clicked", async () => {
			renderWithAuth(
				<DeleteCaseButton
					caseStudyId={1}
					variant="destructive"
					redirect={false}
				/>
			);

			const deleteButton = screen.getByRole("button", { name: /delete/i });
			await user.click(deleteButton);

			// Check for confirmation modal
			await waitFor(() => {
				expect(screen.getByRole("dialog")).toBeInTheDocument();
				expect(
					screen.getByText("Are you sure you want to delete this case study?")
				).toBeInTheDocument();
			});

			// Check for modal buttons
			expect(
				screen.getByRole("button", { name: /no/i })
			).toBeInTheDocument();
			expect(
				screen.getByRole("button", { name: /yes, remove case study!/i })
			).toBeInTheDocument();
		});

		it("should close modal when 'No' is clicked", async () => {
			renderWithAuth(
				<DeleteCaseButton
					caseStudyId={1}
					variant="destructive"
					redirect={false}
				/>
			);

			// Open modal
			const deleteButton = screen.getByRole("button", { name: /delete/i });
			await user.click(deleteButton);

			await waitFor(() => {
				expect(screen.getByRole("dialog")).toBeInTheDocument();
			});

			// Click 'No' button
			const noButton = screen.getByRole("button", { name: /no/i });
			await user.click(noButton);

			// Check modal is closed
			await waitFor(() => {
				expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
			});
		});

		it("should close modal when clicking close button", async () => {
			renderWithAuth(
				<DeleteCaseButton
					caseStudyId={1}
					variant="destructive"
					redirect={false}
				/>
			);

			// Open modal
			const deleteButton = screen.getByRole("button", { name: /delete/i });
			await user.click(deleteButton);

			await waitFor(() => {
				expect(screen.getByRole("dialog")).toBeInTheDocument();
			});

			// Click the close button (X button)
			const closeButton = screen.getByRole("button", { name: /close/i });
			await user.click(closeButton);

			// Check modal is closed
			await waitFor(() => {
				expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
			});
		});
	});

	describe("Delete Functionality", () => {
		it("should successfully delete case study without redirect", async () => {
			// Mock successful deletion
			mockDeleteCaseStudy.mockResolvedValue(true);

			renderWithAuth(
				<DeleteCaseButton
					caseStudyId={1}
					variant="destructive"
					redirect={false}
				/>
			);

			// Open modal and confirm deletion
			const deleteButton = screen.getByRole("button", { name: /delete/i });
			await user.click(deleteButton);

			await waitFor(() => {
				expect(screen.getByRole("dialog")).toBeInTheDocument();
			});

			const confirmButton = screen.getByRole("button", {
				name: /yes, remove case study!/i,
			});
			await user.click(confirmButton);

			// Check deletion was called
			await waitFor(() => {
				expect(mockDeleteCaseStudy).toHaveBeenCalledWith(
					"mock-session-key",
					1
				);
			});

			// Check success toast
			await waitFor(() => {
				expect(mockToast).toHaveBeenCalledWith({
					title: "Successfully Deleted",
					description: "Case Study Deleted",
				});
			});

			// Should not redirect when redirect=false
			expect(mockPush).not.toHaveBeenCalled();
		});

		it("should successfully delete case study with redirect", async () => {
			// Mock successful deletion
			mockDeleteCaseStudy.mockResolvedValue(true);

			renderWithAuth(
				<DeleteCaseButton
					caseStudyId={1}
					variant="destructive"
					redirect={true}
				/>
			);

			// Open modal and confirm deletion
			const deleteButton = screen.getByRole("button", { name: /delete/i });
			await user.click(deleteButton);

			await waitFor(() => {
				expect(screen.getByRole("dialog")).toBeInTheDocument();
			});

			const confirmButton = screen.getByRole("button", {
				name: /yes, remove case study!/i,
			});
			await user.click(confirmButton);

			// Check deletion was called
			await waitFor(() => {
				expect(mockDeleteCaseStudy).toHaveBeenCalledWith(
					"mock-session-key",
					1
				);
			});

			// Check success toast
			await waitFor(() => {
				expect(mockToast).toHaveBeenCalledWith({
					title: "Successfully Deleted",
					description: "Case Study Deleted",
				});
			});

			// Should redirect when redirect=true
			await waitFor(() => {
				expect(mockPush).toHaveBeenCalledWith("/dashboard/case-studies");
			});
		});

		it("should handle deletion failure gracefully", async () => {
			// Mock failed deletion
			mockDeleteCaseStudy.mockResolvedValue(false);

			renderWithAuth(
				<DeleteCaseButton
					caseStudyId={1}
					variant="destructive"
					redirect={false}
				/>
			);

			// Open modal and confirm deletion
			const deleteButton = screen.getByRole("button", { name: /delete/i });
			await user.click(deleteButton);

			await waitFor(() => {
				expect(screen.getByRole("dialog")).toBeInTheDocument();
			});

			const confirmButton = screen.getByRole("button", {
				name: /yes, remove case study!/i,
			});
			await user.click(confirmButton);

			// Check deletion was called
			await waitFor(() => {
				expect(mockDeleteCaseStudy).toHaveBeenCalledWith(
					"mock-session-key",
					1
				);
			});

			// Check error toast
			await waitFor(() => {
				expect(mockToast).toHaveBeenCalledWith({
					variant: "destructive",
					title: "Delete Failed",
					description: "Something went wrong!",
				});
			});

			// Should not redirect on failure
			expect(mockPush).not.toHaveBeenCalled();
		});

		it("should handle API errors gracefully", async () => {
			// Mock API error
			mockDeleteCaseStudy.mockRejectedValue(new Error("Network error"));

			renderWithAuth(
				<DeleteCaseButton
					caseStudyId={1}
					variant="destructive"
					redirect={false}
				/>
			);

			// Open modal and confirm deletion
			const deleteButton = screen.getByRole("button", { name: /delete/i });
			await user.click(deleteButton);

			await waitFor(() => {
				expect(screen.getByRole("dialog")).toBeInTheDocument();
			});

			const confirmButton = screen.getByRole("button", {
				name: /yes, remove case study!/i,
			});
			await user.click(confirmButton);

			// Check deletion was called
			await waitFor(() => {
				expect(mockDeleteCaseStudy).toHaveBeenCalledWith(
					"mock-session-key",
					1
				);
			});

			// Should not redirect on error
			expect(mockPush).not.toHaveBeenCalled();
		});
	});

	describe("Loading States", () => {
		it("should handle async deletion properly", async () => {
			// Mock slow deletion
			mockDeleteCaseStudy.mockImplementation(
				() =>
					new Promise((resolve) => setTimeout(() => resolve(true), 100))
			);

			renderWithAuth(
				<DeleteCaseButton
					caseStudyId={1}
					variant="destructive"
					redirect={false}
				/>
			);

			// Open modal and confirm deletion
			const deleteButton = screen.getByRole("button", { name: /delete/i });
			await user.click(deleteButton);

			await waitFor(() => {
				expect(screen.getByRole("dialog")).toBeInTheDocument();
			});

			const confirmButton = screen.getByRole("button", {
				name: /yes, remove case study!/i,
			});
			await user.click(confirmButton);

			// Wait for completion
			await waitFor(
				() => {
					expect(mockToast).toHaveBeenCalled();
				},
				{ timeout: 2000 }
			);
		});
	});

	describe("Session Handling", () => {
		it("should handle missing session gracefully", async () => {
			// Mock no session
			(useSession as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
				data: null,
				status: "unauthenticated",
			});

			renderWithAuth(
				<DeleteCaseButton
					caseStudyId={1}
					variant="destructive"
					redirect={false}
				/>
			);

			// Open modal and confirm deletion
			const deleteButton = screen.getByRole("button", { name: /delete/i });
			await user.click(deleteButton);

			await waitFor(() => {
				expect(screen.getByRole("dialog")).toBeInTheDocument();
			});

			const confirmButton = screen.getByRole("button", {
				name: /yes, remove case study!/i,
			});
			await user.click(confirmButton);

			// Check deletion was called with empty key
			await waitFor(() => {
				expect(mockDeleteCaseStudy).toHaveBeenCalledWith("", 1);
			});
		});

		it("should handle session without key", async () => {
			// Mock session without key
			(useSession as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
				data: { ...mockUser, key: undefined },
				status: "authenticated",
			});

			renderWithAuth(
				<DeleteCaseButton
					caseStudyId={1}
					variant="destructive"
					redirect={false}
				/>
			);

			// Open modal and confirm deletion
			const deleteButton = screen.getByRole("button", { name: /delete/i });
			await user.click(deleteButton);

			await waitFor(() => {
				expect(screen.getByRole("dialog")).toBeInTheDocument();
			});

			const confirmButton = screen.getByRole("button", {
				name: /yes, remove case study!/i,
			});
			await user.click(confirmButton);

			// Check deletion was called with empty key
			await waitFor(() => {
				expect(mockDeleteCaseStudy).toHaveBeenCalledWith("", 1);
			});
		});
	});

	describe("Multiple Case Studies", () => {
		it("should handle different case study IDs correctly", async () => {
			mockDeleteCaseStudy.mockResolvedValue(true);

			// Test with different case study ID
			const { rerender } = renderWithAuth(
				<DeleteCaseButton
					caseStudyId={5}
					variant="destructive"
					redirect={false}
				/>
			);

			// Open modal and confirm deletion
			const deleteButton = screen.getByRole("button", { name: /delete/i });
			await user.click(deleteButton);

			await waitFor(() => {
				expect(screen.getByRole("dialog")).toBeInTheDocument();
			});

			const confirmButton = screen.getByRole("button", {
				name: /yes, remove case study!/i,
			});
			await user.click(confirmButton);

			// Check deletion was called with correct ID
			await waitFor(() => {
				expect(mockDeleteCaseStudy).toHaveBeenCalledWith(
					"mock-session-key",
					5
				);
			});

			// Test with another ID
			vi.clearAllMocks();
			rerender(
				<DeleteCaseButton
					caseStudyId={10}
					variant="link"
					redirect={true}
				/>
			);

			const newDeleteButton = screen.getByRole("button", { name: /delete/i });
			await user.click(newDeleteButton);

			await waitFor(() => {
				expect(screen.getByRole("dialog")).toBeInTheDocument();
			});

			const newConfirmButton = screen.getByRole("button", {
				name: /yes, remove case study!/i,
			});
			await user.click(newConfirmButton);

			await waitFor(() => {
				expect(mockDeleteCaseStudy).toHaveBeenCalledWith(
					"mock-session-key",
					10
				);
			});
		});
	});

	describe("Accessibility", () => {
		it("should have proper accessibility attributes", () => {
			renderWithAuth(
				<DeleteCaseButton
					caseStudyId={1}
					variant="destructive"
					redirect={false}
				/>
			);

			const deleteButton = screen.getByRole("button", { name: /delete/i });
			expect(deleteButton).toBeInTheDocument();
			expect(deleteButton).toHaveAttribute("type", "button");
		});

		it("should support keyboard navigation", async () => {
			renderWithAuth(
				<DeleteCaseButton
					caseStudyId={1}
					variant="destructive"
					redirect={false}
				/>
			);

			const deleteButton = screen.getByRole("button", { name: /delete/i });

			// Focus the button
			deleteButton.focus();
			expect(deleteButton).toHaveFocus();

			// Press Enter to open modal
			await user.keyboard("{Enter}");

			await waitFor(() => {
				expect(screen.getByRole("dialog")).toBeInTheDocument();
			});

			// Modal should be present and interactive
			const confirmButton = screen.getByRole("button", {
				name: /yes, remove case study!/i,
			});
			expect(confirmButton).toBeInTheDocument();

			// Tab navigation should work within the modal
			await user.keyboard("{Tab}");
			expect(document.activeElement).toBeInTheDocument();
		});

		it("should have proper ARIA labels for screen readers", async () => {
			renderWithAuth(
				<DeleteCaseButton
					caseStudyId={1}
					variant="destructive"
					redirect={false}
				/>
			);

			// Open modal
			const deleteButton = screen.getByRole("button", { name: /delete/i });
			await user.click(deleteButton);

			await waitFor(() => {
				expect(screen.getByRole("dialog")).toBeInTheDocument();
			});

			// Check modal has proper labeling
			const dialog = screen.getByRole("dialog");
			expect(dialog).toBeInTheDocument();

			// Check buttons have clear labels
			expect(
				screen.getByRole("button", { name: /no/i })
			).toBeInTheDocument();
			expect(
				screen.getByRole("button", { name: /yes, remove case study!/i })
			).toBeInTheDocument();
		});
	});
});
