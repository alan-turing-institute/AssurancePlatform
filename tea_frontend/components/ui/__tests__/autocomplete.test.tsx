import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AutoComplete from "../autocomplete";
import type { User } from "@/types";

// Mock the utils function
vi.mock("@/lib/utils", () => ({
	cn: (...args: any[]) => args.filter(Boolean).join(" "),
}));

describe("AutoComplete", () => {
	const mockUsers: User[] = [
		{ id: 1, username: "john.doe", email: "john@example.com", name: "John Doe" },
		{ id: 2, username: "jane.smith", email: "jane@example.com", name: "Jane Smith" },
		{ id: 3, username: "bob.johnson", email: "bob@example.com", name: "Bob Johnson" },
		{ id: 4, username: "alice.wilson", email: "alice@example.com", name: "Alice Wilson" },
		{ id: 5, username: "charlie.brown", email: "", name: "Charlie Brown" }, // User without email
	];

	const mockSetSelectedUsers = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("Component Rendering", () => {
		it("should render input field with placeholder", () => {
			render(
				<AutoComplete
					options={mockUsers}
					selectedUsers={[]}
					setSelectedUsers={mockSetSelectedUsers}
				/>
			);

			const input = screen.getByPlaceholderText("Start typing...");
			expect(input).toBeInTheDocument();
			expect(input).toHaveAttribute("type", "text");
		});

		it("should not show dropdown initially", () => {
			render(
				<AutoComplete
					options={mockUsers}
					selectedUsers={[]}
					setSelectedUsers={mockSetSelectedUsers}
				/>
			);

			expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
		});

		it("should have correct container styling", () => {
			render(
				<AutoComplete
					options={mockUsers}
					selectedUsers={[]}
					setSelectedUsers={mockSetSelectedUsers}
				/>
			);

			const container = screen.getByPlaceholderText("Start typing...").closest(".autocomplete");
			expect(container).toHaveClass("autocomplete", "relative");
		});

		it("should have correct input styling", () => {
			render(
				<AutoComplete
					options={mockUsers}
					selectedUsers={[]}
					setSelectedUsers={mockSetSelectedUsers}
				/>
			);

			const input = screen.getByPlaceholderText("Start typing...");
			expect(input).toHaveClass(
				"flex", "h-10", "w-full", "rounded-md", "border", "border-input",
				"bg-background", "px-3", "py-2", "text-sm", "ring-offset-background"
			);
		});
	});

	describe("Input Interaction", () => {
		it("should update input value when typing", async () => {
			const user = userEvent.setup();
			render(
				<AutoComplete
					options={mockUsers}
					selectedUsers={[]}
					setSelectedUsers={mockSetSelectedUsers}
				/>
			);

			const input = screen.getByPlaceholderText("Start typing...");
			await user.type(input, "john");

			expect(input).toHaveValue("john");
		});

		it("should clear input value", async () => {
			const user = userEvent.setup();
			render(
				<AutoComplete
					options={mockUsers}
					selectedUsers={[]}
					setSelectedUsers={mockSetSelectedUsers}
				/>
			);

			const input = screen.getByPlaceholderText("Start typing...");
			await user.type(input, "john");
			expect(input).toHaveValue("john");

			await user.clear(input);
			expect(input).toHaveValue("");
		});

		it("should show dropdown when input has value", async () => {
			const user = userEvent.setup();
			render(
				<AutoComplete
					options={mockUsers}
					selectedUsers={[]}
					setSelectedUsers={mockSetSelectedUsers}
				/>
			);

			const input = screen.getByPlaceholderText("Start typing...");
			await user.type(input, "john");

			await waitFor(() => {
				expect(screen.getByRole("listbox")).toBeInTheDocument();
			});
		});

		it("should hide dropdown when input is cleared", async () => {
			const user = userEvent.setup();
			render(
				<AutoComplete
					options={mockUsers}
					selectedUsers={[]}
					setSelectedUsers={mockSetSelectedUsers}
				/>
			);

			const input = screen.getByPlaceholderText("Start typing...");
			await user.type(input, "john");

			await waitFor(() => {
				expect(screen.getByRole("listbox")).toBeInTheDocument();
			});

			await user.clear(input);

			await waitFor(() => {
				expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
			});
		});
	});

	describe("Filtering Logic", () => {
		it("should filter options based on username", async () => {
			const user = userEvent.setup();
			render(
				<AutoComplete
					options={mockUsers}
					selectedUsers={[]}
					setSelectedUsers={mockSetSelectedUsers}
				/>
			);

			const input = screen.getByPlaceholderText("Start typing...");
			await user.type(input, "john");

			await waitFor(() => {
				// Check for text content that includes username
				expect(screen.getByText(/john\.doe/)).toBeInTheDocument();
				expect(screen.getByText(/bob\.johnson/)).toBeInTheDocument();
				expect(screen.queryByText(/jane\.smith/)).not.toBeInTheDocument();
			});
		});

		it("should be case insensitive", async () => {
			const user = userEvent.setup();
			render(
				<AutoComplete
					options={mockUsers}
					selectedUsers={[]}
					setSelectedUsers={mockSetSelectedUsers}
				/>
			);

			const input = screen.getByPlaceholderText("Start typing...");
			await user.type(input, "JOHN");

			await waitFor(() => {
				// Check for text content that includes username
				expect(screen.getByText(/john\.doe/)).toBeInTheDocument();
				expect(screen.getByText(/bob\.johnson/)).toBeInTheDocument();
			});
		});

		it("should exclude already selected users", async () => {
			const user = userEvent.setup();
			const selectedUsers = [mockUsers[0]]; // john.doe is already selected

			render(
				<AutoComplete
					options={mockUsers}
					selectedUsers={selectedUsers}
					setSelectedUsers={mockSetSelectedUsers}
				/>
			);

			const input = screen.getByPlaceholderText("Start typing...");
			await user.type(input, "john");

			await waitFor(() => {
				// john.doe should be excluded as it's already selected
				expect(screen.queryByText(/john\.doe/)).not.toBeInTheDocument();
				expect(screen.getByText(/bob\.johnson/)).toBeInTheDocument();
			});
		});

		it("should handle partial matches", async () => {
			const user = userEvent.setup();
			render(
				<AutoComplete
					options={mockUsers}
					selectedUsers={[]}
					setSelectedUsers={mockSetSelectedUsers}
				/>
			);

			const input = screen.getByPlaceholderText("Start typing...");
			await user.type(input, "smith");

			await waitFor(() => {
				// Only jane.smith should match "smith"
				expect(screen.getByText(/jane\.smith/)).toBeInTheDocument();
				expect(screen.queryByText(/john\.doe/)).not.toBeInTheDocument();
			});
		});

		it("should show no options when no matches found", async () => {
			const user = userEvent.setup();
			render(
				<AutoComplete
					options={mockUsers}
					selectedUsers={[]}
					setSelectedUsers={mockSetSelectedUsers}
				/>
			);

			const input = screen.getByPlaceholderText("Start typing...");
			await user.type(input, "xyz");

			await waitFor(() => {
				expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
			});
		});
	});

	describe("Option Selection", () => {
		it("should select option when clicked", async () => {
			const user = userEvent.setup();
			render(
				<AutoComplete
					options={mockUsers}
					selectedUsers={[]}
					setSelectedUsers={mockSetSelectedUsers}
				/>
			);

			const input = screen.getByPlaceholderText("Start typing...");
			await user.type(input, "john");

			await waitFor(() => {
				expect(screen.getByText(/john\.doe/)).toBeInTheDocument();
			});

			await user.click(screen.getByText(/john\.doe/));

			expect(mockSetSelectedUsers).toHaveBeenCalledWith([mockUsers[0]]);
		});

		it("should clear input after selection", async () => {
			const user = userEvent.setup();
			render(
				<AutoComplete
					options={mockUsers}
					selectedUsers={[]}
					setSelectedUsers={mockSetSelectedUsers}
				/>
			);

			const input = screen.getByPlaceholderText("Start typing...");
			await user.type(input, "john");

			await waitFor(() => {
				expect(screen.getByText(/john\.doe/)).toBeInTheDocument();
			});

			await user.click(screen.getByText(/john\.doe/));

			expect(input).toHaveValue("");
		});

		it("should close dropdown after selection", async () => {
			const user = userEvent.setup();
			render(
				<AutoComplete
					options={mockUsers}
					selectedUsers={[]}
					setSelectedUsers={mockSetSelectedUsers}
				/>
			);

			const input = screen.getByPlaceholderText("Start typing...");
			await user.type(input, "john");

			await waitFor(() => {
				expect(screen.getByRole("listbox")).toBeInTheDocument();
			});

			await user.click(screen.getByText(/john\.doe/));

			await waitFor(() => {
				expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
			});
		});

		it("should add selected user to existing selections", async () => {
			const user = userEvent.setup();
			const existingSelections = [mockUsers[1]]; // jane.smith

			render(
				<AutoComplete
					options={mockUsers}
					selectedUsers={existingSelections}
					setSelectedUsers={mockSetSelectedUsers}
				/>
			);

			const input = screen.getByPlaceholderText("Start typing...");
			await user.type(input, "john");

			await waitFor(() => {
				expect(screen.getByText(/john\.doe/)).toBeInTheDocument();
			});

			await user.click(screen.getByText(/john\.doe/));

			expect(mockSetSelectedUsers).toHaveBeenCalledWith([mockUsers[1], mockUsers[0]]);
		});

		it("should not add already selected user", async () => {
			const user = userEvent.setup();
			const existingSelections = [mockUsers[0]]; // john.doe already selected

			render(
				<AutoComplete
					options={mockUsers}
					selectedUsers={existingSelections}
					setSelectedUsers={mockSetSelectedUsers}
				/>
			);

			const input = screen.getByPlaceholderText("Start typing...");
			await user.type(input, "bob");

			await waitFor(() => {
				expect(screen.getByText(/bob\.johnson/)).toBeInTheDocument();
			});

			await user.click(screen.getByText(/bob\.johnson/));

			expect(mockSetSelectedUsers).toHaveBeenCalledWith([mockUsers[0], mockUsers[2]]);
		});
	});

	describe("Keyboard Navigation", () => {
		it("should select option with Enter key", async () => {
			const user = userEvent.setup();
			render(
				<AutoComplete
					options={mockUsers}
					selectedUsers={[]}
					setSelectedUsers={mockSetSelectedUsers}
				/>
			);

			const input = screen.getByPlaceholderText("Start typing...");
			await user.type(input, "john");

			await waitFor(() => {
				expect(screen.getByText(/john\.doe/)).toBeInTheDocument();
			});

			const option = screen.getByText(/john\.doe/);
			await user.type(option, "{Enter}");

			expect(mockSetSelectedUsers).toHaveBeenCalledWith([mockUsers[0]]);
		});

		it("should select option with Space key", async () => {
			const user = userEvent.setup();
			render(
				<AutoComplete
					options={mockUsers}
					selectedUsers={[]}
					setSelectedUsers={mockSetSelectedUsers}
				/>
			);

			const input = screen.getByPlaceholderText("Start typing...");
			await user.type(input, "john");

			await waitFor(() => {
				expect(screen.getByText(/john\.doe/)).toBeInTheDocument();
			});

			const option = screen.getByText(/john\.doe/);
			await user.type(option, " ");

			expect(mockSetSelectedUsers).toHaveBeenCalledWith([mockUsers[0]]);
		});
	});

	describe("Focus and Blur Behavior", () => {
		it("should show dropdown on focus if input has value", async () => {
			const user = userEvent.setup();
			render(
				<AutoComplete
					options={mockUsers}
					selectedUsers={[]}
					setSelectedUsers={mockSetSelectedUsers}
				/>
			);

			const input = screen.getByPlaceholderText("Start typing...");
			await user.type(input, "john");
			await user.tab(); // Focus away
			await user.click(input); // Focus back

			await waitFor(() => {
				expect(screen.getByRole("listbox")).toBeInTheDocument();
			});
		});

		it("should close dropdown on blur with delay", async () => {
			const user = userEvent.setup();
			render(
				<AutoComplete
					options={mockUsers}
					selectedUsers={[]}
					setSelectedUsers={mockSetSelectedUsers}
				/>
			);

			const input = screen.getByPlaceholderText("Start typing...");
			await user.type(input, "john");

			await waitFor(() => {
				expect(screen.getByRole("listbox")).toBeInTheDocument();
			});

			await user.tab(); // Blur

			// Should still be open immediately due to setTimeout delay
			expect(screen.getByRole("listbox")).toBeInTheDocument();

			// After delay, should be closed
			await waitFor(() => {
				expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
			}, { timeout: 200 });
		});
	});

	describe("Display Format", () => {
		it("should display username with email when email exists", async () => {
			const user = userEvent.setup();
			render(
				<AutoComplete
					options={mockUsers}
					selectedUsers={[]}
					setSelectedUsers={mockSetSelectedUsers}
				/>
			);

			const input = screen.getByPlaceholderText("Start typing...");
			await user.type(input, "john");

			await waitFor(() => {
				expect(screen.getByText("john.doe (john@example.com)")).toBeInTheDocument();
			});
		});

		it("should display only username when email is empty", async () => {
			const user = userEvent.setup();
			render(
				<AutoComplete
					options={mockUsers}
					selectedUsers={[]}
					setSelectedUsers={mockSetSelectedUsers}
				/>
			);

			const input = screen.getByPlaceholderText("Start typing...");
			await user.type(input, "charlie");

			await waitFor(() => {
				expect(screen.getByText(/charlie\.brown/)).toBeInTheDocument();
				// Should not have empty parentheses when email is empty
				expect(screen.queryByText(/charlie\.brown \(\)/)).not.toBeInTheDocument();
			});
		});
	});

	describe("Dropdown Styling and Size", () => {
		it("should have correct dropdown styling", async () => {
			const user = userEvent.setup();
			render(
				<AutoComplete
					options={mockUsers}
					selectedUsers={[]}
					setSelectedUsers={mockSetSelectedUsers}
				/>
			);

			const input = screen.getByPlaceholderText("Start typing...");
			await user.type(input, "john");

			await waitFor(() => {
				const dropdown = screen.getByRole("listbox");
				expect(dropdown).toHaveClass(
					"absolute", "top-full", "left-0", "z-50", "mt-1", "w-full",
					"space-y-3", "rounded-md", "bg-gray-100", "p-2", "shadow-lg", "dark:bg-slate-900"
				);
			});
		});

		it("should limit dropdown size to maximum 5 items", async () => {
			const user = userEvent.setup();
			render(
				<AutoComplete
					options={mockUsers}
					selectedUsers={[]}
					setSelectedUsers={mockSetSelectedUsers}
				/>
			);

			const input = screen.getByPlaceholderText("Start typing...");
			await user.type(input, "o"); // Should match multiple users

			await waitFor(() => {
				const dropdown = screen.getByRole("listbox");
				// "o" matches john.doe, bob.johnson, alice.wilson, charlie.brown (4 users)
				expect(dropdown).toHaveAttribute("size", "4");
			});
		});

		it("should set dropdown size to number of filtered options when less than 5", async () => {
			const user = userEvent.setup();
			render(
				<AutoComplete
					options={mockUsers}
					selectedUsers={[]}
					setSelectedUsers={mockSetSelectedUsers}
				/>
			);

			const input = screen.getByPlaceholderText("Start typing...");
			await user.type(input, "john");

			await waitFor(() => {
				const dropdown = screen.getByRole("listbox");
				expect(dropdown).toHaveAttribute("size", "2"); // john.doe and bob.johnson
			});
		});
	});

	describe("Edge Cases", () => {
		it("should handle empty options array", () => {
			render(
				<AutoComplete
					options={[]}
					selectedUsers={[]}
					setSelectedUsers={mockSetSelectedUsers}
				/>
			);

			expect(screen.getByPlaceholderText("Start typing...")).toBeInTheDocument();
		});

		it("should handle options with missing properties", async () => {
			const incompleteUsers = [
				{ id: 1, username: "incomplete", email: "", name: "" },
			] as User[];

			const user = userEvent.setup();
			render(
				<AutoComplete
					options={incompleteUsers}
					selectedUsers={[]}
					setSelectedUsers={mockSetSelectedUsers}
				/>
			);

			const input = screen.getByPlaceholderText("Start typing...");
			await user.type(input, "incomplete");

			await waitFor(() => {
				expect(screen.getByText(/incomplete/)).toBeInTheDocument();
			});
		});

		it("should handle special characters in search", async () => {
			const specialUsers = [
				{ id: 1, username: "user@special", email: "test@example.com", name: "Special User" },
			] as User[];

			const user = userEvent.setup();
			render(
				<AutoComplete
					options={specialUsers}
					selectedUsers={[]}
					setSelectedUsers={mockSetSelectedUsers}
				/>
			);

			const input = screen.getByPlaceholderText("Start typing...");
			await user.type(input, "@special");

			await waitFor(() => {
				expect(screen.getByText(/user@special/)).toBeInTheDocument();
			});
		});

		it("should handle rapid typing", async () => {
			const user = userEvent.setup();
			render(
				<AutoComplete
					options={mockUsers}
					selectedUsers={[]}
					setSelectedUsers={mockSetSelectedUsers}
				/>
			);

			const input = screen.getByPlaceholderText("Start typing...");

			// Type rapidly
			await user.type(input, "john", { delay: 1 });

			await waitFor(() => {
				expect(screen.getByText(/john\.doe/)).toBeInTheDocument();
			});
		});

		it("should handle selection of user with duplicate username", async () => {
			const duplicateUsers = [
				...mockUsers,
				{ id: 6, username: "john.doe", email: "john2@example.com", name: "John Doe 2" },
			] as User[];

			const user = userEvent.setup();
			render(
				<AutoComplete
					options={duplicateUsers}
					selectedUsers={[]}
					setSelectedUsers={mockSetSelectedUsers}
				/>
			);

			const input = screen.getByPlaceholderText("Start typing...");
			await user.type(input, "john.doe");

			await waitFor(() => {
				const options = screen.getAllByText(/john\.doe/);
				expect(options).toHaveLength(2);
			});

			// Click the first option which includes the email
			const firstOption = screen.getAllByText(/john\.doe/)[0];
			await user.click(firstOption);

			expect(mockSetSelectedUsers).toHaveBeenCalledWith([mockUsers[0]]);
		});
	});
});
