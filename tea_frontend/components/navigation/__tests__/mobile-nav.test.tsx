import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/src/__tests__/utils/test-utils";
import { MobileNav } from "../mobile-nav";

// Mock Next.js components
vi.mock("next/image", () => ({
	default: ({ alt, className, src }: { alt: string; className: string; src: string }) => (
		<img alt={alt} className={className} src={src} />
	),
}));

vi.mock("next/link", () => ({
	default: ({ children, href }: { children: React.ReactNode; href: string }) => (
		<a href={href}>{children}</a>
	),
}));

// Mock Headless UI components
vi.mock("@headlessui/react", () => {
	const Dialog = Object.assign(
		({ children, className, as, onClose }: any) => (
			<div data-testid="dialog" className={className}>{children}</div>
		),
		{
			Panel: ({ children, className }: any) => (
				<div className={className} data-testid="dialog-panel">{children}</div>
			),
		}
	);

	const Transition = Object.assign(
		({ children, show, as }: any) => {
			if (show === false) return null;
			return <>{children}</>;
		},
		{
			Root: ({ children, show, as }: any) => (
				<div data-testid="transition-root" data-show={show}>{children}</div>
			),
			Child: ({ children, as, enter, enterFrom, enterTo, leave, leaveFrom, leaveTo }: any) => (
				<div data-testid="transition-child">{children}</div>
			),
		}
	);

	return {
		Dialog,
		Transition,
		Fragment: ({ children }: any) => <>{children}</>,
	};
});

// Mock Heroicons
vi.mock("@heroicons/react/24/outline", () => ({
	XMarkIcon: ({ className, "aria-hidden": ariaHidden }: { className: string; "aria-hidden": boolean }) => (
		<div className={className} aria-hidden={ariaHidden} data-testid="x-mark-icon">
			XMarkIcon
		</div>
	),
	FolderIcon: ({ className }: { className?: string }) => (
		<div className={className} data-testid="folder-icon">
			FolderIcon
		</div>
	),
	UserGroupIcon: ({ className }: { className?: string }) => (
		<div className={className} data-testid="user-group-icon">
			UserGroupIcon
		</div>
	),
	Cog6ToothIcon: ({ className }: { className?: string }) => (
		<div className={className} data-testid="cog-icon">
			Cog6ToothIcon
		</div>
	),
	UsersIcon: ({ className }: { className?: string }) => (
		<div className={className} data-testid="users-icon">
			UsersIcon
		</div>
	),
	GlobeAltIcon: ({ className }: { className?: string }) => (
		<div className={className} data-testid="globe-icon">
			GlobeAltIcon
		</div>
	),
	DocumentDuplicateIcon: ({ className }: { className?: string }) => (
		<div className={className} data-testid="document-icon">
			DocumentDuplicateIcon
		</div>
	),
}));

// Mock lucide-react
vi.mock("lucide-react", () => ({
	Blocks: ({ className }: { className?: string }) => (
		<div className={className} data-testid="blocks-icon">
			Blocks
		</div>
	),
	ExternalLink: ({ className }: { className?: string }) => (
		<div className={className} data-testid="external-link-icon">
			ExternalLink
		</div>
	),
}));

// Mock Radix UI icons
vi.mock("@radix-ui/react-icons", () => ({
	GitHubLogoIcon: ({ className }: { className?: string }) => (
		<div className={className} data-testid="github-icon">
			GitHubLogoIcon
		</div>
	),
}));

// Mock LoggedInUser component
vi.mock("../logged-in-user", () => ({
	default: () => <div data-testid="logged-in-user">Logged In User</div>,
}));

// Mock Separator component
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

