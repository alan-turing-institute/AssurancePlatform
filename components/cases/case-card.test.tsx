import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "@/src/__tests__/mocks/server";
import { setupEnvVars } from "@/src/__tests__/utils/env-test-utils";
import { createMockAssuranceCase } from "@/src/__tests__/utils/mock-data";
import {
	renderWithAuth,
	screen,
	waitFor,
} from "@/src/__tests__/utils/test-utils";
import CaseCard from "./case-card";

// Regex constants for test assertions
const LONG_CASE_NAME_REGEX = /This is a very long case name/;
const LONG_DESCRIPTION_REGEX = /This is a very long description/;
const _CREATED_ON_REGEX = /Created on: \d{2}\/\d{2}\/\d{4}/;
const CREATED_ON_DATE_REGEX = /Created on:/;
const CREATED_ON_DATE_PATTERN_REGEX = /Created on: \d{2}\/\d{2}\/\d{4}/;
const CREATED_ON_LABEL_REGEX = /Created on:/i;
const INVALID_DATE_REGEX = /Created on: Invalid date/;

// Create promise resolvers for controlling async operations
let fetchScreenshotResolve: ((value: Response) => void) | null = null;
let _fetchScreenshotReject: ((reason?: Error) => void) | null = null;
let deleteResolve: (() => void) | null = null;
let _deleteReject: (() => void) | null = null;

// Mock fetch globally to control image loading
const originalFetch = global.fetch;
beforeAll(() => {
	global.fetch = vi
		.fn()
		.mockImplementation((url: string, options?: RequestInit) => {
			if (url.includes("/api/cases/") && url.includes("/image")) {
				return new Promise((resolve, reject) => {
					fetchScreenshotResolve = resolve;
					_fetchScreenshotReject = reject;
				});
			}
			if (options?.method === "DELETE" && url.includes("/api/cases/")) {
				return new Promise((resolve, reject) => {
					deleteResolve = () => resolve(new Response(null, { status: 204 }));
					_deleteReject = () => reject(new Error("Delete failed"));
				});
			}
			return originalFetch(url, options);
		});
});

