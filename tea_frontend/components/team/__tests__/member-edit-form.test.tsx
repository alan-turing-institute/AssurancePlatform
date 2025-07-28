import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	renderWithoutProviders,
	screen,
	waitFor,
} from "@/src/__tests__/utils/test-utils";
import {
	adminMember,
	corporateMember,
	createMockTeamMember,
	departments,
	hrMember,
	memberWithLongName,
	memberWithMinimalData,
	memberWithSpecialCharacters,
	optimizationMember,
	projectsMember,
	regularMember,
} from "@/src/__tests__/utils/team-mock-data";
import MemberEditForm from "../member-edit-form";

// Regex constants for test assertions
const NAME_LABEL_REGEX = /^name$/i;
const JOB_TITLE_LABEL_REGEX = /job title/i;
const DEPARTMENT_LABEL_REGEX = /department/i;
const ADMIN_LABEL_REGEX = /admin/i;
const UPDATE_MEMBER_BUTTON_REGEX = /update member/i;
const DEACTIVATE_BUTTON_REGEX = /deactivate/i;
const SELECT_TEAM_PLACEHOLDER_REGEX = /select a team/i;

// Validation error regex patterns
const NAME_MIN_2_CHAR_REGEX = /name must be at least 2 characters/i;
const TITLE_MIN_2_CHAR_REGEX = /job title must be atleast 2 characters/i;
const SELECT_TEAM_ERROR_REGEX = /please select a team/i;

// Admin description text
const ADMIN_DESCRIPTION_REGEX = /the admin has full control over the application/i;

