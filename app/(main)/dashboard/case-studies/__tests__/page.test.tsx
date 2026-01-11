import { render, screen } from "@testing-library/react";
import { redirect } from "next/navigation";
import type { Session } from "next-auth";
import { getServerSession } from "next-auth";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CaseStudy } from "@/types/domain";
import CaseStudiesPage from "../page";

type PageHeadingProps = {
	title: string;
	description: string;
	createButton?: boolean;
	redirectUrl?: string;
};

// Mock dependencies
vi.mock("next/navigation", () => ({
	redirect: vi.fn(),
}));

vi.mock("next-auth", () => ({
	getServerSession: vi.fn(),
}));

vi.mock("@/actions/case-studies", () => ({
	fetchCaseStudies: vi.fn(),
}));

vi.mock("@/lib/auth-options", () => ({
	authOptions: {},
}));

vi.mock("@/lib/sanitize-html", () => ({
	extractTextFromHtml: vi.fn((html: string) => html),
}));

// Mock child components
vi.mock("@/components/ui/page-heading", () => ({
	default: ({
		title,
		description,
		createButton,
		redirectUrl,
	}: PageHeadingProps) => (
		<div data-testid="page-heading">
			<h1>{title}</h1>
			<p>{description}</p>
			{createButton && (
				<button
					data-redirect-url={redirectUrl}
					data-testid="create-button"
					type="button"
				>
					Create
				</button>
			)}
		</div>
	),
}));

vi.mock("@/components/ui/separator", () => ({
	Separator: () => <hr data-testid="separator" />,
}));

vi.mock("../_components/table-actions", () => ({
	default: ({ caseStudy }: { caseStudy: CaseStudy }) => (
		<div data-testid={`table-actions-${caseStudy.id}`}>Actions</div>
	),
}));

// Mock Next.js Link
vi.mock("next/link", () => ({
	default: ({
		children,
		href,
	}: {
		children: React.ReactNode;
		href: string;
	}) => <a href={href}>{children}</a>,
}));

const mockCaseStudies = [
	{
		id: 1,
		title: "Test Case Study 1",
		description: "<p>Test description 1</p>",
		authors: "Author 1",
		createdOn: "2024-01-01T00:00:00Z",
		publishedDate: "2024-01-02T00:00:00Z",
		published: true,
		type: "learning",
		content: "Test content",
		owner: 1,
		image: null,
		assuranceCases: [],
	},
	{
		id: 2,
		title: "Test Case Study 2",
		description: "Test description 2",
		authors: "Author 2, Author 3",
		createdOn: "2024-01-03T00:00:00Z",
		publishedDate: null,
		published: false,
		type: "reference",
		content: "Test content 2",
		owner: 1,
		image: null,
		assuranceCases: [],
	},
];