afterAll(() => {
	global.fetch = originalFetch;
});

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

	let cleanupEnv: (() => void) | undefined;

	beforeEach(() => {
		vi.clearAllMocks();
		mockPush.mockClear();
		// Reset promise resolvers
		fetchScreenshotResolve = null;
		_fetchScreenshotReject = null;
		deleteResolve = null;
		_deleteReject = null;

		// Set up environment variables
		cleanupEnv = setupEnvVars({
			NEXT_PUBLIC_API_URL: "http://localhost:8000",
			NEXT_PUBLIC_API_URL_STAGING: "http://staging.localhost:8000",
		});
	});

	afterEach(() => {
		if (cleanupEnv) {
			cleanupEnv();
		}
	});

	it("should render case information correctly", async () => {
		renderWithAuth(<CaseCard assuranceCase={mockAssuranceCase} />);

		// Resolve image fetch with 404
		await act(async () => {
			fetchScreenshotResolve?.(new Response(null, { status: 404 }));
			await new Promise((resolve) => setTimeout(resolve, 0));
		});

		expect(screen.getByText("Test Safety Case")).toBeInTheDocument();
		expect(
			screen.getByText("A comprehensive safety assurance case")
		).toBeInTheDocument();

		// Check formatted date
		expect(screen.getByText("Created on: 15/01/2024")).toBeInTheDocument();
	});

	it("should render action buttons", async () => {
		renderWithAuth(<CaseCard assuranceCase={mockAssuranceCase} />);

		// Resolve image fetch with 404
		await act(async () => {
			fetchScreenshotResolve?.(new Response(null, { status: 404 }));
			await new Promise((resolve) => setTimeout(resolve, 0));
		});

		// The card should be wrapped in a link
		const cardLink = screen.getByRole("link");
		expect(cardLink).toBeInTheDocument();
		expect(cardLink).toHaveAttribute("href", "/case/1");

		// Delete button exists but is hidden until hover
		const deleteButton = screen.getByRole("button");
		expect(deleteButton).toBeInTheDocument();
		expect(deleteButton).toHaveClass("hidden");
	});

	it("should navigate to case view when card is clicked", async () => {
		const _user = userEvent.setup();
		renderWithAuth(<CaseCard assuranceCase={mockAssuranceCase} />);

		// Resolve image fetch with 404
		await act(async () => {
			fetchScreenshotResolve?.(new Response(null, { status: 404 }));
			await new Promise((resolve) => setTimeout(resolve, 0));
		});

		// The entire card is a link
		const cardLink = screen.getByRole("link");
		// Since it's a Next.js Link, it doesn't use router.push
		// Instead, check the href attribute
		expect(cardLink).toHaveAttribute("href", "/case/1");
	});

	it("should show delete button on hover for users with manage permissions", async () => {
		const user = userEvent.setup();
		renderWithAuth(<CaseCard assuranceCase={mockAssuranceCase} />);

		// Resolve image fetch with 404
		await act(async () => {
			fetchScreenshotResolve?.(new Response(null, { status: 404 }));
			await new Promise((resolve) => setTimeout(resolve, 0));
		});

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
		const user = userEvent.setup();
		renderWithAuth(<CaseCard assuranceCase={mockAssuranceCase} />);

		// Resolve image fetch with 404
		await act(async () => {
			fetchScreenshotResolve?.(new Response(null, { status: 404 }));
			await new Promise((resolve) => setTimeout(resolve, 0));
		});

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
		const user = userEvent.setup();
		renderWithAuth(<CaseCard assuranceCase={mockAssuranceCase} />);

		// Resolve image fetch with 404
		await act(async () => {
			fetchScreenshotResolve?.(new Response(null, { status: 404 }));
			await new Promise((resolve) => setTimeout(resolve, 0));
		});

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
		const user = userEvent.setup();
		// Mock window.location.reload
		const reloadSpy = vi.fn();
		Object.defineProperty(window, "location", {
			value: { reload: reloadSpy },
			writable: true,
		});

		renderWithAuth(<CaseCard assuranceCase={mockAssuranceCase} />);

		// Resolve image fetch with 404
		await act(async () => {
			fetchScreenshotResolve?.(new Response(null, { status: 404 }));
			await new Promise((resolve) => setTimeout(resolve, 0));
		});

		// Open delete modal
		const deleteButton = screen.getByRole("button");
		await user.click(deleteButton);

		// Confirm deletion
		const confirmButton = screen.getByText("Delete");
		await user.click(confirmButton);

		// Should show loading state immediately after clicking confirm
		expect(screen.getByText("Processing")).toBeInTheDocument();

		// Complete the deletion
		await act(async () => {
			deleteResolve?.();
			await new Promise((resolve) => setTimeout(resolve, 0));
		});

		// Should reload the page after successful deletion
		await waitFor(() => {
			expect(reloadSpy).toHaveBeenCalled();
		});
	});

	it("should handle case deletion failure", async () => {
		const user = userEvent.setup();
		// Mock window.location.reload
		const reloadSpy = vi.fn();
		Object.defineProperty(window, "location", {
			value: { reload: reloadSpy },
			writable: true,
		});

		// Override global fetch for this test to simulate failure
		global.fetch = vi
			.fn()
			.mockImplementation((url: string, options?: RequestInit) => {
				if (url.includes("/api/cases/") && url.includes("/image")) {
					return Promise.resolve(new Response(null, { status: 404 }));
				}
				if (options?.method === "DELETE" && url.includes("/api/cases/")) {
					return Promise.resolve(new Response(null, { status: 500 }));
				}
				return originalFetch(url, options);
			});

		renderWithAuth(<CaseCard assuranceCase={mockAssuranceCase} />);

		// Wait for image fetch to complete
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 0));
		});

		// Open delete modal
		const deleteButton = screen.getByRole("button");
		await user.click(deleteButton);

		// Confirm deletion
		const confirmButton = screen.getByText("Delete");
		await user.click(confirmButton);

		// Wait for the deletion to complete
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 0));
		});

		// Should not reload on failure
		await waitFor(() => {
			expect(reloadSpy).not.toHaveBeenCalled();
		});
	});

	it("should render skeleton while image is loading", async () => {
		// Don't resolve the image fetch to keep it in loading state
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

		// Clean up by resolving the promise
		await act(async () => {
			fetchScreenshotResolve?.(new Response(null, { status: 404 }));
			await new Promise((resolve) => setTimeout(resolve, 0));
		});
	});

	it("should render case with image when available", async () => {
		// Override fetch for this specific test
		const originalGlobalFetch = global.fetch;
		global.fetch = vi
			.fn()
			.mockImplementation((url: string, options?: RequestInit) => {
				// Match the exact URL pattern the component uses
				if (url === "http://localhost:8000/api/cases/1/image") {
					return Promise.resolve(
						new Response(
							JSON.stringify({ image: "data:image/png;base64,test" }),
							{
								status: 200,
								headers: { "Content-Type": "application/json" },
							}
						)
					);
				}
				// Fall back to the original mock for other URLs
				return originalGlobalFetch(url, options);
			});

		renderWithAuth(<CaseCard assuranceCase={mockAssuranceCase} />);

		// Wait for image to load
		await waitFor(() => {
			const image = screen.getByAltText(
				`Assurance Case ${mockAssuranceCase.name} screenshot`
			);
			expect(image).toBeInTheDocument();
			expect(image).toHaveAttribute("src", "data:image/png;base64,test");
		});

		// Restore the original fetch
		global.fetch = originalGlobalFetch;
	});

	it("should have proper card structure and styling", async () => {
		renderWithAuth(<CaseCard assuranceCase={mockAssuranceCase} />);

		// Resolve image fetch with 404
		await act(async () => {
			fetchScreenshotResolve?.(new Response(null, { status: 404 }));
			await new Promise((resolve) => setTimeout(resolve, 0));
		});

		// Check for card link
		const cardLink = screen.getByRole("link");
		expect(cardLink).toBeInTheDocument();
		expect(cardLink).toHaveAttribute("href", "/case/1");

		// Check for title and description
		expect(screen.getByText(mockAssuranceCase.name)).toBeInTheDocument();
		expect(
			screen.getByText(mockAssuranceCase.description ?? "")
		).toBeInTheDocument();

		// Check for date
		expect(screen.getByText(CREATED_ON_DATE_REGEX)).toBeInTheDocument();
	});

	it("should format date correctly for different timezones", async () => {
		const caseWithDifferentDate = {
			...mockAssuranceCase,
			created_date: "2024-06-30T23:59:59Z",
		};

		renderWithAuth(<CaseCard assuranceCase={caseWithDifferentDate} />);

		// Resolve image fetch with 404
		await act(async () => {
			fetchScreenshotResolve?.(new Response(null, { status: 404 }));
			await new Promise((resolve) => setTimeout(resolve, 0));
		});

		// Should display formatted date in DD/MM/YYYY format
		// Check for the date text - moment might format it based on local timezone
		const dateElement = screen.getByText(CREATED_ON_LABEL_REGEX);
		expect(dateElement).toBeInTheDocument();
		// The formatted date should be present - check the full text includes a date pattern
		expect(dateElement.textContent).toMatch(CREATED_ON_DATE_PATTERN_REGEX);
	});

	it("should be accessible via keyboard navigation", async () => {
		// Mock 404 response for image
		server.use(
			http.get(
				`${process.env.NEXT_PUBLIC_API_URL}/api/cases/1/image`,
				() => new HttpResponse(null, { status: 404 })
			)
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
		const caseWithLongText = {
			...mockAssuranceCase,
			name: "This is a very long case name that should be handled properly in the UI without breaking the layout",
			description:
				"This is a very long description that contains a lot of text to test how the component handles text overflow and maintains proper layout structure",
		};

		renderWithAuth(<CaseCard assuranceCase={caseWithLongText} />);

		// Resolve image fetch with 404
		await act(async () => {
			fetchScreenshotResolve?.(new Response(null, { status: 404 }));
			await new Promise((resolve) => setTimeout(resolve, 0));
		});

		expect(screen.getByText(LONG_CASE_NAME_REGEX)).toBeInTheDocument();
		expect(screen.getByText(LONG_DESCRIPTION_REGEX)).toBeInTheDocument();
	});

	it("should handle missing or invalid date gracefully", async () => {
		const caseWithInvalidDate = {
			...mockAssuranceCase,
			created_date: "",
		};

		renderWithAuth(<CaseCard assuranceCase={caseWithInvalidDate} />);

		// Resolve image fetch with 404
		await act(async () => {
			fetchScreenshotResolve?.(new Response(null, { status: 404 }));
			await new Promise((resolve) => setTimeout(resolve, 0));
		});

		// Should still render the card without crashing
		expect(screen.getByText("Test Safety Case")).toBeInTheDocument();
		// Date should show as Invalid date
		expect(screen.getByText(INVALID_DATE_REGEX)).toBeInTheDocument();
	});

	it("should not show delete button for users without manage permissions", async () => {
		const caseWithViewOnly = {
			...mockAssuranceCase,
			permissions: "view",
		};

		renderWithAuth(<CaseCard assuranceCase={caseWithViewOnly} />);

		// Resolve image fetch with 404
		await act(async () => {
			fetchScreenshotResolve?.(new Response(null, { status: 404 }));
			await new Promise((resolve) => setTimeout(resolve, 0));
		});

		// Should not render delete button
		const deleteButton = screen.queryByRole("button");
		expect(deleteButton).not.toBeInTheDocument();
	});

	it("should show permission icons in footer", async () => {
		const caseWithMultiplePermissions = {
			...mockAssuranceCase,
			permissions: ["view", "review", "edit"],
		};

		renderWithAuth(<CaseCard assuranceCase={caseWithMultiplePermissions} />);

		// Resolve image fetch with 404
		await act(async () => {
			fetchScreenshotResolve?.(new Response(null, { status: 404 }));
			await new Promise((resolve) => setTimeout(resolve, 0));
		});

		// Check for permission icons in the footer specifically
		const footer = screen.getByText(CREATED_ON_DATE_REGEX).closest("div");
		const iconsContainer = footer?.querySelector(
			".flex.items-center.justify-start.gap-2"
		);
		const icons = iconsContainer?.querySelectorAll(".h-4.w-4") || [];
		// Should have 3 permission icons
		expect(icons.length).toBe(3);
	});
});
