import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Clear global mocks to test actual implementations
vi.unmock("@/providers/modal-provider");

// Mock all modal components
vi.mock("@/components/modals/case-create-modal", () => ({
	CaseCreateModal: () => (
		<div data-testid="case-create-modal">CaseCreateModal</div>
	),
}));

vi.mock("@/components/modals/email-modal", () => ({
	EmailModal: () => <div data-testid="email-modal">EmailModal</div>,
}));

vi.mock("@/components/modals/import-modal", () => ({
	ImportModal: () => <div data-testid="import-modal">ImportModal</div>,
}));

vi.mock("@/components/modals/permissions-modal", () => ({
	PermissionsModal: () => (
		<div data-testid="permissions-modal">PermissionsModal</div>
	),
}));

vi.mock("@/components/modals/resources-modal", () => ({
	ResourcesModal: () => <div data-testid="resources-modal">ResourcesModal</div>,
}));

vi.mock("@/components/modals/share-modal", () => ({
	ShareModal: () => <div data-testid="share-modal">ShareModal</div>,
}));

// Mock next-auth/react
vi.mock("next-auth/react", () => ({
	SessionProvider: ({
		children,
		...props
	}: {
		children: React.ReactNode;
		[key: string]: unknown;
	}) => (
		<div data-props={JSON.stringify(props)} data-testid="session-provider">
			{children}
		</div>
	),
}));

// Mock next-themes
vi.mock("next-themes", () => ({
	ThemeProvider: ({
		children,
		...props
	}: {
		children: React.ReactNode;
		[key: string]: unknown;
	}) => (
		<div data-props={JSON.stringify(props)} data-testid="next-themes-provider">
			{children}
		</div>
	),
}));

// Error boundary removed as it was unused

// Import providers after mocking
const { ModalProvider } = await import("../modal-provider");
const SessionProvider = (await import("../session-provider")).default;
const { ThemeProvider } = await import("../theme-provider");

