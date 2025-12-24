import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	Command,
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
	CommandShortcut,
} from "../command";

// Mock cmdk
vi.mock("cmdk", () => {
	const ReactLib = React;

	const mockCommandInput = ReactLib.forwardRef<
		HTMLInputElement,
		React.InputHTMLAttributes<HTMLInputElement> & { className?: string }
	>(
		(
			{
				className,
				...props
			}: React.InputHTMLAttributes<HTMLInputElement> & { className?: string },
			ref: React.Ref<HTMLInputElement>
		) => (
			<input
				className={className}
				data-testid="command-input"
				ref={ref}
				{...props}
			/>
		)
	);
	mockCommandInput.displayName = "CommandInput";

	const mockCommandList = ReactLib.forwardRef<
		HTMLDivElement,
		React.HTMLAttributes<HTMLDivElement> & {
			className?: string;
			children?: React.ReactNode;
		}
	>(
		(
			{
				className,
				children,
				...props
			}: React.HTMLAttributes<HTMLDivElement> & {
				className?: string;
				children?: React.ReactNode;
			},
			ref: React.Ref<HTMLDivElement>
		) => (
			<div
				className={className}
				data-testid="command-list"
				ref={ref}
				{...props}
			>
				{children}
			</div>
		)
	);
	mockCommandList.displayName = "CommandList";

	const mockCommandEmpty = ReactLib.forwardRef<
		HTMLDivElement,
		React.HTMLAttributes<HTMLDivElement>
	>(
		(
			props: React.HTMLAttributes<HTMLDivElement>,
			ref: React.Ref<HTMLDivElement>
		) => <div data-testid="command-empty" ref={ref} {...props} />
	);
	mockCommandEmpty.displayName = "CommandEmpty";

	const mockCommandGroup = ReactLib.forwardRef<
		HTMLDivElement,
		React.HTMLAttributes<HTMLDivElement> & {
			className?: string;
			children?: React.ReactNode;
		}
	>(
		(
			{
				className,
				children,
				...props
			}: React.HTMLAttributes<HTMLDivElement> & {
				className?: string;
				children?: React.ReactNode;
			},
			ref: React.Ref<HTMLDivElement>
		) => (
			<div
				className={className}
				data-testid="command-group"
				ref={ref}
				{...props}
			>
				{children}
			</div>
		)
	);
	mockCommandGroup.displayName = "CommandGroup";

	const mockCommandItem = ReactLib.forwardRef<
		HTMLButtonElement,
		React.ButtonHTMLAttributes<HTMLButtonElement> & {
			className?: string;
			children?: React.ReactNode;
		}
	>(
		(
			{
				className,
				children,
				...props
			}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
				className?: string;
				children?: React.ReactNode;
			},
			ref: React.Ref<HTMLButtonElement>
		) => (
			<button
				className={className}
				data-testid="command-item"
				ref={ref}
				type="button"
				{...props}
			>
				{children}
			</button>
		)
	);
	mockCommandItem.displayName = "CommandItem";

	const mockCommandSeparator = ReactLib.forwardRef<
		HTMLDivElement,
		React.HTMLAttributes<HTMLDivElement> & { className?: string }
	>(
		(
			{
				className,
				...props
			}: React.HTMLAttributes<HTMLDivElement> & { className?: string },
			ref: React.Ref<HTMLDivElement>
		) => (
			<div
				className={className}
				data-testid="command-separator"
				ref={ref}
				{...props}
			/>
		)
	);
	mockCommandSeparator.displayName = "CommandSeparator";

	const mockCommandMain = ReactLib.forwardRef<
		HTMLDivElement,
		React.HTMLAttributes<HTMLDivElement> & {
			className?: string;
			children?: React.ReactNode;
		}
	>(
		(
			{
				className,
				children,
				...props
			}: React.HTMLAttributes<HTMLDivElement> & {
				className?: string;
				children?: React.ReactNode;
			},
			ref: React.Ref<HTMLDivElement>
		) => (
			<div
				className={className}
				data-testid="command-root"
				ref={ref}
				{...props}
			>
				{children}
			</div>
		)
	);

	// Assign the sub-components
	Object.assign(mockCommandMain, {
		Input: mockCommandInput,
		List: mockCommandList,
		Empty: mockCommandEmpty,
		Group: mockCommandGroup,
		Item: mockCommandItem,
		Separator: mockCommandSeparator,
		displayName: "Command",
	});

	return {
		Command: mockCommandMain,
	};
});

// Mock dialog components
vi.mock("@/components/ui/dialog", () => ({
	Dialog: ({
		children,
		...props
	}: {
		children?: React.ReactNode;
		[key: string]: unknown;
	}) => (
		<div data-testid="dialog" {...props}>
			{children}
		</div>
	),
	DialogContent: ({
		children,
		className,
		...props
	}: {
		children?: React.ReactNode;
		className?: string;
		[key: string]: unknown;
	}) => (
		<div className={className} data-testid="dialog-content" {...props}>
			{children}
		</div>
	),
}));

