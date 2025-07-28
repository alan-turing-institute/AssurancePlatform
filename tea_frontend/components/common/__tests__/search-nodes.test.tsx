import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Node } from "reactflow";
import {
	renderWithAuth,
	screen,
	userEvent,
	waitFor,
} from "@/src/__tests__/utils/test-utils";
import SearchNodes from "../search-nodes";

// Mock ActionTooltip component
vi.mock("../../ui/action-tooltip", () => ({
	default: ({ children, label }: { children: React.ReactNode; label: string }) => (
		<div title={label}>{children}</div>
	),
}));

describe("SearchNodes", () => {
	const mockFocusNode = vi.fn();

	const createMockNode = (id: string, name: string, description: string): Node => ({
		id,
		type: "goal",
		position: { x: 0, y: 0 },
		data: {
			id: parseInt(id),
			name,
			short_description: description,
			type: "goal",
		},
	});

	const mockNodes: Node[] = [
		createMockNode("1", "G1", "Primary system goal"),
		createMockNode("2", "S1", "Testing strategy for the system"),
		createMockNode("3", "P1", "Performance property claim"),
		createMockNode("4", "E1", "Unit test evidence"),
		createMockNode("5", "G2", "Secondary safety goal"),
	];

	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("Component Rendering", () => {
		it("should render search button", () => {
			renderWithAuth(
				<SearchNodes nodes={mockNodes} focusNode={mockFocusNode} />
			);

			expect(screen.getByRole("button")).toBeInTheDocument();
			expect(screen.getByTitle("Search")).toBeInTheDocument();
		});

		it("should render search icon", () => {
			renderWithAuth(
				<SearchNodes nodes={mockNodes} focusNode={mockFocusNode} />
			);

			expect(screen.getByText("Search")).toBeInTheDocument();
		});

		it("should not show dialog initially", () => {
			renderWithAuth(
				<SearchNodes nodes={mockNodes} focusNode={mockFocusNode} />
			);

			expect(screen.queryByText("Search Nodes")).not.toBeInTheDocument();
		});
	});

	describe("Dialog Opening and Closing", () => {
		it("should open dialog when search button is clicked", async () => {
			const user = userEvent.setup();

			renderWithAuth(
				<SearchNodes nodes={mockNodes} focusNode={mockFocusNode} />
			);

			const searchButton = screen.getByRole("button");
			await user.click(searchButton);

			await waitFor(() => {
				expect(screen.getByText("Search Nodes")).toBeInTheDocument();
			});
		});

		it("should show dialog content when open", async () => {
			const user = userEvent.setup();

			renderWithAuth(
				<SearchNodes nodes={mockNodes} focusNode={mockFocusNode} />
			);

			await user.click(screen.getByRole("button"));

			await waitFor(() => {
				expect(screen.getByText("Search Nodes")).toBeInTheDocument();
				expect(
					screen.getByText("Enter your keywords into the input below to find a node.")
				).toBeInTheDocument();
				expect(screen.getByRole("textbox")).toBeInTheDocument();
			});
		});
	});

	describe("Search Functionality", () => {
		it("should show all nodes initially", async () => {
			const user = userEvent.setup();

			renderWithAuth(
				<SearchNodes nodes={mockNodes} focusNode={mockFocusNode} />
			);

			await user.click(screen.getByRole("button"));

			await waitFor(() => {
				expect(screen.getByText("Primary system goal")).toBeInTheDocument();
				expect(screen.getByText("Testing strategy for the system")).toBeInTheDocument();
				expect(screen.getByText("Performance property claim")).toBeInTheDocument();
				expect(screen.getByText("Unit test evidence")).toBeInTheDocument();
				expect(screen.getByText("Secondary safety goal")).toBeInTheDocument();
			});
		});

		it("should filter nodes based on search input", async () => {
			const user = userEvent.setup();

			renderWithAuth(
				<SearchNodes nodes={mockNodes} focusNode={mockFocusNode} />
			);

			await user.click(screen.getByRole("button"));

			await waitFor(() => {
				expect(screen.getByRole("textbox")).toBeInTheDocument();
			});

			const searchInput = screen.getByRole("textbox");
			await user.type(searchInput, "goal");

			await waitFor(() => {
				expect(screen.getByText("Primary system goal")).toBeInTheDocument();
				expect(screen.getByText("Secondary safety goal")).toBeInTheDocument();
				expect(screen.queryByText("Testing strategy for the system")).not.toBeInTheDocument();
				expect(screen.queryByText("Performance property claim")).not.toBeInTheDocument();
				expect(screen.queryByText("Unit test evidence")).not.toBeInTheDocument();
			});
		});

		it("should perform case-insensitive search", async () => {
			const user = userEvent.setup();

			renderWithAuth(
				<SearchNodes nodes={mockNodes} focusNode={mockFocusNode} />
			);

			await user.click(screen.getByRole("button"));

			const searchInput = screen.getByRole("textbox");
			await user.type(searchInput, "GOAL");

			await waitFor(() => {
				expect(screen.getByText("Primary system goal")).toBeInTheDocument();
				expect(screen.getByText("Secondary safety goal")).toBeInTheDocument();
			});
		});

		it("should search within descriptions", async () => {
			const user = userEvent.setup();

			renderWithAuth(
				<SearchNodes nodes={mockNodes} focusNode={mockFocusNode} />
			);

			await user.click(screen.getByRole("button"));

			const searchInput = screen.getByRole("textbox");
			await user.type(searchInput, "strategy");

			await waitFor(() => {
				expect(screen.getByText("Testing strategy for the system")).toBeInTheDocument();
				expect(screen.queryByText("Primary system goal")).not.toBeInTheDocument();
			});
		});

		it("should show no results for non-matching search", async () => {
			const user = userEvent.setup();

			renderWithAuth(
				<SearchNodes nodes={mockNodes} focusNode={mockFocusNode} />
			);

			await user.click(screen.getByRole("button"));

			const searchInput = screen.getByRole("textbox");
			await user.type(searchInput, "nonexistent");

			await waitFor(() => {
				expect(screen.queryByText("Primary system goal")).not.toBeInTheDocument();
				expect(screen.queryByText("Testing strategy for the system")).not.toBeInTheDocument();
			});
		});
	});

	describe("Node Selection", () => {
		it("should call focusNode when a node is clicked", async () => {
			const user = userEvent.setup();

			renderWithAuth(
				<SearchNodes nodes={mockNodes} focusNode={mockFocusNode} />
			);

			await user.click(screen.getByRole("button"));

			await waitFor(() => {
				expect(screen.getByText("Primary system goal")).toBeInTheDocument();
			});

			const nodeButton = screen.getByText("Primary system goal").closest("button");
			expect(nodeButton).toBeInTheDocument();

			await user.click(nodeButton!);

			expect(mockFocusNode).toHaveBeenCalledWith("1");
		});

		it("should handle keyboard navigation", async () => {
			const user = userEvent.setup();

			renderWithAuth(
				<SearchNodes nodes={mockNodes} focusNode={mockFocusNode} />
			);

			await user.click(screen.getByRole("button"));

			await waitFor(() => {
				expect(screen.getByText("Primary system goal")).toBeInTheDocument();
			});

			const nodeButton = screen.getByText("Primary system goal").closest("button");

			// Test Enter key
			nodeButton?.focus();
			await user.keyboard("{Enter}");

			expect(mockFocusNode).toHaveBeenCalledWith("1");
		});

		it("should handle space key selection", async () => {
			const user = userEvent.setup();

			renderWithAuth(
				<SearchNodes nodes={mockNodes} focusNode={mockFocusNode} />
			);

			await user.click(screen.getByRole("button"));

			await waitFor(() => {
				expect(screen.getByText("Primary system goal")).toBeInTheDocument();
			});

			const nodeButton = screen.getByText("Primary system goal").closest("button");

			// Test Space key
			nodeButton?.focus();
			await user.keyboard(" ");

			expect(mockFocusNode).toHaveBeenCalledWith("1");
		});
	});

	describe("Node Display", () => {
		it("should display node identifiers", async () => {
			const user = userEvent.setup();

			renderWithAuth(
				<SearchNodes nodes={mockNodes} focusNode={mockFocusNode} />
			);

			await user.click(screen.getByRole("button"));

			await waitFor(() => {
				expect(screen.getByText("Identifier: G1")).toBeInTheDocument();
				expect(screen.getByText("Identifier: S1")).toBeInTheDocument();
				expect(screen.getByText("Identifier: P1")).toBeInTheDocument();
			});
		});

		it("should display node descriptions", async () => {
			const user = userEvent.setup();

			renderWithAuth(
				<SearchNodes nodes={mockNodes} focusNode={mockFocusNode} />
			);

			await user.click(screen.getByRole("button"));

			await waitFor(() => {
				expect(screen.getByText("Primary system goal")).toBeInTheDocument();
				expect(screen.getByText("Testing strategy for the system")).toBeInTheDocument();
			});
		});

		it("should show separators between nodes", async () => {
			const user = userEvent.setup();

			renderWithAuth(
				<SearchNodes nodes={mockNodes} focusNode={mockFocusNode} />
			);

			await user.click(screen.getByRole("button"));

			await waitFor(() => {
				// Check for separator elements with proper classes
				const separators = document.querySelectorAll('.shrink-0.bg-border');
				expect(separators.length).toBeGreaterThan(0);
			});
		});
	});

	describe("Edge Cases", () => {
		it("should handle empty nodes array", async () => {
			const user = userEvent.setup();

			renderWithAuth(
				<SearchNodes nodes={[]} focusNode={mockFocusNode} />
			);

			await user.click(screen.getByRole("button"));

			await waitFor(() => {
				expect(screen.getByText("Search Nodes")).toBeInTheDocument();
				// Should show no nodes
				expect(screen.queryByText("Identifier:")).not.toBeInTheDocument();
			});
		});

		it("should handle very long descriptions", async () => {
			const longDescription = "A".repeat(500);
			const nodesWithLongDesc: Node[] = [
				createMockNode("1", "G1", longDescription),
			];

			const user = userEvent.setup();

			renderWithAuth(
				<SearchNodes nodes={nodesWithLongDesc} focusNode={mockFocusNode} />
			);

			await user.click(screen.getByRole("button"));

			await waitFor(() => {
				expect(screen.getByText(longDescription)).toBeInTheDocument();
			});
		});

		it("should handle special characters in search", async () => {
			const nodesWithSpecialChars: Node[] = [
				createMockNode("1", "G1", "Test with special chars: !@#$%^&*()"),
			];

			const user = userEvent.setup();

			renderWithAuth(
				<SearchNodes nodes={nodesWithSpecialChars} focusNode={mockFocusNode} />
			);

			await user.click(screen.getByRole("button"));

			const searchInput = screen.getByRole("textbox");
			await user.type(searchInput, "!@#");

			await waitFor(() => {
				expect(screen.getByText("Test with special chars: !@#$%^&*()")).toBeInTheDocument();
			});
		});

		it("should update filtered nodes when nodes prop changes", async () => {
			const user = userEvent.setup();

			const { rerender } = renderWithAuth(
				<SearchNodes nodes={mockNodes} focusNode={mockFocusNode} />
			);

			await user.click(screen.getByRole("button"));

			await waitFor(() => {
				expect(screen.getByText("Primary system goal")).toBeInTheDocument();
			});

			// Update nodes prop
			const newNodes = [createMockNode("10", "G10", "New goal")];
			rerender(<SearchNodes nodes={newNodes} focusNode={mockFocusNode} />);

			await waitFor(() => {
				expect(screen.getByText("New goal")).toBeInTheDocument();
				expect(screen.queryByText("Primary system goal")).not.toBeInTheDocument();
			});
		});
	});

	describe("Search Input Behavior", () => {
		it("should have autocomplete disabled", async () => {
			const user = userEvent.setup();

			renderWithAuth(
				<SearchNodes nodes={mockNodes} focusNode={mockFocusNode} />
			);

			await user.click(screen.getByRole("button"));

			await waitFor(() => {
				const searchInput = screen.getByRole("textbox");
				expect(searchInput).toHaveAttribute("autocomplete", "off");
			});
		});

		it("should have correct input id", async () => {
			const user = userEvent.setup();

			renderWithAuth(
				<SearchNodes nodes={mockNodes} focusNode={mockFocusNode} />
			);

			await user.click(screen.getByRole("button"));

			await waitFor(() => {
				const searchInput = screen.getByRole("textbox");
				expect(searchInput).toHaveAttribute("id", "searchValue");
			});
		});
	});

	describe("Accessibility", () => {
		it("should have screen reader text", () => {
			renderWithAuth(
				<SearchNodes nodes={mockNodes} focusNode={mockFocusNode} />
			);

			expect(screen.getByText("Search")).toBeInTheDocument();
		});

		it("should be keyboard accessible", async () => {
			const user = userEvent.setup();

			renderWithAuth(
				<SearchNodes nodes={mockNodes} focusNode={mockFocusNode} />
			);

			const button = screen.getByRole("button");

			// Focus and activate with Enter
			button.focus();
			await user.keyboard("{Enter}");

			await waitFor(() => {
				expect(screen.getByText("Search Nodes")).toBeInTheDocument();
			});
		});

		it("should have proper dialog structure", async () => {
			const user = userEvent.setup();

			renderWithAuth(
				<SearchNodes nodes={mockNodes} focusNode={mockFocusNode} />
			);

			await user.click(screen.getByRole("button"));

			await waitFor(() => {
				expect(screen.getByRole("dialog")).toBeInTheDocument();
				expect(screen.getByText("Search Nodes")).toBeInTheDocument();
				expect(screen.getByText("Enter your keywords into the input below to find a node.")).toBeInTheDocument();
			});
		});
	});
});
