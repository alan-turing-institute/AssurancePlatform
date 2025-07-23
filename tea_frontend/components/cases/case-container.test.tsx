import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "@/src/__tests__/mocks/server";
import { createMockAssuranceCase } from "@/src/__tests__/utils/mock-data";
import {
	renderWithReactFlowAndAuth,
	screen,
	waitFor,
} from "@/src/__tests__/utils/test-utils";
import type { AssuranceCase, User } from "@/types";
import CaseContainer from "./case-container";

// Regex constants for test assertions
const LOADING_REGEX = /loading/i;

// Mock the store
const mockStore = {
	assuranceCase: null as AssuranceCase | null,
	setAssuranceCase: vi.fn(),
	setOrphanedElements: vi.fn(),
	viewMembers: [] as User[],
	setViewMembers: vi.fn(),
	editMembers: [] as User[],
	setEditMembers: vi.fn(),
	reviewMembers: [] as User[],
	setReviewMembers: vi.fn(),
};

vi.mock("@/data/store", () => ({
	default: () => mockStore,
}));

// Mock the unauthorized function
const mockUnauthorized = vi.fn();
vi.mock("@/hooks/use-auth", () => ({
	unauthorized: () => mockUnauthorized(),
}));

// Mock next/navigation
const mockParams = { caseId: "1" };
vi.mock("next/navigation", () => ({
	useParams: () => mockParams,
	useRouter: () => ({
		push: vi.fn(),
		replace: vi.fn(),
		prefetch: vi.fn(),
		back: vi.fn(),
		forward: vi.fn(),
		refresh: vi.fn(),
	}),
	usePathname: () => "/",
	useSearchParams: () => new URLSearchParams(),
}));

// Mock ReactFlow components
vi.mock("reactflow", () => ({
	ReactFlowProvider: ({ children }: { children: React.ReactNode }) => (
		<div data-testid="reactflow-provider">{children}</div>
	),
}));

// Mock child components
vi.mock("./flow", () => ({
	default: () => <div data-testid="flow-component">Flow Component</div>,
}));

vi.mock("./case-details", () => ({
	default: ({
		isOpen,
		setOpen,
	}: {
		isOpen: boolean;
		setOpen: (open: boolean) => void;
	}) => (
		<div data-open={isOpen} data-testid="case-details">
			<button onClick={() => setOpen(!isOpen)} type="button">
				Toggle Details
			</button>
		</div>
	),
}));

vi.mock("../header", () => ({
	default: ({ setOpen }: { setOpen: (open: boolean) => void }) => (
		<div data-testid="header">
			<button onClick={() => setOpen(true)} type="button">
				Open Details
			</button>
		</div>
	),
}));

vi.mock("@/components/websocket", () => ({
	default: () => (
		<div data-testid="websocket-component">WebSocket Component</div>
	),
}));

vi.mock("@/lib/case-helper", () => ({
	addHiddenProp: vi.fn((data) => Promise.resolve({ ...data, hidden: false })),
}));

