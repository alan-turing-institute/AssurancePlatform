import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	Sheet,
	SheetClose,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetOverlay,
	SheetPortal,
	SheetTitle,
	SheetTrigger,
} from "../sheet";

// Mock Radix UI dialog primitives
vi.mock("@radix-ui/react-dialog", () => {
	const ReactLib = React;

	const mockRoot = ({
		children,
		...props
	}: {
		children?: React.ReactNode;
		[key: string]: unknown;
	}) => (
		<div data-testid="sheet-root" {...props}>
			{children}
		</div>
	);

	const mockTrigger = ReactLib.forwardRef<
		HTMLButtonElement,
		React.ButtonHTMLAttributes<HTMLButtonElement> & {
			children?: React.ReactNode;
			onClick?: () => void;
		}
	>(
		(
			{
				children,
				onClick,
				...props
			}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
				children?: React.ReactNode;
				onClick?: () => void;
			},
			ref: React.Ref<HTMLButtonElement>
		) => (
			<button
				data-testid="sheet-trigger"
				onClick={onClick}
				ref={ref}
				{...props}
			>
				{children}
			</button>
		)
	);

	const mockClose = ReactLib.forwardRef<
		HTMLButtonElement,
		React.ButtonHTMLAttributes<HTMLButtonElement> & {
			children?: React.ReactNode;
			className?: string;
			onClick?: () => void;
		}
	>(
		(
			{
				children,
				className,
				onClick,
				...props
			}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
				children?: React.ReactNode;
				className?: string;
				onClick?: () => void;
			},
			ref: React.Ref<HTMLButtonElement>
		) => (
			<button
				className={className}
				data-testid="sheet-close"
				onClick={onClick}
				ref={ref}
				{...props}
			>
				{children}
			</button>
		)
	);

	const mockPortal = ({ children }: { children?: React.ReactNode }) => (
		<div data-testid="sheet-portal">{children}</div>
	);

	const mockOverlay = ReactLib.forwardRef<
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
				data-testid="sheet-overlay"
				ref={ref}
				{...props}
			/>
		)
	);
	mockOverlay.displayName = "DialogOverlay";

	const mockContent = ReactLib.forwardRef<
		HTMLDivElement,
		React.HTMLAttributes<HTMLDivElement> & {
			children?: React.ReactNode;
			className?: string;
		}
	>(
		(
			{
				children,
				className,
				...props
			}: React.HTMLAttributes<HTMLDivElement> & {
				children?: React.ReactNode;
				className?: string;
			},
			ref: React.Ref<HTMLDivElement>
		) => (
			<div
				className={className}
				data-testid="sheet-content"
				ref={ref}
				{...props}
			>
				{children}
			</div>
		)
	);
	mockContent.displayName = "DialogContent";

	const mockTitle = ReactLib.forwardRef<
		HTMLHeadingElement,
		React.HTMLAttributes<HTMLHeadingElement> & {
			children?: React.ReactNode;
			className?: string;
		}
	>(
		(
			{
				children,
				className,
				...props
			}: React.HTMLAttributes<HTMLHeadingElement> & {
				children?: React.ReactNode;
				className?: string;
			},
			ref: React.Ref<HTMLHeadingElement>
		) => (
			<h2 className={className} data-testid="sheet-title" ref={ref} {...props}>
				{children}
			</h2>
		)
	);
	mockTitle.displayName = "DialogTitle";

	const mockDescription = ReactLib.forwardRef<
		HTMLParagraphElement,
		React.HTMLAttributes<HTMLParagraphElement> & {
			children?: React.ReactNode;
			className?: string;
		}
	>(
		(
			{
				children,
				className,
				...props
			}: React.HTMLAttributes<HTMLParagraphElement> & {
				children?: React.ReactNode;
				className?: string;
			},
			ref: React.Ref<HTMLParagraphElement>
		) => (
			<p
				className={className}
				data-testid="sheet-description"
				ref={ref}
				{...props}
			>
				{children}
			</p>
		)
	);
	mockDescription.displayName = "DialogDescription";

	return {
		Root: mockRoot,
		Trigger: mockTrigger,
		Close: mockClose,
		Portal: mockPortal,
		Overlay: mockOverlay,
		Content: mockContent,
		Title: mockTitle,
		Description: mockDescription,
	};
});

// Mock class-variance-authority
vi.mock("class-variance-authority", () => ({
	cva:
		(
			base: string,
			config?: {
				defaultVariants?: { side?: string };
				variants?: { side?: Record<string, string> };
			}
		) =>
		(props?: { side?: string }) => {
			const variant = props?.side || config?.defaultVariants?.side || "right";
			const variantClasses = config?.variants?.side?.[variant] || "";
			return `${base} ${variantClasses}`.trim();
		},
}));

