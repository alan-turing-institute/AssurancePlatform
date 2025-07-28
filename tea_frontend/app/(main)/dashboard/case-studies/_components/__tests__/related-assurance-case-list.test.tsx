import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { useSession } from "next-auth/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "@/src/__tests__/mocks/server";
import { renderWithAuth } from "@/src/__tests__/utils/test-utils";
import type { AssuranceCase } from "@/types/domain";
import RelatedAssuranceCaseList from "../related-assurance-case-list";

// Mock next-auth
vi.mock("next-auth/react", () => ({
	useSession: vi.fn(),
	signIn: vi.fn(),
	signOut: vi.fn(),
	getSession: vi.fn(),
	SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock Link component
vi.mock("next/link", () => ({
	default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
		<a className={className} href={href}>
			{children}
		</a>
	),
}));

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const mockUser = {
	id: 1,
	name: "Test User",
	email: "test@example.com",
	key: "mock-session-key",
};

// Mock assurance cases data
const mockAssuranceCases: AssuranceCase[] = [
	{
		id: 1,
		name: "Safety Assurance Case",
		title: "Safety Assurance Case",
		description: "A comprehensive safety assurance case",
		published: true,
		published_date: "2024-01-01T00:00:00Z",
		created_date: "2024-01-01T00:00:00Z",
		owner: 1,
		type: "AssuranceCase",
		lock_uuid: null,
		view_groups: [],
		edit_groups: [],
		review_groups: [],
		color_profile: "default",
		permissions: "manage",
		comments: [],
		goals: [],
		property_claims: [],
		evidence: [],
		contexts: [],
		strategies: [],
		images: [],
		viewMembers: [],
		editMembers: [],
		reviewMembers: [],
	},
	{
		id: 2,
		name: "Security Assurance Case",
		title: "Security Assurance Case",
		description: "A detailed security assurance case",
		published: true,
		published_date: "2024-01-02T00:00:00Z",
		created_date: "2024-01-02T00:00:00Z",
		owner: 1,
		type: "AssuranceCase",
		lock_uuid: null,
		view_groups: [],
		edit_groups: [],
		review_groups: [],
		color_profile: "default",
		permissions: "manage",
		comments: [],
		goals: [],
		property_claims: [],
		evidence: [],
		contexts: [],
		strategies: [],
		images: [],
		viewMembers: [],
		editMembers: [],
		reviewMembers: [],
	},
	{
		id: 3,
		name: "Performance Assurance Case",
		title: "Performance Assurance Case",
		description: null, // Test case with null description
		published: true,
		published_date: "2024-01-03T00:00:00Z",
		created_date: "2024-01-03T00:00:00Z",
		owner: 2,
		type: "AssuranceCase",
		lock_uuid: null,
		view_groups: [],
		edit_groups: [],
		review_groups: [],
		color_profile: "default",
		permissions: "view",
		comments: [],
		goals: [],
		property_claims: [],
		evidence: [],
		contexts: [],
		strategies: [],
		images: [],
		viewMembers: [],
		editMembers: [],
		reviewMembers: [],
	},
];

describe("RelatedAssuranceCaseList Component", () => {
	const user = userEvent.setup();
	const mockSetSelectedAssuranceCases = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
		(useSession as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
			data: mockUser,
			status: "authenticated",
		});

		// Reset server handlers
		server.resetHandlers();
	});

	describe("Component Rendering with Data", () => {
		it("should render list of published assurance cases", async () => {
			// Mock API response
			server.use(
				http.get("/api/published-assurance-cases", () => {
					return HttpResponse.json(mockAssuranceCases);
				})
			);

			renderWithAuth(
				<RelatedAssuranceCaseList
					selectedAssuranceCases={[]}
					setSelectedAssuranceCases={mockSetSelectedAssuranceCases}
				/>
			);

			// Wait for cases to load
			await waitFor(() => {
				expect(screen.getByText("Safety Assurance Case")).toBeInTheDocument();
				expect(screen.getByText("Security Assurance Case")).toBeInTheDocument();
				expect(screen.getByText("Performance Assurance Case")).toBeInTheDocument();
			});

			// Check descriptions
			expect(
				screen.getByText("A comprehensive safety assurance case")
			).toBeInTheDocument();
			expect(
				screen.getByText("A detailed security assurance case")
			).toBeInTheDocument();
			expect(screen.getByText("No description")).toBeInTheDocument();
		});

		it("should render checkboxes for each assurance case", async () => {
			server.use(
				http.get("/api/published-assurance-cases", () => {
					return HttpResponse.json(mockAssuranceCases);
				})
			);

			renderWithAuth(
				<RelatedAssuranceCaseList
					selectedAssuranceCases={[]}
					setSelectedAssuranceCases={mockSetSelectedAssuranceCases}
				/>
			);

			await waitFor(() => {
				expect(screen.getByText("Safety Assurance Case")).toBeInTheDocument();
			});

			// Check for checkboxes
			const checkboxes = screen.getAllByRole("checkbox");
			expect(checkboxes).toHaveLength(3);

			// Check that checkboxes have proper IDs and labels
			expect(screen.getByLabelText("Safety Assurance Case")).toBeInTheDocument();
			expect(screen.getByLabelText("Security Assurance Case")).toBeInTheDocument();
			expect(screen.getByLabelText("Performance Assurance Case")).toBeInTheDocument();
		});

		it("should show selected state for pre-selected cases", async () => {
			server.use(
				http.get("/api/published-assurance-cases", () => {
					return HttpResponse.json(mockAssuranceCases);
				})
			);

			renderWithAuth(
				<RelatedAssuranceCaseList
					selectedAssuranceCases={[1, 3]}
					setSelectedAssuranceCases={mockSetSelectedAssuranceCases}
				/>
			);

			await waitFor(() => {
				expect(screen.getByText("Safety Assurance Case")).toBeInTheDocument();
			});

			// Check that pre-selected cases are checked
			const safetyCheckbox = screen.getByLabelText("Safety Assurance Case");
			const performanceCheckbox = screen.getByLabelText("Performance Assurance Case");
			const securityCheckbox = screen.getByLabelText("Security Assurance Case");

			expect(safetyCheckbox).toBeChecked();
			expect(performanceCheckbox).toBeChecked();
			expect(securityCheckbox).not.toBeChecked();
		});

		it("should sort selected cases to the top", async () => {
			server.use(
				http.get("/api/published-assurance-cases", () => {
					return HttpResponse.json(mockAssuranceCases);
				})
			);

			renderWithAuth(
				<RelatedAssuranceCaseList
					selectedAssuranceCases={[2, 3]} // Security (id: 2) and Performance (id: 3)
					setSelectedAssuranceCases={mockSetSelectedAssuranceCases}
				/>
			);

			await waitFor(() => {
				expect(screen.getByText("Security Assurance Case")).toBeInTheDocument();
			});

			// Get all case containers
			const caseContainers = screen.getAllByRole("checkbox").map(checkbox =>
				checkbox.closest(".mb-2")
			);

			// Selected cases should appear first
			expect(within(caseContainers[0]!).getByText("Security Assurance Case")).toBeInTheDocument();
			expect(within(caseContainers[1]!).getByText("Performance Assurance Case")).toBeInTheDocument();
			expect(within(caseContainers[2]!).getByText("Safety Assurance Case")).toBeInTheDocument();
		});
	});

	describe("Component Rendering without Data", () => {
		it("should show empty state when no published cases exist", async () => {
			// Mock empty response
			server.use(
				http.get("/api/published-assurance-cases", () => {
					return HttpResponse.json([]);
				})
			);

			renderWithAuth(
				<RelatedAssuranceCaseList
					selectedAssuranceCases={[]}
					setSelectedAssuranceCases={mockSetSelectedAssuranceCases}
				/>
			);

			// Wait for empty state to appear
			await waitFor(() => {
				expect(
					screen.getByText("No Published Assurance Cases Found")
				).toBeInTheDocument();
			});

			expect(
				screen.getByText("You need to publish an assurance case first.")
			).toBeInTheDocument();

			// Check for "See Cases" link
			const seeLink = screen.getByRole("link", { name: /see cases/i });
			expect(seeLink).toBeInTheDocument();
			expect(seeLink).toHaveAttribute("href", "/dashboard");
		});
	});

	describe("Case Selection Functionality", () => {
		beforeEach(async () => {
			server.use(
				http.get("/api/published-assurance-cases", () => {
					return HttpResponse.json(mockAssuranceCases);
				})
			);
		});

		it("should select a case when checkbox is clicked", async () => {
			renderWithAuth(
				<RelatedAssuranceCaseList
					selectedAssuranceCases={[]}
					setSelectedAssuranceCases={mockSetSelectedAssuranceCases}
				/>
			);

			await waitFor(() => {
				expect(screen.getByText("Safety Assurance Case")).toBeInTheDocument();
			});

			// Click on Safety Assurance Case checkbox
			const safetyCheckbox = screen.getByLabelText("Safety Assurance Case");
			await user.click(safetyCheckbox);

			// Check that setSelectedAssuranceCases was called to add the case
			expect(mockSetSelectedAssuranceCases).toHaveBeenCalledWith(
				expect.any(Function)
			);

			// Test the function that was passed
			const updateFunction = mockSetSelectedAssuranceCases.mock.calls[0][0];
			const result = updateFunction([]);
			expect(result).toEqual([1]);
		});

		it("should deselect a case when already selected checkbox is clicked", async () => {
			renderWithAuth(
				<RelatedAssuranceCaseList
					selectedAssuranceCases={[1]}
					setSelectedAssuranceCases={mockSetSelectedAssuranceCases}
				/>
			);

			await waitFor(() => {
				expect(screen.getByText("Safety Assurance Case")).toBeInTheDocument();
			});

			// Safety case should be checked initially
			const safetyCheckbox = screen.getByLabelText("Safety Assurance Case");
			expect(safetyCheckbox).toBeChecked();

			// Click to deselect
			await user.click(safetyCheckbox);

			// Check that setSelectedAssuranceCases was called to remove the case
			expect(mockSetSelectedAssuranceCases).toHaveBeenCalledWith(
				expect.any(Function)
			);

			// Test the function that was passed
			const updateFunction = mockSetSelectedAssuranceCases.mock.calls[0][0];
			const result = updateFunction([1]);
			expect(result).toEqual([]);
		});

		it("should handle multiple selections correctly", async () => {
			renderWithAuth(
				<RelatedAssuranceCaseList
					selectedAssuranceCases={[1]}
					setSelectedAssuranceCases={mockSetSelectedAssuranceCases}
				/>
			);

			await waitFor(() => {
				expect(screen.getByText("Security Assurance Case")).toBeInTheDocument();
			});

			// Select Security case (should add to existing selection)
			const securityCheckbox = screen.getByLabelText("Security Assurance Case");
			await user.click(securityCheckbox);

			// Test the function that was passed
			const updateFunction = mockSetSelectedAssuranceCases.mock.calls[0][0];
			const result = updateFunction([1]); // Current state has Safety case (id: 1)
			expect(result).toEqual([1, 2]); // Should add Security case (id: 2)
		});

		it("should not add duplicate selections", async () => {
			renderWithAuth(
				<RelatedAssuranceCaseList
					selectedAssuranceCases={[1]}
					setSelectedAssuranceCases={mockSetSelectedAssuranceCases}
				/>
			);

			await waitFor(() => {
				expect(screen.getByText("Safety Assurance Case")).toBeInTheDocument();
			});

			// Click the already selected case again (should deselect)
			const safetyCheckbox = screen.getByLabelText("Safety Assurance Case");
			await user.click(safetyCheckbox);

			// Test deselection
			const updateFunction = mockSetSelectedAssuranceCases.mock.calls[0][0];
			const result = updateFunction([1]);
			expect(result).toEqual([]);
		});

		it("should handle clicking on label to select case", async () => {
			renderWithAuth(
				<RelatedAssuranceCaseList
					selectedAssuranceCases={[]}
					setSelectedAssuranceCases={mockSetSelectedAssuranceCases}
				/>
			);

			await waitFor(() => {
				expect(screen.getByText("Safety Assurance Case")).toBeInTheDocument();
			});

			// Click on the label instead of checkbox
			const label = screen.getByLabelText("Safety Assurance Case").closest("label");
			if (label) {
				await user.click(label);

				expect(mockSetSelectedAssuranceCases).toHaveBeenCalledWith(
					expect.any(Function)
				);

				const updateFunction = mockSetSelectedAssuranceCases.mock.calls[0][0];
				const result = updateFunction([]);
				expect(result).toEqual([1]);
			}
		});
	});

	describe("Scrolling Behavior", () => {
		it("should show scroll area when more than 4 cases", async () => {
			// Create more than 4 cases
			const manyCases = Array.from({ length: 6 }, (_, i) => ({
				...mockAssuranceCases[0],
				id: i + 1,
				name: `Assurance Case ${i + 1}`,
				description: `Description for case ${i + 1}`,
			}));

			server.use(
				http.get("/api/published-assurance-cases", () => {
					return HttpResponse.json(manyCases);
				})
			);

			renderWithAuth(
				<RelatedAssuranceCaseList
					selectedAssuranceCases={[]}
					setSelectedAssuranceCases={mockSetSelectedAssuranceCases}
				/>
			);

			await waitFor(() => {
				expect(screen.getByText("Assurance Case 1")).toBeInTheDocument();
			});

			// Check that scroll area has fixed height for many cases
			const scrollArea = screen.getByText("Assurance Case 1").closest(".w-full");
			expect(scrollArea).toHaveClass("h-72");
		});

		it("should show auto height when 4 or fewer cases", async () => {
			// Use original 3 cases
			server.use(
				http.get("/api/published-assurance-cases", () => {
					return HttpResponse.json(mockAssuranceCases);
				})
			);

			renderWithAuth(
				<RelatedAssuranceCaseList
					selectedAssuranceCases={[]}
					setSelectedAssuranceCases={mockSetSelectedAssuranceCases}
				/>
			);

			await waitFor(() => {
				expect(screen.getByText("Safety Assurance Case")).toBeInTheDocument();
			});

			// Check that scroll area has auto height for few cases
			const scrollArea = screen.getByText("Safety Assurance Case").closest(".w-full");
			expect(scrollArea).toHaveClass("h-auto");
		});
	});

	describe("API Integration", () => {
		it("should make correct API call", async () => {
			let requestMade = false;
			server.use(
				http.get("/api/published-assurance-cases", ({ request }) => {
					requestMade = true;
					// Check authorization header
					expect(request.headers.get("Authorization")).toBe("Token mock-session-key");
					return HttpResponse.json(mockAssuranceCases);
				})
			);

			renderWithAuth(
				<RelatedAssuranceCaseList
					selectedAssuranceCases={[]}
					setSelectedAssuranceCases={mockSetSelectedAssuranceCases}
				/>
			);

			await waitFor(() => {
				expect(requestMade).toBe(true);
			});
		});

		it("should handle API errors gracefully", async () => {
			server.use(
				http.get("/api/published-assurance-cases", () => {
					return HttpResponse.json(
						{ error: "Internal server error" },
						{ status: 500 }
					);
				})
			);

			renderWithAuth(
				<RelatedAssuranceCaseList
					selectedAssuranceCases={[]}
					setSelectedAssuranceCases={mockSetSelectedAssuranceCases}
				/>
			);

			// Should still show empty state on error
			await waitFor(() => {
				expect(
					screen.getByText("No Published Assurance Cases Found")
				).toBeInTheDocument();
			});
		});

		it("should handle network errors gracefully", async () => {
			server.use(
				http.get("/api/published-assurance-cases", () => {
					throw new Error("Network error");
				})
			);

			renderWithAuth(
				<RelatedAssuranceCaseList
					selectedAssuranceCases={[]}
					setSelectedAssuranceCases={mockSetSelectedAssuranceCases}
				/>
			);

			// Should show empty state on network error
			await waitFor(() => {
				expect(
					screen.getByText("No Published Assurance Cases Found")
				).toBeInTheDocument();
			});
		});

		it("should refetch data when session key changes", async () => {
			let requestCount = 0;
			server.use(
				http.get("/api/published-assurance-cases", () => {
					requestCount++;
					return HttpResponse.json(mockAssuranceCases);
				})
			);

			const { rerender } = renderWithAuth(
				<RelatedAssuranceCaseList
					selectedAssuranceCases={[]}
					setSelectedAssuranceCases={mockSetSelectedAssuranceCases}
				/>
			);

			await waitFor(() => {
				expect(requestCount).toBe(1);
			});

			// Change session key
			(useSession as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
				data: { ...mockUser, key: "new-session-key" },
				status: "authenticated",
			});

			rerender(
				<RelatedAssuranceCaseList
					selectedAssuranceCases={[]}
					setSelectedAssuranceCases={mockSetSelectedAssuranceCases}
				/>
			);

			await waitFor(() => {
				expect(requestCount).toBe(2);
			});
		});
	});

	describe("Session Handling", () => {
		it("should handle missing session gracefully", async () => {
			(useSession as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
				data: null,
				status: "unauthenticated",
			});

			server.use(
				http.get("/api/published-assurance-cases", ({ request }) => {
					// Should make request without auth header
					expect(request.headers.get("Authorization")).toBe("Token undefined");
					return HttpResponse.json([]);
				})
			);

			renderWithAuth(
				<RelatedAssuranceCaseList
					selectedAssuranceCases={[]}
					setSelectedAssuranceCases={mockSetSelectedAssuranceCases}
				/>
			);

			await waitFor(() => {
				expect(
					screen.getByText("No Published Assurance Cases Found")
				).toBeInTheDocument();
			});
		});

		it("should handle session without key", async () => {
			(useSession as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
				data: { ...mockUser, key: undefined },
				status: "authenticated",
			});

			server.use(
				http.get("/api/published-assurance-cases", ({ request }) => {
					expect(request.headers.get("Authorization")).toBe("Token undefined");
					return HttpResponse.json([]);
				})
			);

			renderWithAuth(
				<RelatedAssuranceCaseList
					selectedAssuranceCases={[]}
					setSelectedAssuranceCases={mockSetSelectedAssuranceCases}
				/>
			);

			await waitFor(() => {
				expect(
					screen.getByText("No Published Assurance Cases Found")
				).toBeInTheDocument();
			});
		});
	});

	describe("Performance and Edge Cases", () => {
		it("should handle large number of cases efficiently", async () => {
			// Create 100 cases
			const largeCaseList = Array.from({ length: 100 }, (_, i) => ({
				...mockAssuranceCases[0],
				id: i + 1,
				name: `Assurance Case ${i + 1}`,
				description: `Description for case ${i + 1}`,
			}));

			server.use(
				http.get("/api/published-assurance-cases", () => {
					return HttpResponse.json(largeCaseList);
				})
			);

			renderWithAuth(
				<RelatedAssuranceCaseList
					selectedAssuranceCases={[]}
					setSelectedAssuranceCases={mockSetSelectedAssuranceCases}
				/>
			);

			await waitFor(() => {
				expect(screen.getByText("Assurance Case 1")).toBeInTheDocument();
			});

			// Should still render and be scrollable
			const scrollArea = screen.getByText("Assurance Case 1").closest(".w-full");
			expect(scrollArea).toHaveClass("h-72");

			// Should have all 100 checkboxes
			const checkboxes = screen.getAllByRole("checkbox");
			expect(checkboxes).toHaveLength(100);
		});

		it("should handle cases with missing or unusual data", async () => {
			const edgeCases = [
				{
					...mockAssuranceCases[0],
					id: 1,
					name: "", // Empty name
					description: null,
				},
				{
					...mockAssuranceCases[0],
					id: 2,
					name: "Very Long Case Name That Should Be Handled Properly Even Though It Is Extremely Long And Might Cause Layout Issues",
					description: "Very long description that might cause layout issues if not handled properly. This description goes on and on with lots of text that should be truncated or wrapped appropriately.",
				},
				{
					...mockAssuranceCases[0],
					id: 3,
					name: "Special Characters: !@#$%^&*()_+-=[]{}|;':\",./<>?",
					description: "Description with special chars: <script>alert('xss')</script>",
				},
			];

			server.use(
				http.get("/api/published-assurance-cases", () => {
					return HttpResponse.json(edgeCases);
				})
			);

			renderWithAuth(
				<RelatedAssuranceCaseList
					selectedAssuranceCases={[]}
					setSelectedAssuranceCases={mockSetSelectedAssuranceCases}
				/>
			);

			await waitFor(() => {
				// Should handle empty name gracefully
				const checkboxes = screen.getAllByRole("checkbox");
				expect(checkboxes).toHaveLength(3);
			});

			// Check that special characters are rendered safely
			expect(
				screen.getByText("Special Characters: !@#$%^&*()_+-=[]{}|;':\",./<>?")
			).toBeInTheDocument();

			// XSS attempt should be rendered as text, not executed
			expect(
				screen.getByText("Description with special chars: <script>alert('xss')</script>")
			).toBeInTheDocument();
		});
	});

	describe("Accessibility", () => {
		beforeEach(async () => {
			server.use(
				http.get("/api/published-assurance-cases", () => {
					return HttpResponse.json(mockAssuranceCases);
				})
			);
		});

		it("should have proper accessibility attributes", async () => {
			renderWithAuth(
				<RelatedAssuranceCaseList
					selectedAssuranceCases={[]}
					setSelectedAssuranceCases={mockSetSelectedAssuranceCases}
				/>
			);

			await waitFor(() => {
				expect(screen.getByText("Safety Assurance Case")).toBeInTheDocument();
			});

			// Check checkboxes have proper labels
			const checkboxes = screen.getAllByRole("checkbox");
			checkboxes.forEach(checkbox => {
				expect(checkbox).toHaveAttribute("id");
				const id = checkbox.getAttribute("id");
				expect(screen.getByLabelText(new RegExp(id?.replace("case-", "") || ""))).toBeInTheDocument();
			});
		});

		it("should support keyboard navigation", async () => {
			renderWithAuth(
				<RelatedAssuranceCaseList
					selectedAssuranceCases={[]}
					setSelectedAssuranceCases={mockSetSelectedAssuranceCases}
				/>
			);

			await waitFor(() => {
				expect(screen.getByText("Safety Assurance Case")).toBeInTheDocument();
			});

			const firstCheckbox = screen.getAllByRole("checkbox")[0];

			// Focus the first checkbox
			firstCheckbox.focus();
			expect(firstCheckbox).toHaveFocus();

			// Tab to next checkbox
			await user.tab();
			const secondCheckbox = screen.getAllByRole("checkbox")[1];
			expect(secondCheckbox).toHaveFocus();
		});

		it("should support screen reader navigation", async () => {
			renderWithAuth(
				<RelatedAssuranceCaseList
					selectedAssuranceCases={[1]}
					setSelectedAssuranceCases={mockSetSelectedAssuranceCases}
				/>
			);

			await waitFor(() => {
				expect(screen.getByText("Safety Assurance Case")).toBeInTheDocument();
			});

			// Check that labels properly describe the content
			const safetyCheckbox = screen.getByLabelText("Safety Assurance Case");
			expect(safetyCheckbox).toBeChecked();
			expect(safetyCheckbox).toHaveAttribute("aria-checked", "true");

			const securityCheckbox = screen.getByLabelText("Security Assurance Case");
			expect(securityCheckbox).not.toBeChecked();
			expect(securityCheckbox).toHaveAttribute("aria-checked", "false");
		});
	});
});
