import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/src/__tests__/utils/test-utils";
import DesktopNav from "../desktop-nav";

// Mock Next.js components
vi.mock("next/image", () => ({
	default: ({
		alt,
		className,
		src,
	}: {
		alt: string;
		className: string;
		src: string;
	}) => <img alt={alt} className={className} src={src} />,
}));

vi.mock("next/link", () => ({
	default: ({
		children,
		href,
	}: {
		children: React.ReactNode;
		href: string;
	}) => <a href={href}>{children}</a>,
}));

// Mock the LoggedInUser component
vi.mock("../logged-in-user", () => ({
	default: () => <div data-testid="logged-in-user">Logged In User</div>,
}));

// Mock the Separator component
vi.mock("@/components/ui/separator", () => ({
	Separator: ({ className }: { className: string }) => (
		<div className={className} data-testid="separator" />
	),
}));

// Mock next/navigation
const mockUsePathname = vi.fn();
vi.mock("next/navigation", async (importOriginal) => {
	const actual = (await importOriginal()) as Record<string, unknown>;
	return {
		...actual,
		usePathname: () => mockUsePathname(),
	};
});

describe("DesktopNav", () => {
	beforeEach(() => {
		mockUsePathname.mockReturnValue("/dashboard");
	});

	describe("Component Structure", () => {
		it("should render with correct layout classes", () => {
			const { container } = render(<DesktopNav />);

			const desktopNavContainer = container.firstChild as Element;
			expect(desktopNavContainer).toHaveClass(
				"hidden",
				"lg:fixed",
				"lg:inset-y-0",
				"lg:z-50",
				"lg:flex",
				"lg:w-72",
				"lg:flex-col"
			);
		});

		it("should render with proper sidebar styling", () => {
			const { container } = render(<DesktopNav />);

			const sidebar = container.querySelector(".bg-indigo-600");
			expect(sidebar).toHaveClass(
				"flex",
				"grow",
				"flex-col",
				"gap-y-5",
				"overflow-y-auto",
				"bg-indigo-600",
				"px-6",
				"pb-4",
				"dark:bg-slate-900"
			);
		});
	});

	describe("Logo and Branding", () => {
		it("should render the platform logo and title", () => {
			render(<DesktopNav />);

			const logo = screen.getByAltText("Turing Ethical Assurance Logo");
			expect(logo).toBeInTheDocument();
			expect(logo).toHaveClass("w-16");
			expect(logo).toHaveAttribute("src", "/images/tea-logo2.png");

			expect(
				screen.getByText("Trustworthy and Ethical Assurance Platform")
			).toBeInTheDocument();
		});

		it("should wrap logo in dashboard link", () => {
			render(<DesktopNav />);

			const links = screen.getAllByRole("link");
			const logoLink = links.find(
				(link) =>
					link.getAttribute("href") === "/dashboard" &&
					link.querySelector('img[alt="Turing Ethical Assurance Logo"]')
			);
			expect(logoLink).toBeInTheDocument();
			expect(logoLink).toHaveAttribute("href", "/dashboard");
		});
	});

	describe("Navigation Items", () => {
		it("should render navigation items from config", () => {
			render(<DesktopNav />);

			expect(screen.getByText("My Assurance Cases")).toBeInTheDocument();
			expect(screen.getByText("Shared With Me")).toBeInTheDocument();
			expect(screen.getByText("Case Studies")).toBeInTheDocument();
			expect(screen.getByText("Discover Public Projects")).toBeInTheDocument();
		});

		it("should highlight active navigation item based on pathname", () => {
			mockUsePathname.mockReturnValue("/dashboard");
			render(<DesktopNav />);

			const links = screen.getAllByRole("link");
			const activeLink = links.find(
				(link) =>
					link.textContent?.includes("My Assurance Cases") &&
					link.getAttribute("href") === "/dashboard"
			);
			expect(activeLink).toHaveClass("bg-indigo-700", "text-white");
		});

		it("should apply inactive styling to non-active items", () => {
			mockUsePathname.mockReturnValue("/dashboard");
			render(<DesktopNav />);

			const links = screen.getAllByRole("link");
			const inactiveLink = links.find((link) =>
				link.textContent?.includes("Shared With Me")
			);
			expect(inactiveLink).toHaveClass("text-indigo-200");
		});

		it("should handle external links with proper attributes", () => {
			render(<DesktopNav />);

			const externalLinks = screen
				.getAllByRole("link")
				.filter((link) => link.getAttribute("target") === "_blank");
			expect(externalLinks.length).toBeGreaterThan(0);

			for (const link of externalLinks) {
				expect(link).toHaveAttribute("target", "_blank");
				if (link.getAttribute("rel")) {
					expect(link).toHaveAttribute("rel", "noopener");
				}
			}
		});
	});

	describe("Teams Section", () => {
		it("should show 'No teams added' when teams array is empty", () => {
			render(<DesktopNav />);

			expect(screen.getByText("Your teams")).toBeInTheDocument();
			expect(screen.getByText("No teams added")).toBeInTheDocument();
		});

		it("should show proper teams section styling", () => {
			render(<DesktopNav />);

			const teamsHeader = screen.getByText("Your teams");
			expect(teamsHeader).toHaveClass(
				"font-semibold",
				"text-indigo-200",
				"text-xs",
				"leading-6"
			);
		});
	});

	describe("User Section", () => {
		it("should render LoggedInUser component", () => {
			render(<DesktopNav />);

			expect(screen.getByTestId("logged-in-user")).toBeInTheDocument();
		});

		it("should have separators in navigation", () => {
			render(<DesktopNav />);

			const separators = screen.getAllByTestId("separator");
			expect(separators.length).toBeGreaterThan(0);
		});
	});

	describe("Accessibility and Structure", () => {
		it("should have semantic navigation structure", () => {
			render(<DesktopNav />);

			const nav = screen.getByRole("navigation");
			expect(nav).toBeInTheDocument();
			expect(nav).toHaveClass("flex", "flex-1", "flex-col");
		});

		it("should have proper list structure", () => {
			render(<DesktopNav />);

			const lists = screen.getAllByRole("list");
			expect(lists.length).toBeGreaterThan(0);
		});
	});

	describe("Responsive Design", () => {
		it("should have correct responsive classes", () => {
			const { container } = render(<DesktopNav />);

			const desktopNavContainer = container.firstChild as Element;
			expect(desktopNavContainer).toHaveClass("hidden");
			expect(desktopNavContainer).toHaveClass("lg:flex");
			expect(desktopNavContainer).toHaveClass("lg:fixed");
			expect(desktopNavContainer).toHaveClass("lg:z-50");
		});

		it("should have proper sidebar styling", () => {
			const { container } = render(<DesktopNav />);

			const sidebar = container.querySelector(".bg-indigo-600");
			expect(sidebar).toHaveClass("dark:bg-slate-900");
		});
	});

	describe("Different Pathname Scenarios", () => {
		it("should handle different pathnames correctly", () => {
			mockUsePathname.mockReturnValue("/dashboard/shared");
			render(<DesktopNav />);

			const links = screen.getAllByRole("link");
			const activeLink = links.find(
				(link) => link.getAttribute("href") === "/dashboard/shared"
			);
			expect(activeLink).toHaveClass("bg-indigo-700", "text-white");
		});

		it("should handle root pathname", () => {
			mockUsePathname.mockReturnValue("/");
			render(<DesktopNav />);

			// Should render without errors
			expect(screen.getByText("My Assurance Cases")).toBeInTheDocument();
		});

		it("should handle discover pathname", () => {
			mockUsePathname.mockReturnValue("/discover");
			render(<DesktopNav />);

			const links = screen.getAllByRole("link");
			const activeLink = links.find(
				(link) => link.getAttribute("href") === "/discover"
			);
			expect(activeLink).toHaveClass("bg-indigo-700", "text-white");
		});
	});
});
