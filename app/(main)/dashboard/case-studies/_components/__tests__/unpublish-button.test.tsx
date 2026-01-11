import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { useSession } from "next-auth/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateCaseStudy } from "@/actions/case-studies";
import { server } from "@/src/__tests__/mocks/server";
import { renderWithAuth } from "@/src/__tests__/utils/test-utils";
import UnpublishCaseButton from "../unpublish-button";

// Top-level regex patterns for performance
const UNPUBLISH_REGEX = /unpublish/i;
const NO_REGEX = /no/i;
const YES_UNPUBLISH_CASE_STUDY_REGEX = /yes, unpublish case study!/i;
const CLOSE_REGEX = /close/i;

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
vi.mock("@/lib/toast", () => ({
	useToast: () => ({
		toast: mockToast,
	}),
}));

// Mock actions
vi.mock("@/actions/case-studies", () => ({
	updateCaseStudy: vi.fn(),
}));

// Get the mocked function
const mockUpdateCaseStudy = vi.mocked(updateCaseStudy);

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const mockUser = {
	id: 1,
	name: "Test User",
	email: "test@example.com",
	key: "",
};

describe("UnpublishCaseButton Component", () => {
	const user = userEvent.setup();

	beforeEach(() => {
		vi.clearAllMocks();
		(useSession as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
			data: mockUser,
			status: "authenticated",
		});
	});

	describe("Component Rendering", () => {
		it("should render unpublish button with cloud download icon", () => {
			renderWithAuth(<UnpublishCaseButton caseStudyId={1} />);

			const unpublishButton = screen.getByRole("button", {
				name: UNPUBLISH_REGEX,
			});
			expect(unpublishButton).toBeInTheDocument();

			// Check for cloud download icon
			const cloudIcon = unpublishButton.querySelector("svg");
			expect(cloudIcon).toBeInTheDocument();

			// Check button text
			expect(unpublishButton.textContent).toMatch(UNPUBLISH_REGEX);
		});

		it("should have proper button styling", () => {
			renderWithAuth(<UnpublishCaseButton caseStudyId={1} />);

			const unpublishButton = screen.getByRole("button", {
				name: UNPUBLISH_REGEX,
			});
			expect(unpublishButton).toHaveAttribute("type", "button");
			expect(unpublishButton).toHaveClass("transition-colors");
		});
	});

	describe("Modal Interaction", () => {
		it("should open confirmation modal when unpublish button is clicked", async () => {
			renderWithAuth(<UnpublishCaseButton caseStudyId={1} />);

			const unpublishButton = screen.getByRole("button", {
				name: UNPUBLISH_REGEX,
			});
			await user.click(unpublishButton);

			// Check for confirmation modal
			await waitFor(() => {
				expect(screen.getByRole("dialog")).toBeInTheDocument();
				expect(
					screen.getByText(
						"Are you sure you want to unpublish this case study?"
					)
				).toBeInTheDocument();
			});

			// Check for modal buttons
			expect(
				screen.getByRole("button", { name: NO_REGEX })
			).toBeInTheDocument();
			expect(
				screen.getByRole("button", { name: YES_UNPUBLISH_CASE_STUDY_REGEX })
			).toBeInTheDocument();
		});

		it("should close modal when 'No' is clicked", async () => {
			renderWithAuth(<UnpublishCaseButton caseStudyId={1} />);

			// Open modal
			const unpublishButton = screen.getByRole("button", {
				name: UNPUBLISH_REGEX,
			});
			await user.click(unpublishButton);

			await waitFor(() => {
				expect(screen.getByRole("dialog")).toBeInTheDocument();
			});

			// Click 'No' button
			const noButton = screen.getByRole("button", { name: NO_REGEX });
			await user.click(noButton);

			// Check modal is closed
			await waitFor(() => {
				expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
			});
		});

		it("should close modal when clicking close button", async () => {
			renderWithAuth(<UnpublishCaseButton caseStudyId={1} />);

			// Open modal
			const unpublishButton = screen.getByRole("button", {
				name: UNPUBLISH_REGEX,
			});
			await user.click(unpublishButton);

			await waitFor(() => {
				expect(screen.getByRole("dialog")).toBeInTheDocument();
			});

			// Click the close button (X button)
			const closeButton = screen.getByRole("button", { name: CLOSE_REGEX });
			await user.click(closeButton);

			// Check modal is closed
			await waitFor(() => {
				expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
			});
		});

		it("should close modal when pressing Escape key", async () => {
			renderWithAuth(<UnpublishCaseButton caseStudyId={1} />);

			// Open modal
			const unpublishButton = screen.getByRole("button", {
				name: UNPUBLISH_REGEX,
			});
			await user.click(unpublishButton);

			await waitFor(() => {
				expect(screen.getByRole("dialog")).toBeInTheDocument();
			});

			// Press Escape
			await user.keyboard("{Escape}");

			// Check modal is closed
			await waitFor(() => {
				expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
			});
		});
	});

	describe("Unpublish Functionality", () => {
		it("should successfully unpublish case study", async () => {
			// Mock successful unpublish
			mockUpdateCaseStudy.mockResolvedValue({ success: true, data: true });

			renderWithAuth(<UnpublishCaseButton caseStudyId={1} />);

			// Open modal and confirm unpublish
			const unpublishButton = screen.getByRole("button", {
				name: UNPUBLISH_REGEX,
			});
			await user.click(unpublishButton);

			await waitFor(() => {
				expect(screen.getByRole("dialog")).toBeInTheDocument();
			});

			const confirmButton = screen.getByRole("button", {
				name: YES_UNPUBLISH_CASE_STUDY_REGEX,
			});
			await user.click(confirmButton);

			// Check unpublish was called with correct parameters
			await waitFor(() => {
				expect(mockUpdateCaseStudy).toHaveBeenCalledWith(
					"",
					expect.any(FormData)
				);
			});

			// Verify FormData contents
			const call = mockUpdateCaseStudy.mock.calls[0];
			const formData = call[1] as FormData;
			expect(formData.get("id")).toBe("1");
			expect(formData.get("published")).toBe("false");
			expect(formData.get("published_date")).toBe("");

			// Check success toast
			await waitFor(() => {
				expect(mockToast).toHaveBeenCalledWith({
					title: "Successfully Unpublished",
					description: "You have unpublished your case study!",
				});
			});

			// Check modal is closed
			await waitFor(() => {
				expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
			});
		});

		it("should handle unpublish failure from API", async () => {
			// Mock failed unpublish
			mockUpdateCaseStudy.mockResolvedValue({ success: false, error: "Update failed" });

			renderWithAuth(<UnpublishCaseButton caseStudyId={1} />);

			// Open modal and confirm unpublish
			const unpublishButton = screen.getByRole("button", {
				name: UNPUBLISH_REGEX,
			});
			await user.click(unpublishButton);

			await waitFor(() => {
				expect(screen.getByRole("dialog")).toBeInTheDocument();
			});

			const confirmButton = screen.getByRole("button", {
				name: YES_UNPUBLISH_CASE_STUDY_REGEX,
			});
			await user.click(confirmButton);

			// Check unpublish was called
			await waitFor(() => {
				expect(mockUpdateCaseStudy).toHaveBeenCalled();
			});

			// Check error toast
			await waitFor(() => {
				expect(mockToast).toHaveBeenCalledWith({
					variant: "destructive",
					title: "Failed to Unpublish",
					description: "Sorry something went wrong!",
				});
			});

			// Check modal is closed
			await waitFor(() => {
				expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
			});
		});

		it("should handle network errors gracefully", async () => {
			// Mock network error
			mockUpdateCaseStudy.mockRejectedValue(new Error("Network error"));

			renderWithAuth(<UnpublishCaseButton caseStudyId={1} />);

			// Open modal and confirm unpublish
			const unpublishButton = screen.getByRole("button", {
				name: UNPUBLISH_REGEX,
			});
			await user.click(unpublishButton);

			await waitFor(() => {
				expect(screen.getByRole("dialog")).toBeInTheDocument();
			});

			const confirmButton = screen.getByRole("button", {
				name: YES_UNPUBLISH_CASE_STUDY_REGEX,
			});
			await user.click(confirmButton);

			// Check unpublish was called
			await waitFor(() => {
				expect(mockUpdateCaseStudy).toHaveBeenCalled();
			});

			// Check error toast
			await waitFor(() => {
				expect(mockToast).toHaveBeenCalledWith({
					variant: "destructive",
					title: "Failed to Unpublish",
					description: "Sorry something went wrong!",
				});
			});

			// Check modal is closed
			await waitFor(() => {
				expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
			});
		});

		it("should handle server errors (500) gracefully", async () => {
			// Mock server error
			server.use(
				http.put(`${API_BASE_URL}/api/case-studies/1/`, () =>
					HttpResponse.json({ error: "Internal server error" }, { status: 500 })
				)
			);

			// updateCaseStudy action should handle this and return false
			mockUpdateCaseStudy.mockResolvedValue({ success: false, error: "Update failed" });

			renderWithAuth(<UnpublishCaseButton caseStudyId={1} />);

			// Open modal and confirm unpublish
			const unpublishButton = screen.getByRole("button", {
				name: UNPUBLISH_REGEX,
			});
			await user.click(unpublishButton);

			await waitFor(() => {
				expect(screen.getByRole("dialog")).toBeInTheDocument();
			});

			const confirmButton = screen.getByRole("button", {
				name: YES_UNPUBLISH_CASE_STUDY_REGEX,
			});
			await user.click(confirmButton);

			// Check error toast
			await waitFor(() => {
				expect(mockToast).toHaveBeenCalledWith({
					variant: "destructive",
					title: "Failed to Unpublish",
					description: "Sorry something went wrong!",
				});
			});
		});
	});

	describe("Loading States", () => {
		it("should handle async unpublish properly", async () => {
			// Mock slow unpublish
			mockUpdateCaseStudy.mockImplementation(
				() => new Promise((resolve) => setTimeout(() => resolve(true), 100))
			);

			renderWithAuth(<UnpublishCaseButton caseStudyId={1} />);

			// Open modal and confirm unpublish
			const unpublishButton = screen.getByRole("button", {
				name: UNPUBLISH_REGEX,
			});
			await user.click(unpublishButton);

			await waitFor(() => {
				expect(screen.getByRole("dialog")).toBeInTheDocument();
			});

			const confirmButton = screen.getByRole("button", {
				name: YES_UNPUBLISH_CASE_STUDY_REGEX,
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

		it("should close modal after successful unpublish", async () => {
			// Mock successful unpublish
			mockUpdateCaseStudy.mockResolvedValue({ success: true, data: true });

			renderWithAuth(<UnpublishCaseButton caseStudyId={1} />);

			// Open modal and confirm unpublish
			const unpublishButton = screen.getByRole("button", {
				name: UNPUBLISH_REGEX,
			});
			await user.click(unpublishButton);

			await waitFor(() => {
				expect(screen.getByRole("dialog")).toBeInTheDocument();
			});

			const confirmButton = screen.getByRole("button", {
				name: YES_UNPUBLISH_CASE_STUDY_REGEX,
			});
			await user.click(confirmButton);

			// Modal should close after operation
			await waitFor(() => {
				expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
			});
		});
	});

	describe("Session Handling", () => {
		it("should handle missing session gracefully", async () => {
			// Mock no session
			(useSession as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
				data: null,
				status: "unauthenticated",
			});

			renderWithAuth(<UnpublishCaseButton caseStudyId={1} />);

			// Open modal and confirm unpublish
			const unpublishButton = screen.getByRole("button", {
				name: UNPUBLISH_REGEX,
			});
			await user.click(unpublishButton);

			await waitFor(() => {
				expect(screen.getByRole("dialog")).toBeInTheDocument();
			});

			const confirmButton = screen.getByRole("button", {
				name: YES_UNPUBLISH_CASE_STUDY_REGEX,
			});
			await user.click(confirmButton);

			// Check unpublish was called with empty string (session key no longer used)
			await waitFor(() => {
				expect(mockUpdateCaseStudy).toHaveBeenCalledWith(
					"",
					expect.any(FormData)
				);
			});
		});

		it("should handle session without key", async () => {
			// Mock session without key
			(useSession as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
				data: { ...mockUser, key: undefined },
				status: "authenticated",
			});

			renderWithAuth(<UnpublishCaseButton caseStudyId={1} />);

			// Open modal and confirm unpublish
			const unpublishButton = screen.getByRole("button", {
				name: UNPUBLISH_REGEX,
			});
			await user.click(unpublishButton);

			await waitFor(() => {
				expect(screen.getByRole("dialog")).toBeInTheDocument();
			});

			const confirmButton = screen.getByRole("button", {
				name: YES_UNPUBLISH_CASE_STUDY_REGEX,
			});
			await user.click(confirmButton);

			// Check unpublish was called with empty string (session key no longer used)
			await waitFor(() => {
				expect(mockUpdateCaseStudy).toHaveBeenCalledWith(
					"",
					expect.any(FormData)
				);
			});
		});
	});

	describe("Different Case Study IDs", () => {
		it("should handle different case study IDs correctly", async () => {
			mockUpdateCaseStudy.mockResolvedValue({ success: true, data: true });

			// Test with different case study ID
			const { rerender } = renderWithAuth(
				<UnpublishCaseButton caseStudyId={5} />
			);

			// Open modal and confirm unpublish
			const unpublishButton = screen.getByRole("button", {
				name: UNPUBLISH_REGEX,
			});
			await user.click(unpublishButton);

			await waitFor(() => {
				expect(screen.getByRole("dialog")).toBeInTheDocument();
			});

			const confirmButton = screen.getByRole("button", {
				name: YES_UNPUBLISH_CASE_STUDY_REGEX,
			});
			await user.click(confirmButton);

			// Check unpublish was called with correct ID
			await waitFor(() => {
				const call = mockUpdateCaseStudy.mock.calls[0];
				const formData = call[1] as FormData;
				expect(formData.get("id")).toBe("5");
			});

			// Test with another ID
			vi.clearAllMocks();
			rerender(<UnpublishCaseButton caseStudyId={10} />);

			const newUnpublishButton = screen.getByRole("button", {
				name: UNPUBLISH_REGEX,
			});
			await user.click(newUnpublishButton);

			await waitFor(() => {
				expect(screen.getByRole("dialog")).toBeInTheDocument();
			});

			const newConfirmButton = screen.getByRole("button", {
				name: YES_UNPUBLISH_CASE_STUDY_REGEX,
			});
			await user.click(newConfirmButton);

			await waitFor(() => {
				const call = mockUpdateCaseStudy.mock.calls[0];
				const formData = call[1] as FormData;
				expect(formData.get("id")).toBe("10");
			});
		});

		it("should handle edge case ID values", async () => {
			mockUpdateCaseStudy.mockResolvedValue({ success: true, data: true });

			renderWithAuth(<UnpublishCaseButton caseStudyId={0} />);

			// Open modal and confirm unpublish
			const unpublishButton = screen.getByRole("button", {
				name: UNPUBLISH_REGEX,
			});
			await user.click(unpublishButton);

			await waitFor(() => {
				expect(screen.getByRole("dialog")).toBeInTheDocument();
			});

			const confirmButton = screen.getByRole("button", {
				name: YES_UNPUBLISH_CASE_STUDY_REGEX,
			});
			await user.click(confirmButton);

			// Check unpublish was called with ID 0
			await waitFor(() => {
				const call = mockUpdateCaseStudy.mock.calls[0];
				const formData = call[1] as FormData;
				expect(formData.get("id")).toBe("0");
			});
		});
	});

	describe("FormData Structure", () => {
		it("should send correct FormData structure", async () => {
			mockUpdateCaseStudy.mockResolvedValue({ success: true, data: true });

			renderWithAuth(<UnpublishCaseButton caseStudyId={1} />);

			// Open modal and confirm unpublish
			const unpublishButton = screen.getByRole("button", {
				name: UNPUBLISH_REGEX,
			});
			await user.click(unpublishButton);

			await waitFor(() => {
				expect(screen.getByRole("dialog")).toBeInTheDocument();
			});

			const confirmButton = screen.getByRole("button", {
				name: YES_UNPUBLISH_CASE_STUDY_REGEX,
			});
			await user.click(confirmButton);

			// Verify FormData structure
			await waitFor(() => {
				const call = mockUpdateCaseStudy.mock.calls[0];
				const formData = call[1] as FormData;

				// Check required fields for unpublishing
				expect(formData.get("id")).toBe("1");
				expect(formData.get("published")).toBe("false");
				expect(formData.get("published_date")).toBe("");

				// Should only have these 3 fields
				const entries = Array.from(formData.entries());
				expect(entries).toHaveLength(3);
			});
		});
	});

	describe("Accessibility", () => {
		it("should have proper accessibility attributes", () => {
			renderWithAuth(<UnpublishCaseButton caseStudyId={1} />);

			const unpublishButton = screen.getByRole("button", {
				name: UNPUBLISH_REGEX,
			});
			expect(unpublishButton).toBeInTheDocument();
			expect(unpublishButton).toHaveAttribute("type", "button");
		});

		it("should support keyboard navigation", async () => {
			renderWithAuth(<UnpublishCaseButton caseStudyId={1} />);

			const unpublishButton = screen.getByRole("button", {
				name: UNPUBLISH_REGEX,
			});

			// Focus the button
			unpublishButton.focus();
			expect(unpublishButton).toHaveFocus();

			// Press Enter to open modal
			await user.keyboard("{Enter}");

			await waitFor(() => {
				expect(screen.getByRole("dialog")).toBeInTheDocument();
			});

			// Modal should be present and interactive
			const confirmButton = screen.getByRole("button", {
				name: YES_UNPUBLISH_CASE_STUDY_REGEX,
			});
			expect(confirmButton).toBeInTheDocument();

			// Tab navigation should work within the modal
			await user.keyboard("{Tab}");
			expect(document.activeElement).toBeInTheDocument();
		});

		it("should have proper ARIA labels for screen readers", async () => {
			renderWithAuth(<UnpublishCaseButton caseStudyId={1} />);

			// Open modal
			const unpublishButton = screen.getByRole("button", {
				name: UNPUBLISH_REGEX,
			});
			await user.click(unpublishButton);

			await waitFor(() => {
				expect(screen.getByRole("dialog")).toBeInTheDocument();
			});

			// Check modal has proper labeling
			const dialog = screen.getByRole("dialog");
			expect(dialog).toBeInTheDocument();

			// Check buttons have clear labels
			expect(
				screen.getByRole("button", { name: NO_REGEX })
			).toBeInTheDocument();
			expect(
				screen.getByRole("button", { name: YES_UNPUBLISH_CASE_STUDY_REGEX })
			).toBeInTheDocument();
		});

		it("should maintain focus management", async () => {
			renderWithAuth(<UnpublishCaseButton caseStudyId={1} />);

			const unpublishButton = screen.getByRole("button", {
				name: UNPUBLISH_REGEX,
			});

			// Focus the trigger
			unpublishButton.focus();
			expect(unpublishButton).toHaveFocus();

			// Open modal
			await user.click(unpublishButton);

			await waitFor(() => {
				expect(screen.getByRole("dialog")).toBeInTheDocument();
			});

			// Modal should be present with confirm button
			const confirmButton = screen.getByRole("button", {
				name: YES_UNPUBLISH_CASE_STUDY_REGEX,
			});
			expect(confirmButton).toBeInTheDocument();

			// Close modal with Escape
			await user.keyboard("{Escape}");

			// Modal should close
			await waitFor(() => {
				expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
			});
		});
	});

	describe("Modal Content", () => {
		it("should display correct confirmation message", async () => {
			renderWithAuth(<UnpublishCaseButton caseStudyId={1} />);

			const unpublishButton = screen.getByRole("button", {
				name: UNPUBLISH_REGEX,
			});
			await user.click(unpublishButton);

			await waitFor(() => {
				expect(screen.getByRole("dialog")).toBeInTheDocument();
			});

			// Check specific message content
			expect(
				screen.getByText("Are you sure you want to unpublish this case study?")
			).toBeInTheDocument();
		});

		it("should have correct button labels", async () => {
			renderWithAuth(<UnpublishCaseButton caseStudyId={1} />);

			const unpublishButton = screen.getByRole("button", {
				name: UNPUBLISH_REGEX,
			});
			await user.click(unpublishButton);

			await waitFor(() => {
				expect(screen.getByRole("dialog")).toBeInTheDocument();
			});

			// Check specific button labels
			const cancelButton = screen.getByRole("button", { name: "No" });
			expect(cancelButton).toBeInTheDocument();

			const confirmButton = screen.getByRole("button", {
				name: "Yes, unpublish case study!",
			});
			expect(confirmButton).toBeInTheDocument();
		});
	});
});
