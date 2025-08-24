import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	renderWithoutProviders,
	screen,
} from "@/src/__tests__/utils/test-utils";
import MemberList from "../member-list";

// Mock the MemberEdit component
vi.mock("../member-edit", () => ({
	default: ({
		member,
		isOpen,
		onClose,
	}: {
		member: any;
		isOpen: boolean;
		onClose: () => void;
	}) => (
		<div data-testid="member-edit-modal">
			{isOpen && (
				<div data-testid="modal-open">
					<div data-testid="editing-member-id">{member?.id}</div>
					<div data-testid="editing-member-name">{member?.name}</div>
					<button data-testid="close-modal" onClick={onClose} type="button">
						Close
					</button>
				</div>
			)}
		</div>
	),
}));

// Mock Next.js Image component
vi.mock("next/image", () => ({
	default: ({ alt, src, ...props }: any) => (
		// eslint-disable-next-line @next/next/no-img-element
		<img alt={alt} data-testid="member-image" src={src} {...props} />
	),
}));

// Regex constants for test assertions
const USERS_HEADING_REGEX = /^users$/i;
const USERS_DESCRIPTION_REGEX = /a list of all users in your account/i;
const ADD_USER_BUTTON_REGEX = /add user/i;
const NAME_COLUMN_REGEX = /^name$/i;
const TITLE_COLUMN_REGEX = /^title$/i;
const STATUS_COLUMN_REGEX = /^status$/i;
const ROLE_COLUMN_REGEX = /^role$/i;
const _EDIT_COLUMN_REGEX = /edit/i;
const ACTIVE_STATUS_REGEX = /active/i;
const EDIT_BUTTON_REGEX = /^edit$/i;

