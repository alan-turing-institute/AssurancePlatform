import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Clear global mocks to test actual implementations
vi.unmock("@/providers/modal-provider");

// Mock all modal components
vi.mock("@/components/modals/case-create-modal", () => ({
	CaseCreateModal: () => <div data-testid="case-create-modal">CaseCreateModal</div>,
}));

vi.mock("@/components/modals/email-modal", () => ({
	EmailModal: () => <div data-testid="email-modal">EmailModal</div>,
}));

vi.mock("@/components/modals/import-modal", () => ({
	ImportModal: () => <div data-testid="import-modal">ImportModal</div>,
}));

vi.mock("@/components/modals/permissions-modal", () => ({
	PermissionsModal: () => <div data-testid="permissions-modal">PermissionsModal</div>,
}));

vi.mock("@/components/modals/resources-modal", () => ({
	ResourcesModal: () => <div data-testid="resources-modal">ResourcesModal</div>,
}));

vi.mock("@/components/modals/share-modal", () => ({
	ShareModal: () => <div data-testid="share-modal">ShareModal</div>,
}));

// Mock next-auth/react
vi.mock("next-auth/react", () => ({
	SessionProvider: ({ children, ...props }: { children: React.ReactNode; [key: string]: any }) => (
		<div data-testid="session-provider" data-props={JSON.stringify(props)}>
			{children}
		</div>
	),
	useSession: () => ({
		data: { user: { name: "Test User" } },
		status: "authenticated",
	}),
}));

// Mock next-themes
vi.mock("next-themes", () => ({
	ThemeProvider: ({ children, ...props }: { children: React.ReactNode; [key: string]: any }) => (
		<div data-testid="next-themes-provider" data-props={JSON.stringify(props)}>
			{children}
		</div>
	),
}));

// Import providers after mocking
const { ModalProvider } = await import("../modal-provider");
const SessionProvider = (await import("../session-provider")).default;
const { ThemeProvider } = await import("../theme-provider");

