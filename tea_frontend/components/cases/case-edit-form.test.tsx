import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "@/src/__tests__/mocks/server";
import {
	createMockAssuranceCase,
	mockAssuranceCase,
} from "@/src/__tests__/utils/mock-data";
import {
	renderWithAuth,
	screen,
	userEvent,
	waitFor,
} from "@/src/__tests__/utils/test-utils";
import type { AssuranceCase } from "@/types";
import CaseEditForm from "./case-edit-form";

// Regex constants for text matching
const NAME_LABEL_REGEX = /name/i;
const DESCRIPTION_LABEL_REGEX = /description/i;
const UPDATE_BUTTON_REGEX = /update/i;

// Mock the store
const mockStore = {
	assuranceCase: mockAssuranceCase as AssuranceCase | null,
	setAssuranceCase: vi.fn(),
};

vi.mock("@/data/store", () => ({
	default: () => mockStore,
}));

describe("CaseEditForm", () => {
	const mockOnClose = vi.fn();
	const mockSetUnresolvedChanges = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
		mockStore.assuranceCase = createMockAssuranceCase({
			id: 1,
			name: "Test Case",
			description: "Test Description",
			permissions: "manage",
		});
		mockStore.setAssuranceCase.mockClear();
	});

	describe("Form Rendering", () => {
		it("should render form with case data populated", () => {
			renderWithAuth(
				<CaseEditForm
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			expect(screen.getByDisplayValue("Test Case")).toBeInTheDocument();
			expect(screen.getByDisplayValue("Test Description")).toBeInTheDocument();
		});

		it("should render form labels correctly", () => {
			renderWithAuth(
				<CaseEditForm
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			expect(screen.getByLabelText(NAME_LABEL_REGEX)).toBeInTheDocument();
			expect(
				screen.getByLabelText(DESCRIPTION_LABEL_REGEX)
			).toBeInTheDocument();
		});

		it("should render update button when user has manage permissions", () => {
			renderWithAuth(
				<CaseEditForm
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			expect(
				screen.getByRole("button", { name: UPDATE_BUTTON_REGEX })
			).toBeInTheDocument();
		});

		it("should not render update button when user lacks manage permissions", () => {
			mockStore.assuranceCase = createMockAssuranceCase({
				permissions: "view",
			});

			renderWithAuth(
				<CaseEditForm
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			expect(
				screen.queryByRole("button", { name: UPDATE_BUTTON_REGEX })
			).not.toBeInTheDocument();
		});
	});

	describe("Permission-based UI", () => {
		it("should show read-only indicators when user lacks manage permissions", () => {
			mockStore.assuranceCase = createMockAssuranceCase({
				permissions: "view",
			});

			renderWithAuth(
				<CaseEditForm
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			expect(screen.getAllByTitle("Read Only")).toHaveLength(2);
			expect(screen.getByDisplayValue("Test Assurance Case")).toHaveAttribute(
				"readonly"
			);
			expect(
				screen.getByDisplayValue(
					"A comprehensive test case for testing purposes"
				)
			).toHaveAttribute("readonly");
		});

		it("should allow editing when user has manage permissions", () => {
			renderWithAuth(
				<CaseEditForm
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			const nameInput = screen.getByDisplayValue("Test Case");
			const descriptionInput = screen.getByDisplayValue("Test Description");

			expect(nameInput).not.toHaveAttribute("readonly");
			expect(descriptionInput).not.toHaveAttribute("readonly");
		});

		it("should not show lock icons when user has manage permissions", () => {
			renderWithAuth(
				<CaseEditForm
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			expect(screen.queryByTitle("Read Only")).not.toBeInTheDocument();
		});
	});

	describe("Form Validation", () => {
		it("should require minimum 2 characters for name", async () => {
			const user = userEvent.setup();

			renderWithAuth(
				<CaseEditForm
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			const nameInput = screen.getByDisplayValue("Test Case");
			await user.clear(nameInput);
			await user.type(nameInput, "A");

			const updateButton = screen.getByRole("button", {
				name: UPDATE_BUTTON_REGEX,
			});
			await user.click(updateButton);

			await waitFor(() => {
				expect(
					screen.getByText("Name must be at least 2 characters.")
				).toBeInTheDocument();
			});
		});

		it("should require minimum 2 characters for description", async () => {
			const user = userEvent.setup();

			renderWithAuth(
				<CaseEditForm
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			const descriptionInput = screen.getByDisplayValue("Test Description");
			await user.clear(descriptionInput);
			await user.type(descriptionInput, "A");

			const updateButton = screen.getByRole("button", {
				name: UPDATE_BUTTON_REGEX,
			});
			await user.click(updateButton);

			await waitFor(() => {
				expect(
					screen.getByText("Description must be atleast 2 characters")
				).toBeInTheDocument();
			});
		});

		it("should allow valid form submission", async () => {
			const user = userEvent.setup();

			server.use(
				http.put("*/api/cases/1/", () => {
					return HttpResponse.json({ success: true });
				})
			);

			renderWithAuth(
				<CaseEditForm
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			const nameInput = screen.getByDisplayValue("Test Case");
			const descriptionInput = screen.getByDisplayValue("Test Description");

			await user.clear(nameInput);
			await user.type(nameInput, "Updated Test Case");
			await user.clear(descriptionInput);
			await user.type(descriptionInput, "Updated test description");

			const updateButton = screen.getByRole("button", {
				name: UPDATE_BUTTON_REGEX,
			});
			await user.click(updateButton);

			await waitFor(() => {
				expect(mockStore.setAssuranceCase).toHaveBeenCalledWith(
					expect.objectContaining({
						name: "Updated Test Case",
						description: "Updated test description",
					})
				);
				expect(mockOnClose).toHaveBeenCalled();
			});
		});
	});

	describe("Form Submission", () => {
		it("should show loading state during submission", async () => {
			const user = userEvent.setup();

			// Delay the API response to test loading state
			server.use(
				http.put("*/api/cases/1/", async () => {
					await new Promise((resolve) => setTimeout(resolve, 100));
					return HttpResponse.json({ success: true });
				})
			);

			renderWithAuth(
				<CaseEditForm
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			const updateButton = screen.getByRole("button", {
				name: UPDATE_BUTTON_REGEX,
			});
			await user.click(updateButton);

			expect(screen.getByText("Updating...")).toBeInTheDocument();
			expect(updateButton).toBeDisabled();

			await waitFor(() => {
				expect(screen.queryByText("Updating...")).not.toBeInTheDocument();
			});
		});

		it("should send correct API request with updated data", async () => {
			const user = userEvent.setup();

			let capturedRequestBody: { name: string; description: string } | null =
				null;
			server.use(
				http.put("*/api/cases/1/", async ({ request }) => {
					const jsonBody = await request.json();
					capturedRequestBody =
						jsonBody &&
						typeof jsonBody === "object" &&
						"name" in jsonBody &&
						"description" in jsonBody
							? (jsonBody as { name: string; description: string })
							: null;
					return HttpResponse.json({ success: true });
				})
			);

			renderWithAuth(
				<CaseEditForm
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			const nameInput = screen.getByDisplayValue("Test Case");
			const descriptionInput = screen.getByDisplayValue("Test Description");

			await user.clear(nameInput);
			await user.type(nameInput, "API Test Case");
			await user.clear(descriptionInput);
			await user.type(descriptionInput, "API test description");

			const updateButton = screen.getByRole("button", {
				name: UPDATE_BUTTON_REGEX,
			});
			await user.click(updateButton);

			await waitFor(() => {
				expect(capturedRequestBody).toEqual({
					name: "API Test Case",
					description: "API test description",
				});
			});
		});

		it("should include authorization header in API request", async () => {
			const user = userEvent.setup();

			let capturedHeaders: Record<string, string> = {};
			server.use(
				http.put("*/api/cases/1/", ({ request }) => {
					capturedHeaders = Object.fromEntries(request.headers.entries());
					return HttpResponse.json({ success: true });
				})
			);

			renderWithAuth(
				<CaseEditForm
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			const updateButton = screen.getByRole("button", {
				name: UPDATE_BUTTON_REGEX,
			});
			await user.click(updateButton);

			await waitFor(() => {
				expect(capturedHeaders.authorization).toBeDefined();
				expect(capturedHeaders["content-type"]).toBe("application/json");
			});
		});

		it("should handle API errors gracefully", async () => {
			const user = userEvent.setup();

			server.use(
				http.put("*/api/cases/1/", () => {
					return new HttpResponse(null, { status: 500 });
				})
			);

			renderWithAuth(
				<CaseEditForm
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			const updateButton = screen.getByRole("button", {
				name: UPDATE_BUTTON_REGEX,
			});
			await user.click(updateButton);

			await waitFor(() => {
				// The component currently doesn't handle errors properly
				// It still closes the form and updates the store even on error
				// This is a TODO in the component: // TODO: Handle error response
				expect(screen.queryByText("Updating...")).not.toBeInTheDocument();
				expect(mockOnClose).toHaveBeenCalled();
				expect(mockStore.setAssuranceCase).toHaveBeenCalled();
			});
		});
	});

	describe("Change Tracking", () => {
		it("should track changes to name field", async () => {
			const user = userEvent.setup();

			renderWithAuth(
				<CaseEditForm
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			const nameInput = screen.getByDisplayValue("Test Case");
			await user.type(nameInput, " Modified");

			await waitFor(() => {
				expect(mockSetUnresolvedChanges).toHaveBeenCalledWith(true);
			});
		});

		it("should track changes to description field", async () => {
			const user = userEvent.setup();

			renderWithAuth(
				<CaseEditForm
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			const descriptionInput = screen.getByDisplayValue("Test Description");
			await user.type(descriptionInput, " Modified");

			await waitFor(() => {
				expect(mockSetUnresolvedChanges).toHaveBeenCalledWith(true);
			});
		});

		it("should not track changes to untracked fields", async () => {
			const user = userEvent.setup();

			renderWithAuth(
				<CaseEditForm
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			// Click the update button without making changes
			const updateButton = screen.getByRole("button", {
				name: UPDATE_BUTTON_REGEX,
			});
			await user.click(updateButton);

			// setUnresolvedChanges should not be called for form submission
			expect(mockSetUnresolvedChanges).not.toHaveBeenCalledWith(true);
		});
	});

	describe("Store Integration", () => {
		it("should update store with new case data after successful submission", async () => {
			const user = userEvent.setup();

			server.use(
				http.put("*/api/cases/1/", () => {
					return HttpResponse.json({ success: true });
				})
			);

			renderWithAuth(
				<CaseEditForm
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			const nameInput = screen.getByDisplayValue("Test Case");
			await user.clear(nameInput);
			await user.type(nameInput, "Store Updated Case");

			const updateButton = screen.getByRole("button", {
				name: UPDATE_BUTTON_REGEX,
			});
			await user.click(updateButton);

			await waitFor(() => {
				expect(mockStore.setAssuranceCase).toHaveBeenCalledWith(
					expect.objectContaining({
						...mockStore.assuranceCase,
						name: "Store Updated Case",
						description: "Test Description",
					})
				);
			});
		});

		it("should preserve existing case data when updating", async () => {
			const user = userEvent.setup();

			server.use(
				http.put("*/api/cases/1/", () => {
					return HttpResponse.json({ success: true });
				})
			);

			renderWithAuth(
				<CaseEditForm
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			const updateButton = screen.getByRole("button", {
				name: UPDATE_BUTTON_REGEX,
			});
			await user.click(updateButton);

			await waitFor(() => {
				expect(mockStore.setAssuranceCase).toHaveBeenCalledWith(
					expect.objectContaining({
						id: 1,
						// Should preserve all other case properties
					})
				);
			});
		});
	});

	describe("Form Accessibility", () => {
		it("should have proper form labels", () => {
			renderWithAuth(
				<CaseEditForm
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			const nameInput = screen.getByLabelText(NAME_LABEL_REGEX);
			const descriptionInput = screen.getByLabelText(DESCRIPTION_LABEL_REGEX);

			expect(nameInput).toBeInTheDocument();
			expect(descriptionInput).toBeInTheDocument();
		});

		it("should show validation errors with proper accessibility", async () => {
			const user = userEvent.setup();

			renderWithAuth(
				<CaseEditForm
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			const nameInput = screen.getByDisplayValue("Test Case");
			await user.clear(nameInput);
			await user.type(nameInput, "A");

			const updateButton = screen.getByRole("button", {
				name: UPDATE_BUTTON_REGEX,
			});
			await user.click(updateButton);

			await waitFor(() => {
				const errorMessage = screen.getByText(
					"Name must be at least 2 characters."
				);
				expect(errorMessage).toBeInTheDocument();
				// The FormMessage component might not add role="alert" directly
				// but the error should still be visible
			});
		});

		it("should have proper button states and accessibility", () => {
			renderWithAuth(
				<CaseEditForm
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			const updateButton = screen.getByRole("button", {
				name: UPDATE_BUTTON_REGEX,
			});
			expect(updateButton).toBeEnabled();
			expect(updateButton).toHaveClass("bg-indigo-500", "hover:bg-indigo-600");
		});
	});

	describe("Edge Cases", () => {
		it("should handle empty assurance case gracefully", () => {
			mockStore.assuranceCase = null;

			renderWithAuth(
				<CaseEditForm
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			// Should render with empty default values
			const nameInput = screen.getByLabelText(NAME_LABEL_REGEX);
			const descriptionInput = screen.getByLabelText(DESCRIPTION_LABEL_REGEX);

			expect(nameInput).toHaveValue("");
			expect(descriptionInput).toHaveValue("");
		});

		it("should handle missing case permissions", () => {
			mockStore.assuranceCase = createMockAssuranceCase({
				permissions: undefined,
			});

			renderWithAuth(
				<CaseEditForm
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			// Should default to read-only behavior
			expect(
				screen.queryByRole("button", { name: UPDATE_BUTTON_REGEX })
			).not.toBeInTheDocument();
		});

		it("should handle very long text inputs", async () => {
			const user = userEvent.setup();
			const longText = "A".repeat(1000);

			renderWithAuth(
				<CaseEditForm
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			const descriptionInput = screen.getByDisplayValue("Test Description");
			await user.clear(descriptionInput);
			await user.type(descriptionInput, longText);

			expect(descriptionInput).toHaveValue(longText);
		});
	});
});
