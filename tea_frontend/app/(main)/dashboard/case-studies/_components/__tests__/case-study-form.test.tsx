import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "@/src/__tests__/mocks/server";
import { renderWithAuth } from "@/src/__tests__/utils/test-utils";
import type { CaseStudy } from "@/types/domain";
import { createCaseStudy, updateCaseStudy, deleteCaseStudy } from "@/actions/case-studies";
import CaseStudyForm from "../case-study-form";

// Mock Next.js navigation
const mockPush = vi.fn();
const mockBack = vi.fn();

vi.mock("next/navigation", () => ({
	useRouter: vi.fn(() => ({
		push: mockPush,
		back: mockBack,
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

// Mock import modal hook
vi.mock("@/hooks/use-import-modal", () => ({
	useImportModal: () => ({
		onOpen: vi.fn(),
		onClose: vi.fn(),
		isOpen: false,
	}),
}));

// Mock TiptapEditor
vi.mock("@/components/ui/tiptap-editor", () => ({
	default: ({
		onChange,
		value,
		placeholder,
	}: {
		onChange: (content: string) => void;
		value: string;
		placeholder: string;
	}) => (
		<textarea
			data-testid="tiptap-editor"
			onChange={(e) => onChange(e.target.value)}
			placeholder={placeholder}
			value={value}
		/>
	),
}));

// Mock ImageUpload component
vi.mock("@/components/ui/image-upload", () => ({
	ImageUpload: ({
		onChange,
		onRemove,
		value,
		disabled,
	}: {
		onChange: (file: File | string) => void;
		onRemove: () => void;
		value: string;
		disabled: boolean;
	}) => (
		<div data-testid="image-upload">
			<input
				accept="image/*"
				disabled={disabled}
				data-testid="image-input"
				onChange={(e) => {
					const file = e.target.files?.[0];
					if (file) onChange(file);
				}}
				type="file"
			/>
			{value && (
				<div>
					<img alt="Preview" src={value} />
					<button onClick={onRemove} type="button">
						Remove
					</button>
				</div>
			)}
		</div>
	),
}));

// Mock sectors config
vi.mock("@/config/index", () => ({
	sectors: [
		{ ID: 1, Name: "Healthcare" },
		{ ID: 2, Name: "Automotive" },
		{ ID: 3, Name: "Aerospace" },
		{ ID: 4, Name: "Finance" },
	],
}));

// Mock actions
vi.mock("@/actions/case-studies", () => ({
	createCaseStudy: vi.fn(),
	updateCaseStudy: vi.fn(),
	deleteCaseStudy: vi.fn(),
}));

// Get the mocked functions
const mockCreateCaseStudy = vi.mocked(createCaseStudy);
const mockUpdateCaseStudy = vi.mocked(updateCaseStudy);
const mockDeleteCaseStudy = vi.mocked(deleteCaseStudy);

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Mock case study data
const mockCaseStudy: CaseStudy = {
	id: 1,
	title: "Test Case Study",
	description: "<p>Test description</p>",
	sector: "Healthcare",
	type: "Assurance Case",
	contact: "test@example.com",
	published: false,
	publishedDate: undefined,
	createdOn: "2024-01-01T00:00:00Z",
	authors: "John Doe, Jane Smith",
	assurance_cases: [1, 2],
};

const mockPublishedCaseStudy: CaseStudy = {
	...mockCaseStudy,
	id: 2,
	title: "Published Case Study",
	published: true,
	publishedDate: "2024-01-01T00:00:00Z",
};

const mockUser = {
	id: 1,
	name: "Test User",
	email: "test@example.com",
	key: "mock-session-key",
};

// Mock URL.createObjectURL for image upload tests
global.URL.createObjectURL = vi.fn(() => "mocked-object-url");
global.URL.revokeObjectURL = vi.fn();

describe("CaseStudyForm Component", () => {
	const user = userEvent.setup();

	beforeEach(() => {
		vi.clearAllMocks();
		(useSession as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
			data: mockUser,
			status: "authenticated",
		});
		(useRouter as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
			push: mockPush,
			back: mockBack,
			replace: vi.fn(),
			refresh: vi.fn(),
			forward: vi.fn(),
			prefetch: vi.fn(),
		});
	});

	afterEach(() => {
		server.resetHandlers();
	});

	describe("Form Rendering", () => {
		it("should render form with basic information fields for new case study", () => {
			renderWithAuth(<CaseStudyForm caseStudy={undefined} />);

			// Check basic information section
			expect(screen.getByText("Basic Information")).toBeInTheDocument();
			expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
			expect(screen.getByText("Sector")).toBeInTheDocument();
			expect(screen.getByText("Type")).toBeInTheDocument();

			// Check author information section
			expect(screen.getByText("Author Information")).toBeInTheDocument();
			expect(screen.getByPlaceholderText("Enter author name")).toBeInTheDocument();
			expect(
				screen.getByLabelText(/corresponding author email/i)
			).toBeInTheDocument();

			// Check description section
			expect(screen.getByText("Case Study Description")).toBeInTheDocument();
			expect(screen.getByTestId("tiptap-editor")).toBeInTheDocument();

			// Check related assurance cases section
			expect(screen.getByText("Related Assurance Cases")).toBeInTheDocument();

			// Check featured image section
			expect(screen.getByText("Featured Image")).toBeInTheDocument();
			expect(screen.getByTestId("image-upload")).toBeInTheDocument();

			// Check save button for new case study
			expect(
				screen.getByRole("button", { name: /save$/i })
			).toBeInTheDocument();
		});

		it("should render form with existing case study data", () => {
			renderWithAuth(<CaseStudyForm caseStudy={mockCaseStudy} />);

			// Check that form is populated with existing data
			const titleInput = screen.getByDisplayValue("Test Case Study");
			expect(titleInput).toBeInTheDocument();

			const contactInput = screen.getByDisplayValue("test@example.com");
			expect(contactInput).toBeInTheDocument();

			// Check sector is selected (by checking the selected value in combobox)
			const comboboxes = screen.getAllByRole("combobox");
			expect(comboboxes[0]).toHaveTextContent("Healthcare");

			// Check type is selected
			expect(comboboxes[1]).toHaveTextContent("Assurance Case");

			// Check save changes button for existing case study
			expect(
				screen.getByRole("button", { name: /save changes/i })
			).toBeInTheDocument();

			// Check publish/unpublish button for existing case study
			expect(
				screen.getByRole("button", { name: /make public/i })
			).toBeInTheDocument();

			// Check delete button is present
			expect(
				screen.getByRole("button", { name: /delete/i })
			).toBeInTheDocument();
		});

		it("should render published case study with remove from public button", () => {
			renderWithAuth(<CaseStudyForm caseStudy={mockPublishedCaseStudy} />);

			// Check remove from public button for published case study
			expect(
				screen.getByRole("button", { name: /remove from public/i })
			).toBeInTheDocument();
		});

		it("should disable certain fields when case study is published", () => {
			renderWithAuth(<CaseStudyForm caseStudy={mockPublishedCaseStudy} />);

			// Image upload should be disabled
			const imageInput = screen.getByTestId("image-input");
			expect(imageInput).toBeDisabled();

			// Author removal buttons should not be visible for published case studies
			const removeButtons = screen.queryAllByRole("button", { name: /×/i });
			// Only close buttons from modals should be present, not author removal buttons
			expect(removeButtons.length).toBe(0);
		});
	});

	describe("Form Validation", () => {
		it("should show validation errors for required fields", async () => {
			renderWithAuth(<CaseStudyForm caseStudy={undefined} />);

			// Try to submit form without filling required fields
			const saveButton = screen.getByRole("button", { name: /save$/i });
			await user.click(saveButton);

			// Check for validation errors
			await waitFor(() => {
				expect(screen.getByText("Title is required")).toBeInTheDocument();
				expect(
					screen.getByText("Description is required")
				).toBeInTheDocument();
			});
		});

		it("should validate email format for contact field", async () => {
			renderWithAuth(<CaseStudyForm caseStudy={undefined} />);

			// Fill required fields
			await user.type(screen.getByLabelText(/title/i), "Test Title");
			await user.type(
				screen.getByTestId("tiptap-editor"),
				"Test description"
			);

			// Enter invalid email
			await user.type(
				screen.getByLabelText(/corresponding author email/i),
				"invalid-email"
			);

			// Submit form
			const saveButton = screen.getByRole("button", { name: /save$/i });
			await user.click(saveButton);

			// Check for email validation error (looking for a generic email validation message)
			await waitFor(() => {
				const errorMessage = screen.queryByText(/email/i) || screen.queryByText(/invalid/i);
				expect(errorMessage).toBeInTheDocument();
			});
		});
	});

	describe("Author Management", () => {
		it("should allow adding and removing authors", async () => {
			renderWithAuth(<CaseStudyForm caseStudy={undefined} />);

			// Add first author
			const authorInput = screen.getByPlaceholderText("Enter author name");
			await user.type(authorInput, "John Doe");
			await user.click(screen.getByRole("button", { name: /add author/i }));

			// Check author is added
			expect(screen.getByText("John Doe")).toBeInTheDocument();

			// Add second author
			await user.type(authorInput, "Jane Smith");
			await user.click(screen.getByRole("button", { name: /add author/i }));

			// Check second author is added
			expect(screen.getByText("Jane Smith")).toBeInTheDocument();

			// Remove first author
			const removeButtons = screen.getAllByRole("button", { name: /×/i });
			await user.click(removeButtons[0]);

			// Check first author is removed
			expect(screen.queryByText("John Doe")).not.toBeInTheDocument();
			expect(screen.getByText("Jane Smith")).toBeInTheDocument();
		});

		it("should add author when pressing Enter key", async () => {
			renderWithAuth(<CaseStudyForm caseStudy={undefined} />);

			const authorInput = screen.getByPlaceholderText("Enter author name");
			await user.type(authorInput, "John Doe{enter}");

			// Check author is added
			expect(screen.getByText("John Doe")).toBeInTheDocument();
		});

		it("should not add duplicate authors", async () => {
			renderWithAuth(<CaseStudyForm caseStudy={undefined} />);

			const authorInput = screen.getByPlaceholderText("Enter author name");
			const addButton = screen.getByRole("button", { name: /add author/i });

			// Add first author
			await user.type(authorInput, "John Doe");
			await user.click(addButton);

			// Try to add same author again
			await user.type(authorInput, "John Doe");
			await user.click(addButton);

			// Check only one instance exists
			const authorElements = screen.getAllByText("John Doe");
			expect(authorElements).toHaveLength(1);
		});

		it("should populate authors from existing case study", () => {
			renderWithAuth(<CaseStudyForm caseStudy={mockCaseStudy} />);

			// Check authors are displayed
			expect(screen.getByText("John Doe")).toBeInTheDocument();
			expect(screen.getByText("Jane Smith")).toBeInTheDocument();
		});
	});

	describe("Form Submission", () => {
		it("should create new case study successfully", async () => {
			// Mock successful creation using the action
			mockCreateCaseStudy.mockResolvedValue(3);

			renderWithAuth(<CaseStudyForm caseStudy={undefined} />);

			// Fill required fields
			await user.type(screen.getByLabelText(/title/i), "New Case Study");
			await user.type(
				screen.getByTestId("tiptap-editor"),
				"New description"
			);

			// Submit form
			const saveButton = screen.getByRole("button", { name: /save$/i });
			await user.click(saveButton);

			// Check for success message and navigation
			await waitFor(() => {
				expect(mockPush).toHaveBeenCalledWith("/dashboard/case-studies/3");
			});
		});

		it("should update existing case study successfully", async () => {
			// Mock successful update using the action
			mockUpdateCaseStudy.mockResolvedValue(true);

			renderWithAuth(<CaseStudyForm caseStudy={mockCaseStudy} />);

			// Update title
			const titleInput = screen.getByDisplayValue("Test Case Study");
			await user.clear(titleInput);
			await user.type(titleInput, "Updated Case Study");

			// Submit form
			const saveButton = screen.getByRole("button", { name: /save changes/i });
			await user.click(saveButton);

			// Check for success (no navigation for updates)
			await waitFor(() => {
				expect(mockPush).not.toHaveBeenCalled();
			});
		});

		it("should show confirmation dialog when updating published case study", async () => {
			renderWithAuth(<CaseStudyForm caseStudy={mockPublishedCaseStudy} />);

			// Update title
			const titleInput = screen.getByDisplayValue("Published Case Study");
			await user.clear(titleInput);
			await user.type(titleInput, "Updated Published Case Study");

			// Submit form
			const saveButton = screen.getByRole("button", { name: /save changes/i });
			await user.click(saveButton);

			// Check for confirmation dialog
			await waitFor(() => {
				expect(
					screen.getByText(
						"This case study is published. Updating it may affect the live version. Are you sure you want to proceed?"
					)
				).toBeInTheDocument();
			});

			// Confirm update
			const confirmButton = screen.getByRole("button", {
				name: /update anyway/i,
			});
			await user.click(confirmButton);

			// Check dialog closes
			await waitFor(() => {
				expect(
					screen.queryByText(
						"This case study is published. Updating it may affect the live version. Are you sure you want to proceed?"
					)
				).not.toBeInTheDocument();
			});
		});
	});

	describe("Publishing/Unpublishing", () => {
		it("should publish case study successfully", async () => {
			// Mock successful publish
			mockUpdateCaseStudy.mockResolvedValue(true);

			renderWithAuth(<CaseStudyForm caseStudy={mockCaseStudy} />);

			// Click publish button
			const publishButton = screen.getByRole("button", { name: /make public/i });
			await user.click(publishButton);

			// Check that the action was called
			await waitFor(() => {
				expect(mockUpdateCaseStudy).toHaveBeenCalled();
			});
		});

		it("should unpublish case study successfully", async () => {
			// Mock successful unpublish
			mockUpdateCaseStudy.mockResolvedValue(true);

			renderWithAuth(<CaseStudyForm caseStudy={mockPublishedCaseStudy} />);

			// Click unpublish button
			const unpublishButton = screen.getByRole("button", {
				name: /remove from public/i,
			});
			await user.click(unpublishButton);

			// Check that the action was called
			await waitFor(() => {
				expect(mockUpdateCaseStudy).toHaveBeenCalled();
			});
		});
	});

	describe("Image Upload", () => {
		it("should upload image successfully", async () => {
			// Mock successful image upload
			server.use(
				http.post(`${API_BASE_URL}/api/case-studies/1/image/`, () => {
					return HttpResponse.json({
						message: "Image uploaded successfully",
						image: "/media/case-studies/1/image.jpg",
					});
				})
			);

			renderWithAuth(<CaseStudyForm caseStudy={mockCaseStudy} />);

			// Upload image
			const imageInput = screen.getByTestId("image-input");
			const file = new File(["test"], "test.jpg", { type: "image/jpeg" });

			await user.upload(imageInput, file);

			// Check for preview
			await waitFor(() => {
				expect(screen.getByAltText("Preview")).toBeInTheDocument();
			});
		});

		it("should remove image successfully", async () => {
			// Mock existing image
			const caseStudyWithImage = {
				...mockCaseStudy,
				image: "/media/case-studies/1/existing.jpg",
			};

			// Mock successful image deletion
			server.use(
				http.delete(`${API_BASE_URL}/api/case-studies/1/image/`, () => {
					return new HttpResponse(null, { status: 204 });
				})
			);

			renderWithAuth(<CaseStudyForm caseStudy={caseStudyWithImage} />);

			// Remove image
			const removeButton = screen.getByRole("button", { name: /remove/i });
			await user.click(removeButton);

			// Check image is removed
			await waitFor(() => {
				expect(screen.queryByAltText("Preview")).not.toBeInTheDocument();
			});
		});
	});

	describe("Error Handling", () => {
		it("should handle creation errors gracefully", async () => {
			// Mock creation error
			mockCreateCaseStudy.mockResolvedValue(null);

			renderWithAuth(<CaseStudyForm caseStudy={undefined} />);

			// Fill and submit form
			await user.type(screen.getByLabelText(/title/i), "New Case Study");
			await user.type(
				screen.getByTestId("tiptap-editor"),
				"New description"
			);

			const saveButton = screen.getByRole("button", { name: /save$/i });
			await user.click(saveButton);

			// Check for error handling (no navigation)
			await waitFor(() => {
				expect(mockPush).not.toHaveBeenCalled();
			});
		});

		it("should handle update errors gracefully", async () => {
			// Mock update error
			mockUpdateCaseStudy.mockResolvedValue(false);

			renderWithAuth(<CaseStudyForm caseStudy={mockCaseStudy} />);

			// Update and submit
			const titleInput = screen.getByDisplayValue("Test Case Study");
			await user.clear(titleInput);
			await user.type(titleInput, "Updated Case Study");

			const saveButton = screen.getByRole("button", { name: /save changes/i });
			await user.click(saveButton);

			// Check for error handling (loading state should end)
			await waitFor(() => {
				expect(saveButton).not.toBeDisabled();
			});
		});
	});

	describe("Loading States", () => {
		it("should show loading state during form submission", async () => {
			// Mock slow response
			mockCreateCaseStudy.mockImplementation(
				() => new Promise((resolve) => setTimeout(() => resolve(3), 100))
			);

			renderWithAuth(<CaseStudyForm caseStudy={undefined} />);

			// Fill and submit form
			await user.type(screen.getByLabelText(/title/i), "New Case Study");
			await user.type(
				screen.getByTestId("tiptap-editor"),
				"New description"
			);

			const saveButton = screen.getByRole("button", { name: /save$/i });
			await user.click(saveButton);

			// Check button is disabled during loading
			expect(saveButton).toBeDisabled();

			// Wait for completion
			await waitFor(
				() => {
					expect(mockPush).toHaveBeenCalled();
				},
				{ timeout: 2000 }
			);
		});
	});

	describe("Accessibility", () => {
		it("should have proper form labels and accessibility attributes", () => {
			renderWithAuth(<CaseStudyForm caseStudy={undefined} />);

			// Check form has proper labels
			expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
			expect(screen.getByText("Sector")).toBeInTheDocument();
			expect(screen.getByText("Type")).toBeInTheDocument();
			expect(
				screen.getByLabelText(/corresponding author email/i)
			).toBeInTheDocument();

			// Check buttons have accessible names
			expect(
				screen.getByRole("button", { name: /add author/i })
			).toBeInTheDocument();
			expect(
				screen.getByRole("button", { name: /save$/i })
			).toBeInTheDocument();
		});

		it("should support keyboard navigation", async () => {
			renderWithAuth(<CaseStudyForm caseStudy={undefined} />);

			// Test tab navigation
			const titleInput = screen.getByLabelText(/title/i);
			titleInput.focus();
			expect(titleInput).toHaveFocus();

			// Tab to next field
			await user.tab();
			const sectorSelect = screen.getByRole("combobox");
			expect(sectorSelect).toHaveFocus();
		});
	});
});