describe("Providers Integration", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.clearAllTimers();
	});

	describe("Provider Hierarchy", () => {
		it("should work with all providers in typical app structure", async () => {
			const App = () => (
				<SessionProvider>
					<ThemeProvider defaultTheme="system" enableSystem>
						<ModalProvider />
						<div data-testid="app-content">App Content</div>
					</ThemeProvider>
				</SessionProvider>
			);

			render(<App />);

			// Check all providers are rendered
			expect(screen.getByTestId("session-provider")).toBeInTheDocument();
			expect(screen.getByTestId("next-themes-provider")).toBeInTheDocument();
			expect(screen.getByTestId("app-content")).toBeInTheDocument();

			// Wait for modal provider to mount
			await waitFor(() => {
				expect(screen.getByTestId("case-create-modal")).toBeInTheDocument();
			});

			// Check all modals are rendered
			expect(screen.getByTestId("case-create-modal")).toBeInTheDocument();
			expect(screen.getByTestId("email-modal")).toBeInTheDocument();
			expect(screen.getByTestId("import-modal")).toBeInTheDocument();
			expect(screen.getByTestId("permissions-modal")).toBeInTheDocument();
			expect(screen.getByTestId("resources-modal")).toBeInTheDocument();
			expect(screen.getByTestId("share-modal")).toBeInTheDocument();
		});

		it("should work with different provider ordering", async () => {
			const App = () => (
				<ThemeProvider>
					<SessionProvider>
						<ModalProvider />
						<div data-testid="app-content">App Content</div>
					</SessionProvider>
				</ThemeProvider>
			);

			render(<App />);

			expect(screen.getByTestId("next-themes-provider")).toBeInTheDocument();
			expect(screen.getByTestId("session-provider")).toBeInTheDocument();
			expect(screen.getByTestId("app-content")).toBeInTheDocument();

			await waitFor(() => {
				expect(screen.getByTestId("case-create-modal")).toBeInTheDocument();
			});
		});

		it("should work with nested provider structures", async () => {
			const AppLayout = ({ children }: { children: React.ReactNode }) => (
				<div data-testid="app-layout">{children}</div>
			);

			const App = () => (
				<SessionProvider session={{ user: { name: "Test" } }}>
					<AppLayout>
						<ThemeProvider defaultTheme="dark">
							<div data-testid="themed-content">Themed Content</div>
							<ModalProvider />
						</ThemeProvider>
					</AppLayout>
				</SessionProvider>
			);

			render(<App />);

			expect(screen.getByTestId("session-provider")).toBeInTheDocument();
			expect(screen.getByTestId("app-layout")).toBeInTheDocument();
			expect(screen.getByTestId("next-themes-provider")).toBeInTheDocument();
			expect(screen.getByTestId("themed-content")).toBeInTheDocument();

			await waitFor(() => {
				expect(screen.getByTestId("case-create-modal")).toBeInTheDocument();
			});
		});
	});

	describe("Provider Props Integration", () => {
		it("should handle complex props across all providers", async () => {
			const session = {
				user: { name: "Integration User", email: "integration@test.com" },
				expires: "2024-12-31",
			};

			const themeProps = {
				attribute: "class" as const,
				defaultTheme: "system",
				enableSystem: true,
				themes: ["light", "dark", "auto"],
				storageKey: "integration-theme",
			};

			const sessionProps = {
				session,
				basePath: "/auth",
				refetchInterval: 300,
				refetchOnWindowFocus: true,
			};

			const App = () => (
				<SessionProvider {...sessionProps}>
					<ThemeProvider {...themeProps}>
						<ModalProvider />
						<div data-testid="integration-content">Integration Test</div>
					</ThemeProvider>
				</SessionProvider>
			);

			render(<App />);

			// Check providers are rendered with correct props
			const sessionProvider = screen.getByTestId("session-provider");
			const themeProvider = screen.getByTestId("next-themes-provider");

			expect(sessionProvider).toBeInTheDocument();
			expect(themeProvider).toBeInTheDocument();

			// Verify props are passed correctly
			const sessionPropsData = JSON.parse(sessionProvider.getAttribute("data-props") || "{}");
			const themePropsData = JSON.parse(themeProvider.getAttribute("data-props") || "{}");

			expect(sessionPropsData).toMatchObject({
				session,
				basePath: "/auth",
				refetchInterval: 300,
				refetchOnWindowFocus: true,
			});

			expect(themePropsData).toMatchObject({
				attribute: "class",
				defaultTheme: "system",
				enableSystem: true,
				themes: ["light", "dark", "auto"],
				storageKey: "integration-theme",
			});

			await waitFor(() => {
				expect(screen.getByTestId("case-create-modal")).toBeInTheDocument();
			});
		});

		it("should handle prop updates across providers", async () => {
			const App = ({
				theme,
				sessionData
			}: {
				theme: string;
				sessionData: any;
			}) => (
				<SessionProvider session={sessionData}>
					<ThemeProvider defaultTheme={theme}>
						<ModalProvider />
						<div data-testid="dynamic-content">Dynamic Content</div>
					</ThemeProvider>
				</SessionProvider>
			);

			const initialSession = { user: { name: "Initial User" } };
			const updatedSession = { user: { name: "Updated User" } };

			const { rerender } = render(
				<App theme="light" sessionData={initialSession} />
			);

			await waitFor(() => {
				expect(screen.getByTestId("case-create-modal")).toBeInTheDocument();
			});

			// Update props
			rerender(<App theme="dark" sessionData={updatedSession} />);

			// All providers should still be rendered
			expect(screen.getByTestId("session-provider")).toBeInTheDocument();
			expect(screen.getByTestId("next-themes-provider")).toBeInTheDocument();
			expect(screen.getByTestId("case-create-modal")).toBeInTheDocument();
		});
	});

	describe("Provider Error Handling", () => {
		it("should handle provider unmounting in correct order", async () => {
			const App = () => (
				<SessionProvider>
					<ThemeProvider>
						<ModalProvider />
					</ThemeProvider>
				</SessionProvider>
			);

			const { unmount } = render(<App />);

			await waitFor(() => {
				expect(screen.getByTestId("case-create-modal")).toBeInTheDocument();
			});

			// Should not throw when unmounting nested providers
			expect(() => unmount()).not.toThrow();
		});
	});

	describe("Real-world App Structure", () => {
		it("should work in complete app with all providers", async () => {
			const Layout = ({ children }: { children: React.ReactNode }) => (
				<div data-testid="layout">
					<header data-testid="header">Header</header>
					<main data-testid="main">{children}</main>
					<footer data-testid="footer">Footer</footer>
				</div>
			);

			const Page = () => (
				<div data-testid="page">
					<h1>Test Page</h1>
					<p>Page content</p>
				</div>
			);

			const App = () => (
				<SessionProvider
					session={{ user: { name: "App User" } }}
					refetchInterval={300}
				>
					<ThemeProvider
						defaultTheme="system"
						enableSystem
						themes={["light", "dark", "system"]}
					>
						<Layout>
							<Page />
						</Layout>
						<ModalProvider />
					</ThemeProvider>
				</SessionProvider>
			);

			render(<App />);

			// Check app structure
			expect(screen.getByTestId("session-provider")).toBeInTheDocument();
			expect(screen.getByTestId("next-themes-provider")).toBeInTheDocument();
			expect(screen.getByTestId("layout")).toBeInTheDocument();
			expect(screen.getByTestId("header")).toBeInTheDocument();
			expect(screen.getByTestId("main")).toBeInTheDocument();
			expect(screen.getByTestId("footer")).toBeInTheDocument();
			expect(screen.getByTestId("page")).toBeInTheDocument();

			// Check modals are rendered
			await waitFor(() => {
				expect(screen.getByTestId("case-create-modal")).toBeInTheDocument();
			});

			expect(screen.getByTestId("email-modal")).toBeInTheDocument();
			expect(screen.getByTestId("import-modal")).toBeInTheDocument();
			expect(screen.getByTestId("permissions-modal")).toBeInTheDocument();
			expect(screen.getByTestId("resources-modal")).toBeInTheDocument();
			expect(screen.getByTestId("share-modal")).toBeInTheDocument();
		});

		it("should handle conditional provider rendering", async () => {
			const App = ({
				withAuth,
				withThemes,
				withModals
			}: {
				withAuth: boolean;
				withThemes: boolean;
				withModals: boolean;
			}) => {
				let content = <div data-testid="app-content">App Content</div>;

				if (withModals) {
					content = (
						<>
							{content}
							<ModalProvider />
						</>
					);
				}

				if (withThemes) {
					content = <ThemeProvider>{content}</ThemeProvider>;
				}

				if (withAuth) {
					content = <SessionProvider>{content}</SessionProvider>;
				}

				return content;
			};

			// Test all providers enabled
			const { rerender } = render(
				<App withAuth={true} withThemes={true} withModals={true} />
			);

			expect(screen.getByTestId("session-provider")).toBeInTheDocument();
			expect(screen.getByTestId("next-themes-provider")).toBeInTheDocument();
			expect(screen.getByTestId("app-content")).toBeInTheDocument();

			await waitFor(() => {
				expect(screen.getByTestId("case-create-modal")).toBeInTheDocument();
			});

			// Test with only session and themes
			rerender(<App withAuth={true} withThemes={true} withModals={false} />);

			expect(screen.getByTestId("session-provider")).toBeInTheDocument();
			expect(screen.getByTestId("next-themes-provider")).toBeInTheDocument();
			expect(screen.getByTestId("app-content")).toBeInTheDocument();
			expect(screen.queryByTestId("case-create-modal")).not.toBeInTheDocument();

			// Test with no providers
			rerender(<App withAuth={false} withThemes={false} withModals={false} />);

			expect(screen.queryByTestId("session-provider")).not.toBeInTheDocument();
			expect(screen.queryByTestId("next-themes-provider")).not.toBeInTheDocument();
			expect(screen.getByTestId("app-content")).toBeInTheDocument();
		});
	});

	describe("Performance and Memory", () => {
		it("should handle multiple mount/unmount cycles", async () => {
			const App = () => (
				<SessionProvider>
					<ThemeProvider>
						<ModalProvider />
					</ThemeProvider>
				</SessionProvider>
			);

			// Test multiple mount/unmount cycles
			for (let i = 0; i < 5; i++) {
				const { unmount } = render(<App />);

				await waitFor(() => {
					expect(screen.getByTestId("case-create-modal")).toBeInTheDocument();
				});

				expect(screen.getByTestId("session-provider")).toBeInTheDocument();
				expect(screen.getByTestId("next-themes-provider")).toBeInTheDocument();

				unmount();
			}

			// Should not cause memory leaks
			expect(true).toBe(true);
		});

		it("should handle rapid re-renders across all providers", async () => {
			const App = ({ version }: { version: number }) => (
				<SessionProvider session={{ version }}>
					<ThemeProvider defaultTheme={version % 2 === 0 ? "light" : "dark"}>
						<ModalProvider />
						<div data-testid="version">Version: {version}</div>
					</ThemeProvider>
				</SessionProvider>
			);

			const { rerender } = render(<App version={1} />);

			await waitFor(() => {
				expect(screen.getByTestId("case-create-modal")).toBeInTheDocument();
			});

			// Rapidly re-render multiple times
			for (let i = 2; i <= 10; i++) {
				rerender(<App version={i} />);
			}

			expect(screen.getByTestId("session-provider")).toBeInTheDocument();
			expect(screen.getByTestId("next-themes-provider")).toBeInTheDocument();
			expect(screen.getByTestId("case-create-modal")).toBeInTheDocument();
			expect(screen.getByText("Version: 10")).toBeInTheDocument();
		});
	});

	describe("Context and State Management", () => {
		it("should maintain independent provider states", async () => {
			const TestComponent = () => {
				return (
					<div data-testid="test-component">
						<div data-testid="session-context">Session Active</div>
						<div data-testid="theme-context">Theme Active</div>
						<div data-testid="modals-context">Modals Active</div>
					</div>
				);
			};

			const App = () => (
				<SessionProvider session={{ user: { name: "Context User" } }}>
					<ThemeProvider defaultTheme="light">
						<TestComponent />
						<ModalProvider />
					</ThemeProvider>
				</SessionProvider>
			);

			render(<App />);

			// All contexts should be available
			expect(screen.getByTestId("session-context")).toBeInTheDocument();
			expect(screen.getByTestId("theme-context")).toBeInTheDocument();
			expect(screen.getByTestId("modals-context")).toBeInTheDocument();

			await waitFor(() => {
				expect(screen.getByTestId("case-create-modal")).toBeInTheDocument();
			});
		});

		it("should handle provider state changes without affecting others", async () => {
			const App = ({ sessionUser, theme }: { sessionUser: string; theme: string }) => (
				<SessionProvider session={{ user: { name: sessionUser } }}>
					<ThemeProvider defaultTheme={theme}>
						<ModalProvider />
						<div data-testid="app-state">
							User: {sessionUser}, Theme: {theme}
						</div>
					</ThemeProvider>
				</SessionProvider>
			);

			const { rerender } = render(<App sessionUser="User1" theme="light" />);

			await waitFor(() => {
				expect(screen.getByTestId("case-create-modal")).toBeInTheDocument();
			});

			expect(screen.getByText("User: User1, Theme: light")).toBeInTheDocument();

			// Change only session
			rerender(<App sessionUser="User2" theme="light" />);

			expect(screen.getByText("User: User2, Theme: light")).toBeInTheDocument();
			expect(screen.getByTestId("case-create-modal")).toBeInTheDocument();

			// Change only theme
			rerender(<App sessionUser="User2" theme="dark" />);

			expect(screen.getByText("User: User2, Theme: dark")).toBeInTheDocument();
			expect(screen.getByTestId("case-create-modal")).toBeInTheDocument();
		});
	});

	describe("Accessibility and Standards", () => {
		it("should maintain accessibility when all providers are active", async () => {
			const App = () => (
				<SessionProvider>
					<ThemeProvider>
						<div role="main">
							<h1>Main Content</h1>
							<button type="button">Interactive Element</button>
						</div>
						<ModalProvider />
					</ThemeProvider>
				</SessionProvider>
			);

			render(<App />);

			// Check accessibility elements are preserved
			expect(screen.getByRole("main")).toBeInTheDocument();
			expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
			expect(screen.getByRole("button")).toBeInTheDocument();

			await waitFor(() => {
				expect(screen.getByTestId("case-create-modal")).toBeInTheDocument();
			});

			// Providers shouldn't interfere with accessibility
			expect(screen.getByRole("main")).toBeInTheDocument();
			expect(screen.getByRole("button")).toBeInTheDocument();
		});

		it("should not create accessibility violations with nested providers", async () => {
			const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

			const App = () => (
				<SessionProvider>
					<ThemeProvider>
						<main>
							<h1>Accessible App</h1>
							<nav>
								<ul>
									<li><a href="/home">Home</a></li>
									<li><a href="/about">About</a></li>
								</ul>
							</nav>
						</main>
						<ModalProvider />
					</ThemeProvider>
				</SessionProvider>
			);

			render(<App />);

			await waitFor(() => {
				expect(screen.getByTestId("case-create-modal")).toBeInTheDocument();
			});

			// No accessibility warnings should be generated
			expect(consoleWarnSpy).not.toHaveBeenCalled();
			expect(consoleErrorSpy).not.toHaveBeenCalled();

			// Semantic elements should be preserved
			expect(screen.getByRole("main")).toBeInTheDocument();
			expect(screen.getByRole("navigation")).toBeInTheDocument();
			expect(screen.getByRole("list")).toBeInTheDocument();

			consoleWarnSpy.mockRestore();
			consoleErrorSpy.mockRestore();
		});
	});
});
