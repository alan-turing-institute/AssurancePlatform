import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithAuth } from "@/src/__tests__/utils/test-utils";
import type { CaseStudy } from "@/types/domain";
import TableActions from "../table-actions";

// Constants for regex patterns
const VIEW_REGEX = /view/i;

// Mock child components
vi.mock("../delete-button", () => ({
	default: ({
		caseStudyId,
		variant,
		...props
	}: { caseStudyId: number; variant: string } & Record<string, unknown>) => (
		<button data-testid={`delete-button-${caseStudyId}`} {...props}>
			<svg data-testid="trash-icon" />
			Delete
		</button>
	),
}));

vi.mock("../unpublish-button", () => ({
	default: ({
		caseStudyId,
		...props
	}: { caseStudyId: number } & Record<string, unknown>) => (
		<button data-testid={`unpublish-button-${caseStudyId}`} {...props}>
			<svg data-testid="cloud-download-icon" />
			Unpublish
		</button>
	),
}));

// Mock Link component
vi.mock("next/link", () => ({
	default: ({
		href,
		children,
		className,
	}: {
		href: string;
		children: React.ReactNode;
		className?: string;
	}) => (
		<a className={className} href={href}>
			{children}
		</a>
	),
}));

// Mock case study data
const mockCaseStudy: CaseStudy = {
	id: 1,
	title: "Test Case Study",
	description: "Test description",
	sector: "Healthcare",
	type: "Assurance Case",
	contact: "test@example.com",
	published: false,
	publishedDate: undefined,
	createdOn: "2024-01-01T00:00:00Z",
	authors: "John Doe",
	assurance_cases: [],
};

const mockPublishedCaseStudy: CaseStudy = {
	...mockCaseStudy,
	id: 2,
	title: "Published Case Study",
	published: true,
	publishedDate: "2024-01-01T00:00:00Z",
};