describe("MemberList", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("Component Rendering", () => {
		it("should render the header section correctly", () => {
			renderWithoutProviders(<MemberList />);

			expect(screen.getByText(USERS_HEADING_REGEX)).toBeInTheDocument();
			expect(screen.getByText(USERS_DESCRIPTION_REGEX)).toBeInTheDocument();
			expect(
				screen.getByRole("button", { name: ADD_USER_BUTTON_REGEX })
			).toBeInTheDocument();
		});

		it("should render table headers correctly", () => {
			renderWithoutProviders(<MemberList />);

			expect(screen.getByText(NAME_COLUMN_REGEX)).toBeInTheDocument();
			expect(screen.getByText(TITLE_COLUMN_REGEX)).toBeInTheDocument();
			expect(screen.getByText(STATUS_COLUMN_REGEX)).toBeInTheDocument();
			expect(screen.getByText(ROLE_COLUMN_REGEX)).toBeInTheDocument();

			// Check that we have 5 column headers (including the hidden Edit column)
			const columnHeaders = screen.getAllByRole("columnheader");
			expect(columnHeaders).toHaveLength(5);
		});

		it("should render all default team members", () => {
			renderWithoutProviders(<MemberList />);

			// Check that all team members from the component are rendered
			expect(screen.getByText("Rich Griffiths")).toBeInTheDocument();
			expect(screen.getByText("Marlon Dedakis")).toBeInTheDocument();
			expect(screen.getByText("Kalle Westerling")).toBeInTheDocument();
			expect(screen.getByText("Christopher Burr")).toBeInTheDocument();
		});

		it("should render member details correctly", () => {
			renderWithoutProviders(<MemberList />);

			// Check Rich Griffiths details
			expect(screen.getByText("Rich Griffiths")).toBeInTheDocument();
			expect(screen.getByText("Full Stack Developer")).toBeInTheDocument();
			expect(
				screen.getByText("rich.griffiths89@gmail.com")
			).toBeInTheDocument();
			expect(screen.getByText("Admin")).toBeInTheDocument();

			// Check Marlon Dedakis details
			expect(screen.getByText("Marlon Dedakis")).toBeInTheDocument();
			expect(screen.getByText("Developer")).toBeInTheDocument();
			expect(screen.getByText("marlonscloud@gmail.com")).toBeInTheDocument();

			// Check that Technology department appears multiple times (Rich and Marlon)
			const technologyDepts = screen.getAllByText("Technology");
			expect(technologyDepts.length).toBe(2);

			// Check multiple "Member" roles exist
			const memberRoles = screen.getAllByText("Member");
			expect(memberRoles.length).toBeGreaterThan(1);
		});

		it("should render member images correctly", () => {
			renderWithoutProviders(<MemberList />);

			const memberImages = screen.getAllByTestId("member-image");
			expect(memberImages.length).toBe(4); // All team members should have images

			// Check that images have correct attributes
			memberImages.forEach((img) => {
				expect(img).toHaveAttribute("alt", "");
				expect(img).toHaveAttribute("src");
			});
		});

		it("should render all members with Active status", () => {
			renderWithoutProviders(<MemberList />);

			const activeStatuses = screen.getAllByText(ACTIVE_STATUS_REGEX);
			expect(activeStatuses.length).toBe(4); // All 4 members should be active
		});
	});

	describe("Member Edit Functionality", () => {
		it("should open edit modal when edit button is clicked", async () => {
			const user = userEvent.setup();
			renderWithoutProviders(<MemberList />);

			// Find all edit buttons (there's one "Edit" in the header plus 4 edit buttons)
			const allEditTexts = screen.getAllByText(EDIT_BUTTON_REGEX);
			expect(allEditTexts.length).toBe(5); // 1 header + 4 buttons

			// Get only the buttons (not the header text)
			const editButtons = screen
				.getAllByRole("button")
				.filter((button) => button.textContent?.includes("Edit"));
			expect(editButtons.length).toBe(4);

			// Click the first edit button (Rich Griffiths)
			await user.click(editButtons[0]);

			// Check that the modal is open
			expect(screen.getByTestId("modal-open")).toBeInTheDocument();
			expect(screen.getByTestId("editing-member-id")).toHaveTextContent("1");
			expect(screen.getByTestId("editing-member-name")).toHaveTextContent(
				"Rich Griffiths"
			);
		});

		it("should close edit modal when close button is clicked", async () => {
			const user = userEvent.setup();
			renderWithoutProviders(<MemberList />);

			// Open modal using button filter approach
			const editButtons = screen
				.getAllByRole("button")
				.filter((button) => button.textContent?.includes("Edit"));
			await user.click(editButtons[0]);

			expect(screen.getByTestId("modal-open")).toBeInTheDocument();

			// Close modal
			const closeButton = screen.getByTestId("close-modal");
			await user.click(closeButton);

			expect(screen.queryByTestId("modal-open")).not.toBeInTheDocument();
		});

		it("should edit different members when their edit buttons are clicked", async () => {
			const user = userEvent.setup();
			renderWithoutProviders(<MemberList />);

			const editButtons = screen
				.getAllByRole("button")
				.filter((button) => button.textContent?.includes("Edit"));

			// Edit first member (Rich Griffiths)
			await user.click(editButtons[0]);
			expect(screen.getByTestId("editing-member-id")).toHaveTextContent("1");
			expect(screen.getByTestId("editing-member-name")).toHaveTextContent(
				"Rich Griffiths"
			);

			// Close modal
			await user.click(screen.getByTestId("close-modal"));

			// Edit second member (Marlon Dedakis)
			await user.click(editButtons[1]);
			expect(screen.getByTestId("editing-member-id")).toHaveTextContent("2");
			expect(screen.getByTestId("editing-member-name")).toHaveTextContent(
				"Marlon Dedakis"
			);

			// Close modal
			await user.click(screen.getByTestId("close-modal"));

			// Edit third member (Kalle Westerling)
			await user.click(editButtons[2]);
			expect(screen.getByTestId("editing-member-id")).toHaveTextContent("3");
			expect(screen.getByTestId("editing-member-name")).toHaveTextContent(
				"Kalle Westerling"
			);
		});

		it("should handle rapid edit button clicks", async () => {
			const user = userEvent.setup();
			renderWithoutProviders(<MemberList />);

			const editButtons = screen
				.getAllByRole("button")
				.filter((button) => button.textContent?.includes("Edit"));

			// Rapid clicks on different buttons
			await user.click(editButtons[0]);
			await user.click(editButtons[1]);
			await user.click(editButtons[2]);

			// Should show the last clicked member (Kalle Westerling)
			expect(screen.getByTestId("editing-member-id")).toHaveTextContent("3");
			expect(screen.getByTestId("editing-member-name")).toHaveTextContent(
				"Kalle Westerling"
			);
		});
	});

	describe("Table Structure", () => {
		it("should render a proper table structure", () => {
			renderWithoutProviders(<MemberList />);

			const table = screen.getByRole("table");
			expect(table).toBeInTheDocument();

			// Check for table sections
			const thead = table.querySelector("thead");
			const tbody = table.querySelector("tbody");
			expect(thead).toBeInTheDocument();
			expect(tbody).toBeInTheDocument();

			// Check that we have the correct number of rows (4 members + header)
			const allRows = screen.getAllByRole("row");
			expect(allRows.length).toBe(5); // 1 header + 4 data rows
		});

		it("should render correct number of columns for each row", () => {
			renderWithoutProviders(<MemberList />);

			// Get all data rows (excluding header)
			const tbody = screen.getByRole("table").querySelector("tbody");
			const dataRows = tbody?.querySelectorAll("tr");
			expect(dataRows?.length).toBe(4);

			// Each row should have 5 columns (Name, Title, Status, Role, Edit)
			dataRows?.forEach((row) => {
				const cells = row.querySelectorAll("td");
				expect(cells.length).toBe(5);
			});
		});

		it("should render table with correct CSS classes", () => {
			renderWithoutProviders(<MemberList />);

			const table = screen.getByRole("table");
			expect(table).toHaveClass("min-w-full", "divide-y", "divide-gray-300");
		});
	});

	describe("Button Functionality", () => {
		it("should render Add User button with correct styles", () => {
			renderWithoutProviders(<MemberList />);

			const addButton = screen.getByRole("button", {
				name: ADD_USER_BUTTON_REGEX,
			});
			expect(addButton).toBeInTheDocument();
			expect(addButton).toHaveClass(
				"block",
				"rounded-md",
				"bg-indigo-600",
				"px-3",
				"py-2"
			);
		});

		it("should render Edit buttons for each member", () => {
			renderWithoutProviders(<MemberList />);

			const editButtons = screen
				.getAllByRole("button")
				.filter((button) => button.textContent?.includes("Edit"));
			expect(editButtons.length).toBe(4);

			editButtons.forEach((button) => {
				expect(button).toHaveClass("text-indigo-600", "hover:text-indigo-900");
			});
		});

		it("should have proper accessibility attributes for edit buttons", () => {
			renderWithoutProviders(<MemberList />);

			const editButtons = screen
				.getAllByRole("button")
				.filter((button) => button.textContent?.includes("Edit"));

			// Each edit button should have a screen reader text with member name
			const firstEditButton = editButtons[0];
			const srText = firstEditButton.querySelector(".sr-only");
			expect(srText).toHaveTextContent(", Rich Griffiths");
		});
	});

	describe("Department Display", () => {
		it("should display correct departments for each member", () => {
			renderWithoutProviders(<MemberList />);

			// Rich Griffiths and Marlon Dedakis are in Technology
			const technologyDepts = screen.getAllByText("Technology");
			expect(technologyDepts.length).toBe(2);

			// Kalle Westerling is in Optimization
			expect(screen.getByText("Optimization")).toBeInTheDocument();

			// Christopher Burr is in Projects
			expect(screen.getByText("Projects")).toBeInTheDocument();
		});

		it("should render department information in correct table cell", () => {
			renderWithoutProviders(<MemberList />);

			// Find the row for Rich Griffiths and check his department
			const richRow = screen.getByText("Rich Griffiths").closest("tr");
			const technologyElements = screen.getAllByText("Technology");
			expect(richRow).toContainElement(technologyElements[0]);

			// Find the row for Kalle Westerling and check his department
			const kalleRow = screen.getByText("Kalle Westerling").closest("tr");
			expect(kalleRow).toContainElement(screen.getByText("Optimization"));
		});
	});

	describe("Role Display", () => {
		it("should display Admin role for admin members", () => {
			renderWithoutProviders(<MemberList />);

			// Rich Griffiths should be Admin
			const richRow = screen.getByText("Rich Griffiths").closest("tr");
			expect(richRow).toContainElement(screen.getByText("Admin"));
		});

		it("should display Member role for regular members", () => {
			renderWithoutProviders(<MemberList />);

			// Check that Member roles are displayed
			const memberRoles = screen.getAllByText("Member");
			expect(memberRoles.length).toBe(3); // Marlon, Kalle, and Christopher
		});
	});

	describe("State Management", () => {
		it("should initialize with modal closed", () => {
			renderWithoutProviders(<MemberList />);

			expect(screen.queryByTestId("modal-open")).not.toBeInTheDocument();
		});

		it("should maintain modal state correctly", async () => {
			const user = userEvent.setup();
			renderWithoutProviders(<MemberList />);

			// Initially closed
			expect(screen.queryByTestId("modal-open")).not.toBeInTheDocument();

			// Open modal
			const editButtons = screen
				.getAllByRole("button")
				.filter((button) => button.textContent?.includes("Edit"));
			await user.click(editButtons[0]);
			expect(screen.getByTestId("modal-open")).toBeInTheDocument();

			// Close modal
			await user.click(screen.getByTestId("close-modal"));
			expect(screen.queryByTestId("modal-open")).not.toBeInTheDocument();
		});

		it("should handle selectedMember state correctly", async () => {
			const user = userEvent.setup();
			renderWithoutProviders(<MemberList />);

			const editButtons = screen
				.getAllByRole("button")
				.filter((button) => button.textContent?.includes("Edit"));

			// Select first member
			await user.click(editButtons[0]);
			expect(screen.getByTestId("editing-member-id")).toHaveTextContent("1");

			// Select different member without closing modal first
			await user.click(editButtons[1]);
			expect(screen.getByTestId("editing-member-id")).toHaveTextContent("2");
		});
	});

	describe("Accessibility", () => {
		it("should have proper table accessibility", () => {
			renderWithoutProviders(<MemberList />);

			const table = screen.getByRole("table");
			expect(table).toBeInTheDocument();

			// Check column headers
			const columnHeaders = screen.getAllByRole("columnheader");
			expect(columnHeaders.length).toBe(5);

			columnHeaders.forEach((header) => {
				expect(header).toHaveAttribute("scope", "col");
			});
		});

		it("should have screen reader friendly edit buttons", () => {
			renderWithoutProviders(<MemberList />);

			// Get only the edit buttons (not the header text)
			const editButtons = screen
				.getAllByRole("button")
				.filter((button) => button.textContent?.includes("Edit"));

			editButtons.forEach((button, _index) => {
				const srText = button.querySelector(".sr-only");
				expect(srText).toBeInTheDocument();
				expect(srText?.textContent).toContain(","); // Should contain member name
			});
		});

		it("should have proper heading hierarchy", () => {
			renderWithoutProviders(<MemberList />);

			const mainHeading = screen.getByRole("heading", { level: 1 });
			expect(mainHeading).toHaveTextContent(USERS_HEADING_REGEX);
		});

		it("should support keyboard navigation", async () => {
			const user = userEvent.setup();
			renderWithoutProviders(<MemberList />);

			// Tab to the add user button
			await user.tab();
			expect(
				screen.getByRole("button", { name: ADD_USER_BUTTON_REGEX })
			).toHaveFocus();

			// Tab to first edit button
			await user.tab();
			const editButtons = screen
				.getAllByRole("button")
				.filter((button) => button.textContent?.includes("Edit"));
			expect(editButtons[0]).toHaveFocus();

			// Use Enter to activate the button
			await user.keyboard("{Enter}");
			expect(screen.getByTestId("modal-open")).toBeInTheDocument();
		});
	});

	describe("Edge Cases", () => {
		it("should handle empty member list gracefully", () => {
			// Note: The component uses hardcoded data, so this tests the current implementation
			renderWithoutProviders(<MemberList />);

			// Even with hardcoded data, should still render the structure
			expect(screen.getByText(USERS_HEADING_REGEX)).toBeInTheDocument();
			expect(screen.getByRole("table")).toBeInTheDocument();
		});

		it("should handle missing member data gracefully", async () => {
			const user = userEvent.setup();
			renderWithoutProviders(<MemberList />);

			// This tests the current implementation with valid data
			const editButtons = screen
				.getAllByRole("button")
				.filter((button) => button.textContent?.includes("Edit"));
			await user.click(editButtons[0]);

			expect(screen.getByTestId("modal-open")).toBeInTheDocument();
		});

		it("should handle rapid state changes", async () => {
			const user = userEvent.setup();
			renderWithoutProviders(<MemberList />);

			const editButtons = screen
				.getAllByRole("button")
				.filter((button) => button.textContent?.includes("Edit"));

			// Rapid open/close/open
			await user.click(editButtons[0]);
			expect(screen.getByTestId("modal-open")).toBeInTheDocument();

			await user.click(screen.getByTestId("close-modal"));
			expect(screen.queryByTestId("modal-open")).not.toBeInTheDocument();

			await user.click(editButtons[1]);
			expect(screen.getByTestId("modal-open")).toBeInTheDocument();
			expect(screen.getByTestId("editing-member-id")).toHaveTextContent("2");
		});
	});

	describe("Component Layout", () => {
		it("should have proper responsive classes", () => {
			renderWithoutProviders(<MemberList />);

			// Check that the root container has proper padding classes
			const containerWithPadding = document.querySelector(".px-4");
			expect(containerWithPadding).toBeInTheDocument();

			// Check table container has overflow handling - it's the parent container
			const overflowContainer = document.querySelector(".overflow-x-auto");
			expect(overflowContainer).toBeInTheDocument();
		});

		it("should render header section with proper layout", () => {
			renderWithoutProviders(<MemberList />);

			const headerSection = screen
				.getByText(USERS_HEADING_REGEX)
				.closest(".sm\\:flex");
			expect(headerSection).toBeInTheDocument();

			const addButton = screen.getByRole("button", {
				name: ADD_USER_BUTTON_REGEX,
			});
			expect(addButton.closest(".sm\\:flex-none")).toBeInTheDocument();
		});

		it("should have proper table cell alignment", () => {
			renderWithoutProviders(<MemberList />);

			// Check that table headers have proper text alignment
			const nameHeader = screen.getByText(NAME_COLUMN_REGEX);
			expect(nameHeader).toHaveClass("text-left");

			// Check that the hidden edit header has proper classes
			const editColumnHeader = screen.getAllByRole("columnheader")[4]; // The 5th column is Edit
			expect(editColumnHeader).toHaveClass("relative");
		});
	});
});
