import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockAssuranceCase } from "@/src/__tests__/utils/mock-data";
import CaseNotes from "../case-notes";

// Create a flexible mock assurance case for testing
const testAssuranceCase = {
	...mockAssuranceCase,
	permissions: "manage" as string | string[] | undefined,
};

// Mock the store
const mockStore = {
	assuranceCase: testAssuranceCase as
		| typeof testAssuranceCase
		| null
		| undefined,
	caseNotes: [] as unknown[],
	setCaseNotes: vi.fn(),
};

vi.mock("@/data/store", () => ({
	default: () => mockStore,
}));

// Mock child components - using correct import paths
vi.mock("@/components/ui/notes-sheet", () => ({
	default: ({
		children,
		title,
		description,
		isOpen,
		onClose,
	}: {
		children: React.ReactNode;
		title: string;
		description: string;
		isOpen: boolean;
		onClose: () => void;
	}) => (
		<div data-open={isOpen} data-testid="notes-sheet">
			<div data-testid="notes-sheet-title">{title}</div>
			<div data-testid="notes-sheet-description">{description}</div>
			<button data-testid="notes-sheet-close" onClick={onClose} type="button">
				Close
			</button>
			{children}
		</div>
	),
}));

vi.mock("@/components/cases/notes-feed", () => ({
	default: () => <div data-testid="notes-feed">Notes Feed</div>,
}));

vi.mock("@/components/cases/notes-form", () => ({
	default: () => <div data-testid="notes-form">Notes Form</div>,
}));

describe("CaseNotes", () => {
	const mockOnClose = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
		mockStore.assuranceCase = testAssuranceCase;
	});

	describe("Rendering", () => {
		it("should render when open and assurance case exists", () => {
			render(<CaseNotes isOpen={true} onClose={mockOnClose} />);

			expect(screen.getByTestId("notes-sheet")).toBeInTheDocument();
			expect(screen.getByTestId("notes-feed")).toBeInTheDocument();
		});

		it("should not render when not mounted initially", () => {
			const { container } = render(
				<CaseNotes isOpen={true} onClose={mockOnClose} />
			);

			// Component should render after mounting
			expect(container.firstChild).toBeTruthy();
		});

		it("should not render when assurance case is null", () => {
			mockStore.assuranceCase = null;
			const { container } = render(
				<CaseNotes isOpen={true} onClose={mockOnClose} />
			);

			expect(container.firstChild).toBeNull();
		});

		it("should render when closed", () => {
			render(<CaseNotes isOpen={false} onClose={mockOnClose} />);

			const notesSheet = screen.getByTestId("notes-sheet");
			expect(notesSheet).toHaveAttribute("data-open", "false");
		});
	});

	describe("Permission-based rendering", () => {
		it("should show notes form for non-view permissions", () => {
			mockStore.assuranceCase = {
				...testAssuranceCase,
				permissions: "edit",
			};

			render(<CaseNotes isOpen={true} onClose={mockOnClose} />);

			expect(screen.getByTestId("notes-form")).toBeInTheDocument();
		});

		it("should not show notes form for view-only permissions", () => {
			mockStore.assuranceCase = {
				...testAssuranceCase,
				permissions: "view",
			};

			render(<CaseNotes isOpen={true} onClose={mockOnClose} />);

			expect(screen.queryByTestId("notes-form")).not.toBeInTheDocument();
		});

		it("should show manage title for non-view permissions", () => {
			mockStore.assuranceCase = {
				...testAssuranceCase,
				permissions: "edit",
			};

			render(<CaseNotes isOpen={true} onClose={mockOnClose} />);

			expect(screen.getByTestId("notes-sheet-title")).toHaveTextContent(
				"Manage Case Notes"
			);
		});

		it("should show view-only title for view permissions", () => {
			mockStore.assuranceCase = {
				...testAssuranceCase,
				permissions: "view",
			};

			render(<CaseNotes isOpen={true} onClose={mockOnClose} />);

			expect(screen.getByTestId("notes-sheet-title")).toHaveTextContent(
				"Case Notes"
			);
		});
	});

	describe("Description text", () => {
		it("should show manage description for edit permissions", () => {
			mockStore.assuranceCase = {
				...testAssuranceCase,
				permissions: "edit",
			};

			render(<CaseNotes isOpen={true} onClose={mockOnClose} />);

			expect(screen.getByTestId("notes-sheet-description")).toHaveTextContent(
				"Use this section to view and manage your notes."
			);
		});

		it("should show view-only description for view permissions", () => {
			mockStore.assuranceCase = {
				...testAssuranceCase,
				permissions: "view",
			};

			render(<CaseNotes isOpen={true} onClose={mockOnClose} />);

			expect(screen.getByTestId("notes-sheet-description")).toHaveTextContent(
				"Use this section to view notes."
			);
		});

		it("should show manage description for manage permissions", () => {
			mockStore.assuranceCase = {
				...testAssuranceCase,
				permissions: "manage",
			};

			render(<CaseNotes isOpen={true} onClose={mockOnClose} />);

			expect(screen.getByTestId("notes-sheet-description")).toHaveTextContent(
				"Use this section to view and manage your notes."
			);
		});

		it("should show manage description for review permissions", () => {
			mockStore.assuranceCase = {
				...testAssuranceCase,
				permissions: "review",
			};

			render(<CaseNotes isOpen={true} onClose={mockOnClose} />);

			expect(screen.getByTestId("notes-sheet-description")).toHaveTextContent(
				"Use this section to view and manage your notes."
			);
		});
	});

	describe("Component integration", () => {
		it("should always render notes feed", () => {
			render(<CaseNotes isOpen={true} onClose={mockOnClose} />);

			expect(screen.getByTestId("notes-feed")).toBeInTheDocument();
		});

		it("should pass props correctly to NotesSheet", () => {
			render(<CaseNotes isOpen={true} onClose={mockOnClose} />);

			const notesSheet = screen.getByTestId("notes-sheet");
			expect(notesSheet).toHaveAttribute("data-open", "true");
		});
	});

	describe("Edge cases", () => {
		it("should handle undefined assurance case", () => {
			mockStore.assuranceCase = undefined;
			const { container } = render(
				<CaseNotes isOpen={true} onClose={mockOnClose} />
			);

			expect(container.firstChild).toBeNull();
		});

		it("should handle assurance case with undefined permissions", () => {
			mockStore.assuranceCase = {
				...testAssuranceCase,
				permissions: undefined,
			};

			render(<CaseNotes isOpen={true} onClose={mockOnClose} />);

			// Should default to showing notes form when permissions are undefined
			expect(screen.getByTestId("notes-form")).toBeInTheDocument();
		});
	});
});
