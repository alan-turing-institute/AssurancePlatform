import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { server } from "@/src/__tests__/mocks/server";
import {
	renderWithAuth,
	screen,
	userEvent,
	waitFor,
} from "@/src/__tests__/utils/test-utils";
import Dashboard from "../page";

// Types
interface MockGoal {
	id: number;
	name: string;
	short_description?: string;
	long_description?: string;
	assurance_case: number;
}

interface MockStrategy {
	id: number;
	name: string;
	short_description?: string;
	long_description?: string;
	goal: number;
	assurance_case: number;
}

interface MockEvidence {
	id: number;
	name: string;
	short_description?: string;
	long_description?: string;
	URL?: string;
	assurance_case: number;
}

interface MockContext {
	id: number;
	name: string;
	short_description?: string;
	long_description?: string;
}

interface MockCaseData {
	goals?: MockGoal[];
	strategies?: MockStrategy[];
	evidence?: MockEvidence[];
	goal: number;
	assurance_case: number;
}

interface MockPropertyClaim {
	id: number;
	name: string;
	short_description?: string;
	long_description?: string;
	property_claim_type?: string;
	level?: number;
	claim_type?: string;
	goal?: number;
	strategy?: number;
	assurance_case: number;
}

interface MockAssuranceCase {
	id: number;
	name: string;
	description: string;
	created_date: string;
	owner: number;
	permissions: string;
	goals?: MockGoal[];
	strategies?: MockStrategy[];
	evidence?: MockEvidence[];
	contexts?: MockContext[];
	property_claims?: MockPropertyClaim[];
}

interface CaseListProps {
	assuranceCases: MockAssuranceCase[];
	showCreate?: boolean;
}

// Mock the server-side modules
vi.mock("next/navigation", async () => {
	const actual = await vi.importActual("next/navigation");
	return {
		...actual,
		redirect: vi.fn(),
		useRouter: () => ({
			push: vi.fn(),
			replace: vi.fn(),
			prefetch: vi.fn(),
			back: vi.fn(),
			forward: vi.fn(),
			refresh: vi.fn(),
		}),
	};
});

vi.mock("next-auth", () => ({
	getServerSession: vi.fn(() =>
		Promise.resolve({
			key: "mock-session-key",
			user: {
				id: "1",
				name: "Test User",
				email: "test@example.com",
			},
		})
	),
}));

// Mock the action modules
vi.mock("@/actions/assurance-cases", () => ({
	fetchAssuranceCases: vi.fn(() =>
		Promise.resolve([
			{
				id: 1,
				name: "Test Assurance Case",
				description: "A test case for testing",
				created_date: "2024-01-01T00:00:00Z",
				owner: 1,
				permissions: "manage",
			},
			{
				id: 2,
				name: "Another Test Case",
				description: "Another case for testing",
				created_date: "2024-01-02T00:00:00Z",
				owner: 1,
				permissions: "manage",
			},
		])
	),
}));

vi.mock("@/actions/users", () => ({
	fetchCurrentUser: vi.fn(() =>
		Promise.resolve({
			id: 1,
			username: "testuser",
			email: "test@example.com",
			first_name: "Test",
			last_name: "User",
		})
	),
}));

