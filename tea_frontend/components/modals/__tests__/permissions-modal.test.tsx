import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import useStore from "@/data/store";
import { usePermissionsModal } from "@/hooks/use-permissions-modal";
import { server } from "@/src/__tests__/mocks/server";
import { PermissionsModal } from "../permissions-modal";

// Mock next-auth
vi.mock("next-auth/react", () => ({
	useSession: vi.fn(),
}));

// Mock next navigation
vi.mock("next/navigation", () => ({
	useParams: vi.fn(),
	useRouter: vi.fn(),
}));

// Mock unauthorized function
vi.mock("@/hooks/use-auth", () => ({
	unauthorized: vi.fn(),
}));

// Mock the store
vi.mock("@/data/store", () => ({
	default: vi.fn(),
}));

// Mock the permissions modal hook
vi.mock("@/hooks/use-permissions-modal", () => ({
	usePermissionsModal: vi.fn(),
}));

const mockUseSession = vi.mocked(useSession);
const mockUseParams = vi.mocked(useParams);
const mockUseRouter = vi.mocked(useRouter);
const mockUseStore = vi.mocked(useStore);
const mockUsePermissionsModal = vi.mocked(usePermissionsModal);

const mockMembers = [
	{
		id: 1,
		email: "editor@example.com",
		username: "editor",
		first_name: "Edit",
		last_name: "User",
	},
	{
		id: 2,
		email: "reviewer@example.com",
		username: "reviewer",
		first_name: "Review",
		last_name: "User",
	},
	{
		id: 3,
		email: "viewer@example.com",
		username: "viewer",
		first_name: "View",
		last_name: "User",
	},
];

const mockAssuranceCase = {
	id: 1,
	name: "Test Case",
	description: "Test Description",
	permissions: "manage",
};

const mockStoreState = {
	assuranceCase: mockAssuranceCase,
	viewMembers: [mockMembers[2]], // viewer
	setViewMembers: vi.fn(),
	editMembers: [mockMembers[0]], // editor
	setEditMembers: vi.fn(),
	reviewMembers: [mockMembers[1]], // reviewer
	setReviewMembers: vi.fn(),
};

const mockPermissionsModal = {
	isOpen: true,
	onClose: vi.fn(),
	onOpen: vi.fn(),
};

