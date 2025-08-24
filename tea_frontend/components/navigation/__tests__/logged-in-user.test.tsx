import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchCurrentUser } from "@/actions/users";
import { act, render, screen, waitFor } from "@/src/__tests__/utils/test-utils";
import LoggedInUser from "../logged-in-user";

// Mock Next.js components
vi.mock("next/link", () => ({
	default: ({
		children,
		href,
		className,
	}: {
		children: React.ReactNode;
		href: string;
		className?: string;
	}) => (
		<a className={className} href={href}>
			{children}
		</a>
	),
}));

// Mock the Skeleton component
vi.mock("@/components/ui/skeleton", () => ({
	Skeleton: ({ className }: { className: string }) => (
		<div className={className} data-testid="skeleton" />
	),
}));

// Mock the fetchCurrentUser action
type UserData = { username: string; email: string } | null;
let fetchCurrentUserResolve: ((value: UserData) => void) | null = null;
let fetchCurrentUserReject: ((reason?: unknown) => void) | null = null;

vi.mock("@/actions/users", () => ({
	fetchCurrentUser: vi.fn(
		() =>
			new Promise<UserData>((resolve, reject) => {
				fetchCurrentUserResolve = resolve;
				fetchCurrentUserReject = reject;
			})
	),
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
		fetchCurrentUserResolve = null;
		fetchCurrentUserReject = null;
		mockUseSession.mockReturnValue({
			data: { key: "test-session-key" },
			status: "authenticated",
		});
	});

	describe("Loading State", () => {
		it("should show skeleton loading state initially", () => {
			vi.mocked(fetchCurrentUser).mockImplementation(
				() =>
					new Promise(() => {
						// Intentionally never resolves to test loading state
					})
			); // Never resolves

			render(<LoggedInUser />);

			const skeletons = screen.getAllByTestId("skeleton");
			expect(skeletons).toHaveLength(3);
			expect(skeletons[0]).toBeInTheDocument();
		});

		it("should have proper skeleton styling", () => {
			vi.mocked(fetchCurrentUser).mockImplementation(
				() =>
					new Promise(() => {
						// Intentionally never resolves to test loading state
					})
			);

			render(<LoggedInUser />);

			const skeletons = screen.getAllByTestId("skeleton");
			expect(skeletons[0]).toHaveClass(
				"aspect-square",
				"h-10",
				"w-10",
				"rounded-full"
			);
			expect(skeletons[1]).toHaveClass("h-2", "w-32");
			expect(skeletons[2]).toHaveClass("h-2", "w-24");
		});

		it("should render loading container with proper styling", () => {
			vi.mocked(fetchCurrentUser).mockImplementation(
				() =>
					new Promise(() => {
						// Intentionally never resolves to test loading state
					})
			);

			const { container } = render(<LoggedInUser />);

			const loadingContainer = container.querySelector(".p-4");
			expect(loadingContainer).toBeInTheDocument();
			expect(loadingContainer?.firstElementChild).toHaveClass(
				"flex",
				"items-center",
				"gap-3"
			);
		});
	});

	describe("User Data Display", () => {
		const mockUserData = {
			username: "testuser",
			email: "test@example.com",
		};

		beforeEach(() => {
			// Reset to use promise-based mock
			vi.mocked(fetchCurrentUser).mockImplementation(
				() =>
					new Promise((resolve) => {
						fetchCurrentUserResolve = resolve;
					})
			);
		});

		it("should display user information after loading", async () => {
			render(<LoggedInUser />);

			// Initially should show loading state
			expect(screen.getAllByTestId("skeleton")).toHaveLength(3);

			// Resolve the promise and wait for component to update
			await act(async () => {
				fetchCurrentUserResolve?.(mockUserData);
				// Give React time to process the state update
				await new Promise((resolve) => setTimeout(resolve, 0));
			});

			await waitFor(() => {
				expect(screen.getByText("testuser")).toBeInTheDocument();
			});

			expect(screen.getByText("test@example.com")).toBeInTheDocument();
		});

		it("should display user avatar with first letter of username", async () => {
			render(<LoggedInUser />);

			// Resolve the promise and wait for component to update
			await act(async () => {
				fetchCurrentUserResolve?.(mockUserData);
				// Give React time to process the state update
				await new Promise((resolve) => setTimeout(resolve, 0));
			});

			await waitFor(() => {
				expect(screen.getByText("t")).toBeInTheDocument(); // First letter of "testuser"
			});
		});

		it("should capitalize the first letter of username in avatar", async () => {
			render(<LoggedInUser />);

			// Resolve the promise and wait for component to update
			await act(async () => {
				fetchCurrentUserResolve?.(mockUserData);
				// Give React time to process the state update
				await new Promise((resolve) => setTimeout(resolve, 0));
			});

			await waitFor(() => {
				const avatarLetter = screen.getByText("t");
				expect(avatarLetter).toHaveClass("capitalize");
			});
		});

		it("should capitalize username display", async () => {
			render(<LoggedInUser />);

			// Resolve the promise and wait for component to update
			await act(async () => {
				fetchCurrentUserResolve?.(mockUserData);
				// Give React time to process the state update
				await new Promise((resolve) => setTimeout(resolve, 0));
			});

			await waitFor(() => {
				const usernameElement = screen.getByText("testuser");
				expect(usernameElement).toHaveClass("capitalize");
			});
		});

		it("should have proper user info styling", async () => {
			render(<LoggedInUser />);

			// Resolve the promise and wait for component to update
			await act(async () => {
				fetchCurrentUserResolve?.(mockUserData);
				// Give React time to process the state update
				await new Promise((resolve) => setTimeout(resolve, 0));
			});

			await waitFor(() => {
				const usernameElement = screen.getByText("testuser");
				expect(usernameElement).toBeInTheDocument();
			});

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

		it("should render avatar with proper styling", async () => {
			render(<LoggedInUser />);

			// Resolve the promise and wait for component to update
			await act(async () => {
				fetchCurrentUserResolve?.(mockUserData);
				// Give React time to process the state update
				await new Promise((resolve) => setTimeout(resolve, 0));
			});

			await waitFor(() => {
				expect(screen.getByText("t")).toBeInTheDocument();
			});

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

	describe("Link and Navigation", () => {
		const mockUserData = {
			username: "testuser",
			email: "test@example.com",
		};

		beforeEach(() => {
			// Reset to use promise-based mock
			vi.mocked(fetchCurrentUser).mockImplementation(
				() =>
					new Promise((resolve) => {
						fetchCurrentUserResolve = resolve;
					})
			);
		});

		it("should render as a link to settings page", async () => {
			render(<LoggedInUser />);

			// Resolve the promise and wait for component to update
			await act(async () => {
				fetchCurrentUserResolve?.(mockUserData);
				// Give React time to process the state update
				await new Promise((resolve) => setTimeout(resolve, 0));
			});

			await waitFor(() => {
				const settingsLink = screen.getByRole("link");
				expect(settingsLink).toHaveAttribute("href", "/dashboard/settings");
			});
		});

		it("should have proper link styling", async () => {
			render(<LoggedInUser />);

			// Resolve the promise and wait for component to update
			await act(async () => {
				fetchCurrentUserResolve?.(mockUserData);
				// Give React time to process the state update
				await new Promise((resolve) => setTimeout(resolve, 0));
			});

			await waitFor(() => {
				const settingsLink = screen.getByRole("link");
				expect(settingsLink).toBeInTheDocument();
			});

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

		it("should have proper container layout", async () => {
			render(<LoggedInUser />);

			// Resolve the promise and wait for component to update
			await act(async () => {
				fetchCurrentUserResolve?.(mockUserData);
				// Give React time to process the state update
				await new Promise((resolve) => setTimeout(resolve, 0));
			});

			await waitFor(() => {
				const userContainer = screen.getByRole("link");
				expect(userContainer).toBeInTheDocument();
			});

			const userContainer = screen.getByRole("link").firstElementChild;
			expect(userContainer).toHaveClass("flex", "items-center", "gap-3");
		});
	});

	describe("Session Handling", () => {
		it("should handle missing session data", async () => {
			mockUseSession.mockReturnValue({
				data: null,
				status: "unauthenticated",
			});
			// Reset to use promise-based mock
			vi.mocked(fetchCurrentUser).mockImplementation(
				() =>
					new Promise((resolve) => {
						fetchCurrentUserResolve = resolve;
					})
			);

			render(<LoggedInUser />);

			// Resolve the promise
			await act(async () => {
				fetchCurrentUserResolve?.(null);
				// Give React time to process the state update
				await new Promise((resolve) => setTimeout(resolve, 0));
			});

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
			// Reset to use promise-based mock
			vi.mocked(fetchCurrentUser).mockImplementation(
				() =>
					new Promise((resolve) => {
						fetchCurrentUserResolve = resolve;
					})
			);

			render(<LoggedInUser />);

			// Should call fetchCurrentUser with empty string when key is undefined
			expect(vi.mocked(fetchCurrentUser)).toHaveBeenCalledWith("");

			// Resolve the promise
			await act(async () => {
				fetchCurrentUserResolve?.(null);
				// Give React time to process the state update
				await new Promise((resolve) => setTimeout(resolve, 0));
			});
		});

		it("should use session key for fetchCurrentUser", async () => {
			const sessionKey = "test-session-key-123";
			mockUseSession.mockReturnValue({
				data: { key: sessionKey },
				status: "authenticated",
			});
			// Reset to use promise-based mock
			vi.mocked(fetchCurrentUser).mockImplementation(
				() =>
					new Promise((resolve) => {
						fetchCurrentUserResolve = resolve;
					})
			);

			render(<LoggedInUser />);

			expect(vi.mocked(fetchCurrentUser)).toHaveBeenCalledWith(sessionKey);

			// Resolve the promise
			await act(async () => {
				fetchCurrentUserResolve?.({
					username: "testuser",
					email: "test@example.com",
				});
				// Give React time to process the state update
				await new Promise((resolve) => setTimeout(resolve, 0));
			});
		});
	});

	describe("Error Handling", () => {
		it("should handle fetchCurrentUser rejection", async () => {
			// Silence console error for this test
			const consoleError = vi.spyOn(console, "error").mockImplementation(() => {
				// Intentionally empty to suppress console errors
			});

			// Reset to use promise-based mock for error handling
			vi.mocked(fetchCurrentUser).mockImplementation(
				() =>
					new Promise((resolve, reject) => {
						fetchCurrentUserResolve = resolve;
						fetchCurrentUserReject = reject;
					})
			);

			render(<LoggedInUser />);

			// Reject the promise and wait for component to update
			await act(async () => {
				fetchCurrentUserReject?.(new Error("Network error"));
				// Give React time to process the state update
				await new Promise((resolve) => setTimeout(resolve, 0));
			});

			// Wait for the component to handle the error and stop loading
			await waitFor(() => {
				// After error, component should exit loading state and show the link
				expect(screen.getByRole("link")).toBeInTheDocument();
			});

			// Restore console.error
			consoleError.mockRestore();
		});

		it("should handle null user data", async () => {
			// Reset to use promise-based mock
			vi.mocked(fetchCurrentUser).mockImplementation(
				() =>
					new Promise((resolve) => {
						fetchCurrentUserResolve = resolve;
					})
			);

			render(<LoggedInUser />);

			// Resolve the promise with null
			await act(async () => {
				fetchCurrentUserResolve?.(null);
				// Give React time to process the state update
				await new Promise((resolve) => setTimeout(resolve, 0));
			});

			await waitFor(() => {
				// Should render link but without user content
				expect(screen.getByRole("link")).toBeInTheDocument();
			});
		});

		it("should handle partial user data", async () => {
			// Reset to use promise-based mock
			vi.mocked(fetchCurrentUser).mockImplementation(
				() =>
					new Promise((resolve) => {
						fetchCurrentUserResolve = resolve;
					})
			);

			render(<LoggedInUser />);

			// Resolve the promise with partial data
			await act(async () => {
				fetchCurrentUserResolve?.({
					username: "testuser",
					email: "", // Missing email
				});
				// Give React time to process the state update
				await new Promise((resolve) => setTimeout(resolve, 0));
			});

			await waitFor(() => {
				expect(screen.getByText("testuser")).toBeInTheDocument();
			});

			// Empty email renders as an empty <p> tag
			const emailElement = screen.getAllByText((content, element) => {
				return (
					element?.tagName.toLowerCase() === "p" &&
					element?.className.includes("text-gray-300") &&
					content === ""
				);
			});
			expect(emailElement.length).toBeGreaterThan(0);
		});
	});

	describe("Component Lifecycle", () => {
		it("should fetch user data on mount", async () => {
			// Reset to use promise-based mock
			vi.mocked(fetchCurrentUser).mockImplementation(
				() =>
					new Promise((resolve) => {
						fetchCurrentUserResolve = resolve;
					})
			);

			render(<LoggedInUser />);

			expect(vi.mocked(fetchCurrentUser)).toHaveBeenCalledTimes(1);

			// Resolve the promise
			await act(async () => {
				fetchCurrentUserResolve?.({
					username: "testuser",
					email: "test@example.com",
				});
				// Give React time to process the state update
				await new Promise((resolve) => setTimeout(resolve, 0));
			});
		});

		it("should refetch user data when session key changes", async () => {
			// Reset to use promise-based mock
			vi.mocked(fetchCurrentUser).mockImplementation(
				() =>
					new Promise((resolve) => {
						fetchCurrentUserResolve = resolve;
					})
			);

			const { rerender } = render(<LoggedInUser />);

			expect(vi.mocked(fetchCurrentUser)).toHaveBeenCalledWith(
				"test-session-key"
			);

			// Resolve the first promise
			await act(async () => {
				fetchCurrentUserResolve?.({
					username: "testuser",
					email: "test@example.com",
				});
				// Give React time to process the state update
				await new Promise((resolve) => setTimeout(resolve, 0));
			});

			// Change session key
			mockUseSession.mockReturnValue({
				data: { key: "new-session-key" },
				status: "authenticated",
			});

			rerender(<LoggedInUser />);

			await waitFor(() => {
				expect(vi.mocked(fetchCurrentUser)).toHaveBeenCalledTimes(2);
				expect(vi.mocked(fetchCurrentUser)).toHaveBeenLastCalledWith(
					"new-session-key"
				);
			});

			// Resolve the second promise
			await act(async () => {
				fetchCurrentUserResolve?.({
					username: "testuser",
					email: "test@example.com",
				});
				// Give React time to process the state update
				await new Promise((resolve) => setTimeout(resolve, 0));
			});
		});

		it("should show loading state during data transition", async () => {
			let resolvePromise: (
				value: { username: string; email: string } | null
			) => void;
			vi.mocked(fetchCurrentUser).mockImplementation(
				() =>
					new Promise((resolve) => {
						resolvePromise = resolve;
					})
			);

			render(<LoggedInUser />);

			// Should show skeleton while loading
			expect(screen.getAllByTestId("skeleton")).toHaveLength(3);

			// Resolve the promise and wait for component to update
			await act(async () => {
				resolvePromise?.({
					username: "testuser",
					email: "test@example.com",
				});
				// Give React time to process the state update
				await new Promise((resolve) => setTimeout(resolve, 0));
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
			// Reset to use promise-based mock
			vi.mocked(fetchCurrentUser).mockImplementation(
				() =>
					new Promise((resolve) => {
						fetchCurrentUserResolve = resolve;
					})
			);
		});

		it("should have accessible link structure", async () => {
			render(<LoggedInUser />);

			// Resolve the promise and wait for component to update
			await act(async () => {
				fetchCurrentUserResolve?.(mockUserData);
				// Give React time to process the state update
				await new Promise((resolve) => setTimeout(resolve, 0));
			});

			await waitFor(() => {
				const link = screen.getByRole("link");
				expect(link).toBeInTheDocument();
				expect(link).toHaveAttribute("href", "/dashboard/settings");
			});
		});

		it("should have semantic text hierarchy", async () => {
			render(<LoggedInUser />);

			// Resolve the promise and wait for component to update
			await act(async () => {
				fetchCurrentUserResolve?.(mockUserData);
				// Give React time to process the state update
				await new Promise((resolve) => setTimeout(resolve, 0));
			});

			await waitFor(() => {
				expect(screen.getByText("testuser")).toBeInTheDocument();
			});

			const username = screen.getByText("testuser");
			const email = screen.getByText("test@example.com");

			// Username should be more prominent than email
			expect(username).toHaveClass("text-sm");
			expect(email).toHaveClass("text-xs");
		});
	});
});