describe("MobileNav", () => {
	const mockSetSidebarOpen = vi.fn();
	const defaultProps = {
		sidebarOpen: false,
		setSidebarOpen: mockSetSidebarOpen,
	};

	beforeEach(() => {
		vi.clearAllMocks();
		mockUsePathname.mockReturnValue("/dashboard");
	});

	describe("Component Structure", () => {
		it("should render transition root with correct show state", () => {
			render(<MobileNav {...defaultProps} sidebarOpen={true} />);

			const transitionRoot = screen.getByTestId("transition-root");
			expect(transitionRoot).toHaveAttribute("data-show", "true");
		});

		it("should render transition root as hidden when sidebar is closed", () => {
			render(<MobileNav {...defaultProps} sidebarOpen={false} />);

			const transitionRoot = screen.getByTestId("transition-root");
			expect(transitionRoot).toHaveAttribute("data-show", "false");
		});

		it("should render dialog panel with correct classes", () => {
			render(<MobileNav {...defaultProps} sidebarOpen={true} />);

			const dialogPanel = screen.getByTestId("dialog-panel");
			expect(dialogPanel).toHaveClass(
				"relative",
				"mr-16",
				"flex",
				"w-full",
				"max-w-xs",
				"flex-1"
			);
		});

		it("should render transition children", () => {
			render(<MobileNav {...defaultProps} sidebarOpen={true} />);

			const transitionChildren = screen.getAllByTestId("transition-child");
			expect(transitionChildren.length).toBeGreaterThan(0);
		});
	});

	describe("Close Button", () => {
		it("should render close button with X mark icon", () => {
			render(<MobileNav {...defaultProps} sidebarOpen={true} />);

			const closeButton = screen.getByRole("button");
			expect(closeButton).toBeInTheDocument();
			expect(screen.getByTestId("x-mark-icon")).toBeInTheDocument();
		});

		it("should have proper close button styling", () => {
			render(<MobileNav {...defaultProps} sidebarOpen={true} />);

			const closeButton = screen.getByRole("button");
			expect(closeButton).toHaveClass("-m-2.5", "p-2.5");
		});

		it("should have proper close button attributes", () => {
			render(<MobileNav {...defaultProps} sidebarOpen={true} />);

			const closeButton = screen.getByRole("button");
			expect(closeButton).toHaveAttribute("type", "button");
		});

		it("should have screen reader text for close button", () => {
			render(<MobileNav {...defaultProps} sidebarOpen={true} />);

			expect(screen.getByText("Close sidebar")).toBeInTheDocument();
			const srText = screen.getByText("Close sidebar");
			expect(srText).toHaveClass("sr-only");
		});

		it("should call setSidebarOpen with false when close button is clicked", async () => {
			const user = userEvent.setup();
			render(<MobileNav {...defaultProps} sidebarOpen={true} />);

			const closeButton = screen.getByRole("button");
			await user.click(closeButton);

			expect(mockSetSidebarOpen).toHaveBeenCalledWith(false);
		});
	});

	describe("Logo and Branding", () => {
		it("should render the platform logo and title", () => {
			render(<MobileNav {...defaultProps} sidebarOpen={true} />);

			const logo = screen.getByAltText("Turing Ethical Assurance Logo");
			expect(logo).toBeInTheDocument();
			expect(logo).toHaveClass("w-16");
			expect(logo).toHaveAttribute("src", "/images/tea-logo2.png");

			expect(screen.getByText("Trustworthy and Ethical Assurance Platform")).toBeInTheDocument();
		});

		it("should wrap logo in dashboard link", () => {
			render(<MobileNav {...defaultProps} sidebarOpen={true} />);

			const logoLink = screen.getAllByRole("link").find(link =>
				link.getAttribute("href") === "/dashboard"
			);
			expect(logoLink).toBeInTheDocument();
		});

		it("should have proper logo container styling", () => {
			render(<MobileNav {...defaultProps} sidebarOpen={true} />);

			const logoContainer = screen.getByText("Trustworthy and Ethical Assurance Platform").parentElement;
			expect(logoContainer).toHaveClass(
				"my-3",
				"flex",
				"items-center",
				"justify-start",
				"gap-2",
				"font-semibold",
				"text-white"
			);
		});
	});

	describe("Navigation Items", () => {
		it("should render navigation items from config", () => {
			render(<MobileNav {...defaultProps} sidebarOpen={true} />);

			expect(screen.getByText("My Assurance Cases")).toBeInTheDocument();
			expect(screen.getByText("Shared With Me")).toBeInTheDocument();
			expect(screen.getByText("Case Studies")).toBeInTheDocument();
			expect(screen.getByText("Discover Public Projects")).toBeInTheDocument();
		});

		it("should highlight active navigation item based on pathname", () => {
			mockUsePathname.mockReturnValue("/dashboard");
			render(<MobileNav {...defaultProps} sidebarOpen={true} />);

			const links = screen.getAllByRole("link");
			const activeLink = links.find(link =>
				link.textContent?.includes("My Assurance Cases") &&
				link.getAttribute("href") === "/dashboard"
			);
			expect(activeLink).toHaveClass("bg-indigo-700", "text-white");
		});

		it("should apply inactive styling to non-active items", () => {
			mockUsePathname.mockReturnValue("/dashboard");
			render(<MobileNav {...defaultProps} sidebarOpen={true} />);

			const links = screen.getAllByRole("link");
			const inactiveLink = links.find(link =>
				link.textContent?.includes("Shared With Me")
			);
			expect(inactiveLink).toHaveClass("text-indigo-200");
		});

		it("should handle external links with proper attributes", () => {
			render(<MobileNav {...defaultProps} sidebarOpen={true} />);

			const externalLinks = screen.getAllByRole("link").filter(link =>
				link.getAttribute("target") === "_blank"
			);
			expect(externalLinks.length).toBeGreaterThan(0);

			externalLinks.forEach(link => {
				expect(link).toHaveAttribute("target", "_blank");
				if (link.getAttribute("rel")) {
					expect(link).toHaveAttribute("rel", "noopener");
				}
			});
		});
	});

	describe("Teams Section", () => {
		it("should show 'No teams added' when teams array is empty", () => {
			render(<MobileNav {...defaultProps} sidebarOpen={true} />);

			expect(screen.getByText("Your teams")).toBeInTheDocument();
			expect(screen.getByText("No teams added")).toBeInTheDocument();
		});

		it("should show proper teams section styling", () => {
			render(<MobileNav {...defaultProps} sidebarOpen={true} />);

			const teamsHeader = screen.getByText("Your teams");
			expect(teamsHeader).toHaveClass(
				"font-semibold",
				"text-indigo-200",
				"text-xs",
				"leading-6"
			);
		});

		it("should render empty teams message with proper styling", () => {
			render(<MobileNav {...defaultProps} sidebarOpen={true} />);

			const emptyMessage = screen.getByText("No teams added");
			expect(emptyMessage).toHaveClass(
				"px-2",
				"text-indigo-100/60",
				"text-sm",
				"dark:text-slate-300/50"
			);
		});
	});

	describe("User Section", () => {
		it("should render LoggedInUser component", () => {
			render(<MobileNav {...defaultProps} sidebarOpen={true} />);

			expect(screen.getByTestId("logged-in-user")).toBeInTheDocument();
		});

		it("should have separator before user section", () => {
			render(<MobileNav {...defaultProps} sidebarOpen={true} />);

			const separators = screen.getAllByTestId("separator");
			expect(separators.length).toBeGreaterThan(0);

			// Check for separator with user-specific styling
			const userSeparator = separators.find(sep =>
				sep.className.includes("my-4") &&
				sep.className.includes("bg-indigo-700/80")
			);
			expect(userSeparator).toBeInTheDocument();
		});
	});

	describe("Sidebar Content", () => {
		it("should have proper sidebar styling", () => {
			render(<MobileNav {...defaultProps} sidebarOpen={true} />);

			const sidebar = screen.getByTestId("dialog-panel").querySelector(".bg-indigo-600");
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

		it("should have proper navigation structure", () => {
			render(<MobileNav {...defaultProps} sidebarOpen={true} />);

			const nav = screen.getByRole("navigation");
			expect(nav).toBeInTheDocument();
			expect(nav).toHaveClass("flex", "flex-1", "flex-col");
		});

		it("should have proper list structure", () => {
			render(<MobileNav {...defaultProps} sidebarOpen={true} />);

			const lists = screen.getAllByRole("list");
			expect(lists.length).toBeGreaterThan(0);
		});
	});

	describe("Responsive Design", () => {
		it("should be hidden on large screens", () => {
			render(<MobileNav {...defaultProps} sidebarOpen={true} />);

			// The component itself should be rendered but hidden on lg screens
			// This is handled by the parent container's lg:hidden class
			expect(screen.getByTestId("transition-root")).toBeInTheDocument();
		});

		it("should have mobile-specific header styling", () => {
			render(<MobileNav {...defaultProps} sidebarOpen={true} />);

			const headerContainer = screen.getByText("Trustworthy and Ethical Assurance Platform")
				.closest('.my-4');
			expect(headerContainer).toHaveClass("my-4", "flex", "h-16", "shrink-0", "items-center");
		});
	});

	describe("Props Handling", () => {
		it("should handle sidebarOpen prop changes", () => {
			const { rerender } = render(<MobileNav {...defaultProps} sidebarOpen={false} />);

			let transitionRoot = screen.getByTestId("transition-root");
			expect(transitionRoot).toHaveAttribute("data-show", "false");

			rerender(<MobileNav {...defaultProps} sidebarOpen={true} />);

			transitionRoot = screen.getByTestId("transition-root");
			expect(transitionRoot).toHaveAttribute("data-show", "true");
		});

		it("should call setSidebarOpen prop function", async () => {
			const user = userEvent.setup();
			render(<MobileNav {...defaultProps} sidebarOpen={true} />);

			const closeButton = screen.getByRole("button");
			await user.click(closeButton);

			expect(mockSetSidebarOpen).toHaveBeenCalledTimes(1);
			expect(mockSetSidebarOpen).toHaveBeenCalledWith(false);
		});
	});

	describe("Different Pathname Scenarios", () => {
		it("should handle different pathnames correctly", () => {
			mockUsePathname.mockReturnValue("/dashboard/shared");
			render(<MobileNav {...defaultProps} sidebarOpen={true} />);

			const links = screen.getAllByRole("link");
			const activeLink = links.find(link =>
				link.getAttribute("href") === "/dashboard/shared"
			);
			expect(activeLink).toHaveClass("bg-indigo-700", "text-white");
		});

		it("should handle root pathname", () => {
			mockUsePathname.mockReturnValue("/");
			render(<MobileNav {...defaultProps} sidebarOpen={true} />);

			// Should render without errors
			expect(screen.getByText("My Assurance Cases")).toBeInTheDocument();
		});

		it("should handle discover pathname", () => {
			mockUsePathname.mockReturnValue("/discover");
			render(<MobileNav {...defaultProps} sidebarOpen={true} />);

			const links = screen.getAllByRole("link");
			const activeLink = links.find(link =>
				link.getAttribute("href") === "/discover"
			);
			expect(activeLink).toHaveClass("bg-indigo-700", "text-white");
		});
	});

	describe("Accessibility", () => {
		it("should have proper ARIA attributes for close button", () => {
			render(<MobileNav {...defaultProps} sidebarOpen={true} />);

			const closeIcon = screen.getByTestId("x-mark-icon");
			expect(closeIcon).toHaveAttribute("aria-hidden", "true");
		});

		it("should have semantic navigation structure", () => {
			render(<MobileNav {...defaultProps} sidebarOpen={true} />);

			const nav = screen.getByRole("navigation");
			expect(nav).toBeInTheDocument();
		});

		it("should have proper list structure for accessibility", () => {
			render(<MobileNav {...defaultProps} sidebarOpen={true} />);

			const lists = screen.getAllByRole("list");
			expect(lists.length).toBeGreaterThan(0);
		});

		it("should be keyboard navigable", async () => {
			const user = userEvent.setup();
			render(<MobileNav {...defaultProps} sidebarOpen={true} />);

			const closeButton = screen.getByRole("button");
			await user.tab();

			expect(closeButton).toHaveFocus();
		});
	});

	describe("Theme Support", () => {
		it("should have dark mode classes", () => {
			render(<MobileNav {...defaultProps} sidebarOpen={true} />);

			const sidebar = screen.getByTestId("dialog-panel").querySelector(".bg-indigo-600");
			expect(sidebar).toHaveClass("dark:bg-slate-900");
		});

		it("should have proper separator dark mode styling", () => {
			render(<MobileNav {...defaultProps} sidebarOpen={true} />);

			const separators = screen.getAllByTestId("separator");
			separators.forEach(separator => {
				expect(separator.className).toContain("dark:bg-slate-800");
			});
		});
	});
});
