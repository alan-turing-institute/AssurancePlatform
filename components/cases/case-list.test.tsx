import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	createMockArray,
	createMockAssuranceCase,
} from "@/src/__tests__/utils/mock-data";
import {
	renderWithAuth,
	screen,
	waitFor,
} from "@/src/__tests__/utils/test-utils";
import CaseList from "./case-list";

// Regex constants for test assertions
const FILTER_BY_NAME_REGEX = /filter by name/i;
const IMPORT_FILE_REGEX = /import file/i;
const CREATE_NEW_CASE_REGEX = /create new case/i;
const GET_STARTED_REGEX = /get started with a new case/i;
const TEST_CASE_1_REGEX = /test case 1/i;
const TEST_CASE_2_REGEX = /test case 2/i;
const SAFETY_CASE_REGEX = /safety case/i;
const SECURITY_CASE_REGEX = /security case/i;
const CASE_CARD_REGEX = /^case-card-/;

// Mock the modal hooks
const mockCreateCaseModal = {
	isOpen: false,
	onOpen: vi.fn(),
	onClose: vi.fn(),
};

const mockImportModal = {
	isOpen: false,
	onOpen: vi.fn(),
	onClose: vi.fn(),
};

vi.mock("@/hooks/use-create-case-modal", () => ({
	useCreateCaseModal: () => mockCreateCaseModal,
}));

vi.mock("@/hooks/use-import-modal", () => ({
	useImportModal: () => mockImportModal,
}));

// Mock the CaseCard component to avoid nested dependencies
vi.mock("./case-card", () => ({
	default: ({
		assuranceCase,
	}: {
		assuranceCase: {
			id: number;
			name: string;
			description: string;
			created_date: string;
		};
	}) => (
		<div data-testid={`case-card-${assuranceCase.id}`}>
			<h3>{assuranceCase.name}</h3>
			<p>{assuranceCase.description}</p>
			<span>
				Created on:{" "}
				{new Date(assuranceCase.created_date).toLocaleDateString("en-GB")}
			</span>
		</div>
	),
}));

