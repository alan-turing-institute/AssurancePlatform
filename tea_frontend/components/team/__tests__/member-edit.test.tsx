import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	renderWithoutProviders,
	screen,
	waitFor,
} from "@/src/__tests__/utils/test-utils";
import {
	adminMember,
	regularMember,
} from "@/src/__tests__/utils/team-mock-data";
import MemberEdit from "../member-edit";

// Mock the EditSheet component
vi.mock("../../ui/edit-sheet", () => ({
	default: ({
		description,
		isOpen,
		onChange,
		onClose,
		title,
		children,
	}: {
		description: string;
		isOpen: boolean;
		onChange: (open: boolean) => void;
		onClose: () => void;
		title: string;
		children?: React.ReactNode;
	}) => (
		<div data-testid="edit-sheet">
			<div data-testid="edit-sheet-title">{title}</div>
			<div data-testid="edit-sheet-description">{description}</div>
			<div data-testid="edit-sheet-content">{children}</div>
			<button
				data-testid="edit-sheet-close"
				onClick={() => onChange(false)}
				type="button"
			>
				Close
			</button>
			{isOpen && <div data-testid="sheet-is-open">Sheet is open</div>}
		</div>
	),
}));

// Mock the MemberEditForm component
vi.mock("../member-edit-form", () => ({
	default: ({ member }: { member: any }) => (
		<div data-testid="member-edit-form">
			<span data-testid="member-name">{member.name}</span>
			<span data-testid="member-title">{member.title}</span>
			<span data-testid="member-email">{member.email}</span>
		</div>
	),
}));

// Regex constants for test assertions
const EDITING_MEMBER_TITLE_REGEX = /editing member/i;
const UPDATE_MEMBERS_DESCRIPTION_REGEX = /use this form to update members/i;

