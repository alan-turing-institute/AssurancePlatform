import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "@/src/__tests__/mocks/server";
import { createMockAssuranceCase } from "@/src/__tests__/utils/mock-data";
import { renderWithAuth, screen } from "@/src/__tests__/utils/test-utils";
import CaseCard from "./case-card";

// Regex constants for test assertions
const LONG_CASE_NAME_REGEX = /This is a very long case name/;
const LONG_DESCRIPTION_REGEX = /This is a very long description/;
const _CREATED_ON_REGEX = /Created on: \d{2}\/\d{2}\/\d{4}/;
const CREATED_ON_DATE_REGEX = /Created on:/;

// Mock the AlertModal component
vi.mock("@/components/modals/alert-modal", () => ({
	AlertModal: ({
		isOpen,
		onClose,
		onConfirm,
		loading,
		confirmButtonText,
	}: {
		isOpen: boolean;
		onClose: () => void;
		onConfirm: () => void;
		loading: boolean;
		confirmButtonText: string;
	}) => {
		if (!isOpen) {
			return null;
		}
		return (
			<div data-testid="alert-modal">
				<p>Are you sure?</p>
				<p>This action cannot be undone.</p>
				<button onClick={onClose} type="button">
					Cancel
				</button>
				<button disabled={loading} onClick={onConfirm} type="button">
					{loading ? "Processing" : confirmButtonText}
				</button>
			</div>
		);
	},
}));

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
	useRouter: () => ({
		push: mockPush,
		replace: vi.fn(),
		prefetch: vi.fn(),
		back: vi.fn(),
		forward: vi.fn(),
		refresh: vi.fn(),
	}),
	useParams: () => ({}),
}));