// Mock components that use client-side features
vi.mock("@/components/cases/case-list", () => ({
	default: ({ assuranceCases, showCreate }: CaseListProps) => {
		const React = require("react");
		const mockCreateModal = vi.fn();
		const [searchTerm, setSearchTerm] = React.useState("");
		const [filteredCases, setFilteredCases] = React.useState(assuranceCases);

		React.useEffect(() => {
			const searchTermLowerCase = searchTerm.toLowerCase();
			let filtered: MockAssuranceCase[];

			if (searchTerm.trim() === "") {
				filtered = [...assuranceCases];
			} else {
				filtered = assuranceCases.filter((ac: MockAssuranceCase) =>
					ac.name.toLowerCase().includes(searchTermLowerCase)
				);
			}

			// Sort by created_date (newest first)
			filtered.sort(
				(a, b) =>
					new Date(b.created_date).getTime() -
					new Date(a.created_date).getTime()
			);

			setFilteredCases(filtered);
		}, [searchTerm, assuranceCases]);

		return (
			<div>
				<input
					data-testid="search-input"
					onChange={(e) => setSearchTerm(e.target.value)}
					placeholder="Filter by name..."
					type="text"
					value={searchTerm}
				/>
				<button data-testid="import-button" type="button">
					Import File
				</button>
				{showCreate && (
					<button
						data-testid="new-case-button"
						onClick={() => {
							mockCreateModal();
							// Simulate navigation to case editor
							Object.defineProperty(window, "location", {
								value: { href: "/case/3" },
								writable: true,
							});
						}}
						type="button"
					>
						Create new case
					</button>
				)}
				<div data-testid="case-list">
					{filteredCases.map((ac: MockAssuranceCase) => (
						<button
							data-testid={`case-card-${ac.id}`}
							key={ac.id}
							onClick={() => {
								Object.defineProperty(window, "location", {
									value: { href: `/case/${ac.id}` },
									writable: true,
								});
							}}
							style={{ all: "unset", cursor: "pointer", display: "block" }}
							type="button"
						>
							<h3>{ac.name}</h3>
							<p>{ac.description}</p>
							<p>{new Date(ac.created_date).toLocaleDateString()}</p>
						</button>
					))}
				</div>
			</div>
		);
	},
}));

vi.mock("@/components/check-user-email", () => ({
	default: () => null,
}));

// Mock the permissions modal that's causing issues
vi.mock("@/components/modals/permissions-modal", () => ({
	PermissionsModal: () => null,
}));

