import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useSession } from "next-auth/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Header from "../header";

// Define regex patterns at module level for performance
const OPEN_MAIN_MENU_REGEX = /open main menu/i;
const LOG_IN_REGEX = /log in/i;
const GET_STARTED_REGEX = /get started/i;
const DOCUMENTATION_REGEX = /documentation/i;
const GITHUB_REGEX = /github/i;
const DISCOVER_REGEX = /discover/i;
const CLOSE_MENU_REGEX = /close menu/i;

// Type definitions for mock components
interface MockImageProps {
	src: string;
	alt: string;
	className?: string;
	width?: string | number;
	height?: string | number;
}

interface MockLinkProps {
	href: string;
	children: React.ReactNode;
	className?: string;
}

interface MockIconProps {
	className?: string;
	[key: string]: unknown;
}

interface MockDialogProps {
	children:
		| React.ReactNode
		| ((props: Record<string, unknown>) => React.ReactNode);
	open: boolean;
	onClose: () => void;
	className?: string;
}

interface MockPanelProps {
	children: React.ReactNode;
	className?: string;
}

// Mock next-auth
vi.mock("next-auth/react", () => ({
	useSession: vi.fn(),
}));

// Mock Next.js Image component
vi.mock("next/image", () => ({
	default: ({ src, alt, className, width, height }: MockImageProps) => (
		// biome-ignore lint/performance/noImgElement: This is a test mock for Next.js Image
		<img
			alt={alt}
			className={className}
			height={height}
			src={src}
			width={width}
		/>
	),
}));

// Mock Next.js Link component
vi.mock("next/link", () => ({
	default: ({ href, children, className }: MockLinkProps) => (
		<a className={className} href={href}>
			{children}
		</a>
	),
}));

// Mock Heroicons
vi.mock("@heroicons/react/24/outline", () => ({
	Bars3Icon: ({ className, ...props }: MockIconProps) => (
		<svg className={className} data-testid="bars3-icon" {...props}>
			<title>Menu Icon</title>
			<path d="M3 6h18M3 12h18M3 18h18" />
		</svg>
	),
	XMarkIcon: ({ className, ...props }: MockIconProps) => (
		<svg className={className} data-testid="xmark-icon" {...props}>
			<title>Close Icon</title>
			<path d="M6 18L18 6M6 6l12 12" />
		</svg>
	),
}));

// Mock Headless UI Dialog
vi.mock("@headlessui/react", () => ({
	Dialog: Object.assign(
		({ children, open, className }: MockDialogProps) =>
			open ? (
				<div className={className} data-testid="mobile-dialog">
					{typeof children === "function" ? children({}) : children}
				</div>
			) : null,
		{
			Panel: ({ children, className }: MockPanelProps) => (
				<div className={className} data-testid="dialog-panel">
					{children}
				</div>
			),
		}
	),
}));