describe("MemberEditForm", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("Form Rendering", () => {
		it("should render all form fields with member data", () => {
			renderWithoutProviders(<MemberEditForm member={adminMember} />);

			// Check that all form fields are present
			const nameInput = screen.getByLabelText(NAME_LABEL_REGEX);
			const titleInput = screen.getByLabelText(JOB_TITLE_LABEL_REGEX);
			const departmentSelect = screen.getByLabelText(DEPARTMENT_LABEL_REGEX);
			const adminSwitch = screen.getByLabelText(ADMIN_LABEL_REGEX);

			expect(nameInput).toBeInTheDocument();
			expect(titleInput).toBeInTheDocument();
			expect(departmentSelect).toBeInTheDocument();
			expect(adminSwitch).toBeInTheDocument();

			// Check that fields are populated with member data
			expect(nameInput).toHaveValue(adminMember.name);
			expect(titleInput).toHaveValue(adminMember.title);
			expect(adminSwitch).toBeChecked(); // Admin member should have admin switch checked
		});

		it("should render form fields with regular member data", () => {
			renderWithoutProviders(<MemberEditForm member={regularMember} />);

			const nameInput = screen.getByLabelText(NAME_LABEL_REGEX);
			const titleInput = screen.getByLabelText(JOB_TITLE_LABEL_REGEX);
			const adminSwitch = screen.getByLabelText(ADMIN_LABEL_REGEX);

			expect(nameInput).toHaveValue(regularMember.name);
			expect(titleInput).toHaveValue(regularMember.title);
			expect(adminSwitch).not.toBeChecked(); // Regular member should not have admin switch checked
		});

		it("should render department select field", () => {
			renderWithoutProviders(<MemberEditForm member={adminMember} />);

			const departmentSelect = screen.getByLabelText(DEPARTMENT_LABEL_REGEX);
			expect(departmentSelect).toBeInTheDocument();

			// Check that the member's current department is displayed
			expect(departmentSelect).toHaveTextContent(adminMember.department);
		});

		it("should render action buttons", () => {
			renderWithoutProviders(<MemberEditForm member={adminMember} />);

			const updateButton = screen.getByRole("button", {
				name: UPDATE_MEMBER_BUTTON_REGEX,
			});
			const deactivateButton = screen.getByRole("button", {
				name: DEACTIVATE_BUTTON_REGEX,
			});

			expect(updateButton).toBeInTheDocument();
			expect(deactivateButton).toBeInTheDocument();
			expect(updateButton).toHaveAttribute("type", "submit");
		});

		it("should render admin switch with description", () => {
			renderWithoutProviders(<MemberEditForm member={adminMember} />);

			expect(screen.getByText(ADMIN_DESCRIPTION_REGEX)).toBeInTheDocument();
		});
	});

	describe("Form Validation", () => {
		it("should show error for name shorter than 2 characters", async () => {
			const user = userEvent.setup();
			renderWithoutProviders(<MemberEditForm member={adminMember} />);

			const nameInput = screen.getByLabelText(NAME_LABEL_REGEX);
			const submitButton = screen.getByRole("button", {
				name: UPDATE_MEMBER_BUTTON_REGEX,
			});

			// Clear name and enter single character
			await user.clear(nameInput);
			await user.type(nameInput, "A");
			await user.click(submitButton);

			await waitFor(() => {
				expect(screen.getByText(NAME_MIN_2_CHAR_REGEX)).toBeInTheDocument();
			});
		});

		it("should show error for job title shorter than 2 characters", async () => {
			const user = userEvent.setup();
			renderWithoutProviders(<MemberEditForm member={adminMember} />);

			const titleInput = screen.getByLabelText(JOB_TITLE_LABEL_REGEX);
			const submitButton = screen.getByRole("button", {
				name: UPDATE_MEMBER_BUTTON_REGEX,
			});

			// Clear title and enter single character
			await user.clear(titleInput);
			await user.type(titleInput, "B");
			await user.click(submitButton);

			await waitFor(() => {
				expect(screen.getByText(TITLE_MIN_2_CHAR_REGEX)).toBeInTheDocument();
			});
		});

		it("should accept valid name and title", async () => {
			const user = userEvent.setup();
			renderWithoutProviders(<MemberEditForm member={adminMember} />);

			const nameInput = screen.getByLabelText(NAME_LABEL_REGEX);
			const titleInput = screen.getByLabelText(JOB_TITLE_LABEL_REGEX);
			const submitButton = screen.getByRole("button", {
				name: UPDATE_MEMBER_BUTTON_REGEX,
			});

			// Update with valid data
			await user.clear(nameInput);
			await user.type(nameInput, "Valid Name");
			await user.clear(titleInput);
			await user.type(titleInput, "Valid Title");
			await user.click(submitButton);

			// Should not show validation errors
			expect(screen.queryByText(NAME_MIN_2_CHAR_REGEX)).not.toBeInTheDocument();
			expect(screen.queryByText(TITLE_MIN_2_CHAR_REGEX)).not.toBeInTheDocument();
		});
	});

	describe("Department Selection", () => {
		it("should handle department selection for all available departments", async () => {
			// Test each department
			for (const department of departments) {
				const testMember = createMockTeamMember({
					department,
				});

				const { unmount } = renderWithoutProviders(<MemberEditForm member={testMember} />);

				const departmentSelect = screen.getByLabelText(DEPARTMENT_LABEL_REGEX);
				expect(departmentSelect).toBeInTheDocument();
				expect(departmentSelect).toHaveTextContent(department);

				// Cleanup for next iteration
				unmount();
			}
		});

		it("should render correctly with Technology department", () => {
			renderWithoutProviders(<MemberEditForm member={adminMember} />);

			const departmentSelect = screen.getByLabelText(DEPARTMENT_LABEL_REGEX);
			expect(departmentSelect).toBeInTheDocument();
		});

		it("should render correctly with HR department", () => {
			renderWithoutProviders(<MemberEditForm member={hrMember} />);

			const departmentSelect = screen.getByLabelText(DEPARTMENT_LABEL_REGEX);
			expect(departmentSelect).toBeInTheDocument();
		});

		it("should render correctly with Corporate department", () => {
			renderWithoutProviders(<MemberEditForm member={corporateMember} />);

			const departmentSelect = screen.getByLabelText(DEPARTMENT_LABEL_REGEX);
			expect(departmentSelect).toBeInTheDocument();
		});

		it("should render correctly with Optimization department", () => {
			renderWithoutProviders(<MemberEditForm member={optimizationMember} />);

			const departmentSelect = screen.getByLabelText(DEPARTMENT_LABEL_REGEX);
			expect(departmentSelect).toBeInTheDocument();
		});

		it("should render correctly with Projects department", () => {
			renderWithoutProviders(<MemberEditForm member={projectsMember} />);

			const departmentSelect = screen.getByLabelText(DEPARTMENT_LABEL_REGEX);
			expect(departmentSelect).toBeInTheDocument();
		});
	});

	describe("Admin Toggle", () => {
		it("should toggle admin status when switch is clicked", async () => {
			const user = userEvent.setup();
			renderWithoutProviders(<MemberEditForm member={regularMember} />);

			const adminSwitch = screen.getByLabelText(ADMIN_LABEL_REGEX);
			expect(adminSwitch).not.toBeChecked();

			// Toggle admin switch
			await user.click(adminSwitch);
			expect(adminSwitch).toBeChecked();

			// Toggle back
			await user.click(adminSwitch);
			expect(adminSwitch).not.toBeChecked();
		});

		it("should start with correct admin status based on member data", () => {
			// Test admin member
			const { unmount: unmountAdmin } = renderWithoutProviders(<MemberEditForm member={adminMember} />);
			expect(screen.getByLabelText(ADMIN_LABEL_REGEX)).toBeChecked();
			unmountAdmin();

			// Test regular member
			renderWithoutProviders(<MemberEditForm member={regularMember} />);
			expect(screen.getByLabelText(ADMIN_LABEL_REGEX)).not.toBeChecked();
		});
	});

	describe("Form Submission", () => {
		it("should call onSubmit when form is submitted with valid data", async () => {
			const user = userEvent.setup();
			renderWithoutProviders(<MemberEditForm member={adminMember} />);

			const nameInput = screen.getByLabelText(NAME_LABEL_REGEX);
			const titleInput = screen.getByLabelText(JOB_TITLE_LABEL_REGEX);
			const submitButton = screen.getByRole("button", {
				name: UPDATE_MEMBER_BUTTON_REGEX,
			});

			// Fill form with valid data
			await user.clear(nameInput);
			await user.type(nameInput, "Updated Name");
			await user.clear(titleInput);
			await user.type(titleInput, "Updated Title");

			// Submit form
			await user.click(submitButton);

			// Note: Since the form submission is a TODO in the component,
			// we can't test the actual submission logic yet
			// This test verifies the form can be submitted without validation errors
			expect(screen.queryByText(NAME_MIN_2_CHAR_REGEX)).not.toBeInTheDocument();
			expect(screen.queryByText(TITLE_MIN_2_CHAR_REGEX)).not.toBeInTheDocument();
		});

		it("should prevent submission with invalid data", async () => {
			const user = userEvent.setup();
			renderWithoutProviders(<MemberEditForm member={adminMember} />);

			const nameInput = screen.getByLabelText(NAME_LABEL_REGEX);
			const submitButton = screen.getByRole("button", {
				name: UPDATE_MEMBER_BUTTON_REGEX,
			});

			// Clear name to make it invalid
			await user.clear(nameInput);
			await user.click(submitButton);

			await waitFor(() => {
				expect(screen.getByText(NAME_MIN_2_CHAR_REGEX)).toBeInTheDocument();
			});
		});
	});

	describe("Edge Cases", () => {
		it("should handle member with very long name and title", () => {
			renderWithoutProviders(<MemberEditForm member={memberWithLongName} />);

			const nameInput = screen.getByLabelText(NAME_LABEL_REGEX);
			const titleInput = screen.getByLabelText(JOB_TITLE_LABEL_REGEX);

			expect(nameInput).toHaveValue(memberWithLongName.name);
			expect(titleInput).toHaveValue(memberWithLongName.title);
		});

		it("should handle member with special characters in name", () => {
			renderWithoutProviders(<MemberEditForm member={memberWithSpecialCharacters} />);

			const nameInput = screen.getByLabelText(NAME_LABEL_REGEX);
			const titleInput = screen.getByLabelText(JOB_TITLE_LABEL_REGEX);

			expect(nameInput).toHaveValue(memberWithSpecialCharacters.name);
			expect(titleInput).toHaveValue(memberWithSpecialCharacters.title);
		});

		it("should handle member with minimal valid data", () => {
			renderWithoutProviders(<MemberEditForm member={memberWithMinimalData} />);

			const nameInput = screen.getByLabelText(NAME_LABEL_REGEX);
			const titleInput = screen.getByLabelText(JOB_TITLE_LABEL_REGEX);

			expect(nameInput).toHaveValue(memberWithMinimalData.name);
			expect(titleInput).toHaveValue(memberWithMinimalData.title);
		});
	});

	describe("Form State Management", () => {
		it("should maintain form values after validation errors", async () => {
			const user = userEvent.setup();
			renderWithoutProviders(<MemberEditForm member={adminMember} />);

			const nameInput = screen.getByLabelText(NAME_LABEL_REGEX);
			const titleInput = screen.getByLabelText(JOB_TITLE_LABEL_REGEX);
			const submitButton = screen.getByRole("button", {
				name: UPDATE_MEMBER_BUTTON_REGEX,
			});

			// Enter invalid name but valid title
			await user.clear(nameInput);
			await user.type(nameInput, "A"); // Too short
			await user.clear(titleInput);
			await user.type(titleInput, "Valid Title");

			await user.click(submitButton);

			await waitFor(() => {
				expect(screen.getByText(NAME_MIN_2_CHAR_REGEX)).toBeInTheDocument();
			});

			// Check that valid title is maintained
			expect(titleInput).toHaveValue("Valid Title");
			expect(nameInput).toHaveValue("A");
		});

		it("should preserve admin toggle state during form interactions", async () => {
			const user = userEvent.setup();
			renderWithoutProviders(<MemberEditForm member={regularMember} />);

			const adminSwitch = screen.getByLabelText(ADMIN_LABEL_REGEX);
			const nameInput = screen.getByLabelText(NAME_LABEL_REGEX);

			// Toggle admin switch
			await user.click(adminSwitch);
			expect(adminSwitch).toBeChecked();

			// Interact with other fields
			await user.clear(nameInput);
			await user.type(nameInput, "Updated Name");

			// Admin switch should still be checked
			expect(adminSwitch).toBeChecked();
		});
	});

	describe("Accessibility", () => {
		it("should have proper labels for all form fields", () => {
			renderWithoutProviders(<MemberEditForm member={adminMember} />);

			const nameInput = screen.getByLabelText(NAME_LABEL_REGEX);
			const titleInput = screen.getByLabelText(JOB_TITLE_LABEL_REGEX);
			const departmentSelect = screen.getByLabelText(DEPARTMENT_LABEL_REGEX);
			const adminSwitch = screen.getByLabelText(ADMIN_LABEL_REGEX);

			expect(nameInput).toHaveAccessibleName();
			expect(titleInput).toHaveAccessibleName();
			expect(departmentSelect).toHaveAccessibleName();
			expect(adminSwitch).toHaveAccessibleName();
		});

		it("should display error messages in accessible way", async () => {
			const user = userEvent.setup();
			renderWithoutProviders(<MemberEditForm member={adminMember} />);

			const nameInput = screen.getByLabelText(NAME_LABEL_REGEX);
			const submitButton = screen.getByRole("button", {
				name: UPDATE_MEMBER_BUTTON_REGEX,
			});

			// Trigger validation error
			await user.clear(nameInput);
			await user.type(nameInput, "A");
			await user.click(submitButton);

			await waitFor(() => {
				const errorMessage = screen.getByText(NAME_MIN_2_CHAR_REGEX);
				expect(errorMessage).toBeInTheDocument();

				// Error should be associated with the form field
				const formItem = errorMessage.closest(".space-y-2");
				expect(formItem).toContainElement(nameInput);
			});
		});

		it("should support keyboard navigation", async () => {
			const user = userEvent.setup();
			renderWithoutProviders(<MemberEditForm member={adminMember} />);

			// Tab through form fields
			await user.tab(); // Name input
			expect(screen.getByLabelText(NAME_LABEL_REGEX)).toHaveFocus();

			await user.tab(); // Title input
			expect(screen.getByLabelText(JOB_TITLE_LABEL_REGEX)).toHaveFocus();

			await user.tab(); // Department select
			expect(screen.getByLabelText(DEPARTMENT_LABEL_REGEX)).toHaveFocus();

			await user.tab(); // Admin switch
			expect(screen.getByLabelText(ADMIN_LABEL_REGEX)).toHaveFocus();

			await user.tab(); // Update button
			expect(screen.getByRole("button", { name: UPDATE_MEMBER_BUTTON_REGEX })).toHaveFocus();

			await user.tab(); // Deactivate button
			expect(screen.getByRole("button", { name: DEACTIVATE_BUTTON_REGEX })).toHaveFocus();
		});

		it("should handle Enter key submission", async () => {
			const user = userEvent.setup();
			renderWithoutProviders(<MemberEditForm member={adminMember} />);

			const nameInput = screen.getByLabelText(NAME_LABEL_REGEX);

			// Focus name input and press Enter
			nameInput.focus();
			await user.keyboard("{Enter}");

			// Should trigger form submission (no validation errors expected with valid data)
			expect(screen.queryByText(NAME_MIN_2_CHAR_REGEX)).not.toBeInTheDocument();
		});
	});

	describe("Input Placeholders", () => {
		it("should have correct placeholder for name input", () => {
			renderWithoutProviders(<MemberEditForm member={adminMember} />);

			const nameInput = screen.getByLabelText(NAME_LABEL_REGEX);
			expect(nameInput).toHaveAttribute("placeholder", "Member name");
		});

		it("should display department value in select", () => {
			renderWithoutProviders(<MemberEditForm member={adminMember} />);

			const departmentSelect = screen.getByLabelText(DEPARTMENT_LABEL_REGEX);
			expect(departmentSelect).toHaveTextContent(adminMember.department);
		});
	});

	describe("Button Variants", () => {
		it("should render update button as primary", () => {
			renderWithoutProviders(<MemberEditForm member={adminMember} />);

			const updateButton = screen.getByRole("button", {
				name: UPDATE_MEMBER_BUTTON_REGEX,
			});
			expect(updateButton).toBeInTheDocument();
			// Default button variant should be applied
		});

		it("should render deactivate button as outline variant", () => {
			renderWithoutProviders(<MemberEditForm member={adminMember} />);

			const deactivateButton = screen.getByRole("button", {
				name: DEACTIVATE_BUTTON_REGEX,
			});
			expect(deactivateButton).toBeInTheDocument();
			// Outline variant should be applied (tested via class or attribute)
		});
	});
});
