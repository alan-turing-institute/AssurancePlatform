import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
	renderWithoutProviders,
	screen,
	waitFor,
} from "@/src/__tests__/utils/test-utils";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "./tooltip";

// Regex constants for text matching
const HOVER_ME_REGEX = /hover me/i;
const TOOLTIP_TEXT_REGEX = /tooltip text/i;
const CLICK_ME_REGEX = /click me/i;
const CUSTOM_TOOLTIP_REGEX = /custom tooltip/i;
const FOCUSABLE_TRIGGER_REGEX = /focusable trigger/i;
const DISABLED_BUTTON_REGEX = /disabled button/i;

describe("Tooltip", () => {
	it("should render trigger element", () => {
		renderWithoutProviders(
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger>Hover me</TooltipTrigger>
					<TooltipContent>
						<p>Tooltip text</p>
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>
		);

		const trigger = screen.getByText(HOVER_ME_REGEX);
		expect(trigger).toBeInTheDocument();
	});

	it("should show tooltip on hover", async () => {
		const user = userEvent.setup();

		renderWithoutProviders(
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger>Hover me</TooltipTrigger>
					<TooltipContent>
						<p>Tooltip text</p>
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>
		);

		const trigger = screen.getByText(HOVER_ME_REGEX);

		// Tooltip should not be visible initially
		expect(screen.queryByText(TOOLTIP_TEXT_REGEX)).not.toBeInTheDocument();

		// Hover over trigger
		await user.hover(trigger);

		// Tooltip should appear
		await waitFor(() => {
			expect(screen.getByText(TOOLTIP_TEXT_REGEX)).toBeInTheDocument();
		});
	});

	it("should hide tooltip on unhover", async () => {
		const user = userEvent.setup();

		renderWithoutProviders(
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger>Hover me</TooltipTrigger>
					<TooltipContent>
						<p>Tooltip text</p>
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>
		);

		const trigger = screen.getByText(HOVER_ME_REGEX);

		// Show tooltip
		await user.hover(trigger);
		await waitFor(() => {
			expect(screen.getByText(TOOLTIP_TEXT_REGEX)).toBeInTheDocument();
		});

		// Hide tooltip
		await user.unhover(trigger);
		await waitFor(() => {
			expect(screen.queryByText(TOOLTIP_TEXT_REGEX)).not.toBeInTheDocument();
		});
	});

	it("should render with custom content", async () => {
		const user = userEvent.setup();

		renderWithoutProviders(
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger>Hover me</TooltipTrigger>
					<TooltipContent>
						<div>
							<h3>Custom Title</h3>
							<p>Custom description</p>
						</div>
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>
		);

		const trigger = screen.getByText(HOVER_ME_REGEX);
		await user.hover(trigger);

		await waitFor(() => {
			expect(screen.getByText("Custom Title")).toBeInTheDocument();
			expect(screen.getByText("Custom description")).toBeInTheDocument();
		});
	});

	it("should accept custom className on TooltipContent", async () => {
		const user = userEvent.setup();

		renderWithoutProviders(
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger>Hover me</TooltipTrigger>
					<TooltipContent className="custom-tooltip-class">
						<p>Custom tooltip</p>
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>
		);

		const trigger = screen.getByText(HOVER_ME_REGEX);
		await user.hover(trigger);

		await waitFor(() => {
			const content = screen.getByText(CUSTOM_TOOLTIP_REGEX);
			expect(content.parentElement).toHaveClass("custom-tooltip-class");
		});
	});

	it("should work with button as trigger", async () => {
		const user = userEvent.setup();
		const handleClick = vi.fn();

		renderWithoutProviders(
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<button onClick={handleClick} type="button">
							Click me
						</button>
					</TooltipTrigger>
					<TooltipContent>
						<p>Button tooltip</p>
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>
		);

		const button = screen.getByRole("button", { name: CLICK_ME_REGEX });

		// Should show tooltip on hover
		await user.hover(button);
		await waitFor(() => {
			expect(screen.getByText("Button tooltip")).toBeInTheDocument();
		});

		// Should still handle click
		await user.click(button);
		expect(handleClick).toHaveBeenCalledTimes(1);
	});

	it("should support custom sideOffset", async () => {
		const user = userEvent.setup();

		renderWithoutProviders(
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger>Hover me</TooltipTrigger>
					<TooltipContent sideOffset={10}>
						<p>Offset tooltip</p>
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>
		);

		const trigger = screen.getByText(HOVER_ME_REGEX);
		await user.hover(trigger);

		await waitFor(() => {
			const content = screen.getByText("Offset tooltip");
			expect(content).toBeInTheDocument();
		});
	});

	it("should have proper styling classes", async () => {
		const user = userEvent.setup();

		renderWithoutProviders(
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger>Hover me</TooltipTrigger>
					<TooltipContent>
						<p>Styled tooltip</p>
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>
		);

		const trigger = screen.getByText(HOVER_ME_REGEX);
		await user.hover(trigger);

		await waitFor(() => {
			const content = screen.getByText("Styled tooltip").parentElement;
			expect(content).toHaveClass(
				"z-50",
				"overflow-hidden",
				"rounded-md",
				"border",
				"bg-popover",
				"px-3",
				"py-1.5",
				"text-popover-foreground",
				"text-sm",
				"shadow-md"
			);
		});
	});

	it("should support keyboard navigation", async () => {
		const user = userEvent.setup();

		renderWithoutProviders(
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<button type="button">Focusable trigger</button>
					</TooltipTrigger>
					<TooltipContent>
						<p>Keyboard tooltip</p>
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>
		);

		// Tab to focus the trigger
		await user.tab();
		const trigger = screen.getByRole("button", {
			name: FOCUSABLE_TRIGGER_REGEX,
		});
		expect(trigger).toHaveFocus();

		// Tooltip should show on focus
		await waitFor(() => {
			expect(screen.getByText("Keyboard tooltip")).toBeInTheDocument();
		});
	});

	it("should handle multiple tooltips", async () => {
		const user = userEvent.setup();

		renderWithoutProviders(
			<TooltipProvider>
				<div>
					<Tooltip>
						<TooltipTrigger>First trigger</TooltipTrigger>
						<TooltipContent>
							<p>First tooltip</p>
						</TooltipContent>
					</Tooltip>
					<Tooltip>
						<TooltipTrigger>Second trigger</TooltipTrigger>
						<TooltipContent>
							<p>Second tooltip</p>
						</TooltipContent>
					</Tooltip>
				</div>
			</TooltipProvider>
		);

		const firstTrigger = screen.getByText("First trigger");
		const secondTrigger = screen.getByText("Second trigger");

		// Hover first trigger
		await user.hover(firstTrigger);
		await waitFor(() => {
			expect(screen.getByText("First tooltip")).toBeInTheDocument();
			expect(screen.queryByText("Second tooltip")).not.toBeInTheDocument();
		});

		// Move to second trigger
		await user.hover(secondTrigger);
		await waitFor(() => {
			expect(screen.queryByText("First tooltip")).not.toBeInTheDocument();
			expect(screen.getByText("Second tooltip")).toBeInTheDocument();
		});
	});

	it("should handle disabled trigger", async () => {
		const user = userEvent.setup();

		renderWithoutProviders(
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<button disabled type="button">
							Disabled button
						</button>
					</TooltipTrigger>
					<TooltipContent>
						<p>Disabled tooltip</p>
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>
		);

		const button = screen.getByRole("button", { name: DISABLED_BUTTON_REGEX });
		expect(button).toBeDisabled();

		// Hover disabled button
		await user.hover(button);

		// Tooltip should still appear for disabled elements
		await waitFor(() => {
			expect(screen.getByText("Disabled tooltip")).toBeInTheDocument();
		});
	});

	it("should render without TooltipProvider and not crash", () => {
		// This should not throw an error, but tooltip won't work without provider
		expect(() => {
			renderWithoutProviders(
				<Tooltip>
					<TooltipTrigger>No provider</TooltipTrigger>
					<TooltipContent>
						<p>This won't show</p>
					</TooltipContent>
				</Tooltip>
			);
		}).not.toThrow();

		expect(screen.getByText("No provider")).toBeInTheDocument();
	});

	it("should handle side prop on TooltipContent", async () => {
		const user = userEvent.setup();

		renderWithoutProviders(
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger>Hover me</TooltipTrigger>
					<TooltipContent side="bottom">
						<p>Bottom tooltip</p>
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>
		);

		const trigger = screen.getByText(HOVER_ME_REGEX);
		await user.hover(trigger);

		await waitFor(() => {
			expect(screen.getByText("Bottom tooltip")).toBeInTheDocument();
		});
	});

	it("should handle align prop on TooltipContent", async () => {
		const user = userEvent.setup();

		renderWithoutProviders(
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger>Hover me</TooltipTrigger>
					<TooltipContent align="start">
						<p>Start aligned tooltip</p>
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>
		);

		const trigger = screen.getByText(HOVER_ME_REGEX);
		await user.hover(trigger);

		await waitFor(() => {
			expect(screen.getByText("Start aligned tooltip")).toBeInTheDocument();
		});
	});
});