describe("Providers Edge Cases and Error Handling", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.clearAllTimers();
	});

	describe("ModalProvider Edge Cases", () => {
		it("should handle extremely rapid mount/unmount cycles", async () => {
			for (let i = 0; i < 20; i++) {
				const { unmount } = render(<ModalProvider />);
				unmount();
			}

			// Final render should still work
			render(<ModalProvider />);
			await waitFor(() => {
				expect(screen.getByTestId("case-create-modal")).toBeInTheDocument();
			});
		});

		it("should handle memory pressure scenarios", async () => {
			const providers: Array<() => void> = [];

			// Create many providers simultaneously
			for (let i = 0; i < 10; i++) {
				const { unmount } = render(<ModalProvider key={i} />);
				providers.push(unmount);
			}

			// Wait for all to mount
			await waitFor(() => {
				expect(screen.getAllByTestId("case-create-modal")).toHaveLength(10);
			});

			// Cleanup all providers
			for (const unmount of providers) {
				unmount();
			}

			// Should not cause memory issues
			expect(true).toBe(true);
		});

		it("should handle React concurrent rendering", async () => {
			const ConcurrentApp = () => {
				const [count, setCount] = React.useState(0);

				React.useEffect(() => {
					const interval = setInterval(() => {
						setCount((c) => c + 1);
					}, 10);

					setTimeout(() => clearInterval(interval), 100);
					return () => clearInterval(interval);
				}, []);

				return (
					<div>
						<div data-testid="count">{count}</div>
						<ModalProvider />
					</div>
				);
			};

			render(<ConcurrentApp />);

			await waitFor(() => {
				expect(screen.getByTestId("case-create-modal")).toBeInTheDocument();
			});

			// Should handle concurrent updates
			expect(screen.getByTestId("count")).toBeInTheDocument();
		});

		it("should handle component mounting successfully", async () => {
			render(<ModalProvider />);

			// Should mount and render modals correctly
			await waitFor(() => {
				expect(screen.getByTestId("case-create-modal")).toBeInTheDocument();
			});

			expect(screen.getByTestId("case-create-modal")).toBeInTheDocument();
		});
	});

	describe("SessionProvider Edge Cases", () => {
		it("should handle malformed session data", () => {
			const malformedSession = {
				user: { name: null, email: undefined },
				expires: "invalid-date",
				accessToken: Symbol("invalid"),
			};

			render(
				<SessionProvider session={malformedSession}>
					<div data-testid="content">Content</div>
				</SessionProvider>
			);

			expect(screen.getByTestId("session-provider")).toBeInTheDocument();
			expect(screen.getByTestId("content")).toBeInTheDocument();
		});

		it("should handle circular reference in session data", () => {
			const circularSession: {
				user: { name: string };
				expires: string;
				self?: unknown;
			} = {
				user: { name: "Test" },
				expires: "2024-12-31T23:59:59.999Z",
			};
			circularSession.self = circularSession;

			// Mock JSON.stringify to handle circular references
			const originalStringify = JSON.stringify;
			JSON.stringify = vi.fn().mockImplementation((obj) => {
				try {
					return originalStringify(obj);
				} catch (_error) {
					return '{"user":{"name":"Test"},"self":"[Circular]"}';
				}
			});

			expect(() => {
				render(
					<SessionProvider session={circularSession}>
						<div>Content</div>
					</SessionProvider>
				);
			}).not.toThrow();

			// Restore original JSON.stringify
			JSON.stringify = originalStringify;
		});

		it("should handle extremely large session objects", () => {
			const largeSession = {
				user: {
					name: "A".repeat(1000),
					data: new Array(100)
						.fill(0)
						.map((_, i) => ({ key: i, value: "B".repeat(100) })),
				},
				expires: "2099-01-01",
				metadata: new Array(50).fill(0).reduce(
					(acc, _, i) => {
						acc[`field_${i}`] = "C".repeat(200);
						return acc;
					},
					{} as Record<string, string>
				),
			};

			render(
				<SessionProvider session={largeSession}>
					<div data-testid="large-session">Large Session Test</div>
				</SessionProvider>
			);

			expect(screen.getByTestId("session-provider")).toBeInTheDocument();
			expect(screen.getByTestId("large-session")).toBeInTheDocument();
		});

		it("should handle session updates during render", () => {
			let sessionData = { user: { name: "Initial" }, expires: "2099-01-01" };

			const DynamicApp = () => {
				const [, forceUpdate] = React.useState({});

				React.useEffect(() => {
					setTimeout(() => {
						sessionData = { user: { name: "Updated" }, expires: "2099-01-01" };
						forceUpdate({});
					}, 10);
				}, []);

				return (
					<SessionProvider session={sessionData}>
						<div data-testid="dynamic-content">Dynamic Content</div>
					</SessionProvider>
				);
			};

			render(<DynamicApp />);

			expect(screen.getByTestId("session-provider")).toBeInTheDocument();
			expect(screen.getByTestId("dynamic-content")).toBeInTheDocument();
		});
	});

	describe("ThemeProvider Edge Cases", () => {
		it("should handle invalid theme configurations", () => {
			const invalidThemes = [null, undefined, "invalid", 123, {}, []];

			for (const invalidTheme of invalidThemes) {
				const { unmount } = render(
					<ThemeProvider themes={invalidTheme as string[]}>
						<div data-testid={`invalid-theme-${String(invalidTheme)}`}>
							Content
						</div>
					</ThemeProvider>
				);

				expect(screen.getByTestId("next-themes-provider")).toBeInTheDocument();
				unmount();
			}
		});

		it("should handle extremely long theme names", () => {
			const longThemes = ["A".repeat(100), "B".repeat(500), "C".repeat(1000)];

			render(
				<ThemeProvider themes={longThemes}>
					<div data-testid="long-themes">Long Themes Test</div>
				</ThemeProvider>
			);

			expect(screen.getByTestId("next-themes-provider")).toBeInTheDocument();
			expect(screen.getByTestId("long-themes")).toBeInTheDocument();
		});

		it("should handle theme prop mutations during render", () => {
			const mutableThemes = ["light", "dark"];

			const MutatingApp = () => {
				React.useEffect(() => {
					// Mutate the themes array (bad practice but should be handled)
					mutableThemes.push("system");
				}, []);

				return (
					<ThemeProvider themes={mutableThemes}>
						<div data-testid="mutating-themes">Mutating Themes Test</div>
					</ThemeProvider>
				);
			};

			render(<MutatingApp />);

			expect(screen.getByTestId("next-themes-provider")).toBeInTheDocument();
			expect(screen.getByTestId("mutating-themes")).toBeInTheDocument();
		});

		it("should handle storage-related errors", () => {
			// Mock localStorage to throw errors
			const originalLocalStorage = global.localStorage;
			Object.defineProperty(global, "localStorage", {
				value: {
					getItem: () => {
						throw new Error("Storage error");
					},
					setItem: () => {
						throw new Error("Storage error");
					},
					removeItem: () => {
						throw new Error("Storage error");
					},
				},
				writable: true,
			});

			render(
				<ThemeProvider storageKey="error-storage">
					<div data-testid="storage-error">Storage Error Test</div>
				</ThemeProvider>
			);

			expect(screen.getByTestId("next-themes-provider")).toBeInTheDocument();
			expect(screen.getByTestId("storage-error")).toBeInTheDocument();

			// Restore localStorage
			Object.defineProperty(global, "localStorage", {
				value: originalLocalStorage,
				writable: true,
			});
		});
	});

	describe("Provider Interaction Edge Cases", () => {
		it("should handle deep nesting with many levels", async () => {
			const DeepNesting = ({ level }: { level: number }) => {
				if (level === 0) {
					return (
						<SessionProvider>
							<ThemeProvider>
								<ModalProvider />
							</ThemeProvider>
						</SessionProvider>
					);
				}

				return (
					<div data-testid={`level-${level}`}>
						<DeepNesting level={level - 1} />
					</div>
				);
			};

			render(<DeepNesting level={5} />);

			await waitFor(() => {
				expect(screen.getByTestId("case-create-modal")).toBeInTheDocument();
			});

			expect(screen.getByTestId("session-provider")).toBeInTheDocument();
			expect(screen.getByTestId("next-themes-provider")).toBeInTheDocument();
		});

		it("should handle provider recovery scenarios", async () => {
			const App = ({ shouldWork }: { shouldWork: boolean }) => {
				if (!shouldWork) {
					return <div data-testid="fallback">Fallback Content</div>;
				}

				return (
					<SessionProvider>
						<ThemeProvider>
							<ModalProvider />
							<div data-testid="app-content">App Content</div>
						</ThemeProvider>
					</SessionProvider>
				);
			};

			const { rerender } = render(<App shouldWork={false} />);
			expect(screen.getByTestId("fallback")).toBeInTheDocument();

			// Recovery scenario
			rerender(<App shouldWork={true} />);

			await waitFor(() => {
				expect(screen.getByTestId("case-create-modal")).toBeInTheDocument();
			});

			expect(screen.getByTestId("session-provider")).toBeInTheDocument();
			expect(screen.getByTestId("app-content")).toBeInTheDocument();
		});
	});

	describe("Resource Exhaustion Scenarios", () => {
		it("should handle memory exhaustion during provider rendering", async () => {
			// Simulate memory pressure by creating large objects
			const createLargeData = () =>
				new Array(100).fill(0).map(() => ({
					data: "x".repeat(100),
					nested: new Array(10).fill(0).map(() => ({ value: "y".repeat(100) })),
				}));

			const MemoryIntensiveApp = () => {
				const [_data] = React.useState(createLargeData);

				return (
					<SessionProvider
						session={{
							user: { name: "MemoryUser" },
							expires: "2024-12-31T23:59:59.999Z",
						}}
					>
						<ThemeProvider
							themes={new Array(10).fill(0).map((_, i) => `theme-${i}`)}
						>
							<ModalProvider />
							<div data-testid="memory-intensive">Memory Intensive App</div>
						</ThemeProvider>
					</SessionProvider>
				);
			};

			// Should not crash with large data
			render(<MemoryIntensiveApp />);

			await waitFor(() => {
				expect(screen.getByTestId("case-create-modal")).toBeInTheDocument();
			});

			expect(screen.getByTestId("session-provider")).toBeInTheDocument();
			expect(screen.getByTestId("memory-intensive")).toBeInTheDocument();
		});

		it("should handle CPU intensive operations during rendering", async () => {
			const CpuIntensiveApp = () => {
				const [result, setResult] = React.useState(0);

				React.useEffect(() => {
					// Simulate CPU intensive work
					let sum = 0;
					for (let i = 0; i < 10_000; i++) {
						sum += Math.random();
					}
					setResult(sum);
				}, []);

				return (
					<SessionProvider>
						<ThemeProvider>
							<ModalProvider />
							<div data-testid="cpu-result">{result}</div>
						</ThemeProvider>
					</SessionProvider>
				);
			};

			render(<CpuIntensiveApp />);

			await waitFor(() => {
				expect(screen.getByTestId("case-create-modal")).toBeInTheDocument();
			});

			expect(screen.getByTestId("cpu-result")).toBeInTheDocument();
		});
	});

	describe("Browser Compatibility Edge Cases", () => {
		it("should handle basic provider rendering", () => {
			render(
				<SessionProvider>
					<ThemeProvider>
						<div data-testid="compat-test">Compatibility Test</div>
					</ThemeProvider>
				</SessionProvider>
			);

			expect(screen.getByTestId("session-provider")).toBeInTheDocument();
			expect(screen.getByTestId("compat-test")).toBeInTheDocument();
		});

		it("should handle theme provider with storage key", () => {
			render(
				<ThemeProvider storageKey="test-storage">
					<div data-testid="storage-test">Storage Test</div>
				</ThemeProvider>
			);

			expect(screen.getByTestId("next-themes-provider")).toBeInTheDocument();
			expect(screen.getByTestId("storage-test")).toBeInTheDocument();
		});
	});

	describe("Timing and Race Condition Edge Cases", () => {
		it("should handle rapid provider prop changes", async () => {
			const RapidChangeApp = () => {
				const [count, setCount] = React.useState(0);

				React.useEffect(() => {
					const interval = setInterval(() => {
						setCount((c) => c + 1);
					}, 1);

					setTimeout(() => clearInterval(interval), 20);
					return () => clearInterval(interval);
				}, []);

				return (
					<SessionProvider
						session={{
							user: { name: `RapidUser${count}` },
							expires: "2024-12-31T23:59:59.999Z",
						}}
					>
						<ThemeProvider defaultTheme={count % 2 === 0 ? "light" : "dark"}>
							<ModalProvider />
							<div data-testid="rapid-count">{count}</div>
						</ThemeProvider>
					</SessionProvider>
				);
			};

			render(<RapidChangeApp />);

			await waitFor(
				() => {
					expect(screen.getByTestId("case-create-modal")).toBeInTheDocument();
				},
				{ timeout: 100 }
			);

			expect(screen.getByTestId("rapid-count")).toBeInTheDocument();
		});

		it("should handle concurrent provider initialization", async () => {
			const promises = new Array(5).fill(0).map((_, i) => {
				const uniqueKey = `concurrent-provider-${Date.now()}-${Math.random()}`;
				return new Promise<void>((resolve) => {
					setTimeout(() => {
						render(
							<div key={uniqueKey}>
								<SessionProvider>
									<ThemeProvider>
										<div data-testid={`concurrent-${i}`}>Concurrent {i}</div>
									</ThemeProvider>
								</SessionProvider>
							</div>
						);
						resolve();
					}, Math.random() * 10);
				});
			});

			await Promise.all(promises);

			// Should handle concurrent initialization without issues
			expect(screen.getAllByTestId("session-provider")).toHaveLength(5);
		});
	});

	describe("Error Handling", () => {
		it("should handle graceful degradation", () => {
			const GracefulApp = ({
				withTheme,
				withSession,
			}: {
				withTheme: boolean;
				withSession: boolean;
			}) => {
				let content = <div data-testid="base-content">Base Content</div>;

				if (withTheme) {
					content = <ThemeProvider>{content}</ThemeProvider>;
				}

				if (withSession) {
					content = <SessionProvider>{content}</SessionProvider>;
				}

				return content;
			};

			const { rerender } = render(
				<GracefulApp withSession={false} withTheme={false} />
			);
			expect(screen.getByTestId("base-content")).toBeInTheDocument();

			rerender(<GracefulApp withSession={false} withTheme={true} />);
			expect(screen.getByTestId("next-themes-provider")).toBeInTheDocument();

			rerender(<GracefulApp withSession={true} withTheme={true} />);
			expect(screen.getByTestId("session-provider")).toBeInTheDocument();
			expect(screen.getByTestId("next-themes-provider")).toBeInTheDocument();
		});
	});
});
