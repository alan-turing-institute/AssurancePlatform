import { render, screen } from "@testing-library/react";
import { SessionProvider } from "next-auth/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SessionProviderDefault from "../session-provider";

// Mock next-auth/react to test our re-export
vi.mock("next-auth/react", () => {
	const MockSessionProvider = ({
		children,
		session,
		basePath,
		refetchInterval,
		refetchOnWindowFocus,
		refetchWhenOffline,
	}: {
		children: React.ReactNode;
		session?: object | null;
		basePath?: string;
		refetchInterval?: number;
		refetchOnWindowFocus?: boolean;
		refetchWhenOffline?: boolean;
	}) => (
		<div
			data-base-path={basePath}
			data-refetch-interval={refetchInterval}
			data-refetch-on-window-focus={refetchOnWindowFocus}
			data-refetch-when-offline={refetchWhenOffline}
			data-session={session ? "provided" : "null"}
			data-testid="session-provider"
		>
			{children}
		</div>
	);

	return {
		SessionProvider: MockSessionProvider,
		useSession: () => ({
			data: { user: { name: "Test User" } },
			status: "authenticated",
		}),
		signIn: vi.fn(),
		signOut: vi.fn(),
		getSession: vi.fn(),
	};
});

describe("SessionProvider", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("Re-export Functionality", () => {
		it("should re-export SessionProvider from next-auth/react", () => {
			// Test that our default export is the same as the imported SessionProvider
			expect(SessionProviderDefault).toBe(SessionProvider);
		});

		it("should be a function/component", () => {
			expect(typeof SessionProviderDefault).toBe("function");
		});

		it("should have the same name as SessionProvider", () => {
			expect(SessionProviderDefault.name).toBe("MockSessionProvider");
		});
	});

	describe("Component Rendering", () => {
		it("should render children when used as provider", () => {
			render(
				<SessionProviderDefault>
					<div data-testid="child-component">Test Child</div>
				</SessionProviderDefault>
			);

			expect(screen.getByTestId("session-provider")).toBeInTheDocument();
			expect(screen.getByTestId("child-component")).toBeInTheDocument();
			expect(screen.getByText("Test Child")).toBeInTheDocument();
		});

		it("should render multiple children", () => {
			render(
				<SessionProviderDefault>
					<div data-testid="child-1">Child 1</div>
					<div data-testid="child-2">Child 2</div>
					<div data-testid="child-3">Child 3</div>
				</SessionProviderDefault>
			);

			expect(screen.getByTestId("session-provider")).toBeInTheDocument();
			expect(screen.getByTestId("child-1")).toBeInTheDocument();
			expect(screen.getByTestId("child-2")).toBeInTheDocument();
			expect(screen.getByTestId("child-3")).toBeInTheDocument();
		});

		it("should render with no children", () => {
			render(<SessionProviderDefault>{null}</SessionProviderDefault>);

			expect(screen.getByTestId("session-provider")).toBeInTheDocument();
		});
	});

	describe("Props Forwarding", () => {
		it("should forward session prop correctly", () => {
			const mockSession = {
				user: { name: "Test User", email: "test@example.com" },
				expires: "2024-12-31",
			};

			render(
				<SessionProviderDefault session={mockSession}>
					<div>Test Content</div>
				</SessionProviderDefault>
			);

			const provider = screen.getByTestId("session-provider");
			expect(provider).toHaveAttribute("data-session", "provided");
		});

		it("should handle null session", () => {
			render(
				<SessionProviderDefault session={null}>
					<div>Test Content</div>
				</SessionProviderDefault>
			);

			const provider = screen.getByTestId("session-provider");
			expect(provider).toHaveAttribute("data-session", "null");
		});

		it("should forward basePath prop", () => {
			render(
				<SessionProviderDefault basePath="/custom-auth">
					<div>Test Content</div>
				</SessionProviderDefault>
			);

			const provider = screen.getByTestId("session-provider");
			expect(provider).toHaveAttribute("data-base-path", "/custom-auth");
		});

		it("should forward refetchInterval prop", () => {
			render(
				<SessionProviderDefault refetchInterval={300}>
					<div>Test Content</div>
				</SessionProviderDefault>
			);

			const provider = screen.getByTestId("session-provider");
			expect(provider).toHaveAttribute("data-refetch-interval", "300");
		});

		it("should forward refetchOnWindowFocus prop", () => {
			render(
				<SessionProviderDefault refetchOnWindowFocus={false}>
					<div>Test Content</div>
				</SessionProviderDefault>
			);

			const provider = screen.getByTestId("session-provider");
			expect(provider).toHaveAttribute("data-refetch-on-window-focus", "false");
		});

		it("should forward refetchWhenOffline prop", () => {
			render(
				<SessionProviderDefault refetchWhenOffline={false}>
					<div>Test Content</div>
				</SessionProviderDefault>
			);

			const provider = screen.getByTestId("session-provider");
			expect(provider).toHaveAttribute("data-refetch-when-offline", "false");
		});
	});

	describe("Default Props Behavior", () => {
		it("should work with default props when none provided", () => {
			render(
				<SessionProviderDefault>
					<div>Default Props Test</div>
				</SessionProviderDefault>
			);

			const provider = screen.getByTestId("session-provider");
			expect(provider).toBeInTheDocument();
			expect(screen.getByText("Default Props Test")).toBeInTheDocument();
		});

		it("should handle undefined session gracefully", () => {
			render(
				<SessionProviderDefault session={undefined}>
					<div>Undefined Session Test</div>
				</SessionProviderDefault>
			);

			const provider = screen.getByTestId("session-provider");
			expect(provider).toHaveAttribute("data-session", "null");
		});
	});

	describe("Complex Prop Combinations", () => {
		it("should handle all props together", () => {
			const session = {
				user: { name: "Complex User", email: "complex@example.com" },
				expires: "2024-12-31",
			};

			render(
				<SessionProviderDefault
					basePath="/api/auth"
					refetchInterval={600}
					refetchOnWindowFocus={true}
					refetchWhenOffline={false}
					session={session}
				>
					<div>All Props Test</div>
				</SessionProviderDefault>
			);

			const provider = screen.getByTestId("session-provider");
			expect(provider).toHaveAttribute("data-session", "provided");
			expect(provider).toHaveAttribute("data-base-path", "/api/auth");
			expect(provider).toHaveAttribute("data-refetch-interval", "600");
			expect(provider).toHaveAttribute("data-refetch-on-window-focus", "true");
			expect(provider).toHaveAttribute("data-refetch-when-offline", "false");
			expect(screen.getByText("All Props Test")).toBeInTheDocument();
		});
	});

	describe("Provider Nesting", () => {
		it("should work when nested inside other providers", () => {
			const TestProvider = ({ children }: { children: React.ReactNode }) => (
				<div data-testid="outer-provider">{children}</div>
			);

			render(
				<TestProvider>
					<SessionProviderDefault>
						<div data-testid="nested-content">Nested Content</div>
					</SessionProviderDefault>
				</TestProvider>
			);

			expect(screen.getByTestId("outer-provider")).toBeInTheDocument();
			expect(screen.getByTestId("session-provider")).toBeInTheDocument();
			expect(screen.getByTestId("nested-content")).toBeInTheDocument();
		});

		it("should work when wrapping other providers", () => {
			const InnerProvider = ({ children }: { children: React.ReactNode }) => (
				<div data-testid="inner-provider">{children}</div>
			);

			render(
				<SessionProviderDefault>
					<InnerProvider>
						<div data-testid="deeply-nested">Deeply Nested</div>
					</InnerProvider>
				</SessionProviderDefault>
			);

			expect(screen.getByTestId("session-provider")).toBeInTheDocument();
			expect(screen.getByTestId("inner-provider")).toBeInTheDocument();
			expect(screen.getByTestId("deeply-nested")).toBeInTheDocument();
		});
	});

	describe("Re-rendering and Updates", () => {
		it("should handle session updates", () => {
			const initialSession = {
				user: { name: "Initial User" },
				expires: "2099-01-01",
			};
			const updatedSession = {
				user: { name: "Updated User" },
				expires: "2099-01-01",
			};

			const { rerender } = render(
				<SessionProviderDefault session={initialSession}>
					<div>Session Test</div>
				</SessionProviderDefault>
			);

			let provider = screen.getByTestId("session-provider");
			expect(provider).toHaveAttribute("data-session", "provided");

			rerender(
				<SessionProviderDefault session={updatedSession}>
					<div>Session Test</div>
				</SessionProviderDefault>
			);

			provider = screen.getByTestId("session-provider");
			expect(provider).toHaveAttribute("data-session", "provided");
		});

		it("should handle session becoming null", () => {
			const session = { user: { name: "User" }, expires: "2099-01-01" };

			const { rerender } = render(
				<SessionProviderDefault session={session}>
					<div>Session Test</div>
				</SessionProviderDefault>
			);

			let provider = screen.getByTestId("session-provider");
			expect(provider).toHaveAttribute("data-session", "provided");

			rerender(
				<SessionProviderDefault session={null}>
					<div>Session Test</div>
				</SessionProviderDefault>
			);

			provider = screen.getByTestId("session-provider");
			expect(provider).toHaveAttribute("data-session", "null");
		});

		it("should handle children changes", () => {
			const { rerender } = render(
				<SessionProviderDefault>
					<div data-testid="content">Original Content</div>
				</SessionProviderDefault>
			);

			expect(screen.getByTestId("content")).toBeInTheDocument();
			expect(screen.getByText("Original Content")).toBeInTheDocument();

			rerender(
				<SessionProviderDefault>
					<div data-testid="content">Updated Content</div>
				</SessionProviderDefault>
			);

			expect(screen.getByTestId("content")).toBeInTheDocument();
			expect(screen.getByText("Updated Content")).toBeInTheDocument();
		});
	});

	describe("Performance and Memory", () => {
		it("should handle unmounting gracefully", () => {
			const { unmount } = render(
				<SessionProviderDefault>
					<div>Test Content</div>
				</SessionProviderDefault>
			);

			expect(screen.getByTestId("session-provider")).toBeInTheDocument();

			// Should not throw on unmount
			expect(() => unmount()).not.toThrow();
		});

		it("should handle multiple mount/unmount cycles", () => {
			for (let i = 0; i < 5; i++) {
				const { unmount } = render(
					<SessionProviderDefault>
						<div>Cycle {i}</div>
					</SessionProviderDefault>
				);

				expect(screen.getByTestId("session-provider")).toBeInTheDocument();
				expect(screen.getByText(`Cycle ${i}`)).toBeInTheDocument();

				unmount();
			}

			// Should not cause any issues
			expect(true).toBe(true);
		});
	});

	describe("Edge Cases", () => {
		it("should handle extremely long session data", () => {
			const longSession = {
				user: {
					name: "A".repeat(1000),
					email: `${"B".repeat(500)}@example.com`,
					id: "C".repeat(100),
				},
				expires: "2024-12-31",
				accessToken: "D".repeat(2000),
			};

			render(
				<SessionProviderDefault session={longSession}>
					<div>Long Session Test</div>
				</SessionProviderDefault>
			);

			expect(screen.getByTestId("session-provider")).toBeInTheDocument();
			expect(screen.getByText("Long Session Test")).toBeInTheDocument();
		});

		it("should handle malformed session data", () => {
			const malformedSession = {
				user: undefined,
				expires: "2024-12-31T23:59:59.999Z",
			};

			render(
				<SessionProviderDefault session={malformedSession}>
					<div>Malformed Session Test</div>
				</SessionProviderDefault>
			);

			expect(screen.getByTestId("session-provider")).toBeInTheDocument();
			expect(screen.getByText("Malformed Session Test")).toBeInTheDocument();
		});

		it("should handle React strict mode", () => {
			// Simulate React strict mode by rendering twice
			const { unmount } = render(
				<SessionProviderDefault>
					<div>Strict Mode Test</div>
				</SessionProviderDefault>
			);

			expect(screen.getByTestId("session-provider")).toBeInTheDocument();
			unmount();

			// Re-render (simulating strict mode remount)
			render(
				<SessionProviderDefault>
					<div>Strict Mode Test</div>
				</SessionProviderDefault>
			);

			expect(screen.getByTestId("session-provider")).toBeInTheDocument();
			expect(screen.getByText("Strict Mode Test")).toBeInTheDocument();
		});
	});

	describe("TypeScript Type Safety", () => {
		it("should accept valid SessionProvider props", () => {
			// This test ensures TypeScript compilation would pass
			const validProps = {
				session: { user: { name: "Test" }, expires: "2024-12-31" },
				basePath: "/auth",
				refetchInterval: 300,
				refetchOnWindowFocus: true,
				refetchWhenOffline: false as const,
			};

			render(
				<SessionProviderDefault {...validProps}>
					<div>Type Safety Test</div>
				</SessionProviderDefault>
			);

			expect(screen.getByTestId("session-provider")).toBeInTheDocument();
		});

		it("should handle optional props correctly", () => {
			// Test with minimal props (all others optional)
			render(
				<SessionProviderDefault>
					<div>Minimal Props Test</div>
				</SessionProviderDefault>
			);

			expect(screen.getByTestId("session-provider")).toBeInTheDocument();
		});
	});

	describe("Real-world Usage Patterns", () => {
		it("should work in typical app structure", () => {
			const App = () => (
				<SessionProviderDefault>
					<header>App Header</header>
					<main>Main Content</main>
					<footer>App Footer</footer>
				</SessionProviderDefault>
			);

			render(<App />);

			expect(screen.getByTestId("session-provider")).toBeInTheDocument();
			expect(screen.getByText("App Header")).toBeInTheDocument();
			expect(screen.getByText("Main Content")).toBeInTheDocument();
			expect(screen.getByText("App Footer")).toBeInTheDocument();
		});

		it("should maintain session state across component updates", () => {
			const session = {
				user: { name: "Persistent User" },
				expires: "2099-01-01",
			};

			const App = ({ title }: { title: string }) => (
				<SessionProviderDefault session={session}>
					<h1>{title}</h1>
					<div>Content</div>
				</SessionProviderDefault>
			);

			const { rerender } = render(<App title="Initial Title" />);

			expect(screen.getByText("Initial Title")).toBeInTheDocument();
			expect(screen.getByTestId("session-provider")).toHaveAttribute(
				"data-session",
				"provided"
			);

			rerender(<App title="Updated Title" />);

			expect(screen.getByText("Updated Title")).toBeInTheDocument();
			expect(screen.getByTestId("session-provider")).toHaveAttribute(
				"data-session",
				"provided"
			);
		});
	});
});