describe("Header", () => {
	const mockUseSession = vi.mocked(useSession);

	beforeEach(() => {
		vi.clearAllMocks();
		mockUseSession.mockReturnValue({
			data: null,
			status: "unauthenticated",
			update: vi.fn(),
		});
	});

	describe("Component Rendering", () => {
		it("should render header with logo", () => {
			render(<Header />);

			const logo = screen.getByAltText("TEA Platform Logo");
			expect(logo).toBeInTheDocument();
			expect(logo).toHaveAttribute("src", "/images/tea-logo.png");
			expect(logo).toHaveAttribute("width", "183");
			expect(logo).toHaveAttribute("height", "48");
		});

		it("should render navigation links", () => {
			render(<Header />);

			expect(
				screen.getByRole("link", { name: DOCUMENTATION_REGEX })
			).toBeInTheDocument();
			expect(
				screen.getByRole("link", { name: GITHUB_REGEX })
			).toBeInTheDocument();
			expect(
				screen.getByRole("link", { name: DISCOVER_REGEX })
			).toBeInTheDocument();
		});

		it("should render mobile menu toggle button", () => {
			render(<Header />);

			const mobileMenuButton = screen.getByRole("button", {
				name: OPEN_MAIN_MENU_REGEX,
			});
			expect(mobileMenuButton).toBeInTheDocument();
			expect(screen.getByTestId("bars3-icon")).toBeInTheDocument();
		});
	});

	describe("Authentication State", () => {
		it("should show log in link when user is not authenticated", () => {
			mockUseSession.mockReturnValue({
				data: null,
				status: "unauthenticated",
				update: vi.fn(),
			});

			render(<Header />);

			const loginLink = screen.getByRole("link", { name: LOG_IN_REGEX });
			expect(loginLink).toBeInTheDocument();
			expect(loginLink).toHaveAttribute("href", "/login");
		});

		it("should show get started link when user is authenticated", async () => {
			mockUseSession.mockReturnValue({
				data: {
					key: "mock-session-key",
					expires: new Date(Date.now() + 86_400_000).toISOString(),
				},
				status: "authenticated",
				update: vi.fn(),
			});

			render(<Header />);

			await waitFor(() => {
				const getStartedLink = screen.getByRole("link", {
					name: GET_STARTED_REGEX,
				});
				expect(getStartedLink).toBeInTheDocument();
				expect(getStartedLink).toHaveAttribute("href", "/dashboard");
			});
		});

		it("should update authentication state when session changes", async () => {
			const { rerender } = render(<Header />);

			// Initially not authenticated
			expect(
				screen.getByRole("link", { name: LOG_IN_REGEX })
			).toBeInTheDocument();

			// Update session to authenticated
			mockUseSession.mockReturnValue({
				data: {
					key: "mock-session-key",
					expires: new Date(Date.now() + 86_400_000).toISOString(),
				},
				status: "authenticated",
				update: vi.fn(),
			});

			rerender(<Header />);

			await waitFor(() => {
				expect(
					screen.getByRole("link", { name: GET_STARTED_REGEX })
				).toBeInTheDocument();
			});
		});
	});

	describe("Navigation Links", () => {
		it("should have correct href attributes for navigation links", () => {
			render(<Header />);

			const documentationLink = screen.getByRole("link", {
				name: DOCUMENTATION_REGEX,
			});
			const githubLink = screen.getByRole("link", { name: GITHUB_REGEX });
			const discoverLink = screen.getByRole("link", { name: DISCOVER_REGEX });

			expect(documentationLink).toHaveAttribute("href", "/documentation");
			expect(githubLink).toHaveAttribute(
				"href",
				"https://github.com/alan-turing-institute/AssurancePlatform"
			);
			expect(discoverLink).toHaveAttribute("href", "/discover");
		});

		it("should have correct target attributes for external links", () => {
			render(<Header />);

			const documentationLink = screen.getByRole("link", {
				name: DOCUMENTATION_REGEX,
			});
			const githubLink = screen.getByRole("link", { name: GITHUB_REGEX });
			const discoverLink = screen.getByRole("link", { name: DISCOVER_REGEX });

			expect(documentationLink).toHaveAttribute("target", "_blank");
			expect(githubLink).toHaveAttribute("target", "_blank");
			expect(discoverLink).toHaveAttribute("target", "_self");
		});

		it("should render logo as a link to home page", () => {
			render(<Header />);

			const logoLinks = screen.getAllByRole("link");
			const homeLink = logoLinks.find(
				(link) => link.getAttribute("href") === "/"
			);

			expect(homeLink).toBeInTheDocument();
			expect(homeLink?.querySelector("img")).toBeInTheDocument();
		});
	});

	describe("Mobile Menu", () => {
		it("should not show mobile dialog initially", () => {
			render(<Header />);

			expect(screen.queryByTestId("mobile-dialog")).not.toBeInTheDocument();
		});

		it("should open mobile menu when hamburger button is clicked", async () => {
			const user = userEvent.setup();
			render(<Header />);

			const mobileMenuButton = screen.getByRole("button", {
				name: OPEN_MAIN_MENU_REGEX,
			});
			await user.click(mobileMenuButton);

			await waitFor(() => {
				expect(screen.getByTestId("mobile-dialog")).toBeInTheDocument();
			});
		});

		it("should close mobile menu when close button is clicked", async () => {
			const user = userEvent.setup();
			render(<Header />);

			// Open mobile menu
			const mobileMenuButton = screen.getByRole("button", {
				name: OPEN_MAIN_MENU_REGEX,
			});
			await user.click(mobileMenuButton);

			await waitFor(() => {
				expect(screen.getByTestId("mobile-dialog")).toBeInTheDocument();
			});

			// Close mobile menu
			const closeButton = screen.getByRole("button", {
				name: CLOSE_MENU_REGEX,
			});
			await user.click(closeButton);

			await waitFor(() => {
				expect(screen.queryByTestId("mobile-dialog")).not.toBeInTheDocument();
			});
		});

		it("should render all navigation links in mobile menu", async () => {
			const user = userEvent.setup();
			render(<Header />);

			const mobileMenuButton = screen.getByRole("button", {
				name: OPEN_MAIN_MENU_REGEX,
			});
			await user.click(mobileMenuButton);

			await waitFor(() => {
				const mobileDialog = screen.getByTestId("mobile-dialog");
				expect(mobileDialog).toBeInTheDocument();

				// Check that navigation links are present in mobile menu
				const allLinks = screen.getAllByRole("link");
				const documentationLinks = allLinks.filter((link) =>
					link.textContent?.includes("Documentation")
				);
				const githubLinks = allLinks.filter((link) =>
					link.textContent?.includes("GitHub")
				);
				const discoverLinks = allLinks.filter((link) =>
					link.textContent?.includes("Discover")
				);

				expect(documentationLinks.length).toBeGreaterThan(0);
				expect(githubLinks.length).toBeGreaterThan(0);
				expect(discoverLinks.length).toBeGreaterThan(0);
			});
		});

		it("should render close icon in mobile menu", async () => {
			const user = userEvent.setup();
			render(<Header />);

			const mobileMenuButton = screen.getByRole("button", {
				name: OPEN_MAIN_MENU_REGEX,
			});
			await user.click(mobileMenuButton);

			await waitFor(() => {
				expect(screen.getByTestId("xmark-icon")).toBeInTheDocument();
			});
		});
	});

	describe("Responsive Design", () => {
		it("should have correct responsive classes for desktop navigation", () => {
			render(<Header />);

			const nav = screen.getByRole("navigation");
			expect(nav).toHaveClass(
				"mx-auto",
				"flex",
				"max-w-7xl",
				"items-center",
				"justify-between",
				"p-6",
				"lg:px-8"
			);
		});

		it("should hide desktop navigation on mobile", () => {
			render(<Header />);

			const desktopNavContainer = screen
				.getByRole("navigation")
				.querySelector(".hidden.lg\\:flex.lg\\:gap-x-12");
			expect(desktopNavContainer).toBeInTheDocument();
		});

		it("should hide mobile menu button on desktop", () => {
			render(<Header />);

			const mobileMenuContainer = screen
				.getByRole("button", { name: OPEN_MAIN_MENU_REGEX })
				.closest(".flex.lg\\:hidden");
			expect(mobileMenuContainer).toBeInTheDocument();
		});
	});

	describe("Accessibility", () => {
		it("should have proper aria labels", () => {
			render(<Header />);

			const nav = screen.getByRole("navigation");
			expect(nav).toHaveAttribute("aria-label", "Global");

			const mobileMenuButton = screen.getByRole("button", {
				name: OPEN_MAIN_MENU_REGEX,
			});
			expect(mobileMenuButton).toBeInTheDocument();
		});

		it("should have screen reader text for icons", () => {
			render(<Header />);

			expect(screen.getByText("Open main menu")).toBeInTheDocument();
		});

		it("should have alt text for logo images", () => {
			render(<Header />);

			const logoImage = screen.getByAltText("TEA Platform Logo");
			expect(logoImage).toBeInTheDocument();
			expect(logoImage).toHaveAttribute("alt", "TEA Platform Logo");
		});

		it("should have proper aria-hidden attributes for decorative elements", () => {
			render(<Header />);

			const icons = screen.getAllByTestId("bars3-icon");
			for (const icon of icons) {
				expect(icon).toHaveAttribute("aria-hidden", "true");
			}
		});
	});

	describe("Styling", () => {
		it("should have correct styling classes for navigation links", () => {
			render(<Header />);

			const navigationLinks = screen
				.getAllByRole("link")
				.filter(
					(link) =>
						link.textContent?.includes("Documentation") ||
						link.textContent?.includes("GitHub") ||
						link.textContent?.includes("Discover")
				);

			// Check desktop navigation links
			const desktopNavLinks = navigationLinks.filter((link) =>
				link.className.includes("font-semibold text-gray-900 text-sm leading-6")
			);
			expect(desktopNavLinks.length).toBeGreaterThan(0);
		});

		it("should have correct button styling", () => {
			render(<Header />);

			const mobileMenuButton = screen.getByRole("button", {
				name: OPEN_MAIN_MENU_REGEX,
			});
			expect(mobileMenuButton).toHaveClass(
				"-m-2.5",
				"inline-flex",
				"items-center",
				"justify-center",
				"rounded-md",
				"p-2.5",
				"text-gray-700"
			);
		});
	});

	describe("Edge Cases", () => {
		it("should handle session with undefined key", () => {
			mockUseSession.mockReturnValue({
				data: {
					user: { email: "test@example.com" },
					expires: new Date(Date.now() + 86_400_000).toISOString(),
				},
				status: "authenticated",
				update: vi.fn(),
			});

			render(<Header />);

			// Should still show login link since session.key is undefined
			expect(
				screen.getByRole("link", { name: LOG_IN_REGEX })
			).toBeInTheDocument();
		});

		it("should handle multiple clicks on mobile menu toggle", async () => {
			const user = userEvent.setup();
			render(<Header />);

			const mobileMenuButton = screen.getByRole("button", {
				name: OPEN_MAIN_MENU_REGEX,
			});

			// Click multiple times rapidly
			await user.click(mobileMenuButton);
			await user.click(mobileMenuButton);
			await user.click(mobileMenuButton);

			// Menu should still function correctly
			await waitFor(() => {
				expect(screen.getByTestId("mobile-dialog")).toBeInTheDocument();
			});
		});

		it("should handle rapid session state changes", async () => {
			const { rerender } = render(<Header />);

			// Rapidly change session states
			mockUseSession.mockReturnValue({
				data: {
					key: "test-key",
					expires: new Date(Date.now() + 86_400_000).toISOString(),
				},
				status: "authenticated",
				update: vi.fn(),
			});
			rerender(<Header />);

			mockUseSession.mockReturnValue({
				data: null,
				status: "unauthenticated",
				update: vi.fn(),
			});
			rerender(<Header />);

			mockUseSession.mockReturnValue({
				data: {
					key: "new-key",
					expires: new Date(Date.now() + 86_400_000).toISOString(),
				},
				status: "authenticated",
				update: vi.fn(),
			});
			rerender(<Header />);

			await waitFor(() => {
				expect(
					screen.getByRole("link", { name: GET_STARTED_REGEX })
				).toBeInTheDocument();
			});
		});
	});
});