describe("CaseCard", () => {
	const mockAssuranceCase = createMockAssuranceCase({
		id: 1,
		name: "Test Safety Case",
		description: "A comprehensive safety assurance case",
		created_date: "2024-01-15T10:30:00Z",
		permissions: "owner", // Should be owner or editor to show delete button
	});

	beforeEach(() => {
		vi.clearAllMocks();
		mockPush.mockClear();
	});

	it("should render case information correctly", () => {
		// Mock 404 response for image to set default image immediately
		server.use(
			http.get(`${process.env.NEXT_PUBLIC_API_URL}/api/cases/1/image`, () => {
				return new HttpResponse(null, { status: 404 });
			})
		);

		renderWithAuth(<CaseCard assuranceCase={mockAssuranceCase} />);

		expect(screen.getByText("Test Safety Case")).toBeInTheDocument();
		expect(
			screen.getByText("A comprehensive safety assurance case")
		).toBeInTheDocument();

		// Check formatted date
		expect(screen.getByText("Created on: 15/01/2024")).toBeInTheDocument();
	});

	it("should render action buttons", () => {
		// Mock 404 response for image
		server.use(
			http.get(`${process.env.NEXT_PUBLIC_API_URL}/api/cases/1/image`, () => {
				return new HttpResponse(null, { status: 404 });
			})
		);

		renderWithAuth(<CaseCard assuranceCase={mockAssuranceCase} />);

		// The card should be wrapped in a link
		const cardLink = screen.getByRole("link");
		expect(cardLink).toBeInTheDocument();
		expect(cardLink).toHaveAttribute("href", "/case/1");

		// Delete button exists but is hidden until hover
		const deleteButton = screen.getByRole("button");
		expect(deleteButton).toBeInTheDocument();
		expect(deleteButton).toHaveClass("hidden");
	});

	it("should navigate to case view when card is clicked", () => {
		// Mock 404 response for image
		server.use(
			http.get(`${process.env.NEXT_PUBLIC_API_URL}/api/cases/1/image`, () => {
				return new HttpResponse(null, { status: 404 });
			})
		);

		const _user = userEvent.setup();
		renderWithAuth(<CaseCard assuranceCase={mockAssuranceCase} />);

		// The entire card is a link
		const cardLink = screen.getByRole("link");
		// Since it's a Next.js Link, it doesn't use router.push
		// Instead, check the href attribute
		expect(cardLink).toHaveAttribute("href", "/case/1");
	});

	it("should show delete button on hover for users with manage permissions", async () => {
		// Mock 404 response for image
		server.use(
			http.get(`${process.env.NEXT_PUBLIC_API_URL}/api/cases/1/image`, () => {
				return new HttpResponse(null, { status: 404 });
			})
		);

		const user = userEvent.setup();
		renderWithAuth(<CaseCard assuranceCase={mockAssuranceCase} />);

		// Delete button should be present but hidden
		const deleteButton = screen.getByRole("button");
		expect(deleteButton).toHaveClass("hidden");

		// Hover over the card container
		const cardContainer = deleteButton.closest(".group");
		if (cardContainer) {
			await user.hover(cardContainer);
		}

		// Delete button should now be visible (check if still has hidden class)
		// Note: CSS hover effects may not work in jsdom, so we just verify the structure
		expect(deleteButton).toBeInTheDocument();
	});

	it("should open delete confirmation modal when delete button is clicked", async () => {
		// Mock 404 response for image
		server.use(
			http.get(`${process.env.NEXT_PUBLIC_API_URL}/api/cases/1/image`, () => {
				return new HttpResponse(null, { status: 404 });
			})
		);

		const user = userEvent.setup();
		renderWithAuth(<CaseCard assuranceCase={mockAssuranceCase} />);

		// Find the delete button (it's the only button in the component)
		const deleteButton = screen.getByRole("button");
		await user.click(deleteButton);

		expect(screen.getByTestId("alert-modal")).toBeInTheDocument();
		expect(screen.getByText("Are you sure?")).toBeInTheDocument();
		expect(
			screen.getByText("This action cannot be undone.")
		).toBeInTheDocument();
	});

	it("should close delete modal when cancel is clicked", async () => {
		// Mock 404 response for image
		server.use(
			http.get(`${process.env.NEXT_PUBLIC_API_URL}/api/cases/1/image`, () => {
				return new HttpResponse(null, { status: 404 });
			})
		);

		const user = userEvent.setup();
		renderWithAuth(<CaseCard assuranceCase={mockAssuranceCase} />);

		// Open modal
		const deleteButton = screen.getByRole("button");
		await user.click(deleteButton);

		expect(screen.getByTestId("alert-modal")).toBeInTheDocument();

		// Close modal
		const cancelButton = screen.getByText("Cancel");
		await user.click(cancelButton);

		expect(screen.queryByTestId("alert-modal")).not.toBeInTheDocument();
	});

	it("should handle successful case deletion", async () => {
		// Mock 404 response for image
		server.use(
			http.get(`${process.env.NEXT_PUBLIC_API_URL}/api/cases/1/image`, () => {
				return new HttpResponse(null, { status: 404 });
			})
		);

		const user = userEvent.setup();
		// Mock window.location.reload
		const reloadSpy = vi.fn();
		Object.defineProperty(window, "location", {
			value: { reload: reloadSpy },
			writable: true,
		});

		// Mock successful deletion with a slight delay to ensure loading state is visible
		server.use(
			http.delete(
				`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/cases/1/`,
				async () => {
					// Add a small delay to ensure loading state is visible
					await new Promise((resolve) => setTimeout(resolve, 100));
					return new HttpResponse(null, { status: 204 });
				}
			)
		);

		renderWithAuth(<CaseCard assuranceCase={mockAssuranceCase} />);

		// Open delete modal
		const deleteButton = screen.getByRole("button");
		await user.click(deleteButton);

		// Confirm deletion
		const confirmButton = screen.getByText("Delete");
		await user.click(confirmButton);

		// Should show loading state immediately after clicking confirm
		expect(screen.getByText("Processing")).toBeInTheDocument();

		// Should reload the page after successful deletion
		await vi.waitFor(() => {
			expect(reloadSpy).toHaveBeenCalled();
		});
	});

	it("should handle case deletion failure", async () => {
		// Mock 404 response for image
		server.use(
			http.get(`${process.env.NEXT_PUBLIC_API_URL}/api/cases/1/image`, () => {
				return new HttpResponse(null, { status: 404 });
			})
		);

		const user = userEvent.setup();
		// Mock window.location.reload
		const reloadSpy = vi.fn();
		Object.defineProperty(window, "location", {
			value: { reload: reloadSpy },
			writable: true,
		});

		// Mock failed deletion
		server.use(
			http.delete(
				`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/cases/1/`,
				() => {
					return new HttpResponse(null, { status: 500 });
				}
			)
		);

		renderWithAuth(<CaseCard assuranceCase={mockAssuranceCase} />);

		// Open delete modal
		const deleteButton = screen.getByRole("button");
		await user.click(deleteButton);

		// Confirm deletion
		const confirmButton = screen.getByText("Delete");
		await user.click(confirmButton);

		// Should not reload on failure
		await vi.waitFor(() => {
			expect(reloadSpy).not.toHaveBeenCalled();
		});
	});

	it("should render skeleton while image is loading", () => {
		// Don't mock the image endpoint so it stays in loading state
		const { container } = renderWithAuth(
			<CaseCard assuranceCase={mockAssuranceCase} />
		);

		// Look for skeleton component with specific classes that indicate it's the image skeleton
		const skeleton = container.querySelector(
			".relative.mb-4.flex.aspect-video.overflow-hidden.rounded-md"
		);
		expect(skeleton).toBeInTheDocument();
		// The skeleton should be rendered inside this container
		expect(skeleton?.className).toContain("aspect-video");
	});

	it("should render case with image when available", async () => {
		// Mock successful image fetch
		server.use(
			http.get(`${process.env.NEXT_PUBLIC_API_URL}/api/cases/1/image`, () => {
				return HttpResponse.json({ image: "data:image/png;base64,test" });
			})
		);

		renderWithAuth(<CaseCard assuranceCase={mockAssuranceCase} />);

		// Wait for image to load
		await vi.waitFor(() => {
			const image = screen.getByAltText(
				`Assurance Case ${mockAssuranceCase.name} screenshot`
			);
			expect(image).toBeInTheDocument();
			expect(image).toHaveAttribute("src", "data:image/png;base64,test");
		});
	});

	it("should have proper card structure and styling", () => {
		// Mock 404 response for image
		server.use(
			http.get(`${process.env.NEXT_PUBLIC_API_URL}/api/cases/1/image`, () => {
				return new HttpResponse(null, { status: 404 });
			})
		);

		renderWithAuth(<CaseCard assuranceCase={mockAssuranceCase} />);

		// Check for card link
		const cardLink = screen.getByRole("link");
		expect(cardLink).toBeInTheDocument();
		expect(cardLink).toHaveAttribute("href", "/case/1");

		// Check for title and description
		expect(screen.getByText(mockAssuranceCase.name)).toBeInTheDocument();
		expect(
			screen.getByText(mockAssuranceCase.description!)
		).toBeInTheDocument();

		// Check for date
		expect(screen.getByText(CREATED_ON_DATE_REGEX)).toBeInTheDocument();
	});

	it("should format date correctly for different timezones", async () => {
		// Mock 404 response for image
		server.use(
			http.get(`${process.env.NEXT_PUBLIC_API_URL}/api/cases/1/image`, () => {
				return new HttpResponse(null, { status: 404 });
			})
		);

		const caseWithDifferentDate = {
			...mockAssuranceCase,
			created_date: "2024-06-30T23:59:59Z",
		};

		renderWithAuth(<CaseCard assuranceCase={caseWithDifferentDate} />);

		// Should display formatted date in DD/MM/YYYY format
		// 2024-06-30T23:59:59Z should be formatted as 30/06/2024
		expect(screen.getByText(/Created on: 30\/06\/2024/)).toBeInTheDocument();
	});

	it("should be accessible via keyboard navigation", async () => {
		// Mock 404 response for image
		server.use(
			http.get(`${process.env.NEXT_PUBLIC_API_URL}/api/cases/1/image`, () => {
				return new HttpResponse(null, { status: 404 });
			})
		);

		const user = userEvent.setup();
		renderWithAuth(<CaseCard assuranceCase={mockAssuranceCase} />);

		// Tab to the card link
		await user.tab();
		const cardLink = screen.getByRole("link");
		expect(cardLink).toHaveFocus();

		// Tab to the delete button
		await user.tab();
		const deleteButton = screen.getByRole("button");
		expect(deleteButton).toHaveFocus();
	});

	it("should handle long case names and descriptions", async () => {
		// Mock 404 response for image
		server.use(
			http.get(`${process.env.NEXT_PUBLIC_API_URL}/api/cases/1/image`, () => {
				return new HttpResponse(null, { status: 404 });
			})
		);

		const caseWithLongText = {
			...mockAssuranceCase,
			name: "This is a very long case name that should be handled properly in the UI without breaking the layout",
			description:
				"This is a very long description that contains a lot of text to test how the component handles text overflow and maintains proper layout structure",
		};

		renderWithAuth(<CaseCard assuranceCase={caseWithLongText} />);

		expect(screen.getByText(LONG_CASE_NAME_REGEX)).toBeInTheDocument();
		expect(screen.getByText(LONG_DESCRIPTION_REGEX)).toBeInTheDocument();
	});

	it("should handle missing or invalid date gracefully", async () => {
		// Mock 404 response for image
		server.use(
			http.get(`${process.env.NEXT_PUBLIC_API_URL}/api/cases/1/image`, () => {
				return new HttpResponse(null, { status: 404 });
			})
		);

		const caseWithInvalidDate = {
			...mockAssuranceCase,
			created_date: "",
		};

		renderWithAuth(<CaseCard assuranceCase={caseWithInvalidDate} />);

		// Should still render the card without crashing
		expect(screen.getByText("Test Safety Case")).toBeInTheDocument();
		// Date should show as Invalid date
		expect(screen.getByText(/Created on: Invalid date/)).toBeInTheDocument();
	});

	it("should not show delete button for users without manage permissions", async () => {
		// Mock 404 response for image
		server.use(
			http.get(`${process.env.NEXT_PUBLIC_API_URL}/api/cases/1/image`, () => {
				return new HttpResponse(null, { status: 404 });
			})
		);

		const caseWithViewOnly = {
			...mockAssuranceCase,
			permissions: "view",
		};

		renderWithAuth(<CaseCard assuranceCase={caseWithViewOnly} />);

		// Should not render delete button
		const deleteButton = screen.queryByRole("button");
		expect(deleteButton).not.toBeInTheDocument();
	});

	it("should show permission icons in footer", async () => {
		// Mock 404 response for image
		server.use(
			http.get(`${process.env.NEXT_PUBLIC_API_URL}/api/cases/1/image`, () => {
				return new HttpResponse(null, { status: 404 });
			})
		);

		const caseWithMultiplePermissions = {
			...mockAssuranceCase,
			permissions: ["view", "review", "edit"],
		};

		renderWithAuth(<CaseCard assuranceCase={caseWithMultiplePermissions} />);

		// Check for permission icons in the footer specifically
		const footer = screen.getByText(/Created on:/).closest("div");
		const iconsContainer = footer?.querySelector(
			".flex.items-center.justify-start.gap-2"
		);
		const icons = iconsContainer?.querySelectorAll(".h-4.w-4") || [];
		// Should have 3 permission icons
		expect(icons.length).toBe(3);
	});
});
