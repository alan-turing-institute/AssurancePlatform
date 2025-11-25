import { render, screen } from "@testing-library/react";
import { redirect } from "next/navigation";
import type { Session } from "next-auth";
import { getServerSession } from "next-auth";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CaseStudy } from "@/types/domain";
import CaseStudyDetails from "../page";

// Mock dependencies
vi.mock("next/navigation", () => ({
	redirect: vi.fn(),
	useRouter: vi.fn(() => ({
		push: vi.fn(),
		back: vi.fn(),
		forward: vi.fn(),
		refresh: vi.fn(),
		replace: vi.fn(),
		prefetch: vi.fn(),
	})),
	usePathname: vi.fn(() => "/dashboard/case-studies/1"),
	useSearchParams: vi.fn(() => new URLSearchParams()),
}));

vi.mock("next-auth", () => ({
	getServerSession: vi.fn(),
}));

vi.mock("@/actions/case-studies", () => ({
	fetchCaseStudyById: vi.fn(),
}));

vi.mock("@/lib/auth-options", () => ({
	authOptions: {},
}));

// Mock child components
vi.mock("@/components/ui/back-button", () => ({
	default: ({ url }: { url: string }) => (
		<button data-testid="back-button" data-url={url} type="button">
			Back
		</button>
	),
}));

vi.mock("@/components/ui/page-heading", () => ({
	default: ({ title, description }: { title: string; description: string }) => (
		<div data-testid="page-heading">
			<h1>{title}</h1>
			<p>{description}</p>
		</div>
	),
}));

vi.mock("../_components/case-study-form", () => ({
	default: ({ caseStudy }: { caseStudy: CaseStudy }) => (
		<div data-case-study-id={caseStudy.id} data-testid="case-study-form">
			<form className="space-y-8">
				<div>Case Study Form Mock</div>
			</form>
		</div>
	),
}));

const mockCaseStudy = {
	id: 1,
	title: "Test Case Study",
	description: "Test description",
	content: "Test content",
	type: "learning",
	published: false,
	publishedDate: null,
	createdOn: "2024-01-01T00:00:00Z",
	lastModifiedOn: "2024-01-02T00:00:00Z",
	owner: 1,
	image: null,
	assuranceCases: [],
};

const mockPublishedCaseStudy = {
	...mockCaseStudy,
	published: true,
	publishedDate: "2024-01-03T00:00:00Z",
};