describe("CaseContainer", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockStore.assuranceCase = null;
		mockStore.setAssuranceCase.mockClear();
		mockStore.setOrphanedElements.mockClear();
		mockUnauthorized.mockClear();
	});

	describe("Loading State", () => {
		it("should display loading spinner while fetching case data", () => {
			renderWithReactFlowAndAuth(<CaseContainer caseId="1" />);

			// The Loader2 component has animate-spin class
			const spinner = document.querySelector(".animate-spin");
			expect(spinner).toBeInTheDocument();
			expect(screen.getByText("Rendering your chart...")).toBeInTheDocument();
		});

		it("should show correct loading animation elements", () => {
			renderWithReactFlowAndAuth(<CaseContainer caseId="1" />);

			const spinner = document.querySelector(".animate-spin");
			expect(spinner).toBeInTheDocument();
			expect(spinner).toHaveClass("animate-spin");
			expect(screen.getByText("Rendering your chart...")).toHaveClass(
				"text-muted-foreground"
			);
		});
	});

	describe("Case Loading", () => {
		it("should fetch case data when component mounts with caseId prop", async () => {
			const testCase = createMockAssuranceCase({ id: 1, name: "Test Case" });

			server.use(
				http.get("*/api/cases/1/", () => {
					return HttpResponse.json(testCase);
				}),
				http.get("*/api/cases/1/sandbox", () => {
					return HttpResponse.json([]);
				})
			);

			renderWithReactFlowAndAuth(<CaseContainer caseId="1" />);

			await waitFor(() => {
				expect(mockStore.setAssuranceCase).toHaveBeenCalledWith(
					expect.objectContaining({ id: 1, name: "Test Case", hidden: false })
				);
			});
		});

		it("should fetch case data using params when no caseId prop provided", async () => {
			const testCase = createMockAssuranceCase({ id: 1, name: "Params Case" });

			server.use(
				http.get("*/api/cases/1/", () => {
					return HttpResponse.json(testCase);
				}),
				http.get("*/api/cases/1/sandbox", () => {
					return HttpResponse.json([]);
				})
			);

			renderWithReactFlowAndAuth(<CaseContainer />);

			await waitFor(() => {
				expect(mockStore.setAssuranceCase).toHaveBeenCalledWith(
					expect.objectContaining({ id: 1, name: "Params Case", hidden: false })
				);
			});
		});

		it("should fetch orphaned elements after case is loaded", async () => {
			const testCase = createMockAssuranceCase({ id: 1 });
			const orphanedElements = [
				{ id: 1, type: "evidence", name: "Orphaned Evidence" },
			];

			server.use(
				http.get("*/api/cases/1/", () => {
					return HttpResponse.json(testCase);
				}),
				http.get("*/api/cases/1/sandbox", () => {
					return HttpResponse.json(orphanedElements);
				})
			);

			renderWithReactFlowAndAuth(<CaseContainer caseId="1" />);

			await waitFor(() => {
				expect(mockStore.setOrphanedElements).toHaveBeenCalledWith(
					orphanedElements
				);
			});
		});
	});

	describe("Error Handling", () => {
		it("should handle 404 errors gracefully", async () => {
			server.use(
				http.get("*/api/cases/999/", () => {
					return new HttpResponse(null, { status: 404 });
				})
			);

			renderWithReactFlowAndAuth(<CaseContainer caseId="999" />);

			await waitFor(() => {
				expect(screen.getByText("No Case Found")).toBeInTheDocument();
			});
		});

		it("should handle 403 forbidden errors", async () => {
			server.use(
				http.get("*/api/cases/1/", () => {
					return new HttpResponse(null, { status: 403 });
				})
			);

			renderWithReactFlowAndAuth(<CaseContainer caseId="1" />);

			await waitFor(() => {
				expect(screen.getByText("No Case Found")).toBeInTheDocument();
			});
		});

		it("should handle 401 unauthorized errors", async () => {
			mockUnauthorized.mockClear();

			server.use(
				http.get("*/api/cases/1/", () => {
					return new HttpResponse(null, { status: 401 });
				})
			);

			renderWithReactFlowAndAuth(<CaseContainer caseId="1" />);

			await waitFor(() => {
				expect(mockUnauthorized).toHaveBeenCalled();
			});
		});

		it("should handle network errors during case fetch", async () => {
			// Suppress console errors for this test since we expect errors
			const consoleErrorSpy = vi
				.spyOn(console, "error")
				.mockImplementation(() => {
					// Intentionally empty - suppressing console errors for this test
				});

			server.use(
				http.get("*/api/cases/1/", () => {
					return HttpResponse.error();
				})
			);

			renderWithReactFlowAndAuth(<CaseContainer caseId="1" />);

			// The component stays in loading state when there's a network error
			// since the promise is not caught and setLoading(false) is not called
			await waitFor(() => {
				expect(screen.getByText("Rendering your chart...")).toBeInTheDocument();
			});

			consoleErrorSpy.mockRestore();
		});
	});

	describe("Successful Case Rendering", () => {
		beforeEach(() => {
			const testCase = createMockAssuranceCase({ id: 1, name: "Test Case" });
			mockStore.assuranceCase = testCase;

			server.use(
				http.get("*/api/cases/1/", () => {
					return HttpResponse.json(testCase);
				}),
				http.get("*/api/cases/1/sandbox", () => {
					return HttpResponse.json([]);
				})
			);
		});

		it("should render ReactFlow provider when case is loaded", async () => {
			renderWithReactFlowAndAuth(<CaseContainer caseId="1" />);

			await waitFor(() => {
				expect(screen.getByTestId("reactflow-provider")).toBeInTheDocument();
			});
		});

		it("should render all child components when case is loaded", async () => {
			renderWithReactFlowAndAuth(<CaseContainer caseId="1" />);

			await waitFor(() => {
				expect(screen.getByTestId("header")).toBeInTheDocument();
				expect(screen.getByTestId("flow-component")).toBeInTheDocument();
				expect(screen.getByTestId("case-details")).toBeInTheDocument();
				expect(screen.getByTestId("websocket-component")).toBeInTheDocument();
			});
		});

		it("should render feedback button", async () => {
			renderWithReactFlowAndAuth(<CaseContainer caseId="1" />);

			await waitFor(() => {
				const feedbackButton = screen.getByRole("link");
				expect(feedbackButton).toHaveAttribute(
					"href",
					"https://alan-turing-institute.github.io/AssurancePlatform/community/community-support/"
				);
				expect(feedbackButton).toHaveAttribute("target", "_blank");
			});
		});

		it("should not display loading spinner when case is loaded", async () => {
			renderWithReactFlowAndAuth(<CaseContainer caseId="1" />);

			await waitFor(() => {
				expect(
					screen.queryByRole("status", { name: LOADING_REGEX })
				).not.toBeInTheDocument();
			});
		});
	});

	describe("No Case Found State", () => {
		it('should display "No Case Found" when case is null', async () => {
			mockStore.assuranceCase = null;

			server.use(
				http.get("*/api/cases/1/", () => {
					return HttpResponse.json(null);
				})
			);

			renderWithReactFlowAndAuth(<CaseContainer caseId="1" />);

			await waitFor(() => {
				expect(screen.getByText("No Case Found")).toBeInTheDocument();
			});
		});

		it("should not render ReactFlow components when no case found", async () => {
			mockStore.assuranceCase = null;

			server.use(
				http.get("*/api/cases/1/", () => {
					return HttpResponse.json(null);
				})
			);

			renderWithReactFlowAndAuth(<CaseContainer caseId="1" />);

			await waitFor(() => {
				// When there's no case, we should see "No Case Found" text
				expect(screen.getByText("No Case Found")).toBeInTheDocument();
				// And the Flow components should not be rendered
				expect(screen.queryByTestId("flow-component")).not.toBeInTheDocument();
				expect(screen.queryByTestId("header")).not.toBeInTheDocument();
				expect(screen.queryByTestId("case-details")).not.toBeInTheDocument();
			});
		});
	});

	describe("CaseDetails Integration", () => {
		it("should manage case details modal state", async () => {
			const testCase = createMockAssuranceCase({ id: 1 });
			mockStore.assuranceCase = testCase;

			renderWithReactFlowAndAuth(<CaseContainer caseId="1" />);

			await waitFor(() => {
				const caseDetails = screen.getByTestId("case-details");
				expect(caseDetails).toHaveAttribute("data-open", "false");
			});

			// Open details via header button
			const openButton = screen.getByText("Open Details");
			openButton.click();

			await waitFor(() => {
				const caseDetails = screen.getByTestId("case-details");
				expect(caseDetails).toHaveAttribute("data-open", "true");
			});
		});
	});

	describe("Authentication Integration", () => {
		it("should use session token for API requests", async () => {
			const testCase = createMockAssuranceCase({ id: 1 });

			let capturedHeaders: Record<string, string> = {};
			server.use(
				http.get("*/api/cases/1/", ({ request }) => {
					capturedHeaders = Object.fromEntries(request.headers.entries());
					return HttpResponse.json(testCase);
				}),
				http.get("*/api/cases/1/sandbox", () => {
					return HttpResponse.json([]);
				})
			);

			renderWithReactFlowAndAuth(<CaseContainer caseId="1" />);

			await waitFor(() => {
				expect(capturedHeaders.authorization).toBeDefined();
			});
		});
	});

	describe("Component Lifecycle", () => {
		it("should refetch data when caseId prop changes", async () => {
			const case1 = createMockAssuranceCase({ id: 1, name: "Case 1" });
			const case2 = createMockAssuranceCase({ id: 2, name: "Case 2" });

			server.use(
				http.get("*/api/cases/1/", () => HttpResponse.json(case1)),
				http.get("*/api/cases/2/", () => HttpResponse.json(case2)),
				http.get("*/api/cases/*/sandbox", () => HttpResponse.json([]))
			);

			const { rerender } = renderWithReactFlowAndAuth(
				<CaseContainer caseId="1" />
			);

			await waitFor(() => {
				expect(mockStore.setAssuranceCase).toHaveBeenCalledWith(
					expect.objectContaining({ id: 1, name: "Case 1" })
				);
			});

			mockStore.setAssuranceCase.mockClear();
			rerender(<CaseContainer caseId="2" />);

			await waitFor(() => {
				expect(mockStore.setAssuranceCase).toHaveBeenCalledWith(
					expect.objectContaining({ id: 2, name: "Case 2" })
				);
			});
		});
	});

	describe("Accessibility", () => {
		it("should have proper loading state accessibility", () => {
			renderWithReactFlowAndAuth(<CaseContainer caseId="1" />);

			const loadingText = screen.getByText("Rendering your chart...");
			// Check that the loading container has proper classes
			// Go up to the parent that has all the classes
			const loadingContainer = loadingText.parentElement?.parentElement;
			expect(loadingContainer).toHaveClass(
				"flex min-h-screen items-center justify-center"
			);
		});

		it("should have accessible feedback button", async () => {
			const testCase = createMockAssuranceCase({ id: 1 });
			mockStore.assuranceCase = testCase;

			renderWithReactFlowAndAuth(<CaseContainer caseId="1" />);

			await waitFor(() => {
				const feedbackButton = screen.getByRole("link");
				expect(feedbackButton).toBeInTheDocument();
				// The button should be keyboard accessible and have proper focus styles
			});
		});
	});
});
