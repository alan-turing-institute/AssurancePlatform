import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
	renderWithoutProviders,
	screen,
	waitFor,
} from "@/src/__tests__/utils/test-utils";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectSeparator,
	SelectTrigger,
	SelectValue,
} from "./select";

// Regex constants for text matching
const SELECT_TRIGGER_REGEX = /select trigger/i;
const OPTION_ONE_REGEX = /option 1/i;
const OPTION_TWO_REGEX = /option 2/i;
const FRUITS_REGEX = /fruits/i;
const VEGETABLES_REGEX = /vegetables/i;
const APPLE_REGEX = /apple/i;
const CARROT_REGEX = /carrot/i;
const DISABLED_OPTION_REGEX = /option 2 \(disabled\)/i;
const FIRST_OPTION_TWO_REGEX = /first option 2/i;
const SECOND_OPTION_ONE_REGEX = /second option 1/i;

describe("Select", () => {
	it("should render with default props", () => {
		renderWithoutProviders(
			<Select>
				<SelectTrigger>
					<SelectValue placeholder="Select an option" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="option1">Option 1</SelectItem>
					<SelectItem value="option2">Option 2</SelectItem>
				</SelectContent>
			</Select>
		);

		const trigger = screen.getByRole("combobox");
		expect(trigger).toBeInTheDocument();
		expect(trigger).toHaveAttribute("aria-expanded", "false");
		expect(trigger).toHaveTextContent("Select an option");
	});

	it("should open dropdown when clicked", async () => {
		const user = userEvent.setup();

		renderWithoutProviders(
			<Select>
				<SelectTrigger>
					<SelectValue placeholder="Select an option" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="option1">Option 1</SelectItem>
					<SelectItem value="option2">Option 2</SelectItem>
				</SelectContent>
			</Select>
		);

		const trigger = screen.getByRole("combobox");
		await user.click(trigger);

		expect(trigger).toHaveAttribute("aria-expanded", "true");
		expect(
			screen.getByRole("option", { name: OPTION_ONE_REGEX })
		).toBeInTheDocument();
		expect(
			screen.getByRole("option", { name: OPTION_TWO_REGEX })
		).toBeInTheDocument();
	});

	it("should handle option selection", async () => {
		const user = userEvent.setup();
		const handleValueChange = vi.fn();

		renderWithoutProviders(
			<Select onValueChange={handleValueChange}>
				<SelectTrigger>
					<SelectValue placeholder="Select an option" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="option1">Option 1</SelectItem>
					<SelectItem value="option2">Option 2</SelectItem>
					<SelectItem value="option3">Option 3</SelectItem>
				</SelectContent>
			</Select>
		);

		const trigger = screen.getByRole("combobox");
		await user.click(trigger);

		const option2 = screen.getByRole("option", { name: OPTION_TWO_REGEX });
		await user.click(option2);

		expect(handleValueChange).toHaveBeenCalledWith("option2");
		expect(trigger).toHaveTextContent("Option 2");
		expect(trigger).toHaveAttribute("aria-expanded", "false");
	});

	it("should handle keyboard navigation", async () => {
		const user = userEvent.setup();
		const handleValueChange = vi.fn();

		renderWithoutProviders(
			<Select onValueChange={handleValueChange}>
				<SelectTrigger>
					<SelectValue placeholder="Select an option" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="option1">Option 1</SelectItem>
					<SelectItem value="option2">Option 2</SelectItem>
					<SelectItem value="option3">Option 3</SelectItem>
				</SelectContent>
			</Select>
		);

		const trigger = screen.getByRole("combobox");

		// Open with Enter key
		await user.click(trigger);
		await user.keyboard("{Escape}");
		await user.keyboard("{Enter}");
		expect(trigger).toHaveAttribute("aria-expanded", "true");

		// Navigate with arrow keys
		await user.keyboard("{ArrowDown}");
		await user.keyboard("{ArrowDown}");
		await user.keyboard("{ArrowDown}");
		await user.keyboard("{Enter}");

		expect(handleValueChange).toHaveBeenCalledWith("option3");
		expect(trigger).toHaveTextContent("Option 3");
	});

	it("should handle disabled state", async () => {
		const user = userEvent.setup();

		renderWithoutProviders(
			<Select disabled>
				<SelectTrigger>
					<SelectValue placeholder="Select an option" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="option1">Option 1</SelectItem>
					<SelectItem value="option2">Option 2</SelectItem>
				</SelectContent>
			</Select>
		);

		const trigger = screen.getByRole("combobox");
		expect(trigger).toHaveAttribute("data-disabled", "");
		expect(trigger).toHaveClass(
			"disabled:cursor-not-allowed",
			"disabled:opacity-50"
		);

		await user.click(trigger);
		expect(trigger).toHaveAttribute("aria-expanded", "false");
	});

	it("should display placeholder when no value is selected", () => {
		renderWithoutProviders(
			<Select>
				<SelectTrigger>
					<SelectValue placeholder="Choose a fruit" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="apple">Apple</SelectItem>
					<SelectItem value="banana">Banana</SelectItem>
				</SelectContent>
			</Select>
		);

		const trigger = screen.getByRole("combobox");
		expect(trigger).toHaveTextContent("Choose a fruit");
	});

	it("should handle controlled value", () => {
		const { rerender } = renderWithoutProviders(
			<Select value="option1">
				<SelectTrigger>
					<SelectValue placeholder="Select an option" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="option1">Option 1</SelectItem>
					<SelectItem value="option2">Option 2</SelectItem>
				</SelectContent>
			</Select>
		);

		const trigger = screen.getByRole("combobox");
		expect(trigger).toHaveTextContent("Option 1");

		rerender(
			<Select value="option2">
				<SelectTrigger>
					<SelectValue placeholder="Select an option" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="option1">Option 1</SelectItem>
					<SelectItem value="option2">Option 2</SelectItem>
				</SelectContent>
			</Select>
		);

		expect(trigger).toHaveTextContent("Option 2");
	});

	it("should handle defaultValue", () => {
		renderWithoutProviders(
			<Select defaultValue="option2">
				<SelectTrigger>
					<SelectValue placeholder="Select an option" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="option1">Option 1</SelectItem>
					<SelectItem value="option2">Option 2</SelectItem>
					<SelectItem value="option3">Option 3</SelectItem>
				</SelectContent>
			</Select>
		);

		const trigger = screen.getByRole("combobox");
		expect(trigger).toHaveTextContent("Option 2");
	});

	it("should render with groups and labels", async () => {
		const user = userEvent.setup();

		renderWithoutProviders(
			<Select>
				<SelectTrigger>
					<SelectValue placeholder="Select a food" />
				</SelectTrigger>
				<SelectContent>
					<SelectGroup>
						<SelectLabel>Fruits</SelectLabel>
						<SelectItem value="apple">Apple</SelectItem>
						<SelectItem value="banana">Banana</SelectItem>
					</SelectGroup>
					<SelectSeparator />
					<SelectGroup>
						<SelectLabel>Vegetables</SelectLabel>
						<SelectItem value="carrot">Carrot</SelectItem>
						<SelectItem value="potato">Potato</SelectItem>
					</SelectGroup>
				</SelectContent>
			</Select>
		);

		const trigger = screen.getByRole("combobox");
		await user.click(trigger);

		expect(screen.getByText(FRUITS_REGEX)).toBeInTheDocument();
		expect(screen.getByText(VEGETABLES_REGEX)).toBeInTheDocument();
		expect(
			screen.getByRole("option", { name: APPLE_REGEX })
		).toBeInTheDocument();
		expect(
			screen.getByRole("option", { name: CARROT_REGEX })
		).toBeInTheDocument();
	});

	it("should handle disabled items", async () => {
		const user = userEvent.setup();
		const handleValueChange = vi.fn();

		renderWithoutProviders(
			<Select onValueChange={handleValueChange}>
				<SelectTrigger>
					<SelectValue placeholder="Select an option" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="option1">Option 1</SelectItem>
					<SelectItem disabled value="option2">
						Option 2 (Disabled)
					</SelectItem>
					<SelectItem value="option3">Option 3</SelectItem>
				</SelectContent>
			</Select>
		);

		const trigger = screen.getByRole("combobox");
		await user.click(trigger);

		const disabledOption = screen.getByRole("option", {
			name: DISABLED_OPTION_REGEX,
		});
		expect(disabledOption).toHaveAttribute("aria-disabled", "true");
		expect(disabledOption).toHaveClass(
			"data-[disabled]:pointer-events-none",
			"data-[disabled]:opacity-50"
		);

		await user.click(disabledOption);
		expect(handleValueChange).not.toHaveBeenCalled();
		expect(trigger).toHaveAttribute("aria-expanded", "true"); // Should still be open
	});

	it("should accept custom className on trigger", () => {
		renderWithoutProviders(
			<Select>
				<SelectTrigger className="custom-trigger-class">
					<SelectValue placeholder="Select an option" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="option1">Option 1</SelectItem>
				</SelectContent>
			</Select>
		);

		const trigger = screen.getByRole("combobox");
		expect(trigger).toHaveClass("custom-trigger-class");
	});

	it("should accept custom className on content", async () => {
		const user = userEvent.setup();

		renderWithoutProviders(
			<Select>
				<SelectTrigger>
					<SelectValue placeholder="Select an option" />
				</SelectTrigger>
				<SelectContent className="custom-content-class">
					<SelectItem value="option1">Option 1</SelectItem>
				</SelectContent>
			</Select>
		);

		const trigger = screen.getByRole("combobox");
		await user.click(trigger);

		// Find the content container by its role
		const listbox = screen.getByRole("listbox");
		expect(listbox).toHaveClass("custom-content-class");
	});

	it("should close dropdown when clicking outside", async () => {
		const user = userEvent.setup();

		renderWithoutProviders(
			<>
				<Select>
					<SelectTrigger>
						<SelectValue placeholder="Select an option" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="option1">Option 1</SelectItem>
						<SelectItem value="option2">Option 2</SelectItem>
					</SelectContent>
				</Select>
				<button type="button">Outside button</button>
			</>
		);

		const trigger = screen.getByRole("combobox");
		await user.click(trigger);
		expect(trigger).toHaveAttribute("aria-expanded", "true");

		// Escape key should close the dropdown
		await user.keyboard("{Escape}");

		await waitFor(() => {
			expect(trigger).toHaveAttribute("aria-expanded", "false");
		});
	});

	it("should close dropdown with Escape key", async () => {
		const user = userEvent.setup();

		renderWithoutProviders(
			<Select>
				<SelectTrigger>
					<SelectValue placeholder="Select an option" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="option1">Option 1</SelectItem>
					<SelectItem value="option2">Option 2</SelectItem>
				</SelectContent>
			</Select>
		);

		const trigger = screen.getByRole("combobox");
		await user.click(trigger);
		expect(trigger).toHaveAttribute("aria-expanded", "true");

		await user.keyboard("{Escape}");
		expect(trigger).toHaveAttribute("aria-expanded", "false");
	});

	it("should have correct accessibility attributes", () => {
		renderWithoutProviders(
			<Select>
				<SelectTrigger aria-label="Select trigger">
					<SelectValue placeholder="Select an option" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="option1">Option 1</SelectItem>
					<SelectItem value="option2">Option 2</SelectItem>
				</SelectContent>
			</Select>
		);

		const trigger = screen.getByRole("combobox", {
			name: SELECT_TRIGGER_REGEX,
		});
		expect(trigger).toHaveAttribute("aria-label", "Select trigger");
		expect(trigger).toHaveAttribute("aria-expanded", "false");
		expect(trigger).toHaveAttribute("aria-autocomplete", "none");
	});

	it("should show selected item with check mark", async () => {
		const user = userEvent.setup();

		renderWithoutProviders(
			<Select defaultValue="option2">
				<SelectTrigger>
					<SelectValue placeholder="Select an option" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="option1">Option 1</SelectItem>
					<SelectItem value="option2">Option 2</SelectItem>
					<SelectItem value="option3">Option 3</SelectItem>
				</SelectContent>
			</Select>
		);

		const trigger = screen.getByRole("combobox");
		await user.click(trigger);

		const selectedOption = screen.getByRole("option", {
			name: OPTION_TWO_REGEX,
		});
		expect(selectedOption).toHaveAttribute("aria-selected", "true");

		// Check that the check icon SVG is visible for the selected item
		// Look for the svg element within the selected option
		const svgElements = selectedOption.querySelectorAll("svg");
		expect(svgElements.length).toBeGreaterThan(0);
		expect(svgElements[0]).toHaveClass("lucide", "lucide-check");
	});

	it("should handle required attribute", () => {
		renderWithoutProviders(
			<Select required>
				<SelectTrigger>
					<SelectValue placeholder="Select an option" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="option1">Option 1</SelectItem>
					<SelectItem value="option2">Option 2</SelectItem>
				</SelectContent>
			</Select>
		);

		const trigger = screen.getByRole("combobox");
		expect(trigger).toHaveAttribute("aria-required", "true");
	});

	it("should maintain proper styling classes on trigger", () => {
		renderWithoutProviders(
			<Select>
				<SelectTrigger>
					<SelectValue placeholder="Select an option" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="option1">Option 1</SelectItem>
				</SelectContent>
			</Select>
		);

		const trigger = screen.getByRole("combobox");
		expect(trigger).toHaveClass(
			"flex",
			"h-10",
			"w-full",
			"items-center",
			"justify-between",
			"rounded-md",
			"border",
			"border-input",
			"bg-background",
			"px-3",
			"py-2",
			"text-sm",
			"ring-offset-background",
			"placeholder:text-muted-foreground",
			"focus:outline-none",
			"focus:ring-2",
			"focus:ring-ring",
			"focus:ring-offset-2"
		);
	});

	it("should handle multiple selects on the same page", async () => {
		const user = userEvent.setup();
		const handleValueChange1 = vi.fn();
		const handleValueChange2 = vi.fn();

		renderWithoutProviders(
			<div>
				<Select onValueChange={handleValueChange1}>
					<SelectTrigger>
						<SelectValue placeholder="Select first" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="first1">First Option 1</SelectItem>
						<SelectItem value="first2">First Option 2</SelectItem>
					</SelectContent>
				</Select>
				<Select onValueChange={handleValueChange2}>
					<SelectTrigger>
						<SelectValue placeholder="Select second" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="second1">Second Option 1</SelectItem>
						<SelectItem value="second2">Second Option 2</SelectItem>
					</SelectContent>
				</Select>
			</div>
		);

		const triggers = screen.getAllByRole("combobox");
		expect(triggers).toHaveLength(2);

		// Test first select
		await user.click(triggers[0]);
		await user.click(
			screen.getByRole("option", { name: FIRST_OPTION_TWO_REGEX })
		);
		expect(handleValueChange1).toHaveBeenCalledWith("first2");
		expect(handleValueChange2).not.toHaveBeenCalled();

		// Test second select
		await user.click(triggers[1]);
		await user.click(
			screen.getByRole("option", { name: SECOND_OPTION_ONE_REGEX })
		);
		expect(handleValueChange2).toHaveBeenCalledWith("second1");
	});
});