describe("CaseStudiesPage", () => {
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

			await expect(CaseStudiesPage()).rejects.toThrow("NEXT_REDIRECT");

			expect(redirect).toHaveBeenCalledWith("/login");
		});

		it("should redirect to login if session has no user id", async () => {
			vi.mocked(getServerSession).mockResolvedValue({
				user: { name: "Test User", email: "test@example.com" },
				expires: "2025-12-31",
			} as Session);
			const mockRedirect = vi.mocked(redirect);
			mockRedirect.mockImplementation(() => {
				throw new Error("NEXT_REDIRECT");
			});

			await expect(CaseStudiesPage()).rejects.toThrow("NEXT_REDIRECT");

			expect(redirect).toHaveBeenCalledWith("/login");
		});
	});

	describe("With Authentication", () => {
		const mockSession = {
			user: { id: "1", name: "Test User", email: "test@example.com" },
			expires: "2025-12-31",
		};

		beforeEach(() => {
			vi.mocked(getServerSession).mockResolvedValue(mockSession as Session);
		});

		it("should render page heading with correct props", async () => {
			const { fetchCaseStudies } = await import("@/actions/case-studies");
			vi.mocked(fetchCaseStudies).mockResolvedValue(mockCaseStudies);

			const result = await CaseStudiesPage();
			render(result);

			const pageHeading = screen.getByTestId("page-heading");
			expect(pageHeading).toBeInTheDocument();
			expect(pageHeading).toHaveTextContent("Assurance Case Patterns");
			expect(pageHeading).toHaveTextContent(
				"Here you manage all your public patterns"
			);

			const createButton = screen.getByTestId("create-button");
			expect(createButton).toHaveAttribute(
				"data-redirect-url",
				"/dashboard/case-studies/create"
			);
		});

		it("should render table headers correctly", async () => {
			const { fetchCaseStudies } = await import("@/actions/case-studies");
			vi.mocked(fetchCaseStudies).mockResolvedValue(mockCaseStudies);

			const result = await CaseStudiesPage();
			const { container } = render(result);

			// Use more specific queries for table headers
			const headers = container.querySelectorAll("thead th");
			const headerTexts = Array.from(headers)
				.map((h) => h.textContent?.trim())
				.filter(Boolean);

			expect(headerTexts).toContain("Title");
			expect(headerTexts).toContain("Description");
			expect(headerTexts).toContain("Authors");
			expect(headerTexts).toContain("Created");
			expect(headerTexts).toContain("Public");
		});

		it("should display case studies in table rows", async () => {
			const { fetchCaseStudies } = await import("@/actions/case-studies");
			vi.mocked(fetchCaseStudies).mockResolvedValue(mockCaseStudies);

			const result = await CaseStudiesPage();
			render(result);

			// Check first case study
			expect(screen.getByText("Test Case Study 1")).toBeInTheDocument();
			expect(screen.getByText("Author 1")).toBeInTheDocument();

			// Check second case study
			expect(screen.getByText("Test Case Study 2")).toBeInTheDocument();
			expect(screen.getByText("Author 2, Author 3")).toBeInTheDocument();
		});

		it("should display empty state when no case studies", async () => {
			const { fetchCaseStudies } = await import("@/actions/case-studies");
			vi.mocked(fetchCaseStudies).mockResolvedValue([]);

			const result = await CaseStudiesPage();
			render(result);

			expect(screen.getByText("No Case Studies Found.")).toBeInTheDocument();
		});

		it("should render links to individual case studies", async () => {
			const { fetchCaseStudies } = await import("@/actions/case-studies");
			vi.mocked(fetchCaseStudies).mockResolvedValue(mockCaseStudies);

			const result = await CaseStudiesPage();
			render(result);

			const link1 = screen.getByText("Test Case Study 1").closest("a");
			expect(link1).toHaveAttribute("href", "case-studies/1");

			const link2 = screen.getByText("Test Case Study 2").closest("a");
			expect(link2).toHaveAttribute("href", "case-studies/2");
		});

		it("should show published icon for published case studies", async () => {
			const { fetchCaseStudies } = await import("@/actions/case-studies");
			vi.mocked(fetchCaseStudies).mockResolvedValue(mockCaseStudies);

			const result = await CaseStudiesPage();
			const { container } = render(result);

			// Look for CheckCircleIcon by its class
			const publishedIcons = container.querySelectorAll(".text-emerald-500");
			expect(publishedIcons).toHaveLength(1); // Only first case study is published
		});

		it("should format dates correctly", async () => {
			const { fetchCaseStudies } = await import("@/actions/case-studies");
			vi.mocked(fetchCaseStudies).mockResolvedValue(mockCaseStudies);

			const result = await CaseStudiesPage();
			render(result);

			// Check created dates are formatted as DD/MM/YYYY
			expect(screen.getByText("01/01/2024")).toBeInTheDocument();
			expect(screen.getByText("03/01/2024")).toBeInTheDocument();
		});

		it("should render table actions for each case study", async () => {
			const { fetchCaseStudies } = await import("@/actions/case-studies");
			vi.mocked(fetchCaseStudies).mockResolvedValue(mockCaseStudies);

			const result = await CaseStudiesPage();
			render(result);

			expect(screen.getByTestId("table-actions-1")).toBeInTheDocument();
			expect(screen.getByTestId("table-actions-2")).toBeInTheDocument();
		});

		it("should extract text from HTML descriptions", async () => {
			const { fetchCaseStudies } = await import("@/actions/case-studies");
			vi.mocked(fetchCaseStudies).mockResolvedValue(mockCaseStudies);
			const { extractTextFromHtml } = await import("@/lib/sanitize-html");

			const result = await CaseStudiesPage();
			render(result);

			// Verify extractTextFromHtml was called with HTML content
			expect(extractTextFromHtml).toHaveBeenCalledWith(
				"<p>Test description 1</p>"
			);
			expect(extractTextFromHtml).toHaveBeenCalledWith("Test description 2");
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
			const { fetchCaseStudies } = await import("@/actions/case-studies");
			vi.mocked(fetchCaseStudies).mockResolvedValue(mockCaseStudies);

			const result = await CaseStudiesPage();
			const { container } = render(result);

			const mainContainer = container.querySelector(
				".min-h-screen.space-y-4.p-8"
			);
			expect(mainContainer).toBeInTheDocument();
		});

		it("should render separator", async () => {
			const { fetchCaseStudies } = await import("@/actions/case-studies");
			vi.mocked(fetchCaseStudies).mockResolvedValue(mockCaseStudies);

			const result = await CaseStudiesPage();
			render(result);

			expect(screen.getByTestId("separator")).toBeInTheDocument();
		});

		it("should have responsive table classes", async () => {
			const { fetchCaseStudies } = await import("@/actions/case-studies");
			vi.mocked(fetchCaseStudies).mockResolvedValue(mockCaseStudies);

			const result = await CaseStudiesPage();
			const { container } = render(result);

			const table = container.querySelector("table");
			expect(table).toHaveClass(
				"min-w-full",
				"divide-y",
				"divide-foreground/10"
			);
		});
	});

	describe("Accessibility", () => {
		const mockSession = {
			user: { id: "1", name: "Test User", email: "test@example.com" },
			key: "mock-jwt-token",
			expires: "2025-12-31",
		};

		beforeEach(() => {
			vi.mocked(getServerSession).mockResolvedValue(mockSession as Session);
		});

		it("should have proper table structure with scope attributes", async () => {
			const { fetchCaseStudies } = await import("@/actions/case-studies");
			vi.mocked(fetchCaseStudies).mockResolvedValue(mockCaseStudies);

			const result = await CaseStudiesPage();
			const { container } = render(result);

			const headerCells = container.querySelectorAll("th[scope='col']");
			expect(headerCells.length).toBeGreaterThan(0);
		});

		it("should have screen reader only text", async () => {
			const { fetchCaseStudies } = await import("@/actions/case-studies");
			vi.mocked(fetchCaseStudies).mockResolvedValue(mockCaseStudies);

			const result = await CaseStudiesPage();
			const { container } = render(result);

			const srOnlyElements = container.querySelectorAll(".sr-only");
			expect(srOnlyElements.length).toBeGreaterThan(0);
		});
	});
});
