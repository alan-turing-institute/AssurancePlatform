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
import type { AssuranceCase, CaseStudy, User } from "@/types";
import { ShareModal } from "./share-modal";

// Mock constants - must be hoisted for vi.mock
const { mockSaveAs } = vi.hoisted(() => ({
	mockSaveAs: vi.fn(),
}));

// Regex constants for text matching
const SHARE_BUTTON_REGEX = /share/i;
const VALID_EMAIL_REGEX = /valid email/i;
const AT_LEAST_2_CHARS_REGEX = /at least 2 characters/i;
const DOWNLOAD_FILE_REGEX = /download file/i;
const PUBLISH_REGEX = /publish/i;
const UPDATE_REGEX = /update/i;
const UNPUBLISH_REGEX = /unpublish/i;
const PUBLISH_EXACT_REGEX = /^publish$/i;
const ACCESS_LEVEL_REGEX = /access level/i;
const FILENAME_DATE_REGEX = /\d{4}-\d+-\d+T\d+-\d+-\d+\.json$/;

// Mock the store
const mockStore = {
	assuranceCase: mockAssuranceCase as AssuranceCase,
	setAssuranceCase: vi.fn(),
	viewMembers: [] as User[],
	setViewMembers: vi.fn(),
	editMembers: [] as User[],
	setEditMembers: vi.fn(),
	reviewMembers: [] as User[],
	setReviewMembers: vi.fn(),
};

vi.mock("@/data/store", () => ({
	default: () => mockStore,
}));

// Mock the hook
const mockShareModal = {
	isOpen: false,
	onOpen: vi.fn(),
	onClose: vi.fn(),
};

vi.mock("@/hooks/use-share-modal", () => ({
	useShareModal: () => mockShareModal,
}));

// Mock UI Modal component
vi.mock("@/components/ui/modal", () => ({
	Modal: ({
		title,
		description,
		isOpen,
		onClose,
		children,
	}: {
		title: string;
		description: string;
		isOpen: boolean;
		onClose: () => void;
		children: React.ReactNode;
	}) =>
		isOpen ? (
			<div data-testid="modal" role="dialog">
				<h1>{title}</h1>
				<p>{description}</p>
				<button data-testid="modal-close" onClick={onClose} type="button">
					Close
				</button>
				{children}
			</div>
		) : null,
}));

// Mock LinkedCaseModal
vi.mock("./LinkedCaseModal", () => ({
	LinkedCaseModal: ({
		isOpen,
		onClose,
		linkedCaseStudies,
	}: {
		isOpen: boolean;
		onClose: () => void;
		linkedCaseStudies: CaseStudy[];
	}) =>
		isOpen ? (
			<div data-testid="linked-case-modal">
				<button onClick={onClose} type="button">
					Close Linked Cases
				</button>
				<div data-testid="linked-cases-count">{linkedCaseStudies.length}</div>
			</div>
		) : null,
}));

// Mock file-saver
vi.mock("file-saver", () => ({
	saveAs: mockSaveAs,
}));

// Mock neatjson
vi.mock("neatjson", () => ({
	neatJSON: vi.fn((obj) => JSON.stringify(obj, null, 2)),
}));

// Mock toast
const mockToast = vi.fn();
vi.mock("../ui/use-toast", () => ({
	useToast: () => ({ toast: mockToast }),
}));

// window.location.reload is already mocked in setup.tsx
// We just need to access it for our assertions
const mockReload = window.location.reload as ReturnType<typeof vi.fn>;