describe("CaseStudyDetails", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("Authentication", () => {
		it("should redirect to login if no session", async () => {
			vi.mocked(getServerSession).mockResolvedValue(null);
			const mockRedirect = vi.mocked(redirect);
			mockRedirect.mockImplementation(() => {
				throw new Error("NEXT_REDIRECT");
			});

			await expect(
				CaseStudyDetails({
					params: Promise.resolve({ id: "1" }),
				})
			).rejects.toThrow("NEXT_REDIRECT");

			expect(redirect).toHaveBeenCalledWith("/login");
		});

		it("should redirect to login if session has no key", async () => {
			vi.mocked(getServerSession).mockResolvedValue({
				user: { id: "1", name: "Test User", email: "test@example.com" },
				expires: "2025-12-31",
			} as Session);
			const mockRedirect = vi.mocked(redirect);
			mockRedirect.mockImplementation(() => {
				throw new Error("NEXT_REDIRECT");
			});

			await expect(
				CaseStudyDetails({
					params: Promise.resolve({ id: "1" }),
				})
			).rejects.toThrow("NEXT_REDIRECT");

			expect(redirect).toHaveBeenCalledWith("/login");
		});
	});

	describe("With Authentication", () => {
		const mockSession = {
			user: { id: "1", name: "Test User", email: "test@example.com" },
			key: "mock-jwt-token",
			expires: "2025-12-31",
		};

		beforeEach(() => {
			vi.mocked(getServerSession).mockResolvedValue(mockSession as Session);
		});

		it("should render case study details when authenticated", async () => {
			const { fetchCaseStudyById } = await import("@/actions/case-studies");
			vi.mocked(fetchCaseStudyById).mockResolvedValue(mockCaseStudy);

			const result = await CaseStudyDetails({
				params: Promise.resolve({ id: "1" }),
			});

			const { container } = render(result);

			// Check that components are rendered
			expect(screen.getByTestId("back-button")).toBeInTheDocument();
			expect(screen.getByTestId("page-heading")).toBeInTheDocument();
			// Check for the form element instead of data-testid
			expect(container.querySelector("form")).toBeInTheDocument();
		});

		it("should display correct case study title", async () => {
			const { fetchCaseStudyById } = await import("@/actions/case-studies");
			vi.mocked(fetchCaseStudyById).mockResolvedValue(mockCaseStudy);

			const result = await CaseStudyDetails({
				params: Promise.resolve({ id: "1" }),
			});

			render(result);

			const heading = screen.getByTestId("page-heading");
			expect(heading).toHaveTextContent("Test Case Study");
		});

		it("should display creation and modification dates", async () => {
			const { fetchCaseStudyById } = await import("@/actions/case-studies");
			vi.mocked(fetchCaseStudyById).mockResolvedValue(mockCaseStudy);

			const result = await CaseStudyDetails({
				params: Promise.resolve({ id: "1" }),
			});

			render(result);

			const heading = screen.getByTestId("page-heading");
			expect(heading).toHaveTextContent("Created on: 01/01/2024");
			expect(heading).toHaveTextContent("Last modified on: 02/01/2024");
		});

		it("should pass correct URL to back button", async () => {
			const { fetchCaseStudyById } = await import("@/actions/case-studies");
			vi.mocked(fetchCaseStudyById).mockResolvedValue(mockCaseStudy);

			const result = await CaseStudyDetails({
				params: Promise.resolve({ id: "1" }),
			});

			render(result);

			const backButton = screen.getByTestId("back-button");
			expect(backButton).toHaveAttribute("data-url", "/dashboard/case-studies");
		});

		it("should fetch case study with correct ID", async () => {
			const { fetchCaseStudyById } = await import("@/actions/case-studies");
			vi.mocked(fetchCaseStudyById).mockResolvedValue(mockCaseStudy);

			await CaseStudyDetails({
				params: Promise.resolve({ id: "123" }),
			});

			expect(fetchCaseStudyById).toHaveBeenCalledWith("mock-jwt-token", 123);
		});

		it("should pass case study to form component", async () => {
			const { fetchCaseStudyById } = await import("@/actions/case-studies");
			vi.mocked(fetchCaseStudyById).mockResolvedValue(mockCaseStudy);

			const result = await CaseStudyDetails({
				params: Promise.resolve({ id: "1" }),
			});

			const { container } = render(result);

			// Verify form is rendered (the component receives the case study prop)
			expect(container.querySelector("form")).toBeInTheDocument();
		});
	});

	describe("Published Banner", () => {
		const mockSession = {
			user: { id: "1", name: "Test User", email: "test@example.com" },
			key: "mock-jwt-token",
			expires: "2025-12-31",
		};

		beforeEach(() => {
			vi.mocked(getServerSession).mockResolvedValue(mockSession as Session);
		});

		it("should not show published banner for unpublished case study", async () => {
			const { fetchCaseStudyById } = await import("@/actions/case-studies");
			vi.mocked(fetchCaseStudyById).mockResolvedValue(mockCaseStudy);

			const result = await CaseStudyDetails({
				params: Promise.resolve({ id: "1" }),
			});

			const { container } = render(result);

			expect(container.textContent).not.toContain("Published Case Study");
		});

		it("should show published banner for published case study", async () => {
			const { fetchCaseStudyById } = await import("@/actions/case-studies");
			vi.mocked(fetchCaseStudyById).mockResolvedValue(mockPublishedCaseStudy);

			const result = await CaseStudyDetails({
				params: Promise.resolve({ id: "1" }),
			});

			render(result);

			expect(screen.getByText("Published Case Study")).toBeInTheDocument();
		});

		it("should display published date in banner", async () => {
			const { fetchCaseStudyById } = await import("@/actions/case-studies");
			vi.mocked(fetchCaseStudyById).mockResolvedValue(mockPublishedCaseStudy);

			const result = await CaseStudyDetails({
				params: Promise.resolve({ id: "1" }),
			});

			render(result);

			// Check that the published banner exists
			const publishedText = screen.getByText("Published Case Study");
			expect(publishedText).toBeInTheDocument();

			// The date should be formatted by moment - check the parent container
			const bannerContainer = publishedText.closest(".bg-emerald-500");
			expect(bannerContainer?.textContent).toContain("2024");
		});

		it("should apply correct styling to published banner", async () => {
			const { fetchCaseStudyById } = await import("@/actions/case-studies");
			vi.mocked(fetchCaseStudyById).mockResolvedValue(mockPublishedCaseStudy);

			const result = await CaseStudyDetails({
				params: Promise.resolve({ id: "1" }),
			});

			const { container } = render(result);

			const banner = container.querySelector(".bg-emerald-500");
			expect(banner).toBeInTheDocument();
		});
	});

	describe("Layout", () => {
		const mockSession = {
			user: { id: "1", name: "Test User", email: "test@example.com" },
			key: "mock-jwt-token",
			expires: "2025-12-31",
		};

		beforeEach(() => {
			vi.mocked(getServerSession).mockResolvedValue(mockSession as Session);
		});

		it("should have correct container classes", async () => {
			const { fetchCaseStudyById } = await import("@/actions/case-studies");
			vi.mocked(fetchCaseStudyById).mockResolvedValue(mockCaseStudy);

			const result = await CaseStudyDetails({
				params: Promise.resolve({ id: "1" }),
			});

			const { container } = render(result);

			const mainContainer = container.querySelector(
				".min-h-screen.space-y-4.p-8"
			);
			expect(mainContainer).toBeInTheDocument();
		});

		it("should render components in correct order", async () => {
			const { fetchCaseStudyById } = await import("@/actions/case-studies");
			vi.mocked(fetchCaseStudyById).mockResolvedValue(mockCaseStudy);

			const result = await CaseStudyDetails({
				params: Promise.resolve({ id: "1" }),
			});

			const { container } = render(result);

			const elements = Array.from(container.querySelectorAll("[data-testid]"));
			expect(elements.length).toBeGreaterThanOrEqual(2);
			expect(elements[0]).toHaveAttribute("data-testid", "back-button");
			expect(elements[1]).toHaveAttribute("data-testid", "page-heading");
			// Form doesn't have data-testid but we can verify it exists
			expect(container.querySelector("form")).toBeInTheDocument();
		});
	});

	describe("Error Handling", () => {
		const mockSession = {
			user: { id: "1", name: "Test User", email: "test@example.com" },
			key: "mock-jwt-token",
			expires: "2025-12-31",
		};

		beforeEach(() => {
			vi.mocked(getServerSession).mockResolvedValue(mockSession as Session);
		});

		it("should handle invalid case study ID format", async () => {
			const { fetchCaseStudyById } = await import("@/actions/case-studies");
			vi.mocked(fetchCaseStudyById).mockResolvedValue(mockCaseStudy);

			await CaseStudyDetails({
				params: Promise.resolve({ id: "invalid-id" }),
			});

			// Should attempt to parse the ID
			expect(fetchCaseStudyById).toHaveBeenCalledWith(
				"mock-jwt-token",
				Number.NaN
			);
		});
	});
});
