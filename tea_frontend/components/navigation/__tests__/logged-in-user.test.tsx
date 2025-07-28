import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@/src/__tests__/utils/test-utils";
import { fetchCurrentUser } from "@/actions/users";
import LoggedInUser from "../logged-in-user";

// Mock Next.js components
vi.mock("next/link", () => ({
	default: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
		<a href={href} className={className}>{children}</a>
	),
}));

// Mock the Skeleton component
vi.mock("@/components/ui/skeleton", () => ({
	Skeleton: ({ className }: { className: string }) => (
		<div className={className} data-testid="skeleton" />
	),
}));

// Mock the fetchCurrentUser action
vi.mock("@/actions/users", () => ({
	fetchCurrentUser: vi.fn(),
}));

// Mock next-auth/react
const mockUseSession = vi.fn();
vi.mock("next-auth/react", () => ({
	useSession: () => mockUseSession(),
	SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

describe("LoggedInUser", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockUseSession.mockReturnValue({
			data: { key: "test-session-key" },
			status: "authenticated",
		});
	});

	describe("Loading State", () => {
		it("should show skeleton loading state initially", () => {
			vi.mocked(fetchCurrentUser).mockImplementation(() => new Promise(() => {})); // Never resolves

			render(<LoggedInUser />);

			const skeletons = screen.getAllByTestId("skeleton");
			expect(skeletons).toHaveLength(3);
			expect(skeletons[0]).toBeInTheDocument();
		});

		it("should have proper skeleton styling", () => {
			vi.mocked(fetchCurrentUser).mockImplementation(() => new Promise(() => {}));

			render(<LoggedInUser />);

			const skeletons = screen.getAllByTestId("skeleton");
			expect(skeletons[0]).toHaveClass("aspect-square", "h-10", "w-10", "rounded-full");
			expect(skeletons[1]).toHaveClass("h-2", "w-32");
			expect(skeletons[2]).toHaveClass("h-2", "w-24");
		});

		it("should render loading container with proper styling", () => {
			vi.mocked(fetchCurrentUser).mockImplementation(() => new Promise(() => {}));

			const { container } = render(<LoggedInUser />);

			const loadingContainer = container.querySelector(".p-4");
			expect(loadingContainer).toBeInTheDocument();
			expect(loadingContainer?.firstElementChild).toHaveClass("flex", "items-center", "gap-3");
		});
	});

	describe("User Data Display", () => {
		const mockUserData = {
			username: "testuser",
			email: "test@example.com",
		};

		beforeEach(() => {
			vi.mocked(fetchCurrentUser).mockResolvedValue(mockUserData);
		});

		it("should display user information after loading", async () => {
			render(<LoggedInUser />);

			await waitFor(() => {
				expect(screen.getByText("testuser")).toBeInTheDocument();
				expect(screen.getByText("test@example.com")).toBeInTheDocument();
			});
		});

		it("should display user avatar with first letter of username", async () => {
			render(<LoggedInUser />);

			await waitFor(() => {
				expect(screen.getByText("t")).toBeInTheDocument(); // First letter of "testuser"
			});
		});

		it("should capitalize the first letter of username in avatar", async () => {
			render(<LoggedInUser />);

			await waitFor(() => {
				const avatarLetter = screen.getByText("t");
				expect(avatarLetter).toHaveClass("capitalize");
			});
		});

		it("should capitalize username display", async () => {
			render(<LoggedInUser />);

			await waitFor(() => {
				const usernameElement = screen.getByText("testuser");
				expect(usernameElement).toHaveClass("capitalize");
			});
		});

		it("should have proper user info styling", async () => {
			render(<LoggedInUser />);

			await waitFor(() => {
				const usernameElement = screen.getByText("testuser");
				expect(usernameElement).toHaveClass(
					"font-medium",
					"text-sm",
					"text-white",
					"capitalize",
					"group-hover:text-white"
				);

				const emailElement = screen.getByText("test@example.com");
				expect(emailElement).toHaveClass(
					"font-medium",
					"text-gray-300",
					"text-xs",
					"group-hover:text-white"
				);
			});
		});

		it("should render avatar with proper styling", async () => {
			render(<LoggedInUser />);

			await waitFor(() => {
				const avatarContainer = screen.getByText("t").parentElement;
				expect(avatarContainer).toHaveClass(
					"inline-flex",
					"size-10",
					"items-center",
					"justify-center",
					"rounded-full",
					"bg-indigo-900/40",
					"dark:bg-indigo-500"
				);

				const avatarText = screen.getByText("t");
				expect(avatarText).toHaveClass(
					"font-medium",
					"text-sm",
					"text-white",
					"capitalize"
				);
			});
		});
	});

	describe("Link and Navigation", () => {
		const mockUserData = {
			username: "testuser",
			email: "test@example.com",
		};

		beforeEach(() => {
			vi.mocked(fetchCurrentUser).mockResolvedValue(mockUserData);
		});

		it("should render as a link to settings page", async () => {
			render(<LoggedInUser />);

			await waitFor(() => {
				const settingsLink = screen.getByRole("link");
				expect(settingsLink).toHaveAttribute("href", "/dashboard/settings");
			});
		});

		it("should have proper link styling", async () => {
			render(<LoggedInUser />);

			await waitFor(() => {
				const settingsLink = screen.getByRole("link");
				expect(settingsLink).toHaveClass(
					"group",
					"block",
					"shrink-0",
					"rounded-md",
					"p-4",
					"hover:bg-indigo-900/40",
					"dark:hover:bg-indigo-600"
				);
			});
		});

		it("should have proper container layout", async () => {
			render(<LoggedInUser />);

			await waitFor(() => {
				const userContainer = screen.getByRole("link").firstElementChild;
				expect(userContainer).toHaveClass("flex", "items-center", "gap-3");
			});
		});
	});

	describe("Session Handling", () => {
		it("should handle missing session data", async () => {
			mockUseSession.mockReturnValue({
				data: null,
				status: "unauthenticated",
			});
			vi.mocked(fetchCurrentUser).mockResolvedValue(null);

			render(<LoggedInUser />);

			await waitFor(() => {
				// Should still render the link container even with null user data
				expect(screen.getByRole("link")).toBeInTheDocument();
			});
		});

		it("should handle session with undefined key", async () => {
			mockUseSession.mockReturnValue({
				data: { key: undefined },
				status: "authenticated",
			});
			vi.mocked(fetchCurrentUser).mockResolvedValue(null);

			render(<LoggedInUser />);

			// Should call fetchCurrentUser with empty string when key is undefined
			await waitFor(() => {
				expect(vi.mocked(fetchCurrentUser)).toHaveBeenCalledWith("");
			});
		});

		it("should use session key for fetchCurrentUser", async () => {
			const sessionKey = "test-session-key-123";
			mockUseSession.mockReturnValue({
				data: { key: sessionKey },
				status: "authenticated",
			});
			vi.mocked(fetchCurrentUser).mockResolvedValue({
				username: "testuser",
				email: "test@example.com",
			});

			render(<LoggedInUser />);

			expect(vi.mocked(fetchCurrentUser)).toHaveBeenCalledWith(sessionKey);
		});
	});

	describe("Error Handling", () => {
		it("should handle fetchCurrentUser rejection", async () => {
			vi.mocked(fetchCurrentUser).mockRejectedValue(new Error("Network error"));

			render(<LoggedInUser />);

			// Since the component doesn't handle errors, it stays in loading state
			await waitFor(() => {
				expect(screen.getAllByTestId("skeleton")).toHaveLength(3);
			});
		});

		it("should handle null user data", async () => {
			vi.mocked(fetchCurrentUser).mockResolvedValue(null);

			render(<LoggedInUser />);

			await waitFor(() => {
				// Should render link but without user content
				expect(screen.getByRole("link")).toBeInTheDocument();
			});
		});

		it("should handle partial user data", async () => {
			vi.mocked(fetchCurrentUser).mockResolvedValue({
				username: "testuser",
				email: "", // Missing email
			});

			render(<LoggedInUser />);

			await waitFor(() => {
				expect(screen.getByText("testuser")).toBeInTheDocument();
				// Empty email renders as an empty <p> tag, not findable by text
				const emailElement = screen.getAllByText((content, element) => {
					return element?.tagName.toLowerCase() === 'p' &&
						   element?.className.includes('text-gray-300') &&
						   content === '';
				});
				expect(emailElement.length).toBeGreaterThan(0);
			});
		});
	});

	describe("Component Lifecycle", () => {
		it("should fetch user data on mount", () => {
			vi.mocked(fetchCurrentUser).mockResolvedValue({
				username: "testuser",
				email: "test@example.com",
			});

			render(<LoggedInUser />);

			expect(vi.mocked(fetchCurrentUser)).toHaveBeenCalledTimes(1);
		});

		it("should refetch user data when session key changes", async () => {
			const { rerender } = render(<LoggedInUser />);

			expect(vi.mocked(fetchCurrentUser)).toHaveBeenCalledWith("test-session-key");

			// Change session key
			mockUseSession.mockReturnValue({
				data: { key: "new-session-key" },
				status: "authenticated",
			});

			rerender(<LoggedInUser />);

			await act(async () => {
				await new Promise(resolve => setTimeout(resolve, 0));
			});

			expect(vi.mocked(fetchCurrentUser)).toHaveBeenCalledWith("new-session-key");
		});

		it("should show loading state during data transition", async () => {
			let resolvePromise: (value: any) => void;
			vi.mocked(fetchCurrentUser).mockImplementation(() =>
				new Promise(resolve => {
					resolvePromise = resolve;
				})
			);

			render(<LoggedInUser />);

			// Should show skeleton while loading
			expect(screen.getAllByTestId("skeleton")).toHaveLength(3);

			// Resolve the promise
			await act(async () => {
				resolvePromise!({
					username: "testuser",
					email: "test@example.com",
				});
			});

			// Should show user data after loading
			await waitFor(() => {
				expect(screen.getByText("testuser")).toBeInTheDocument();
				expect(screen.queryByTestId("skeleton")).not.toBeInTheDocument();
			});
		});
	});

	describe("Accessibility", () => {
		const mockUserData = {
			username: "testuser",
			email: "test@example.com",
		};

		beforeEach(() => {
			vi.mocked(fetchCurrentUser).mockResolvedValue(mockUserData);
		});

		it("should have accessible link structure", async () => {
			render(<LoggedInUser />);

			await waitFor(() => {
				const link = screen.getByRole("link");
				expect(link).toBeInTheDocument();
				expect(link).toHaveAttribute("href", "/dashboard/settings");
			});
		});

		it("should have semantic text hierarchy", async () => {
			render(<LoggedInUser />);

			await waitFor(() => {
				const username = screen.getByText("testuser");
				const email = screen.getByText("test@example.com");

				// Username should be more prominent than email
				expect(username).toHaveClass("text-sm");
				expect(email).toHaveClass("text-xs");
			});
		});
	});
});