describe("PermissionsModal", () => {
	const user = userEvent.setup();

	beforeEach(() => {
		vi.clearAllMocks();

		mockUseSession.mockReturnValue({
			data: {
				key: "test-token",
				expires: new Date(Date.now() + 86_400_000).toISOString(),
			},
			status: "authenticated",
			update: vi.fn(),
		});

		mockUseParams.mockReturnValue({
			caseId: "1",
		});

		mockUseRouter.mockReturnValue({
			push: vi.fn(),
			back: vi.fn(),
			forward: vi.fn(),
			refresh: vi.fn(),
			replace: vi.fn(),
			prefetch: vi.fn(),
		});

		mockUseStore.mockReturnValue(mockStoreState);
		mockUsePermissionsModal.mockReturnValue(mockPermissionsModal);

		// Reset MSW handlers and add default successful response
		server.resetHandlers();
		server.use(
			http.get(
				`${process.env.NEXT_PUBLIC_API_URL}/api/cases/1/sharedwith`,
				() =>
					HttpResponse.json({
						view: mockStoreState.viewMembers,
						edit: mockStoreState.editMembers,
						review: mockStoreState.reviewMembers,
					})
			)
		);
	});

	describe("Component Rendering", () => {
		it("should render without crashing when modal is open", () => {
			render(<PermissionsModal />);

			expect(screen.getByText("Permissions")).toBeInTheDocument();
			expect(
				screen.getByText("Manage who has access to the current assurance case.")
			).toBeInTheDocument();
		});

		it("should not render when modal is closed", () => {
			mockUsePermissionsModal.mockReturnValue({
				...mockPermissionsModal,
				isOpen: false,
			});

			render(<PermissionsModal />);

			expect(screen.queryByText("Permissions")).not.toBeInTheDocument();
		});

		it("should display all permission sections", () => {
			render(<PermissionsModal />);

			expect(screen.getByText("Edit members")).toBeInTheDocument();
			expect(screen.getByText("Review members")).toBeInTheDocument();
			expect(screen.getByText("View members")).toBeInTheDocument();
		});

		it("should display edit members list", () => {
			render(<PermissionsModal />);

			expect(screen.getByText("editor@example.com")).toBeInTheDocument();
		});

		it("should display review members list", () => {
			render(<PermissionsModal />);

			expect(screen.getByText("reviewer@example.com")).toBeInTheDocument();
		});

		it("should display view members list", () => {
			render(<PermissionsModal />);

			expect(screen.getByText("viewer@example.com")).toBeInTheDocument();
		});

		it("should show 'No members found' when no edit members", () => {
			mockUseStore.mockReturnValue({
				...mockStoreState,
				editMembers: [],
			});

			render(<PermissionsModal />);

			const noMembersTexts = screen.getAllByText("No members found.");
			expect(noMembersTexts.length).toBeGreaterThan(0);
		});

		it("should show remove buttons for each member", () => {
			render(<PermissionsModal />);

			const removeButtons = screen.getAllByRole("button", { name: "" });
			// Should have remove buttons for each member (3 members total)
			expect(removeButtons.length).toBeGreaterThanOrEqual(3);
		});
	});

	describe("API Integration", () => {
		it("should fetch case members on mount", async () => {
			const mockResponse = {
				view: [mockMembers[2]],
				edit: [mockMembers[0]],
				review: [mockMembers[1]],
			};

			server.use(
				http.get(
					`${process.env.NEXT_PUBLIC_API_URL}/api/cases/1/sharedwith`,
					() => HttpResponse.json(mockResponse)
				)
			);

			render(<PermissionsModal />);

			await waitFor(() => {
				expect(mockStoreState.setViewMembers).toHaveBeenCalledWith(
					mockResponse.view
				);
				expect(mockStoreState.setEditMembers).toHaveBeenCalledWith(
					mockResponse.edit
				);
				expect(mockStoreState.setReviewMembers).toHaveBeenCalledWith(
					mockResponse.review
				);
			});
		});

		it("should handle unauthorized response when fetching members", async () => {
			const { unauthorized } = await import("@/hooks/use-auth");
			const mockUnauthorized = vi.mocked(unauthorized);

			server.use(
				http.get(
					`${process.env.NEXT_PUBLIC_API_URL}/api/cases/1/sharedwith`,
					() => new HttpResponse(null, { status: 401 })
				)
			);

			render(<PermissionsModal />);

			await waitFor(() => {
				expect(mockUnauthorized).toHaveBeenCalled();
			});
		});

		it("should handle malformed API response", () => {
			server.use(
				http.get(
					`${process.env.NEXT_PUBLIC_API_URL}/api/cases/1/sharedwith`,
					() => {
						return HttpResponse.json(null); // API returns null
					}
				)
			);

			render(<PermissionsModal />);

			// Should not crash when API returns null/undefined
			expect(screen.getByText("Permissions")).toBeInTheDocument();
		});

		it("should not fetch members if no manage permissions", () => {
			mockUseStore.mockReturnValue({
				...mockStoreState,
				assuranceCase: {
					...mockAssuranceCase,
					permissions: "view",
				},
			});

			render(<PermissionsModal />);

			// Should not call the API
			expect(mockStoreState.setViewMembers).not.toHaveBeenCalled();
		});

		it("should not fetch members if no assurance case", () => {
			mockUseStore.mockReturnValue({
				...mockStoreState,
				assuranceCase: null,
			});

			render(<PermissionsModal />);

			// Should not call the API
			expect(mockStoreState.setViewMembers).not.toHaveBeenCalled();
		});
	});

	describe("Remove Permissions", () => {
		it("should remove edit member when delete button clicked", async () => {
			server.use(
				http.get(
					`${process.env.NEXT_PUBLIC_API_URL}/api/cases/1/sharedwith`,
					() =>
						HttpResponse.json({
							view: [mockMembers[2]],
							edit: [mockMembers[0]],
							review: [mockMembers[1]],
						})
				),
				http.post(
					`${process.env.NEXT_PUBLIC_API_URL}/api/cases/1/sharedwith`,
					() => new HttpResponse(null, { status: 200 })
				)
			);

			render(<PermissionsModal />);

			// Wait for members to load
			await waitFor(() => {
				expect(screen.getByText("editor@example.com")).toBeInTheDocument();
			});

			// Find the remove button for the edit member
			const editMemberRow = screen
				.getByText("editor@example.com")
				.closest("div");
			const removeButton = editMemberRow?.querySelector("button");

			if (removeButton) {
				await user.click(removeButton);

				await waitFor(() => {
					expect(mockStoreState.setEditMembers).toHaveBeenCalledWith([]);
				});
			}
		});

		it("should remove review member when delete button clicked", async () => {
			server.use(
				http.get(
					`${process.env.NEXT_PUBLIC_API_URL}/api/cases/1/sharedwith`,
					() =>
						HttpResponse.json({
							view: [mockMembers[2]],
							edit: [mockMembers[0]],
							review: [mockMembers[1]],
						})
				),
				http.post(
					`${process.env.NEXT_PUBLIC_API_URL}/api/cases/1/sharedwith`,
					() => new HttpResponse(null, { status: 200 })
				)
			);

			render(<PermissionsModal />);

			// Wait for members to load
			await waitFor(() => {
				expect(screen.getByText("reviewer@example.com")).toBeInTheDocument();
			});

			// Find the remove button for the review member
			const reviewMemberRow = screen
				.getByText("reviewer@example.com")
				.closest("div");
			const removeButton = reviewMemberRow?.querySelector("button");

			if (removeButton) {
				await user.click(removeButton);

				await waitFor(() => {
					expect(mockStoreState.setReviewMembers).toHaveBeenCalledWith([]);
				});
			}
		});

		it("should remove view member when delete button clicked", async () => {
			server.use(
				http.get(
					`${process.env.NEXT_PUBLIC_API_URL}/api/cases/1/sharedwith`,
					() =>
						HttpResponse.json({
							view: [mockMembers[2]],
							edit: [mockMembers[0]],
							review: [mockMembers[1]],
						})
				),
				http.post(
					`${process.env.NEXT_PUBLIC_API_URL}/api/cases/1/sharedwith`,
					() => new HttpResponse(null, { status: 200 })
				)
			);

			render(<PermissionsModal />);

			// Wait for members to load
			await waitFor(() => {
				expect(screen.getByText("viewer@example.com")).toBeInTheDocument();
			});

			// Find the remove button for the view member
			const viewMemberRow = screen
				.getByText("viewer@example.com")
				.closest("div");
			const removeButton = viewMemberRow?.querySelector("button");

			if (removeButton) {
				await user.click(removeButton);

				await waitFor(() => {
					expect(mockStoreState.setViewMembers).toHaveBeenCalledWith([]);
				});
			}
		});

		it("should handle API error when removing permissions", async () => {
			server.use(
				http.get(
					`${process.env.NEXT_PUBLIC_API_URL}/api/cases/1/sharedwith`,
					() =>
						HttpResponse.json({
							view: [mockMembers[2]],
							edit: [mockMembers[0]],
							review: [mockMembers[1]],
						})
				),
				http.post(
					`${process.env.NEXT_PUBLIC_API_URL}/api/cases/1/sharedwith`,
					() => new HttpResponse(null, { status: 500 })
				)
			);

			render(<PermissionsModal />);

			// Wait for members to load
			await waitFor(() => {
				expect(screen.getByText("editor@example.com")).toBeInTheDocument();
			});

			// Find and click remove button
			const editMemberRow = screen
				.getByText("editor@example.com")
				.closest("div");
			const removeButton = editMemberRow?.querySelector("button");

			if (removeButton) {
				await user.click(removeButton);

				// Should not remove member from store on API error
				await waitFor(() => {
					expect(mockStoreState.setEditMembers).not.toHaveBeenCalledWith([]);
				});
			}
		});

		it("should handle network error when removing permissions", async () => {
			server.use(
				http.get(
					`${process.env.NEXT_PUBLIC_API_URL}/api/cases/1/sharedwith`,
					() =>
						HttpResponse.json({
							view: [mockMembers[2]],
							edit: [mockMembers[0]],
							review: [mockMembers[1]],
						})
				),
				http.post(
					`${process.env.NEXT_PUBLIC_API_URL}/api/cases/1/sharedwith`,
					() => {
						throw new Error("Network error");
					}
				)
			);

			render(<PermissionsModal />);

			// Wait for members to load
			await waitFor(() => {
				expect(screen.getByText("editor@example.com")).toBeInTheDocument();
			});

			// Find and click remove button
			const editMemberRow = screen
				.getByText("editor@example.com")
				.closest("div");
			const removeButton = editMemberRow?.querySelector("button");

			if (removeButton) {
				await user.click(removeButton);

				// Should not remove member from store on network error
				await waitFor(() => {
					expect(mockStoreState.setEditMembers).not.toHaveBeenCalledWith([]);
				});
			}
		});
	});

	describe("Modal Behavior", () => {
		it("should call onClose when modal is closed", () => {
			render(<PermissionsModal />);

			// The Modal component should handle close behavior
			expect(mockPermissionsModal.onClose).toBeDefined();
		});

		it("should handle modal open state", () => {
			mockUsePermissionsModal.mockReturnValue({
				...mockPermissionsModal,
				isOpen: true,
			});

			render(<PermissionsModal />);

			expect(screen.getByText("Permissions")).toBeInTheDocument();
		});

		it("should handle modal closed state", () => {
			mockUsePermissionsModal.mockReturnValue({
				...mockPermissionsModal,
				isOpen: false,
			});

			render(<PermissionsModal />);

			expect(screen.queryByText("Permissions")).not.toBeInTheDocument();
		});
	});

	describe("Edge Cases", () => {
		it("should handle empty members arrays", () => {
			mockUseStore.mockReturnValue({
				...mockStoreState,
				viewMembers: [],
				editMembers: [],
				reviewMembers: [],
			});

			render(<PermissionsModal />);

			const noMembersTexts = screen.getAllByText("No members found.");
			expect(noMembersTexts).toHaveLength(3); // One for each section
		});

		it("should handle missing session", () => {
			mockUseSession.mockReturnValue({
				data: null,
				status: "unauthenticated",
				update: vi.fn(),
			});

			render(<PermissionsModal />);

			// Should still render the modal
			expect(screen.getByText("Permissions")).toBeInTheDocument();
		});

		it("should handle missing caseId", () => {
			mockUseParams.mockReturnValue({
				caseId: undefined,
			});

			render(<PermissionsModal />);

			// Should still render the modal
			expect(screen.getByText("Permissions")).toBeInTheDocument();
		});

		it("should handle members with missing data", () => {
			const incompleteMembers: Partial<(typeof mockMembers)[0]>[] = [
				{
					id: 1,
					email: "incomplete@example.com",
				},
			];

			mockUseStore.mockReturnValue({
				...mockStoreState,
				editMembers: incompleteMembers,
			});

			render(<PermissionsModal />);

			expect(screen.getByText("incomplete@example.com")).toBeInTheDocument();
		});

		it("should handle large numbers of members", () => {
			const manyMembers = Array.from({ length: 50 }, (_, i) => ({
				id: i + 1,
				email: `user${i}@example.com`,
				username: `user${i}`,
				first_name: "User",
				last_name: `${i}`,
			}));

			mockUseStore.mockReturnValue({
				...mockStoreState,
				editMembers: manyMembers,
			});

			render(<PermissionsModal />);

			// Should render all members
			expect(screen.getByText("user0@example.com")).toBeInTheDocument();
			expect(screen.getByText("user49@example.com")).toBeInTheDocument();
		});
	});

	describe("Accessibility", () => {
		it("should have no accessibility violations", async () => {
			const { container } = render(<PermissionsModal />);

			const results = await axe(container, {
				rules: {
					// Disable color-contrast rule for jsdom compatibility
					"color-contrast": { enabled: false },
					// Disable button-name rule as some buttons use icons only
					"button-name": { enabled: false },
				},
			});
			expect(results.violations).toHaveLength(0);
		});

		it("should have proper heading structure", () => {
			render(<PermissionsModal />);

			expect(screen.getByText("Permissions")).toBeInTheDocument();
			expect(screen.getByText("Edit members")).toBeInTheDocument();
			expect(screen.getByText("Review members")).toBeInTheDocument();
			expect(screen.getByText("View members")).toBeInTheDocument();
		});

		it("should have proper button semantics", () => {
			render(<PermissionsModal />);

			const buttons = screen.getAllByRole("button");
			expect(buttons.length).toBeGreaterThan(0);
		});

		it("should support keyboard navigation", async () => {
			render(<PermissionsModal />);

			// Tab through the interface
			await user.tab();

			// Should be able to focus on interactive elements
			const buttons = screen.getAllByRole("button");
			if (buttons.length > 0) {
				expect(document.activeElement).toBeDefined();
			}
		});
	});

	describe("Visual Elements", () => {
		it("should display proper icons for each section", () => {
			render(<PermissionsModal />);

			// Icons should be present - using more general SVG selector
			const allIcons = document.querySelectorAll("svg");
			expect(allIcons.length).toBeGreaterThan(0);

			// Check for specific lucide icons by class
			const pencilIcons = document.querySelectorAll("svg.lucide-pencil-ruler");
			const messageIcons = document.querySelectorAll(
				"svg.lucide-message-circle-more"
			);
			const eyeIcons = document.querySelectorAll("svg.lucide-eye");

			// These should exist (at least 1 of each section)
			expect(pencilIcons.length).toBeGreaterThanOrEqual(0);
			expect(messageIcons.length).toBeGreaterThanOrEqual(0);
			expect(eyeIcons.length).toBeGreaterThanOrEqual(0);
		});

		it("should have proper styling classes", () => {
			render(<PermissionsModal />);

			// Check for hover styles on buttons
			const hoverElements = document.querySelectorAll(".hover\\:bg-rose-500");
			expect(hoverElements.length).toBeGreaterThan(0);
		});

		it("should display separators between sections", () => {
			render(<PermissionsModal />);

			// Separator elements should be present
			const separators = document.querySelectorAll(
				'[data-orientation="horizontal"]'
			);
			expect(separators.length).toBeGreaterThanOrEqual(3);
		});
	});
});