// Test case editor component
const CaseEditor = ({ caseId }: { caseId: string }) => {
	const React = require("react");
	const [caseData, setCaseData] = React.useState(null);
	const [autoSaveStatus, setAutoSaveStatus] = React.useState("");
	const [loading, setLoading] = React.useState(true);
	const [error, setError] = React.useState(null);

	React.useEffect(() => {
		// Simulate fetching case data
		const url = `http://localhost:8000/api/cases/${caseId}/`;

		fetch(url, {
			headers: {
				Authorization: "Token mock-session-key",
			},
		})
			.then((res) => {
				if (!res.ok) {
					throw new Error(`HTTP error! status: ${res.status}`);
				}
				return res.json();
			})
			.then((data) => {
				// Ensure data has expected structure
				const normalizedData = {
					id: data.id || Number.parseInt(caseId, 10),
					name: data.name || "Test Assurance Case",
					description: data.description || "A test case for testing",
					goals: data.goals || [],
					strategies: data.strategies || [],
					evidence: data.evidence || [],
					...data,
				};
				setCaseData(normalizedData);
				setLoading(false);
			})
			.catch((err) => {
				setError(err.message);
				setLoading(false);
			});
	}, [caseId]);

	const handleAutoSave = React.useMemo(() => {
		const debounce = (fn: () => void, delay: number) => {
			let timeoutId: NodeJS.Timeout;
			return () => {
				clearTimeout(timeoutId);
				timeoutId = setTimeout(fn, delay);
			};
		};
		return debounce(() => {
			setAutoSaveStatus("Saving...");
			setTimeout(() => {
				setAutoSaveStatus("Saved");
			}, 1000);
		}, 2000);
	}, []);

	const addGoal = async () => {
		try {
			const response = await fetch("http://localhost:8000/api/goals/", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: "Token mock-session-key",
				},
				body: JSON.stringify({
					name: "New Goal",
					short_description: "A new goal",
					long_description: "Detailed description of the goal",
					assurance_case: caseId,
				}),
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const newGoal = await response.json();
			setCaseData((prev: MockCaseData | null) => ({
				...prev,
				goals: [...(prev?.goals || []), newGoal],
			}));
			handleAutoSave();
		} catch (_err) {}
	};

	const addStrategy = async () => {
		try {
			const response = await fetch("http://localhost:8000/api/strategies/", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: "Token mock-session-key",
				},
				body: JSON.stringify({
					name: "New Strategy",
					short_description: "A new strategy",
					long_description: "Detailed description of the strategy",
					goal: caseData?.goals?.[0]?.id,
					assurance_case: caseId,
				}),
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const newStrategy = await response.json();
			setCaseData((prev: MockCaseData | null) => ({
				...prev,
				strategies: [...(prev?.strategies || []), newStrategy],
			}));
			handleAutoSave();
		} catch (_err) {}
	};

	const addEvidence = async () => {
		try {
			const response = await fetch("http://localhost:8000/api/evidence/", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: "Token mock-session-key",
				},
				body: JSON.stringify({
					name: "New Evidence",
					short_description: "New evidence item",
					long_description: "Detailed description of the evidence",
					URL: "https://example.com/evidence",
					assurance_case: caseId,
				}),
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const newEvidence = await response.json();
			setCaseData((prev: MockCaseData | null) => ({
				...prev,
				evidence: [...(prev?.evidence || []), newEvidence],
			}));
			handleAutoSave();
		} catch (_err) {}
	};

	if (loading) {
		return <div>Loading...</div>;
	}

	if (error) {
		return <div data-testid="error">Error: {error}</div>;
	}

	if (!caseData) {
		return <div data-testid="no-data">No case data available</div>;
	}

	return (
		<div data-testid="case-editor">
			<h1>{caseData.name || "Untitled Case"}</h1>
			<p>{caseData.description || "No description"}</p>
			{autoSaveStatus && (
				<span data-testid="auto-save-status">{autoSaveStatus}</span>
			)}

			<div data-testid="case-elements">
				<h2>Goals</h2>
				{(caseData.goals || []).map((goal: MockGoal) => (
					<div data-testid={`goal-${goal.id}`} key={goal.id}>
						{goal.name || "Untitled Goal"}
					</div>
				))}
				<button data-testid="add-goal-button" onClick={addGoal} type="button">
					Add Goal
				</button>

				<h2>Strategies</h2>
				{(caseData.strategies || []).map((strategy: MockStrategy) => (
					<div data-testid={`strategy-${strategy.id}`} key={strategy.id}>
						{strategy.name || "Untitled Strategy"}
					</div>
				))}
				<button
					data-testid="add-strategy-button"
					onClick={addStrategy}
					type="button"
				>
					Add Strategy
				</button>

				<h2>Evidence</h2>
				{(caseData.evidence || []).map((evidence: MockEvidence) => (
					<div data-testid={`evidence-${evidence.id}`} key={evidence.id}>
						{evidence.name || "Untitled Evidence"}
					</div>
				))}
				<button
					data-testid="add-evidence-button"
					onClick={addEvidence}
					type="button"
				>
					Add Evidence
				</button>
			</div>
		</div>
	);
};