describe("Sheet", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("Sheet Component", () => {
		it("should render sheet root", () => {
			render(
				<Sheet>
					<div>Sheet content</div>
				</Sheet>
			);

			expect(screen.getByTestId("sheet-root")).toBeInTheDocument();
			expect(screen.getByText("Sheet content")).toBeInTheDocument();
		});

		it("should pass props to root", () => {
			render(
				<Sheet onOpenChange={vi.fn()} open={true}>
					<div>Content</div>
				</Sheet>
			);

			const root = screen.getByTestId("sheet-root");
			// The mock implementation sets open as a boolean attribute
			expect(root).toHaveAttribute("open");
		});
	});

	describe("SheetTrigger Component", () => {
		it("should render trigger button", () => {
			render(
				<Sheet>
					<SheetTrigger>Open Sheet</SheetTrigger>
				</Sheet>
			);

			expect(screen.getByTestId("sheet-trigger")).toBeInTheDocument();
			expect(screen.getByText("Open Sheet")).toBeInTheDocument();
		});

		it("should handle click events", async () => {
			const user = userEvent.setup();
			const onClick = vi.fn();

			render(
				<Sheet>
					<SheetTrigger onClick={onClick}>Click me</SheetTrigger>
				</Sheet>
			);

			await user.click(screen.getByTestId("sheet-trigger"));
			expect(onClick).toHaveBeenCalled();
		});

		it("should forward ref", () => {
			const ref = React.createRef<HTMLButtonElement>();
			render(
				<Sheet>
					<SheetTrigger ref={ref}>Trigger</SheetTrigger>
				</Sheet>
			);

			expect(ref.current).toBeTruthy();
			expect(ref.current).toBe(screen.getByTestId("sheet-trigger"));
		});
	});

	describe("SheetContent Component", () => {
		it("should render content with overlay", () => {
			render(
				<Sheet>
					<SheetContent>
						<div>Sheet body content</div>
					</SheetContent>
				</Sheet>
			);

			expect(screen.getByTestId("sheet-portal")).toBeInTheDocument();
			expect(screen.getByTestId("sheet-overlay")).toBeInTheDocument();
			expect(screen.getByTestId("sheet-content")).toBeInTheDocument();
			expect(screen.getByText("Sheet body content")).toBeInTheDocument();
		});

		it("should render close button", () => {
			const { container } = render(
				<Sheet>
					<SheetContent>Content</SheetContent>
				</Sheet>
			);

			const closeButton = screen.getByTestId("sheet-close");
			expect(closeButton).toBeInTheDocument();
			expect(closeButton).toHaveClass("absolute", "top-4", "right-4");

			// Check for X icon
			const xIcon = container.querySelector(".lucide-x");
			expect(xIcon).toBeInTheDocument();

			// Check for screen reader text
			expect(screen.getByText("Close")).toHaveClass("sr-only");
		});

		it("should apply default side variant (right)", () => {
			render(
				<Sheet>
					<SheetContent>Content</SheetContent>
				</Sheet>
			);

			const content = screen.getByTestId("sheet-content");
			expect(content.className).toContain(
				"data-[state=closed]:slide-out-to-right"
			);
			expect(content.className).toContain(
				"data-[state=open]:slide-in-from-right"
			);
		});

		it("should apply different side variants", () => {
			const { rerender } = render(
				<Sheet>
					<SheetContent side="left">Content</SheetContent>
				</Sheet>
			);

			let content = screen.getByTestId("sheet-content");
			expect(content.className).toContain(
				"data-[state=closed]:slide-out-to-left"
			);
			expect(content.className).toContain(
				"data-[state=open]:slide-in-from-left"
			);

			rerender(
				<Sheet>
					<SheetContent side="top">Content</SheetContent>
				</Sheet>
			);

			content = screen.getByTestId("sheet-content");
			expect(content.className).toContain(
				"data-[state=closed]:slide-out-to-top"
			);
			expect(content.className).toContain(
				"data-[state=open]:slide-in-from-top"
			);

			rerender(
				<Sheet>
					<SheetContent side="bottom">Content</SheetContent>
				</Sheet>
			);

			content = screen.getByTestId("sheet-content");
			expect(content.className).toContain(
				"data-[state=closed]:slide-out-to-bottom"
			);
			expect(content.className).toContain(
				"data-[state=open]:slide-in-from-bottom"
			);
		});

		it("should apply custom className", () => {
			render(
				<Sheet>
					<SheetContent className="custom-sheet">Content</SheetContent>
				</Sheet>
			);

			const content = screen.getByTestId("sheet-content");
			expect(content).toHaveClass("custom-sheet");
		});

		it("should forward ref", () => {
			const ref = React.createRef<HTMLDivElement>();
			render(
				<Sheet>
					<SheetContent ref={ref}>Content</SheetContent>
				</Sheet>
			);

			expect(ref.current).toBeTruthy();
			expect(ref.current).toBe(screen.getByTestId("sheet-content"));
		});
	});

	describe("SheetOverlay Component", () => {
		it("should render overlay with styles", () => {
			render(<SheetOverlay />);

			const overlay = screen.getByTestId("sheet-overlay");
			expect(overlay).toBeInTheDocument();
			expect(overlay.className).toContain("fixed");
			expect(overlay.className).toContain("inset-0");
			expect(overlay.className).toContain("z-50");
			expect(overlay.className).toContain("bg-black/80");
		});

		it("should apply animation classes", () => {
			render(<SheetOverlay />);

			const overlay = screen.getByTestId("sheet-overlay");
			expect(overlay.className).toContain("data-[state=closed]:fade-out-0");
			expect(overlay.className).toContain("data-[state=open]:fade-in-0");
			expect(overlay.className).toContain("data-[state=closed]:animate-out");
			expect(overlay.className).toContain("data-[state=open]:animate-in");
		});

		it("should apply custom className", () => {
			render(<SheetOverlay className="custom-overlay" />);

			const overlay = screen.getByTestId("sheet-overlay");
			expect(overlay).toHaveClass("custom-overlay");
		});
	});

	describe("SheetHeader Component", () => {
		it("should render header", () => {
			render(
				<SheetHeader>
					<div>Header Content</div>
				</SheetHeader>
			);

			const header = screen.getByText("Header Content").parentElement;
			expect(header).toBeInTheDocument();
			expect(header).toHaveClass(
				"flex",
				"flex-col",
				"space-y-2",
				"text-center",
				"sm:text-left"
			);
		});

		it("should apply custom className", () => {
			const { container } = render(
				<SheetHeader className="custom-header">
					<span>Content</span>
				</SheetHeader>
			);

			const header = container.querySelector(".custom-header");
			expect(header).toBeInTheDocument();
			expect(header).toHaveClass(
				"flex",
				"flex-col",
				"space-y-2",
				"custom-header"
			);
		});

		it("should accept HTML attributes", () => {
			const { container } = render(
				<SheetHeader data-test="header" id="sheet-header">
					<span>Content</span>
				</SheetHeader>
			);

			const header = container.querySelector("#sheet-header");
			expect(header).toBeInTheDocument();
			expect(header).toHaveAttribute("data-test", "header");
		});
	});

	describe("SheetFooter Component", () => {
		it("should render footer", () => {
			render(
				<SheetFooter>
					<button type="button">Cancel</button>
					<button type="button">Save</button>
				</SheetFooter>
			);

			const footer = screen.getByText("Cancel").parentElement;
			expect(footer).toBeInTheDocument();
			expect(footer).toHaveClass(
				"flex",
				"flex-col-reverse",
				"sm:flex-row",
				"sm:justify-end",
				"sm:space-x-2"
			);
		});

		it("should apply custom className", () => {
			render(
				<SheetFooter className="custom-footer">
					<button type="button">Action</button>
				</SheetFooter>
			);

			const footer = screen.getByText("Action").parentElement;
			expect(footer).toHaveClass("custom-footer");
		});
	});

	describe("SheetTitle Component", () => {
		it("should render title", () => {
			render(<SheetTitle>Sheet Title</SheetTitle>);

			const title = screen.getByTestId("sheet-title");
			expect(title).toBeInTheDocument();
			expect(title).toHaveTextContent("Sheet Title");
			expect(title.tagName).toBe("H2");
		});

		it("should apply title styles", () => {
			render(<SheetTitle>Title</SheetTitle>);

			const title = screen.getByTestId("sheet-title");
			expect(title).toHaveClass("font-semibold", "text-foreground", "text-lg");
		});

		it("should apply custom className", () => {
			render(<SheetTitle className="custom-title">Title</SheetTitle>);

			const title = screen.getByTestId("sheet-title");
			expect(title).toHaveClass("custom-title");
		});

		it("should forward ref", () => {
			const ref = React.createRef<HTMLHeadingElement>();
			render(<SheetTitle ref={ref}>Title</SheetTitle>);

			expect(ref.current).toBeTruthy();
			expect(ref.current).toBe(screen.getByTestId("sheet-title"));
		});
	});

	describe("SheetDescription Component", () => {
		it("should render description", () => {
			render(<SheetDescription>Sheet description text</SheetDescription>);

			const description = screen.getByTestId("sheet-description");
			expect(description).toBeInTheDocument();
			expect(description).toHaveTextContent("Sheet description text");
			expect(description.tagName).toBe("P");
		});

		it("should apply description styles", () => {
			render(<SheetDescription>Description</SheetDescription>);

			const description = screen.getByTestId("sheet-description");
			expect(description).toHaveClass("text-muted-foreground", "text-sm");
		});

		it("should apply custom className", () => {
			render(
				<SheetDescription className="custom-desc">Description</SheetDescription>
			);

			const description = screen.getByTestId("sheet-description");
			expect(description).toHaveClass("custom-desc");
		});
	});

	describe("SheetClose Component", () => {
		it("should render close button", () => {
			render(
				<Sheet>
					<SheetClose>Close Sheet</SheetClose>
				</Sheet>
			);

			expect(screen.getByTestId("sheet-close")).toBeInTheDocument();
			expect(screen.getByText("Close Sheet")).toBeInTheDocument();
		});

		it("should handle click events", async () => {
			const user = userEvent.setup();
			const onClick = vi.fn();

			render(
				<Sheet>
					<SheetClose onClick={onClick}>Close</SheetClose>
				</Sheet>
			);

			await user.click(screen.getByTestId("sheet-close"));
			expect(onClick).toHaveBeenCalled();
		});
	});

	describe("SheetPortal Component", () => {
		it("should render portal", () => {
			render(
				<SheetPortal>
					<div>Portal Content</div>
				</SheetPortal>
			);

			expect(screen.getByTestId("sheet-portal")).toBeInTheDocument();
			expect(screen.getByText("Portal Content")).toBeInTheDocument();
		});
	});

	describe("Integration Tests", () => {
		it("should render complete sheet with all parts", () => {
			render(
				<Sheet>
					<SheetTrigger>Open</SheetTrigger>
					<SheetContent>
						<SheetHeader>
							<SheetTitle>Edit Profile</SheetTitle>
							<SheetDescription>
								Make changes to your profile here.
							</SheetDescription>
						</SheetHeader>
						<div>
							<label htmlFor="name-input">Name</label>
							<input id="name-input" type="text" />
						</div>
						<SheetFooter>
							<SheetClose>Cancel</SheetClose>
							<button type="button">Save changes</button>
						</SheetFooter>
					</SheetContent>
				</Sheet>
			);

			// Check all components are rendered
			expect(screen.getByTestId("sheet-root")).toBeInTheDocument();
			expect(screen.getByTestId("sheet-trigger")).toBeInTheDocument();
			expect(screen.getByTestId("sheet-content")).toBeInTheDocument();
			expect(screen.getByTestId("sheet-title")).toBeInTheDocument();
			expect(screen.getByTestId("sheet-description")).toBeInTheDocument();

			// Check content
			expect(screen.getByText("Open")).toBeInTheDocument();
			expect(screen.getByText("Edit Profile")).toBeInTheDocument();
			expect(
				screen.getByText("Make changes to your profile here.")
			).toBeInTheDocument();
			expect(screen.getByText("Cancel")).toBeInTheDocument();
			expect(screen.getByText("Save changes")).toBeInTheDocument();
		});

		it("should render sheet from different sides", () => {
			const sides = ["top", "right", "bottom", "left"] as const;

			for (const side of sides) {
				const { unmount } = render(
					<Sheet>
						<SheetContent side={side}>
							<SheetTitle>{side} Sheet</SheetTitle>
						</SheetContent>
					</Sheet>
				);

				const content = screen.getByTestId("sheet-content");
				expect(content.className).toContain(`slide-out-to-${side}`);
				expect(content.className).toContain(`slide-in-from-${side}`);

				unmount();
			}
		});
	});

	describe("Display Names", () => {
		it("should have correct display names", () => {
			expect(SheetHeader.displayName).toBe("SheetHeader");
			expect(SheetFooter.displayName).toBe("SheetFooter");
		});
	});

	describe("Accessibility", () => {
		it("should have sr-only close text", () => {
			render(
				<Sheet>
					<SheetContent>Content</SheetContent>
				</Sheet>
			);

			const srOnlyText = screen.getByText("Close");
			expect(srOnlyText).toHaveClass("sr-only");
		});

		it("should render semantic elements", () => {
			render(
				<Sheet>
					<SheetContent>
						<SheetTitle>Title</SheetTitle>
						<SheetDescription>Description</SheetDescription>
					</SheetContent>
				</Sheet>
			);

			expect(screen.getByTestId("sheet-title").tagName).toBe("H2");
			expect(screen.getByTestId("sheet-description").tagName).toBe("P");
		});
	});
});