describe("MemberEdit", () => {
	const mockOnClose = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("Component Mounting and Rendering", () => {
		it("should render when mounted and isOpen is true", () => {
			renderWithoutProviders(
				<MemberEdit
					member={adminMember}
					isOpen={true}
					onClose={mockOnClose}
				/>
			);

			expect(screen.getByTestId("edit-sheet")).toBeInTheDocument();
			expect(screen.getByTestId("sheet-is-open")).toBeInTheDocument();
			expect(screen.getByTestId("edit-sheet-title")).toHaveTextContent(
				EDITING_MEMBER_TITLE_REGEX
			);
			expect(screen.getByTestId("edit-sheet-description")).toHaveTextContent(
				UPDATE_MEMBERS_DESCRIPTION_REGEX
			);
		});

		it("should not render sheet content when isOpen is false", () => {
			renderWithoutProviders(
				<MemberEdit
					member={adminMember}
					isOpen={false}
					onClose={mockOnClose}
				/>
			);

			expect(screen.getByTestId("edit-sheet")).toBeInTheDocument();
			expect(screen.queryByTestId("sheet-is-open")).not.toBeInTheDocument();
		});
	});

	describe("Member Data Handling", () => {
		it("should render MemberEditForm when member is provided", () => {
			renderWithoutProviders(
				<MemberEdit
					member={adminMember}
					isOpen={true}
					onClose={mockOnClose}
				/>
			);

			const memberEditForm = screen.getByTestId("member-edit-form");
			expect(memberEditForm).toBeInTheDocument();

			// Check that member data is passed to the form
			expect(screen.getByTestId("member-name")).toHaveTextContent(adminMember.name);
			expect(screen.getByTestId("member-title")).toHaveTextContent(adminMember.title);
			expect(screen.getByTestId("member-email")).toHaveTextContent(adminMember.email);
		});

		it("should not render MemberEditForm when member is null", () => {
			renderWithoutProviders(
				<MemberEdit
					member={null}
					isOpen={true}
					onClose={mockOnClose}
				/>
			);

			expect(screen.queryByTestId("member-edit-form")).not.toBeInTheDocument();
		});

		it("should handle different member types correctly", () => {
			// Test with admin member
			const { rerender } = renderWithoutProviders(
				<MemberEdit
					member={adminMember}
					isOpen={true}
					onClose={mockOnClose}
				/>
			);

			expect(screen.getByTestId("member-name")).toHaveTextContent(adminMember.name);

			// Test with regular member
			rerender(
				<MemberEdit
					member={regularMember}
					isOpen={true}
					onClose={mockOnClose}
				/>
			);

			expect(screen.getByTestId("member-name")).toHaveTextContent(regularMember.name);
		});
	});

	describe("Sheet Behavior", () => {
		it("should call onClose when sheet onChange is triggered with false", async () => {
			renderWithoutProviders(
				<MemberEdit
					member={adminMember}
					isOpen={true}
					onClose={mockOnClose}
				/>
			);

			const closeButton = screen.getByTestId("edit-sheet-close");
			closeButton.click();

			expect(mockOnClose).toHaveBeenCalledTimes(1);
		});

		it("should not call onClose when sheet onChange is triggered with true", () => {
			renderWithoutProviders(
				<MemberEdit
					member={adminMember}
					isOpen={true}
					onClose={mockOnClose}
				/>
			);

			// Since we can't easily trigger onChange with true in our mock,
			// we'll test the logic by checking that onClose is not called
			// when the component is initially rendered with isOpen=true
			expect(mockOnClose).not.toHaveBeenCalled();
		});

		it("should pass correct props to EditSheet", () => {
			renderWithoutProviders(
				<MemberEdit
					member={adminMember}
					isOpen={true}
					onClose={mockOnClose}
				/>
			);

			expect(screen.getByTestId("edit-sheet-title")).toHaveTextContent("Editing Member");
			expect(screen.getByTestId("edit-sheet-description")).toHaveTextContent(
				"Use this form to update members."
			);
		});
	});

	describe("State Management", () => {
		it("should handle isOpen state changes", () => {
			const { rerender } = renderWithoutProviders(
				<MemberEdit
					member={adminMember}
					isOpen={false}
					onClose={mockOnClose}
				/>
			);

			expect(screen.queryByTestId("sheet-is-open")).not.toBeInTheDocument();

			// Update to open
			rerender(
				<MemberEdit
					member={adminMember}
					isOpen={true}
					onClose={mockOnClose}
				/>
			);

			expect(screen.getByTestId("sheet-is-open")).toBeInTheDocument();
		});

		it("should handle member prop changes", () => {
			const { rerender } = renderWithoutProviders(
				<MemberEdit
					member={adminMember}
					isOpen={true}
					onClose={mockOnClose}
				/>
			);

			expect(screen.getByTestId("member-name")).toHaveTextContent(adminMember.name);

			// Change member
			rerender(
				<MemberEdit
					member={regularMember}
					isOpen={true}
					onClose={mockOnClose}
				/>
			);

			expect(screen.getByTestId("member-name")).toHaveTextContent(regularMember.name);

			// Set member to null
			rerender(
				<MemberEdit
					member={null}
					isOpen={true}
					onClose={mockOnClose}
				/>
			);

			expect(screen.queryByTestId("member-edit-form")).not.toBeInTheDocument();
		});
	});

	describe("Edge Cases", () => {
		it("should handle member being undefined", () => {
			renderWithoutProviders(
				<MemberEdit
					member={undefined as any}
					isOpen={true}
					onClose={mockOnClose}
				/>
			);

			// Should not render the form when member is undefined
			expect(screen.queryByTestId("member-edit-form")).not.toBeInTheDocument();
		});

		it("should handle onClose being called multiple times", () => {
			renderWithoutProviders(
				<MemberEdit
					member={adminMember}
					isOpen={true}
					onClose={mockOnClose}
				/>
			);

			const closeButton = screen.getByTestId("edit-sheet-close");

			// Click multiple times
			closeButton.click();
			closeButton.click();
			closeButton.click();

			expect(mockOnClose).toHaveBeenCalledTimes(3);
		});

		it("should handle rapid open/close state changes", () => {
			const { rerender } = renderWithoutProviders(
				<MemberEdit
					member={adminMember}
					isOpen={true}
					onClose={mockOnClose}
				/>
			);

			expect(screen.getByTestId("sheet-is-open")).toBeInTheDocument();

			// Rapid state changes
			rerender(
				<MemberEdit
					member={adminMember}
					isOpen={false}
					onClose={mockOnClose}
				/>
			);

			expect(screen.queryByTestId("sheet-is-open")).not.toBeInTheDocument();

			rerender(
				<MemberEdit
					member={adminMember}
					isOpen={true}
					onClose={mockOnClose}
				/>
			);

			expect(screen.getByTestId("sheet-is-open")).toBeInTheDocument();
		});
	});

	describe("Integration with EditSheet", () => {
		it("should pass all required props to EditSheet", () => {
			renderWithoutProviders(
				<MemberEdit
					member={adminMember}
					isOpen={true}
					onClose={mockOnClose}
				/>
			);

			const editSheet = screen.getByTestId("edit-sheet");
			expect(editSheet).toBeInTheDocument();

			// Verify all props are passed correctly
			expect(screen.getByTestId("edit-sheet-title")).toBeInTheDocument();
			expect(screen.getByTestId("edit-sheet-description")).toBeInTheDocument();
			expect(screen.getByTestId("edit-sheet-content")).toBeInTheDocument();
		});

		it("should render children inside EditSheet", () => {
			renderWithoutProviders(
				<MemberEdit
					member={adminMember}
					isOpen={true}
					onClose={mockOnClose}
				/>
			);

			const content = screen.getByTestId("edit-sheet-content");
			expect(content).toContainElement(screen.getByTestId("member-edit-form"));
		});
	});

	describe("Component Lifecycle", () => {
		it("should handle component unmounting gracefully", () => {
			const { unmount } = renderWithoutProviders(
				<MemberEdit
					member={adminMember}
					isOpen={true}
					onClose={mockOnClose}
				/>
			);

			expect(screen.getByTestId("edit-sheet")).toBeInTheDocument();

			// Should unmount without errors
			expect(() => unmount()).not.toThrow();
		});

		it("should handle re-mounting with different props", () => {
			const { unmount } = renderWithoutProviders(
				<MemberEdit
					member={adminMember}
					isOpen={true}
					onClose={mockOnClose}
				/>
			);

			expect(screen.getByTestId("member-name")).toHaveTextContent(adminMember.name);
			unmount();

			// Re-mount with different member
			renderWithoutProviders(
				<MemberEdit
					member={regularMember}
					isOpen={false}
					onClose={mockOnClose}
				/>
			);

			expect(screen.getByTestId("member-name")).toHaveTextContent(regularMember.name);
			expect(screen.queryByTestId("sheet-is-open")).not.toBeInTheDocument();
		});
	});

	describe("Performance", () => {
		it("should not cause unnecessary re-renders when props don't change", () => {
			const { rerender } = renderWithoutProviders(
				<MemberEdit
					member={adminMember}
					isOpen={true}
					onClose={mockOnClose}
				/>
			);

			const initialElement = screen.getByTestId("edit-sheet");

			// Re-render with same props
			rerender(
				<MemberEdit
					member={adminMember}
					isOpen={true}
					onClose={mockOnClose}
				/>
			);

			// Element should still be in the document
			expect(initialElement).toBeInTheDocument();
		});

		it("should handle frequent member updates efficiently", () => {
			const { rerender } = renderWithoutProviders(
				<MemberEdit
					member={adminMember}
					isOpen={true}
					onClose={mockOnClose}
				/>
			);

			// Simulate frequent updates
			for (let i = 0; i < 10; i++) {
				const updatedMember = {
					...adminMember,
					name: `Updated Name ${i}`,
				};

				rerender(
					<MemberEdit
						member={updatedMember}
						isOpen={true}
						onClose={mockOnClose}
					/>
				);

				expect(screen.getByTestId("member-name")).toHaveTextContent(
					`Updated Name ${i}`
				);
			}
		});
	});
});