describe("Command", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("Command Component", () => {
		it("should render the command component", () => {
			render(<Command>Test Content</Command>);

			expect(screen.getByTestId("command-root")).toBeInTheDocument();
			expect(screen.getByText("Test Content")).toBeInTheDocument();
		});

		it("should apply custom className", () => {
			render(<Command className="custom-class">Content</Command>);

			const command = screen.getByTestId("command-root");
			expect(command).toHaveClass("custom-class");
		});

		it("should apply default styles", () => {
			render(<Command>Content</Command>);

			const command = screen.getByTestId("command-root");
			expect(command.className).toContain("flex");
			expect(command.className).toContain("h-full");
			expect(command.className).toContain("w-full");
			expect(command.className).toContain("flex-col");
			expect(command.className).toContain("overflow-hidden");
			expect(command.className).toContain("rounded-md");
			expect(command.className).toContain("bg-popover");
			expect(command.className).toContain("text-popover-foreground");
		});

		it("should forward props", () => {
			render(<Command data-custom="test">Content</Command>);

			const command = screen.getByTestId("command-root");
			expect(command).toHaveAttribute("data-custom", "test");
		});

		it("should forward ref", () => {
			const ref = React.createRef<HTMLDivElement>();
			render(<Command ref={ref}>Content</Command>);

			expect(ref.current).toBeTruthy();
			expect(ref.current).toBe(screen.getByTestId("command-root"));
		});
	});

	describe("CommandDialog Component", () => {
		it("should render dialog with command", () => {
			render(
				<CommandDialog>
					<div>Dialog Content</div>
				</CommandDialog>
			);

			expect(screen.getByTestId("dialog")).toBeInTheDocument();
			expect(screen.getByTestId("dialog-content")).toBeInTheDocument();
			expect(screen.getByTestId("command-root")).toBeInTheDocument();
			expect(screen.getByText("Dialog Content")).toBeInTheDocument();
		});

		it("should apply special styles to dialog content", () => {
			render(
				<CommandDialog>
					<div>Content</div>
				</CommandDialog>
			);

			const dialogContent = screen.getByTestId("dialog-content");
			expect(dialogContent).toHaveClass("overflow-hidden", "p-0", "shadow-lg");
		});

		it("should pass dialog props", () => {
			const onOpenChange = vi.fn();
			render(
				<CommandDialog onOpenChange={onOpenChange} open={true}>
					<div>Content</div>
				</CommandDialog>
			);

			const dialog = screen.getByTestId("dialog");
			// The mock implementation sets open as a boolean attribute
			expect(dialog).toHaveAttribute("open");
		});

		it("should apply command-specific styles", () => {
			render(
				<CommandDialog>
					<div>Content</div>
				</CommandDialog>
			);

			const command = screen.getByTestId("command-root");
			expect(command.className).toContain("**:[[cmdk-group-heading]]:px-2");
		});
	});

	describe("CommandInput Component", () => {
		it("should render input with search icon", () => {
			const { container } = render(<CommandInput placeholder="Search..." />);

			const input = screen.getByTestId("command-input");
			expect(input).toBeInTheDocument();
			expect(input).toHaveAttribute("placeholder", "Search...");

			// Check for search icon
			const searchIcon = container.querySelector(".lucide-search");
			expect(searchIcon).toBeInTheDocument();
		});

		it("should have wrapper with border", () => {
			const { container } = render(<CommandInput />);

			const wrapper = container.querySelector(".flex.items-center.border-b");
			expect(wrapper).toBeInTheDocument();
			expect(wrapper).toHaveAttribute("cmdk-input-wrapper", "");
		});

		it("should apply custom className to input", () => {
			render(<CommandInput className="custom-input" />);

			const input = screen.getByTestId("command-input");
			expect(input).toHaveClass("custom-input");
		});

		it("should apply default input styles", () => {
			render(<CommandInput />);

			const input = screen.getByTestId("command-input");
			expect(input.className).toContain("flex");
			expect(input.className).toContain("h-11");
			expect(input.className).toContain("w-full");
			expect(input.className).toContain("rounded-md");
			expect(input.className).toContain("bg-transparent");
			expect(input.className).toContain("outline-hidden");
		});

		it("should handle disabled state", () => {
			render(<CommandInput disabled />);

			const input = screen.getByTestId("command-input");
			expect(input).toBeDisabled();
		});

		it("should forward ref", () => {
			const ref = React.createRef<HTMLInputElement>();
			render(<CommandInput ref={ref} />);

			expect(ref.current).toBeTruthy();
			expect(ref.current).toBe(screen.getByTestId("command-input"));
		});

		it("should style search icon", () => {
			const { container } = render(<CommandInput />);

			const searchIcon = container.querySelector(".lucide-search");
			expect(searchIcon).toHaveClass(
				"mr-2",
				"h-4",
				"w-4",
				"shrink-0",
				"opacity-50"
			);
		});
	});

	describe("CommandList Component", () => {
		it("should render list with content", () => {
			render(
				<CommandList>
					<div>List Content</div>
				</CommandList>
			);

			const list = screen.getByTestId("command-list");
			expect(list).toBeInTheDocument();
			expect(screen.getByText("List Content")).toBeInTheDocument();
		});

		it("should apply scrollable styles", () => {
			render(<CommandList />);

			const list = screen.getByTestId("command-list");
			expect(list).toHaveClass(
				"max-h-[300px]",
				"overflow-y-auto",
				"overflow-x-hidden"
			);
		});

		it("should apply custom className", () => {
			render(<CommandList className="custom-list" />);

			const list = screen.getByTestId("command-list");
			expect(list).toHaveClass("custom-list");
		});

		it("should forward ref", () => {
			const ref = React.createRef<HTMLDivElement>();
			render(<CommandList ref={ref} />);

			expect(ref.current).toBeTruthy();
			expect(ref.current).toBe(screen.getByTestId("command-list"));
		});
	});

	describe("CommandEmpty Component", () => {
		it("should render empty state", () => {
			render(<CommandEmpty>No results found</CommandEmpty>);

			const empty = screen.getByTestId("command-empty");
			expect(empty).toBeInTheDocument();
			expect(screen.getByText("No results found")).toBeInTheDocument();
		});

		it("should apply empty state styles", () => {
			render(<CommandEmpty />);

			const empty = screen.getByTestId("command-empty");
			expect(empty).toHaveClass("py-6", "text-center", "text-sm");
		});

		it("should forward props", () => {
			render(<CommandEmpty data-empty="true" />);

			const empty = screen.getByTestId("command-empty");
			expect(empty).toHaveAttribute("data-empty", "true");
		});
	});

	describe("CommandGroup Component", () => {
		it("should render group with content", () => {
			render(
				<CommandGroup>
					<div>Group Content</div>
				</CommandGroup>
			);

			const group = screen.getByTestId("command-group");
			expect(group).toBeInTheDocument();
			expect(screen.getByText("Group Content")).toBeInTheDocument();
		});

		it("should apply group styles", () => {
			render(<CommandGroup />);

			const group = screen.getByTestId("command-group");
			expect(group.className).toContain("overflow-hidden");
			expect(group.className).toContain("p-1");
			expect(group.className).toContain("text-foreground");
		});

		it("should apply custom className", () => {
			render(<CommandGroup className="custom-group" />);

			const group = screen.getByTestId("command-group");
			expect(group).toHaveClass("custom-group");
		});

		it("should include heading styles", () => {
			render(<CommandGroup />);

			const group = screen.getByTestId("command-group");
			expect(group.className).toContain("**:[[cmdk-group-heading]]:px-2");
			expect(group.className).toContain("**:[[cmdk-group-heading]]:py-1.5");
			expect(group.className).toContain("**:[[cmdk-group-heading]]:font-medium");
		});
	});

	describe("CommandItem Component", () => {
		it("should render item with content", () => {
			render(
				<CommandItem>
					<span>Item Content</span>
				</CommandItem>
			);

			const item = screen.getByTestId("command-item");
			expect(item).toBeInTheDocument();
			expect(screen.getByText("Item Content")).toBeInTheDocument();
		});

		it("should render as a button", () => {
			render(<CommandItem>Item</CommandItem>);

			const item = screen.getByRole("button");
			expect(item).toBeInTheDocument();
			expect(item).toHaveAttribute("type", "button");
		});

		it("should apply item styles", () => {
			render(<CommandItem />);

			const item = screen.getByTestId("command-item");
			expect(item.className).toContain("relative");
			expect(item.className).toContain("flex");
			expect(item.className).toContain("cursor-default");
			expect(item.className).toContain("select-none");
			expect(item.className).toContain("items-center");
			expect(item.className).toContain("rounded-sm");
			expect(item.className).toContain("px-2");
			expect(item.className).toContain("py-1.5");
			expect(item.className).toContain("text-sm");
		});

		it("should apply data attribute styles", () => {
			render(<CommandItem />);

			const item = screen.getByTestId("command-item");
			expect(item.className).toContain(
				"data-[disabled=true]:pointer-events-none"
			);
			expect(item.className).toContain("data-[selected='true']:bg-accent");
			expect(item.className).toContain("data-[disabled=true]:opacity-50");
		});

		it("should handle onClick", async () => {
			const user = userEvent.setup();
			const onClick = vi.fn();

			render(<CommandItem onClick={onClick}>Click me</CommandItem>);

			const item = screen.getByTestId("command-item");
			await user.click(item);

			expect(onClick).toHaveBeenCalled();
		});
	});

	describe("CommandSeparator Component", () => {
		it("should render separator", () => {
			render(<CommandSeparator />);

			const separator = screen.getByTestId("command-separator");
			expect(separator).toBeInTheDocument();
		});

		it("should apply separator styles", () => {
			render(<CommandSeparator />);

			const separator = screen.getByTestId("command-separator");
			expect(separator).toHaveClass("-mx-1", "h-px", "bg-border");
		});

		it("should apply custom className", () => {
			render(<CommandSeparator className="custom-separator" />);

			const separator = screen.getByTestId("command-separator");
			expect(separator).toHaveClass("custom-separator");
		});
	});

	describe("CommandShortcut Component", () => {
		it("should render shortcut text", () => {
			render(<CommandShortcut>⌘K</CommandShortcut>);

			expect(screen.getByText("⌘K")).toBeInTheDocument();
		});

		it("should apply shortcut styles", () => {
			render(<CommandShortcut>⌘K</CommandShortcut>);

			const shortcut = screen.getByText("⌘K");
			expect(shortcut).toHaveClass(
				"ml-auto",
				"text-muted-foreground",
				"text-xs",
				"tracking-widest"
			);
		});

		it("should apply custom className", () => {
			render(<CommandShortcut className="custom-shortcut">⌘K</CommandShortcut>);

			const shortcut = screen.getByText("⌘K");
			expect(shortcut).toHaveClass("custom-shortcut");
		});

		it("should be a span element", () => {
			render(<CommandShortcut>⌘K</CommandShortcut>);

			const shortcut = screen.getByText("⌘K");
			expect(shortcut.tagName).toBe("SPAN");
		});

		it("should accept HTML attributes", () => {
			render(
				<CommandShortcut data-shortcut="cmd-k" id="shortcut-1">
					⌘K
				</CommandShortcut>
			);

			const shortcut = screen.getByText("⌘K");
			expect(shortcut).toHaveAttribute("id", "shortcut-1");
			expect(shortcut).toHaveAttribute("data-shortcut", "cmd-k");
		});
	});

	describe("Integration Tests", () => {
		it("should render complete command palette", () => {
			render(
				<Command>
					<CommandInput placeholder="Type a command..." />
					<CommandList>
						<CommandEmpty>No results found.</CommandEmpty>
						<CommandGroup heading="Suggestions">
							<CommandItem>
								<span>Calendar</span>
								<CommandShortcut>⌘C</CommandShortcut>
							</CommandItem>
							<CommandItem>
								<span>Search Emoji</span>
								<CommandShortcut>⌘E</CommandShortcut>
							</CommandItem>
						</CommandGroup>
						<CommandSeparator />
						<CommandGroup heading="Settings">
							<CommandItem>
								<span>Profile</span>
								<CommandShortcut>⌘P</CommandShortcut>
							</CommandItem>
						</CommandGroup>
					</CommandList>
				</Command>
			);

			// Check all components are rendered
			expect(screen.getByTestId("command-root")).toBeInTheDocument();
			expect(screen.getByTestId("command-input")).toBeInTheDocument();
			expect(screen.getByTestId("command-list")).toBeInTheDocument();
			expect(screen.getByTestId("command-empty")).toBeInTheDocument();
			expect(screen.getAllByTestId("command-group")).toHaveLength(2);
			expect(screen.getAllByTestId("command-item")).toHaveLength(3);
			expect(screen.getByTestId("command-separator")).toBeInTheDocument();

			// Check content
			expect(
				screen.getByPlaceholderText("Type a command...")
			).toBeInTheDocument();
			expect(screen.getByText("No results found.")).toBeInTheDocument();
			expect(screen.getByText("Calendar")).toBeInTheDocument();
			expect(screen.getByText("⌘C")).toBeInTheDocument();
		});

		it("should render command dialog with content", () => {
			render(
				<CommandDialog open>
					<CommandInput placeholder="Search..." />
					<CommandList>
						<CommandItem>Option 1</CommandItem>
						<CommandItem>Option 2</CommandItem>
					</CommandList>
				</CommandDialog>
			);

			expect(screen.getByTestId("dialog")).toBeInTheDocument();
			expect(screen.getByTestId("command-root")).toBeInTheDocument();
			expect(screen.getByPlaceholderText("Search...")).toBeInTheDocument();
			expect(screen.getByText("Option 1")).toBeInTheDocument();
			expect(screen.getByText("Option 2")).toBeInTheDocument();
		});
	});

	describe("Display Names", () => {
		it("should have correct display names", () => {
			expect(Command.displayName).toBe("Command");
			expect(CommandShortcut.displayName).toBe("CommandShortcut");
		});
	});
});