describe("CaseList", () => {
	const mockCases = [
		createMockAssuranceCase({
			id: 1,
			name: "Test Case 1",
			description: "First test case",
			created_date: "2024-01-01T00:00:00Z",
		}),
		createMockAssuranceCase({
			id: 2,
			name: "Test Case 2",
			description: "Second test case",
			created_date: "2024-02-01T00:00:00Z",
		}),
		createMockAssuranceCase({
			id: 3,
			name: "Safety Case",
			description: "Safety assurance case",
			created_date: "2024-03-01T00:00:00Z",
		}),
		createMockAssuranceCase({
			id: 4,
			name: "Security Case",
			description: "Security assurance case",
			created_date: "2024-04-01T00:00:00Z",
		}),
	];

	beforeEach(() => {
		vi.clearAllMocks();
		mockCreateCaseModal.onOpen.mockClear();
		mockImportModal.onOpen.mockClear();
	});

	describe("Rendering", () => {
		it("should render the case list with all provided cases", () => {
			renderWithAuth(<CaseList assuranceCases={mockCases} />);

			// Check that all case cards are rendered
			expect(screen.getByTestId("case-card-1")).toBeInTheDocument();
			expect(screen.getByTestId("case-card-2")).toBeInTheDocument();
			expect(screen.getByTestId("case-card-3")).toBeInTheDocument();
			expect(screen.getByTestId("case-card-4")).toBeInTheDocument();

			// Check case names are displayed
			expect(screen.getByText(TEST_CASE_1_REGEX)).toBeInTheDocument();
			expect(screen.getByText(TEST_CASE_2_REGEX)).toBeInTheDocument();
			expect(screen.getByText(SAFETY_CASE_REGEX)).toBeInTheDocument();
			expect(screen.getByText(SECURITY_CASE_REGEX)).toBeInTheDocument();
		});

		it("should render cases in descending order by creation date", () => {
			renderWithAuth(<CaseList assuranceCases={mockCases} />);

			const caseCards = screen.getAllByTestId(CASE_CARD_REGEX);

			// Most recent case should be first
			expect(caseCards[0]).toHaveAttribute("data-testid", "case-card-4");
			expect(caseCards[1]).toHaveAttribute("data-testid", "case-card-3");
			expect(caseCards[2]).toHaveAttribute("data-testid", "case-card-2");
			expect(caseCards[3]).toHaveAttribute("data-testid", "case-card-1");
		});

		it("should render search input", () => {
			renderWithAuth(<CaseList assuranceCases={mockCases} />);

			const searchInput = screen.getByPlaceholderText(FILTER_BY_NAME_REGEX);
			expect(searchInput).toBeInTheDocument();
			expect(searchInput).toHaveAttribute("type", "text");
		});

		it("should render import button", () => {
			renderWithAuth(<CaseList assuranceCases={mockCases} />);

			const importButton = screen.getByRole("button", {
				name: IMPORT_FILE_REGEX,
			});
			expect(importButton).toBeInTheDocument();
		});

		it("should render create case button when showCreate is true", () => {
			renderWithAuth(<CaseList assuranceCases={mockCases} showCreate={true} />);

			const createButton = screen.getByRole("button", {
				name: CREATE_NEW_CASE_REGEX,
			});
			expect(createButton).toBeInTheDocument();
			expect(screen.getByText(GET_STARTED_REGEX)).toBeInTheDocument();
		});

		it("should not render create case button when showCreate is false", () => {
			renderWithAuth(
				<CaseList assuranceCases={mockCases} showCreate={false} />
			);

			const createButton = screen.queryByRole("button", {
				name: CREATE_NEW_CASE_REGEX,
			});
			expect(createButton).not.toBeInTheDocument();
		});
	});

	describe("Empty States", () => {
		it("should render empty list when no cases provided", () => {
			renderWithAuth(<CaseList assuranceCases={[]} />);

			// Should not find any case cards
			expect(screen.queryByTestId(CASE_CARD_REGEX)).not.toBeInTheDocument();
		});

		it("should only show create button when no cases and showCreate is true", () => {
			renderWithAuth(<CaseList assuranceCases={[]} showCreate={true} />);

			expect(
				screen.getByRole("button", { name: CREATE_NEW_CASE_REGEX })
			).toBeInTheDocument();
			expect(screen.queryByTestId(CASE_CARD_REGEX)).not.toBeInTheDocument();
		});
	});

	describe("Search Functionality", () => {
		it("should filter cases by name when searching", async () => {
			const user = userEvent.setup();
			renderWithAuth(<CaseList assuranceCases={mockCases} />);

			const searchInput = screen.getByPlaceholderText(FILTER_BY_NAME_REGEX);

			// Search for "safety"
			await user.type(searchInput, "safety");

			await waitFor(() => {
				// Should only show the safety case
				expect(screen.getByTestId("case-card-3")).toBeInTheDocument();
				expect(screen.queryByTestId("case-card-1")).not.toBeInTheDocument();
				expect(screen.queryByTestId("case-card-2")).not.toBeInTheDocument();
				expect(screen.queryByTestId("case-card-4")).not.toBeInTheDocument();
			});
		});

		it("should perform case-insensitive search", async () => {
			const user = userEvent.setup();
			renderWithAuth(<CaseList assuranceCases={mockCases} />);

			const searchInput = screen.getByPlaceholderText(FILTER_BY_NAME_REGEX);

			// Search with different case
			await user.type(searchInput, "SAFETY");

			await waitFor(() => {
				expect(screen.getByTestId("case-card-3")).toBeInTheDocument();
				expect(screen.queryByTestId("case-card-1")).not.toBeInTheDocument();
			});
		});

		it("should show all cases when search is cleared", async () => {
			const user = userEvent.setup();
			renderWithAuth(<CaseList assuranceCases={mockCases} />);

			const searchInput = screen.getByPlaceholderText(FILTER_BY_NAME_REGEX);

			// Type and then clear
			await user.type(searchInput, "safety");
			await user.clear(searchInput);

			await waitFor(() => {
				// All cases should be visible again
				expect(screen.getByTestId("case-card-1")).toBeInTheDocument();
				expect(screen.getByTestId("case-card-2")).toBeInTheDocument();
				expect(screen.getByTestId("case-card-3")).toBeInTheDocument();
				expect(screen.getByTestId("case-card-4")).toBeInTheDocument();
			});
		});

		it("should show no results when search term matches no cases", async () => {
			const user = userEvent.setup();
			renderWithAuth(<CaseList assuranceCases={mockCases} />);

			const searchInput = screen.getByPlaceholderText(FILTER_BY_NAME_REGEX);

			await user.type(searchInput, "nonexistent");

			await waitFor(() => {
				expect(screen.queryByTestId(CASE_CARD_REGEX)).not.toBeInTheDocument();
			});
		});

		it("should handle partial matches in search", async () => {
			const user = userEvent.setup();
			renderWithAuth(<CaseList assuranceCases={mockCases} />);

			const searchInput = screen.getByPlaceholderText(FILTER_BY_NAME_REGEX);

			// Search for "case" - should match multiple items
			await user.type(searchInput, "case");

			await waitFor(() => {
				expect(screen.getByTestId("case-card-1")).toBeInTheDocument();
				expect(screen.getByTestId("case-card-2")).toBeInTheDocument();
				expect(screen.getByTestId("case-card-3")).toBeInTheDocument();
				expect(screen.getByTestId("case-card-4")).toBeInTheDocument();
			});
		});
	});

	describe("Modal Triggers", () => {
		it("should open create case modal when create button is clicked", async () => {
			const user = userEvent.setup();
			renderWithAuth(<CaseList assuranceCases={mockCases} showCreate={true} />);

			const createButton = screen.getByRole("button", {
				name: CREATE_NEW_CASE_REGEX,
			});
			await user.click(createButton);

			expect(mockCreateCaseModal.onOpen).toHaveBeenCalledTimes(1);
		});

		it("should open import modal when import button is clicked", async () => {
			const user = userEvent.setup();
			renderWithAuth(<CaseList assuranceCases={mockCases} />);

			const importButton = screen.getByRole("button", {
				name: IMPORT_FILE_REGEX,
			});
			await user.click(importButton);

			expect(mockImportModal.onOpen).toHaveBeenCalledTimes(1);
		});
	});

	describe("Large Data Sets", () => {
		it("should handle rendering many cases efficiently", () => {
			const manyCases = createMockArray(
				(index) =>
					createMockAssuranceCase({
						id: index + 1,
						name: `Case ${index + 1}`,
						description: `Description for case ${index + 1}`,
						created_date: new Date(2024, 0, index + 1).toISOString(),
					}),
				50
			);

			renderWithAuth(<CaseList assuranceCases={manyCases} />);

			// Check that cases are rendered
			const caseCards = screen.getAllByTestId(CASE_CARD_REGEX);
			expect(caseCards).toHaveLength(50);
		});

		it("should filter large data sets efficiently", async () => {
			const user = userEvent.setup();
			const manyCases = createMockArray(
				(index) =>
					createMockAssuranceCase({
						id: index + 1,
						name:
							index % 2 === 0
								? `Safety Case ${index + 1}`
								: `Security Case ${index + 1}`,
						description: `Description for case ${index + 1}`,
						created_date: new Date(2024, 0, index + 1).toISOString(),
					}),
				20
			);

			renderWithAuth(<CaseList assuranceCases={manyCases} />);

			const searchInput = screen.getByPlaceholderText(FILTER_BY_NAME_REGEX);
			await user.type(searchInput, "safety");

			await waitFor(() => {
				const filteredCards = screen.getAllByTestId(CASE_CARD_REGEX);
				expect(filteredCards).toHaveLength(10); // Half should be safety cases
			});
		});
	});

	describe("Accessibility", () => {
		it("should have proper ARIA attributes on interactive elements", () => {
			renderWithAuth(<CaseList assuranceCases={mockCases} showCreate={true} />);

			const searchInput = screen.getByPlaceholderText(FILTER_BY_NAME_REGEX);
			expect(searchInput).toBeInTheDocument();
			expect(searchInput).toHaveAttribute("type", "text");

			const importButton = screen.getByRole("button", {
				name: IMPORT_FILE_REGEX,
			});
			expect(importButton).toHaveAccessibleName();
		});

		it("should be keyboard navigable", async () => {
			const user = userEvent.setup();
			renderWithAuth(<CaseList assuranceCases={mockCases} showCreate={true} />);

			// Tab through elements
			await user.tab();
			const searchInput = screen.getByPlaceholderText(FILTER_BY_NAME_REGEX);
			expect(searchInput).toHaveFocus();

			await user.tab();
			const importButton = screen.getByRole("button", {
				name: IMPORT_FILE_REGEX,
			});
			expect(importButton).toHaveFocus();

			await user.tab();
			const createButton = screen.getByRole("button", {
				name: CREATE_NEW_CASE_REGEX,
			});
			expect(createButton).toHaveFocus();
		});

		it("should handle keyboard interaction for modals", async () => {
			const user = userEvent.setup();
			renderWithAuth(<CaseList assuranceCases={mockCases} showCreate={true} />);

			const createButton = screen.getByRole("button", {
				name: CREATE_NEW_CASE_REGEX,
			});
			createButton.focus();

			await user.keyboard("{Enter}");
			expect(mockCreateCaseModal.onOpen).toHaveBeenCalledTimes(1);

			const importButton = screen.getByRole("button", {
				name: IMPORT_FILE_REGEX,
			});
			importButton.focus();

			await user.keyboard("{Enter}");
			expect(mockImportModal.onOpen).toHaveBeenCalledTimes(1);
		});
	});

	describe("Responsive Design", () => {
		it("should render with proper grid layout classes", () => {
			renderWithAuth(<CaseList assuranceCases={mockCases} />);

			const gridContainer = screen.getByTestId("case-list-grid");
			expect(gridContainer).toHaveClass(
				"grid",
				"grid-cols-1",
				"sm:grid-cols-2",
				"xl:grid-cols-3",
				"2xl:grid-cols-4"
			);
		});

		it("should have responsive search input width", () => {
			renderWithAuth(<CaseList assuranceCases={mockCases} />);

			const searchContainer = screen.getByTestId("search-container");
			expect(searchContainer).toHaveClass("w-2/3", "md:w-1/3");
		});
	});

	describe("Edge Cases", () => {
		it("should handle cases with missing or invalid dates gracefully", () => {
			const casesWithInvalidDates = [
				createMockAssuranceCase({
					id: 1,
					name: "Invalid Date Case",
					created_date: "invalid-date",
				}),
				createMockAssuranceCase({
					id: 2,
					name: "Empty Date Case",
					created_date: "",
				}),
			];

			renderWithAuth(<CaseList assuranceCases={casesWithInvalidDates} />);

			// Should still render the cases
			expect(screen.getByTestId("case-card-1")).toBeInTheDocument();
			expect(screen.getByTestId("case-card-2")).toBeInTheDocument();
		});

		it("should handle search with special characters", async () => {
			const user = userEvent.setup();
			const specialCase = createMockAssuranceCase({
				id: 1,
				name: "Case with @#$% special chars!",
			});

			renderWithAuth(<CaseList assuranceCases={[specialCase]} />);

			const searchInput = screen.getByPlaceholderText(FILTER_BY_NAME_REGEX);
			await user.type(searchInput, "@#$%");

			await waitFor(() => {
				expect(screen.getByTestId("case-card-1")).toBeInTheDocument();
			});
		});

		it("should handle very long case names", () => {
			const longNameCase = createMockAssuranceCase({
				id: 1,
				name: "A".repeat(200), // Very long name
			});

			renderWithAuth(<CaseList assuranceCases={[longNameCase]} />);

			expect(screen.getByTestId("case-card-1")).toBeInTheDocument();
		});
	});
});