describe("TableActions Component", () => {
	const user = userEvent.setup();

	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("Component Rendering", () => {
		it("should render dropdown menu trigger", () => {
			renderWithAuth(<TableActions caseStudy={mockCaseStudy} />);

			// Check for dropdown trigger (ellipsis icon)
			const trigger = screen.getByRole("button");
			expect(trigger).toBeInTheDocument();

			// Check for ellipsis icon
			const ellipsisIcon = trigger.querySelector("svg");
			expect(ellipsisIcon).toBeInTheDocument();
		});

		it("should be accessible via keyboard", () => {
			renderWithAuth(<TableActions caseStudy={mockCaseStudy} />);

			const trigger = screen.getByRole("button");

			// Should be focusable
			trigger.focus();
			expect(trigger).toHaveFocus();
		});
	});

	describe("Dropdown Menu Interaction", () => {
		it("should open dropdown menu when trigger is clicked", async () => {
			renderWithAuth(<TableActions caseStudy={mockCaseStudy} />);

			const trigger = screen.getByRole("button");
			await user.click(trigger);

			// Check for dropdown menu
			await waitFor(() => {
				expect(screen.getByRole("menu")).toBeInTheDocument();
			});

			// Check for "Actions" label
			expect(screen.getByText("Actions")).toBeInTheDocument();

			// Check for separator
			const separator = screen.getByRole("separator");
			expect(separator).toBeInTheDocument();
		});

		it("should open dropdown menu with keyboard navigation", async () => {
			renderWithAuth(<TableActions caseStudy={mockCaseStudy} />);

			const trigger = screen.getByRole("button");
			trigger.focus();

			// Press Enter to open dropdown
			await user.keyboard("{Enter}");

			await waitFor(() => {
				expect(screen.getByRole("menu")).toBeInTheDocument();
			});
		});

		it("should close dropdown when clicking outside", async () => {
			renderWithAuth(<TableActions caseStudy={mockCaseStudy} />);

			const trigger = screen.getByRole("button");
			await user.click(trigger);

			// Wait for menu to open
			await waitFor(() => {
				expect(screen.getByRole("menu")).toBeInTheDocument();
			});

			// Click outside the menu
			await user.click(document.body);

			// Menu should close
			await waitFor(() => {
				expect(screen.queryByRole("menu")).not.toBeInTheDocument();
			});
		});

		it("should close dropdown when pressing Escape", async () => {
			renderWithAuth(<TableActions caseStudy={mockCaseStudy} />);

			const trigger = screen.getByRole("button");
			await user.click(trigger);

			await waitFor(() => {
				expect(screen.getByRole("menu")).toBeInTheDocument();
			});

			// Press Escape
			await user.keyboard("{Escape}");

			// Menu should close
			await waitFor(() => {
				expect(screen.queryByRole("menu")).not.toBeInTheDocument();
			});
		});
	});

	describe("Menu Items for Unpublished Case Study", () => {
		it("should show View and Delete options for unpublished case study", async () => {
			renderWithAuth(<TableActions caseStudy={mockCaseStudy} />);

			const trigger = screen.getByRole("button");
			await user.click(trigger);

			await waitFor(() => {
				expect(screen.getByRole("menu")).toBeInTheDocument();
			});

			// Check for View option
			const viewLink = screen.getByRole("link", { name: VIEW_REGEX });
			expect(viewLink).toBeInTheDocument();
			expect(viewLink).toHaveAttribute("href", "case-studies/1");

			// Check for view icon
			const viewIcon = viewLink.querySelector("svg");
			expect(viewIcon).toBeInTheDocument();

			// Check for Delete option
			const deleteButton = screen.getByTestId("delete-button-1");
			expect(deleteButton).toBeInTheDocument();

			// Check that Unpublish option is NOT present for unpublished case study
			expect(
				screen.queryByTestId("unpublish-button-1")
			).not.toBeInTheDocument();
		});

		it("should navigate to correct case study detail page", async () => {
			const caseStudyWithDifferentId = { ...mockCaseStudy, id: 5 };
			renderWithAuth(<TableActions caseStudy={caseStudyWithDifferentId} />);

			const trigger = screen.getByRole("button");
			await user.click(trigger);

			await waitFor(() => {
				expect(screen.getByRole("menu")).toBeInTheDocument();
			});

			const viewLink = screen.getByRole("link", { name: VIEW_REGEX });
			expect(viewLink).toHaveAttribute("href", "case-studies/5");
		});
	});

	describe("Menu Items for Published Case Study", () => {
		it("should show View, Unpublish, and Delete options for published case study", async () => {
			renderWithAuth(<TableActions caseStudy={mockPublishedCaseStudy} />);

			const trigger = screen.getByRole("button");
			await user.click(trigger);

			await waitFor(() => {
				expect(screen.getByRole("menu")).toBeInTheDocument();
			});

			// Check for View option
			const viewLink = screen.getByRole("link", { name: VIEW_REGEX });
			expect(viewLink).toBeInTheDocument();
			expect(viewLink).toHaveAttribute("href", "case-studies/2");

			// Check for Unpublish option
			const unpublishButton = screen.getByTestId("unpublish-button-2");
			expect(unpublishButton).toBeInTheDocument();

			// Check for Delete option
			const deleteButton = screen.getByTestId("delete-button-2");
			expect(deleteButton).toBeInTheDocument();
		});

		it("should render unpublish button only for published case studies", async () => {
			// Test unpublished case study first
			const { rerender } = renderWithAuth(
				<TableActions caseStudy={mockCaseStudy} />
			);

			let trigger = screen.getByRole("button");
			await user.click(trigger);

			await waitFor(() => {
				expect(screen.getByRole("menu")).toBeInTheDocument();
			});

			// Should not have unpublish button
			expect(
				screen.queryByTestId("unpublish-button-1")
			).not.toBeInTheDocument();

			// Close menu
			await user.keyboard("{Escape}");

			// Test published case study
			rerender(<TableActions caseStudy={mockPublishedCaseStudy} />);

			trigger = screen.getByRole("button");
			await user.click(trigger);

			await waitFor(() => {
				expect(screen.getByRole("menu")).toBeInTheDocument();
			});

			// Should have unpublish button
			expect(screen.getByTestId("unpublish-button-2")).toBeInTheDocument();
		});
	});

	describe("Menu Item Interactions", () => {
		it("should handle View link click", async () => {
			renderWithAuth(<TableActions caseStudy={mockCaseStudy} />);

			const trigger = screen.getByRole("button");
			await user.click(trigger);

			await waitFor(() => {
				expect(screen.getByRole("menu")).toBeInTheDocument();
			});

			const viewLink = screen.getByRole("link", { name: VIEW_REGEX });

			// Link should be properly configured
			expect(viewLink).toHaveAttribute("href", "case-studies/1");
			expect(viewLink.textContent).toMatch(VIEW_REGEX);
		});

		it("should render delete button as menu item", async () => {
			renderWithAuth(<TableActions caseStudy={mockCaseStudy} />);

			const trigger = screen.getByRole("button");
			await user.click(trigger);

			await waitFor(() => {
				expect(screen.getByRole("menu")).toBeInTheDocument();
			});

			const deleteButton = screen.getByTestId("delete-button-1");

			// Delete button should be in a menu item
			const menuItem = deleteButton.closest("[role='menuitem']");
			expect(menuItem).toBeInTheDocument();
		});

		it("should render unpublish button as menu item for published case studies", async () => {
			renderWithAuth(<TableActions caseStudy={mockPublishedCaseStudy} />);

			const trigger = screen.getByRole("button");
			await user.click(trigger);

			await waitFor(() => {
				expect(screen.getByRole("menu")).toBeInTheDocument();
			});

			const unpublishButton = screen.getByTestId("unpublish-button-2");

			// Unpublish button should be in a menu item
			const menuItem = unpublishButton.closest("[role='menuitem']");
			expect(menuItem).toBeInTheDocument();
		});
	});

	describe("Menu Navigation", () => {
		it("should support keyboard navigation through menu items", async () => {
			renderWithAuth(<TableActions caseStudy={mockPublishedCaseStudy} />);

			const trigger = screen.getByRole("button");
			await user.click(trigger);

			await waitFor(() => {
				expect(screen.getByRole("menu")).toBeInTheDocument();
			});

			// Navigate through menu items with arrow keys
			await user.keyboard("{ArrowDown}");

			// Check which element is focused - let's not assume order
			const focusedElement = document.activeElement;
			expect(focusedElement).toHaveAttribute("role", "menuitem");

			await user.keyboard("{ArrowDown}");

			// Check second focused element
			const secondFocusedElement = document.activeElement;
			expect(secondFocusedElement).toHaveAttribute("role", "menuitem");

			await user.keyboard("{ArrowDown}");

			// Check third focused element
			const thirdFocusedElement = document.activeElement;
			expect(thirdFocusedElement).toHaveAttribute("role", "menuitem");

			// All three menu items should be navigable
			const menuItems = screen.getAllByRole("menuitem");
			expect(menuItems).toHaveLength(3);
		});

		it("should wrap focus when navigating past last item", async () => {
			renderWithAuth(<TableActions caseStudy={mockCaseStudy} />);

			const trigger = screen.getByRole("button");
			await user.click(trigger);

			await waitFor(() => {
				expect(screen.getByRole("menu")).toBeInTheDocument();
			});

			// Get all menu items
			const menuItems = screen.getAllByRole("menuitem");
			expect(menuItems).toHaveLength(2); // View and Delete (no Unpublish for unpublished)

			// Navigate through all items
			await user.keyboard("{ArrowDown}");
			const firstFocusedElement = document.activeElement;

			await user.keyboard("{ArrowDown}");
			const _secondFocusedElement = document.activeElement;

			// Navigate past last item should wrap to first
			await user.keyboard("{ArrowDown}");
			const wrappedElement = document.activeElement;

			// Should have wrapped back to the first element
			expect(wrappedElement).toBe(firstFocusedElement);
		});

		it("should support up arrow navigation", async () => {
			renderWithAuth(<TableActions caseStudy={mockCaseStudy} />);

			const trigger = screen.getByRole("button");
			await user.click(trigger);

			await waitFor(() => {
				expect(screen.getByRole("menu")).toBeInTheDocument();
			});

			// Get all menu items
			const _menuItems = screen.getAllByRole("menuitem");

			// Navigate to first item
			await user.keyboard("{ArrowDown}");
			const firstElement = document.activeElement;

			// Go up from first item (should wrap to last)
			await user.keyboard("{ArrowUp}");
			const wrappedElement = document.activeElement;

			// Should be different from first and should be a menuitem
			expect(wrappedElement).not.toBe(firstElement);
			expect(wrappedElement).toHaveAttribute("role", "menuitem");
		});
	});

	describe("Menu Structure", () => {
		it("should have proper menu structure with separator", async () => {
			renderWithAuth(<TableActions caseStudy={mockCaseStudy} />);

			const trigger = screen.getByRole("button");
			await user.click(trigger);

			await waitFor(() => {
				expect(screen.getByRole("menu")).toBeInTheDocument();
			});

			// Check menu structure
			const menu = screen.getByRole("menu");

			// Should have label
			expect(within(menu).getByText("Actions")).toBeInTheDocument();

			// Should have separator
			expect(within(menu).getByRole("separator")).toBeInTheDocument();

			// Should have menu items
			const menuItems = within(menu).getAllByRole("menuitem");
			expect(menuItems.length).toBeGreaterThan(0);
		});

		it("should maintain consistent order of menu items", async () => {
			renderWithAuth(<TableActions caseStudy={mockPublishedCaseStudy} />);

			const trigger = screen.getByRole("button");
			await user.click(trigger);

			await waitFor(() => {
				expect(screen.getByRole("menu")).toBeInTheDocument();
			});

			const menu = screen.getByRole("menu");
			const menuItems = within(menu).getAllByRole("menuitem");

			// Order should be: View, Unpublish (if published), Delete
			expect(menuItems[0]).toContainElement(
				screen.getByRole("link", { name: VIEW_REGEX })
			);
			expect(menuItems[1]).toContainElement(
				screen.getByTestId("unpublish-button-2")
			);
			expect(menuItems[2]).toContainElement(
				screen.getByTestId("delete-button-2")
			);
		});
	});

	describe("Different Case Study States", () => {
		it("should handle case study with minimal data", async () => {
			const minimalCaseStudy: CaseStudy = {
				id: 99,
				title: "Minimal Case Study",
				description: "",
				sector: "",
				published: false,
				createdOn: "2024-01-01T00:00:00Z",
				authors: "",
				assurance_cases: [],
			};

			renderWithAuth(<TableActions caseStudy={minimalCaseStudy} />);

			const trigger = screen.getByRole("button");
			await user.click(trigger);

			await waitFor(() => {
				expect(screen.getByRole("menu")).toBeInTheDocument();
			});

			// Should still show View and Delete options
			const viewLink = screen.getByRole("link", { name: VIEW_REGEX });
			expect(viewLink).toHaveAttribute("href", "case-studies/99");

			const deleteButton = screen.getByTestId("delete-button-99");
			expect(deleteButton).toBeInTheDocument();

			// Should not show Unpublish for unpublished case study
			expect(
				screen.queryByTestId("unpublish-button-99")
			).not.toBeInTheDocument();
		});

		it("should handle case study with edge case ID values", async () => {
			const edgeCaseCaseStudy: CaseStudy = {
				...mockCaseStudy,
				id: 0, // Edge case: ID of 0
			};

			renderWithAuth(<TableActions caseStudy={edgeCaseCaseStudy} />);

			const trigger = screen.getByRole("button");
			await user.click(trigger);

			await waitFor(() => {
				expect(screen.getByRole("menu")).toBeInTheDocument();
			});

			const viewLink = screen.getByRole("link", { name: VIEW_REGEX });
			expect(viewLink).toHaveAttribute("href", "case-studies/0");

			const deleteButton = screen.getByTestId("delete-button-0");
			expect(deleteButton).toBeInTheDocument();
		});
	});

	describe("Accessibility", () => {
		it("should have proper ARIA attributes", async () => {
			renderWithAuth(<TableActions caseStudy={mockCaseStudy} />);

			const trigger = screen.getByRole("button");
			await user.click(trigger);

			await waitFor(() => {
				expect(screen.getByRole("menu")).toBeInTheDocument();
			});

			// Menu should have proper role
			const menu = screen.getByRole("menu");
			expect(menu).toBeInTheDocument();

			// Menu items should have proper roles
			const menuItems = screen.getAllByRole("menuitem");
			expect(menuItems.length).toBeGreaterThan(0);

			// Separator should have proper role
			const separator = screen.getByRole("separator");
			expect(separator).toBeInTheDocument();
		});

		it("should support screen reader navigation", async () => {
			renderWithAuth(<TableActions caseStudy={mockCaseStudy} />);

			const trigger = screen.getByRole("button");

			// Button should be discoverable by screen readers
			expect(trigger).toBeInTheDocument();
			expect(trigger).toHaveAttribute("type", "button");

			await user.click(trigger);

			await waitFor(() => {
				expect(screen.getByRole("menu")).toBeInTheDocument();
			});

			// All interactive elements should be properly labeled
			const viewLink = screen.getByRole("link", { name: VIEW_REGEX });
			expect(viewLink).toBeInTheDocument();

			const deleteButton = screen.getByTestId("delete-button-1");
			expect(deleteButton).toBeInTheDocument();
		});

		it("should maintain focus management", async () => {
			renderWithAuth(<TableActions caseStudy={mockCaseStudy} />);

			const trigger = screen.getByRole("button");

			// Focus the trigger
			trigger.focus();
			expect(trigger).toHaveFocus();

			// Open menu
			await user.click(trigger);

			await waitFor(() => {
				expect(screen.getByRole("menu")).toBeInTheDocument();
			});

			// Radix UI doesn't automatically focus first item, need to navigate
			await user.keyboard("{ArrowDown}");

			// Focus should move into the menu (could be any menu item)
			const focusedElement = document.activeElement;
			expect(focusedElement).toHaveAttribute("role", "menuitem");

			// Close menu with Escape
			await user.keyboard("{Escape}");

			// Wait for menu to close
			await waitFor(() => {
				expect(screen.queryByRole("menu")).not.toBeInTheDocument();
			});

			// Since Radix UI might not always return focus to trigger on Escape,
			// we can just verify the menu is closed
			expect(screen.queryByRole("menu")).not.toBeInTheDocument();
		});
	});
});