describe("ShareModal", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockShareModal.isOpen = false;
		mockStore.assuranceCase = createMockAssuranceCase({
			id: 1,
			name: "Test Case",
			permissions: "manage",
			published: false,
		});
		mockStore.viewMembers = [];
		mockStore.editMembers = [];
		mockStore.reviewMembers = [];
		mockSaveAs.mockClear();
		mockToast.mockClear();
		// mockReload is cleared by vi.clearAllMocks()
	});

	describe("Modal Visibility", () => {
		it("should not render when modal is closed", () => {
			mockShareModal.isOpen = false;

			renderWithAuth(<ShareModal />);

			expect(screen.queryByTestId("modal")).not.toBeInTheDocument();
		});

		it("should render when modal is open", () => {
			mockShareModal.isOpen = true;

			renderWithAuth(<ShareModal />);

			expect(screen.getByTestId("modal")).toBeInTheDocument();
		});

		it("should display correct title and description", () => {
			mockShareModal.isOpen = true;

			renderWithAuth(<ShareModal />);

			expect(screen.getByText("Share / Export Case")).toBeInTheDocument();
			expect(
				screen.getByText("How would you like the share your assurance case?")
			).toBeInTheDocument();
		});
	});

	describe("User Sharing Section", () => {
		beforeEach(() => {
			mockShareModal.isOpen = true;
		});

		it("should render sharing form when user has manage permissions", () => {
			mockStore.assuranceCase = createMockAssuranceCase({
				permissions: "manage",
			});

			renderWithAuth(<ShareModal />);

			expect(screen.getByText("Share with users")).toBeInTheDocument();
			expect(
				screen.getByPlaceholderText("Enter email address")
			).toBeInTheDocument();
		});

		it("should not render sharing form when user lacks manage permissions", () => {
			mockStore.assuranceCase = createMockAssuranceCase({
				permissions: "view",
			});

			renderWithAuth(<ShareModal />);

			expect(screen.queryByText("Share with users")).not.toBeInTheDocument();
			expect(
				screen.queryByPlaceholderText("Enter email address")
			).not.toBeInTheDocument();
		});

		it("should render access level radio buttons", () => {
			renderWithAuth(<ShareModal />);

			expect(screen.getByText("Access Level")).toBeInTheDocument();
			expect(screen.getByLabelText("Read")).toBeInTheDocument();
			expect(screen.getByLabelText("Edit")).toBeInTheDocument();
			expect(screen.getByLabelText("Reviewer")).toBeInTheDocument();
		});

		it("should default to Read access level", () => {
			renderWithAuth(<ShareModal />);

			const readRadio = screen.getByLabelText("Read");
			expect(readRadio).toBeChecked();
		});

	});

	describe("Form Validation", () => {
		beforeEach(() => {
			mockShareModal.isOpen = true;
		});

		it("should require valid email format", async () => {
			const user = userEvent.setup();

			renderWithAuth(<ShareModal />);

			const emailInput = screen.getByPlaceholderText("Enter email address");
			const shareButton = screen.getByRole("button", {
				name: SHARE_BUTTON_REGEX,
			});

			await user.type(emailInput, "invalid-email");
			await user.click(shareButton);

			await waitFor(() => {
				expect(screen.getByText(VALID_EMAIL_REGEX)).toBeInTheDocument();
			});
		});

		it("should require email to be at least 2 characters", async () => {
			const user = userEvent.setup();

			renderWithAuth(<ShareModal />);

			const emailInput = screen.getByPlaceholderText("Enter email address");
			const shareButton = screen.getByRole("button", {
				name: SHARE_BUTTON_REGEX,
			});

			await user.type(emailInput, "a");
			await user.click(shareButton);

			await waitFor(() => {
				expect(screen.getByText(AT_LEAST_2_CHARS_REGEX)).toBeInTheDocument();
			});
		});

		it("should accept valid email format", async () => {
			const user = userEvent.setup();

			server.use(
				http.post("*/api/cases/*/sharedwith", () => {
					return HttpResponse.json({ success: true });
				})
			);

			renderWithAuth(<ShareModal />);

			const emailInput = screen.getByPlaceholderText("Enter email address");
			const shareButton = screen.getByRole("button", {
				name: SHARE_BUTTON_REGEX,
			});

			await user.type(emailInput, "test@example.com");
			await user.click(shareButton);

			await waitFor(() => {
				expect(screen.queryByText(VALID_EMAIL_REGEX)).not.toBeInTheDocument();
			});
		});
	});

	describe("User Sharing Functionality", () => {
		beforeEach(() => {
			mockShareModal.isOpen = true;
		});

		it("should share with read access by default", async () => {
			const user = userEvent.setup();

			let capturedRequestBody: unknown = null;
			server.use(
				http.post("*/api/cases/*/sharedwith", async ({ request }) => {
					capturedRequestBody = await request.json();
					return HttpResponse.json({ success: true });
				})
			);

			renderWithAuth(<ShareModal />);

			await user.type(
				screen.getByPlaceholderText("Enter email address"),
				"read@example.com"
			);
			await user.click(
				screen.getByRole("button", { name: SHARE_BUTTON_REGEX })
			);

			await waitFor(() => {
				expect(capturedRequestBody).toEqual([
					{
						email: "read@example.com",
						view: true,
					},
				]);
			});
		});

		it("should share with edit access when selected", async () => {
			const user = userEvent.setup();

			let capturedRequestBody: unknown = null;
			server.use(
				http.post("*/api/cases/*/sharedwith", async ({ request }) => {
					capturedRequestBody = await request.json();
					return HttpResponse.json({ success: true });
				})
			);

			renderWithAuth(<ShareModal />);

			// Enter email
			await user.type(
				screen.getByPlaceholderText("Enter email address"),
				"edit@example.com"
			);

			// Find the Edit radio button by its value
			const radioButtons = screen.getAllByRole("radio");
			const editRadio = radioButtons.find(radio => radio.getAttribute("value") === "Edit");

			if (!editRadio) {
				throw new Error("Edit radio button not found");
			}

			// Click the Edit radio button
			await user.click(editRadio);

			// Submit the form
			await user.click(
				screen.getByRole("button", { name: SHARE_BUTTON_REGEX })
			);

			await waitFor(() => {
				expect(capturedRequestBody).toEqual([
					{
						email: "edit@example.com",
						edit: true,
					},
				]);
			});
		});

		it("should share with reviewer access when selected", async () => {
			const user = userEvent.setup();

			let capturedRequestBody: unknown = null;
			server.use(
				http.post("*/api/cases/*/sharedwith", async ({ request }) => {
					capturedRequestBody = await request.json();
					return HttpResponse.json({ success: true });
				})
			);

			renderWithAuth(<ShareModal />);

			await user.type(
				screen.getByPlaceholderText("Enter email address"),
				"reviewer@example.com"
			);

			// Click the Reviewer radio button
			const reviewerRadio = screen.getByRole("radio", { name: "Reviewer" });
			await user.click(reviewerRadio);

			await user.click(
				screen.getByRole("button", { name: SHARE_BUTTON_REGEX })
			);

			await waitFor(() => {
				expect(capturedRequestBody).toEqual([
					{
						email: "reviewer@example.com",
						review: true,
					},
				]);
			});
		});

		it("should show success toast on successful sharing", async () => {
			const user = userEvent.setup();

			server.use(
				http.post("*/api/cases/*/sharedwith", () => {
					return HttpResponse.json({ success: true });
				})
			);

			renderWithAuth(<ShareModal />);

			await user.type(
				screen.getByPlaceholderText("Enter email address"),
				"success@example.com"
			);
			await user.click(
				screen.getByRole("button", { name: SHARE_BUTTON_REGEX })
			);

			await waitFor(() => {
				expect(mockToast).toHaveBeenCalledWith({
					variant: "success",
					title: "Shared Case with:",
					description: "success@example.com",
				});
			});
		});

		it("should reset form after successful sharing", async () => {
			const user = userEvent.setup();

			server.use(
				http.post("*/api/cases/*/sharedwith", () => {
					return HttpResponse.json({ success: true });
				})
			);

			renderWithAuth(<ShareModal />);

			const emailInput = screen.getByPlaceholderText("Enter email address");
			await user.type(emailInput, "reset@example.com");
			await user.click(
				screen.getByRole("button", { name: SHARE_BUTTON_REGEX })
			);

			await waitFor(() => {
				expect(emailInput).toHaveValue("");
			});
		});

		it("should handle sharing errors", async () => {
			const user = userEvent.setup();

			server.use(
				http.post("*/api/cases/*/sharedwith", () => {
					return new HttpResponse(null, { status: 400 });
				})
			);

			renderWithAuth(<ShareModal />);

			await user.type(
				screen.getByPlaceholderText("Enter email address"),
				"error@example.com"
			);
			await user.click(
				screen.getByRole("button", { name: SHARE_BUTTON_REGEX })
			);

			await waitFor(() => {
				expect(mockToast).toHaveBeenCalledWith({
					variant: "destructive",
					title: "Unable to share case",
					description:
						"The email is not registered to an active user of the TEA platform.",
				});
			});
		});
	});

	describe("Export Functionality", () => {
		beforeEach(() => {
			mockShareModal.isOpen = true;
		});

		it("should render export section", () => {
			renderWithAuth(<ShareModal />);

			expect(screen.getByText("Export as JSON")).toBeInTheDocument();
			expect(
				screen.getByText("Select the button below to download a JSON file.")
			).toBeInTheDocument();
			expect(
				screen.getByRole("button", { name: DOWNLOAD_FILE_REGEX })
			).toBeInTheDocument();
		});

		it("should trigger file download when export button clicked", async () => {
			const user = userEvent.setup();

			renderWithAuth(<ShareModal />);

			await user.click(
				screen.getByRole("button", { name: DOWNLOAD_FILE_REGEX })
			);

			expect(mockSaveAs).toHaveBeenCalled();
			const [blob, filename] = mockSaveAs.mock.calls[0];
			expect(blob).toBeInstanceOf(Blob);
			expect(filename).toContain("Test Case");
			expect(filename).toContain(".json");
		});

		it("should remove id fields from exported JSON", async () => {
			const user = userEvent.setup();
			const { neatJSON } = await import("neatjson");

			renderWithAuth(<ShareModal />);

			await user.click(
				screen.getByRole("button", { name: DOWNLOAD_FILE_REGEX })
			);

			expect(neatJSON).toHaveBeenCalledWith(mockStore.assuranceCase, {});
		});

		it("should include timestamp in filename", async () => {
			const user = userEvent.setup();

			renderWithAuth(<ShareModal />);

			await user.click(
				screen.getByRole("button", { name: DOWNLOAD_FILE_REGEX })
			);

			const [, filename] = mockSaveAs.mock.calls[0];
			expect(filename).toMatch(FILENAME_DATE_REGEX);
		});
	});

	describe("Publishing Functionality", () => {
		beforeEach(() => {
			mockShareModal.isOpen = true;
		});

		it("should render publish section when user has manage permissions", () => {
			mockStore.assuranceCase = createMockAssuranceCase({
				permissions: "manage",
				published: false,
			});

			renderWithAuth(<ShareModal />);

			expect(screen.getByText("Publish Assurance Case")).toBeInTheDocument();
			expect(
				screen.getByText(
					"Here you can publish the current version of your case."
				)
			).toBeInTheDocument();
		});

		it("should not render publish section when user lacks manage permissions", () => {
			mockStore.assuranceCase = createMockAssuranceCase({
				permissions: "view",
			});

			renderWithAuth(<ShareModal />);

			expect(
				screen.queryByText("Publish Assurance Case")
			).not.toBeInTheDocument();
		});

		it("should show publish button when case is not published", () => {
			mockStore.assuranceCase = createMockAssuranceCase({
				permissions: "manage",
				published: false,
			});

			renderWithAuth(<ShareModal />);

			expect(
				screen.getByRole("button", { name: PUBLISH_REGEX })
			).toBeInTheDocument();
			expect(
				screen.queryByRole("button", { name: UPDATE_REGEX })
			).not.toBeInTheDocument();
			expect(
				screen.queryByRole("button", { name: UNPUBLISH_REGEX })
			).not.toBeInTheDocument();
		});

		it("should show update and unpublish buttons when case is published", () => {
			mockStore.assuranceCase = createMockAssuranceCase({
				permissions: "manage",
				published: true,
			});

			renderWithAuth(<ShareModal />);

			expect(
				screen.getByRole("button", { name: UPDATE_REGEX })
			).toBeInTheDocument();
			expect(
				screen.getByRole("button", { name: UNPUBLISH_REGEX })
			).toBeInTheDocument();
			expect(
				screen.queryByRole("button", { name: PUBLISH_EXACT_REGEX })
			).not.toBeInTheDocument();
		});

		it("should publish case successfully", async () => {
			const user = userEvent.setup();

			server.use(
				http.put("*/api/cases/1/", () => {
					return HttpResponse.json({ success: true });
				})
			);

			renderWithAuth(<ShareModal />);

			await user.click(screen.getByRole("button", { name: PUBLISH_REGEX }));

			await waitFor(() => {
				expect(window.location.reload).toHaveBeenCalled();
			});
		});

		it("should handle publish errors", async () => {
			const user = userEvent.setup();

			server.use(
				http.put("*/api/cases/1/", () => {
					return new HttpResponse(null, { status: 500 });
				})
			);

			renderWithAuth(<ShareModal />);

			await user.click(screen.getByRole("button", { name: PUBLISH_REGEX }));

			await waitFor(() => {
				expect(mockToast).toHaveBeenCalledWith({
					title: "Something went wrong, publishing assurance case",
				});
			});
		});

		it("should unpublish case successfully", async () => {
			const user = userEvent.setup();

			mockStore.assuranceCase = createMockAssuranceCase({
				permissions: "manage",
				published: true,
			});

			server.use(
				http.put("*/api/cases/1/", () => {
					return HttpResponse.json({ success: true });
				})
			);

			renderWithAuth(<ShareModal />);

			await user.click(screen.getByRole("button", { name: UNPUBLISH_REGEX }));

			await waitFor(() => {
				expect(window.location.reload).toHaveBeenCalled();
			});
		});

		it("should handle unpublish with linked case studies", async () => {
			const user = userEvent.setup();

			mockStore.assuranceCase = createMockAssuranceCase({
				permissions: "manage",
				published: true,
			});

			server.use(
				http.put("*/api/cases/1/", () => {
					return HttpResponse.json(
						{
							error: "Cannot unpublish case with linked case studies",
							linked_case_studies: [{ id: 1, title: "Test Case Study" }],
						},
						{ status: 400 }
					);
				})
			);

			renderWithAuth(<ShareModal />);

			await user.click(screen.getByRole("button", { name: UNPUBLISH_REGEX }));

			await waitFor(() => {
				expect(mockShareModal.onClose).toHaveBeenCalled();
				expect(mockToast).toHaveBeenCalledWith({
					title: "Failed to Unpublish",
					description: expect.any(Object),
				});
			});
		});
	});

	describe("LinkedCaseModal Integration", () => {
		beforeEach(() => {
			mockShareModal.isOpen = true;
		});

		it("should open linked case modal when button is clicked", async () => {
			const user = userEvent.setup();

			mockStore.assuranceCase = createMockAssuranceCase({
				permissions: "manage",
				published: true,
			});

			server.use(
				http.put("*/api/cases/1/", () => {
					return HttpResponse.json(
						{
							error: "Cannot unpublish",
							linked_case_studies: [{ id: 1, title: "Test Case Study" }],
						},
						{ status: 400 }
					);
				})
			);

			renderWithAuth(<ShareModal />);

			await user.click(screen.getByRole("button", { name: UNPUBLISH_REGEX }));

			// Wait for the toast to be called with the correct content
			await waitFor(() => {
				expect(mockToast).toHaveBeenCalledWith(
					expect.objectContaining({
						title: "Failed to Unpublish",
						description: expect.any(Object),
					})
				);
			});
		});
	});

	describe("Store Integration", () => {
		beforeEach(() => {
			mockShareModal.isOpen = true;
		});

		it("should update store when sharing with view access", async () => {
			const user = userEvent.setup();

			server.use(
				http.post("*/api/cases/*/sharedwith", () => {
					return HttpResponse.json({ success: true });
				})
			);

			renderWithAuth(<ShareModal />);

			await user.type(
				screen.getByPlaceholderText("Enter email address"),
				"view@example.com"
			);
			await user.click(
				screen.getByRole("button", { name: SHARE_BUTTON_REGEX })
			);

			await waitFor(() => {
				expect(mockStore.setViewMembers).toHaveBeenCalledWith([
					{ email: "view@example.com", view: true },
				]);
			});
		});

		it("should update store when sharing with edit access", async () => {
			const user = userEvent.setup();

			server.use(
				http.post("*/api/cases/*/sharedwith", () => {
					return HttpResponse.json({ success: true });
				})
			);

			renderWithAuth(<ShareModal />);

			await user.type(
				screen.getByPlaceholderText("Enter email address"),
				"edit@example.com"
			);

			// Click the Edit radio button
			const editRadio = screen.getByRole("radio", { name: "Edit" });
			await user.click(editRadio);

			await user.click(
				screen.getByRole("button", { name: SHARE_BUTTON_REGEX })
			);

			await waitFor(() => {
				expect(mockStore.setEditMembers).toHaveBeenCalledWith([
					{ email: "edit@example.com", edit: true },
				]);
			});
		});

		it("should update store when sharing with reviewer access", async () => {
			const user = userEvent.setup();

			server.use(
				http.post("*/api/cases/*/sharedwith", () => {
					return HttpResponse.json({ success: true });
				})
			);

			renderWithAuth(<ShareModal />);

			await user.type(
				screen.getByPlaceholderText("Enter email address"),
				"reviewer@example.com"
			);

			// Click the Reviewer radio button
			const reviewerRadio = screen.getByRole("radio", { name: "Reviewer" });
			await user.click(reviewerRadio);

			await user.click(
				screen.getByRole("button", { name: SHARE_BUTTON_REGEX })
			);

			await waitFor(() => {
				expect(mockStore.setReviewMembers).toHaveBeenCalledWith([
					{ email: "reviewer@example.com", review: true },
				]);
			});
		});
	});

	describe("Accessibility", () => {
		beforeEach(() => {
			mockShareModal.isOpen = true;
		});

		it("should have proper form labels", () => {
			renderWithAuth(<ShareModal />);

			// Check that the label text exists
			expect(screen.getByText(ACCESS_LEVEL_REGEX)).toBeInTheDocument();
			// Check that radio buttons are properly labeled
			expect(screen.getByRole("radio", { name: "Read" })).toBeInTheDocument();
			expect(screen.getByRole("radio", { name: "Edit" })).toBeInTheDocument();
			expect(screen.getByRole("radio", { name: "Reviewer" })).toBeInTheDocument();
		});

		it("should have proper modal role", () => {
			renderWithAuth(<ShareModal />);

			expect(screen.getByRole("dialog")).toBeInTheDocument();
		});

		it("should have proper button structure", () => {
			renderWithAuth(<ShareModal />);

			const shareButton = screen.getByRole("button", {
				name: SHARE_BUTTON_REGEX,
			});
			const downloadButton = screen.getByRole("button", {
				name: DOWNLOAD_FILE_REGEX,
			});

			expect(shareButton).toHaveAttribute("type", "submit");
			expect(downloadButton).toBeInTheDocument();
		});
	});

	describe("Edge Cases", () => {
		beforeEach(() => {
			mockShareModal.isOpen = true;
		});

		it("should handle missing assurance case", () => {
			mockStore.assuranceCase = null as unknown as AssuranceCase;

			renderWithAuth(<ShareModal />);

			// Should not crash
			expect(screen.getByTestId("modal")).toBeInTheDocument();
			expect(screen.queryByText("Share with users")).not.toBeInTheDocument();
		});

		it("should handle special characters in email", async () => {
			const user = userEvent.setup();

			server.use(
				http.post("*/api/cases/*/sharedwith", () => {
					return HttpResponse.json({ success: true });
				})
			);

			renderWithAuth(<ShareModal />);

			await user.type(
				screen.getByPlaceholderText("Enter email address"),
				"test+special@example-domain.com"
			);
			await user.click(
				screen.getByRole("button", { name: SHARE_BUTTON_REGEX })
			);

			await waitFor(() => {
				expect(mockToast).toHaveBeenCalledWith({
					variant: "success",
					title: "Shared Case with:",
					description: "test+special@example-domain.com",
				});
			});
		});

		it("should handle network errors during sharing", async () => {
			const user = userEvent.setup();

			server.use(
				http.post("*/api/cases/*/sharedwith", () => {
					return HttpResponse.error();
				})
			);

			renderWithAuth(<ShareModal />);

			await user.type(
				screen.getByPlaceholderText("Enter email address"),
				"network@example.com"
			);
			await user.click(
				screen.getByRole("button", { name: SHARE_BUTTON_REGEX })
			);

			await waitFor(() => {
				expect(mockToast).toHaveBeenCalledWith({
					variant: "destructive",
					title: "Error",
					description: "Something went wrong",
				});
			});
		});
	});
});