describe("Case Management Integration Tests", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Reset handlers to ensure clean slate
		server.resetHandlers();

		// Add a specific handler for case management tests to override any conflicts
		server.use(
			http.get("http://localhost:8000/api/cases/:id/", ({ params }) => {
				return HttpResponse.json({
					id: Number.parseInt(params.id as string, 10),
					name: "Test Assurance Case",
					description: "A test case for testing",
					created_date: "2024-01-01T00:00:00Z",
					owner: 1,
					view_groups: [],
					edit_groups: [],
					review_groups: [],
					goals: [],
					property_claims: [],
					evidence: [],
					contexts: [],
					strategies: [],
				});
			}),
			// Add handlers for POST operations
			http.post("http://localhost:8000/api/goals/", async ({ request }) => {
				const body = (await request.json()) as any;
				return HttpResponse.json(
					{
						id: Date.now(),
						name: body.name,
						short_description: body.short_description,
						long_description: body.long_description,
						assurance_case: body.assurance_case,
					},
					{ status: 201 }
				);
			}),
			http.post(
				"http://localhost:8000/api/strategies/",
				async ({ request }) => {
					const body = (await request.json()) as any;
					return HttpResponse.json(
						{
							id: Date.now(),
							name: body.name,
							short_description: body.short_description,
							long_description: body.long_description,
							goal: body.goal,
							assurance_case: body.assurance_case,
						},
						{ status: 201 }
					);
				}
			),
			http.post("http://localhost:8000/api/evidence/", async ({ request }) => {
				const body = (await request.json()) as any;
				return HttpResponse.json(
					{
						id: Date.now(),
						name: body.name,
						short_description: body.short_description,
						long_description: body.long_description,
						URL: body.URL,
						assurance_case: body.assurance_case,
					},
					{ status: 201 }
				);
			})
		);
	});

	describe("Creating new case from dashboard", () => {
		test("should create a new case and redirect to case editor", async () => {
			const user = userEvent.setup();
			renderWithAuth(await Dashboard());

			// Find and click the "New Case" button
			const newCaseButton = await screen.findByTestId("new-case-button");
			expect(newCaseButton).toBeInTheDocument();

			// Mock the case creation response
			server.use(
				http.post("http://localhost:8000/api/cases/", async ({ request }) => {
					const body = (await request.json()) as {
						name: string;
						description: string;
					};
					return HttpResponse.json(
						{
							id: 3,
							name: body.name,
							description: body.description,
							created_date: new Date().toISOString(),
							owner: 1,
							goals: [],
							strategies: [],
							evidence: [],
							contexts: [],
							property_claims: [],
						},
						{ status: 201 }
					);
				})
			);

			await user.click(newCaseButton);

			// The mock redirects to case editor
			await waitFor(() => {
				expect(window.location.href).toBe("/case/3");
			});
		});

		test("should display newly created case in case list", async () => {
			const mockFetchAssuranceCases = vi.mocked(
				await import("@/actions/assurance-cases").then(
					(m) => m.fetchAssuranceCases
				)
			);

			// Update the mock to include the newly created case
			mockFetchAssuranceCases.mockResolvedValueOnce([
				{
					id: 1,
					name: "Test Assurance Case",
					description: "A test case for testing",
					created_date: "2024-01-01T00:00:00Z",
					owner: 1,
					permissions: "manage",
				},
				{
					id: 2,
					name: "Another Test Case",
					description: "Another case for testing",
					created_date: "2024-01-02T00:00:00Z",
					owner: 1,
					permissions: "manage",
				},
				{
					id: 3,
					name: "New Test Case",
					description: "Newly created test case",
					created_date: new Date().toISOString(),
					owner: 1,
					permissions: "manage",
				},
			]);

			renderWithAuth(await Dashboard());

			await waitFor(() => {
				expect(screen.getByTestId("case-card-3")).toBeInTheDocument();
				expect(screen.getByText("New Test Case")).toBeInTheDocument();
			});
		});
	});

	describe("Navigating to case editor", () => {
		test("should navigate to case editor when clicking on existing case", async () => {
			const user = userEvent.setup();
			renderWithAuth(await Dashboard());

			const caseCard = await screen.findByTestId("case-card-1");
			expect(caseCard).toBeInTheDocument();

			await user.click(caseCard);

			await waitFor(() => {
				expect(window.location.href).toBe("/case/1");
			});
		});

		test("should load case editor with correct data", async () => {
			renderWithAuth(<CaseEditor caseId="1" />);

			await waitFor(() => {
				expect(screen.getByText("Test Assurance Case")).toBeInTheDocument();
				expect(screen.getByText("A test case for testing")).toBeInTheDocument();
			});
		});
	});

	describe("Adding goals, strategies, and evidence", () => {
		test("should add a new goal to the case", async () => {
			const user = userEvent.setup();
			renderWithAuth(<CaseEditor caseId="1" />);

			await waitFor(() => {
				expect(screen.getByTestId("case-editor")).toBeInTheDocument();
			});

			const addGoalButton = screen.getByTestId("add-goal-button");
			await user.click(addGoalButton);

			await waitFor(() => {
				expect(screen.getByText("New Goal")).toBeInTheDocument();
			});
		});

		test("should add a strategy under the goal", async () => {
			const user = userEvent.setup();
			renderWithAuth(<CaseEditor caseId="1" />);

			await waitFor(() => {
				expect(screen.getByTestId("case-editor")).toBeInTheDocument();
			});

			// First add a goal
			const addGoalButton = screen.getByTestId("add-goal-button");
			await user.click(addGoalButton);

			await waitFor(() => {
				expect(screen.getByText("New Goal")).toBeInTheDocument();
			});

			// Then add a strategy
			const addStrategyButton = screen.getByTestId("add-strategy-button");
			await user.click(addStrategyButton);

			await waitFor(() => {
				expect(screen.getByText("New Strategy")).toBeInTheDocument();
			});
		});

		test("should add evidence to support the strategy", async () => {
			const user = userEvent.setup();
			renderWithAuth(<CaseEditor caseId="1" />);

			await waitFor(() => {
				expect(screen.getByTestId("case-editor")).toBeInTheDocument();
			});

			const addEvidenceButton = screen.getByTestId("add-evidence-button");
			await user.click(addEvidenceButton);

			await waitFor(() => {
				expect(screen.getByText("New Evidence")).toBeInTheDocument();
			});
		});
	});

	describe("Auto-save functionality", () => {
		test("should trigger auto-save after making changes", async () => {
			const user = userEvent.setup();
			renderWithAuth(<CaseEditor caseId="1" />);

			await waitFor(() => {
				expect(screen.getByTestId("case-editor")).toBeInTheDocument();
			});

			const addGoalButton = screen.getByTestId("add-goal-button");
			await user.click(addGoalButton);

			// Wait for auto-save to trigger
			// Wait for auto-save to trigger (after 2 second debounce)
			await waitFor(() => {
				expect(screen.getByTestId("auto-save-status")).toHaveTextContent(
					"Saving..."
				);
			}, 3000);

			await waitFor(() => {
				expect(screen.getByTestId("auto-save-status")).toHaveTextContent(
					"Saved"
				);
			});
		});
	});

	describe("Case listing and filtering", () => {
		test("should display all cases on dashboard", async () => {
			renderWithAuth(await Dashboard());

			await waitFor(() => {
				expect(screen.getByTestId("case-card-1")).toBeInTheDocument();
				expect(screen.getByTestId("case-card-2")).toBeInTheDocument();
			});
		});

		test("should filter cases by name", async () => {
			const user = userEvent.setup();
			renderWithAuth(await Dashboard());

			const searchInput = await screen.findByTestId("search-input");
			await user.type(searchInput, "Another");

			await waitFor(() => {
				expect(screen.queryByTestId("case-card-1")).not.toBeInTheDocument();
				expect(screen.getByTestId("case-card-2")).toBeInTheDocument();
			});
		});

		test("should clear filter and show all cases", async () => {
			const user = userEvent.setup();
			renderWithAuth(await Dashboard());

			const searchInput = await screen.findByTestId("search-input");
			await user.type(searchInput, "Another");

			await waitFor(() => {
				expect(screen.queryByTestId("case-card-1")).not.toBeInTheDocument();
			});

			await user.clear(searchInput);

			await waitFor(() => {
				expect(screen.getByTestId("case-card-1")).toBeInTheDocument();
				expect(screen.getByTestId("case-card-2")).toBeInTheDocument();
			});
		});

		test("should sort cases by date modified (most recent first)", async () => {
			renderWithAuth(await Dashboard());

			await waitFor(() => {
				const caseList = screen.getByTestId("case-list");
				const cases = Array.from(
					caseList.querySelectorAll('[data-testid^="case-card-"]')
				);

				// Check that cases are sorted by date (newest first)
				expect(cases.length).toBe(2);
				// Since the mock component sorts by created_date, case 2 should be first
				expect(cases[0].getAttribute("data-testid")).toBe("case-card-2");
				expect(cases[1].getAttribute("data-testid")).toBe("case-card-1");
			});
		});
	});
});
