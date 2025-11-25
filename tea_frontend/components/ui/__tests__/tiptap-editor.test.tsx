import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEditor } from "@tiptap/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TiptapEditor from "../tiptap-editor";

// Mock Tiptap dependencies
const mockEditor = {
	isActive: vi.fn(),
	chain: vi.fn(),
	getHTML: vi.fn(),
	destroy: vi.fn(),
};

const mockChain = {
	focus: vi.fn().mockReturnThis(),
	toggleBold: vi.fn().mockReturnThis(),
	toggleItalic: vi.fn().mockReturnThis(),
	toggleStrike: vi.fn().mockReturnThis(),
	setTextAlign: vi.fn().mockReturnThis(),
	toggleBulletList: vi.fn().mockReturnThis(),
	toggleOrderedList: vi.fn().mockReturnThis(),
	toggleBlockquote: vi.fn().mockReturnThis(),
	toggleHeading: vi.fn().mockReturnThis(),
	run: vi.fn(),
};

mockEditor.chain.mockReturnValue(mockChain);

vi.mock("@tiptap/react", () => ({
	useEditor: vi.fn(() => mockEditor),
	EditorContent: ({ className }: { editor?: unknown; className?: string }) => (
		<div className={className} contentEditable data-testid="editor-content">
			Editor Content
		</div>
	),
}));

const mockUseEditor = vi.mocked(useEditor);

// Mock the extensions
vi.mock("@tiptap/starter-kit", () => ({
	default: {
		configure: vi.fn(() => ({})),
	},
}));

vi.mock("@tiptap/extension-color", () => ({
	default: {},
}));

vi.mock("@tiptap/extension-list-item", () => ({
	default: {},
}));

vi.mock("@tiptap/extension-placeholder", () => ({
	default: {
		configure: vi.fn(() => ({})),
	},
}));

vi.mock("@tiptap/extension-text-align", () => ({
	default: {
		configure: vi.fn(() => ({})),
	},
}));

vi.mock("@tiptap/extension-text-style", () => ({
	default: {},
}));

describe("TiptapEditor", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockEditor.getHTML.mockReturnValue("<p>Test content</p>");
	});

	describe("Component Rendering", () => {
		it("should render the editor component", () => {
			render(<TiptapEditor />);

			expect(screen.getByTestId("editor-content")).toBeInTheDocument();
		});

		it("should render with custom className", () => {
			const { container } = render(<TiptapEditor className="custom-class" />);

			const wrapper = container.querySelector(".custom-class");
			expect(wrapper).toBeInTheDocument();
		});

		it("should render with default placeholder", () => {
			render(<TiptapEditor />);

			const editorConfig = mockUseEditor.mock.calls[0]?.[0];
			expect(editorConfig?.extensions).toBeDefined();
			expect(editorConfig?.extensions?.length).toBeGreaterThan(0);
		});

		it("should render with custom placeholder", () => {
			const customPlaceholder = "Write your story here...";

			render(<TiptapEditor placeholder={customPlaceholder} />);

			const editorConfig = mockUseEditor.mock.calls[0]?.[0];
			expect(editorConfig).toBeDefined();
		});

		it("should initialize with provided value", () => {
			const initialValue = "<p>Initial content</p>";

			render(<TiptapEditor value={initialValue} />);

			const editorConfig = mockUseEditor.mock.calls[0]?.[0];
			expect(editorConfig?.content).toBe(initialValue);
		});

		it("should return null if editor is not initialized", () => {
			mockUseEditor.mockReturnValueOnce(null);

			const { container } = render(<TiptapEditor />);

			expect(container.firstChild).toBeNull();
		});
	});

	describe("Toolbar Rendering", () => {
		it("should render all toolbar buttons", () => {
			render(<TiptapEditor />);

			expect(screen.getByTitle("Bold")).toBeInTheDocument();
			expect(screen.getByTitle("Italic")).toBeInTheDocument();
			expect(screen.getByTitle("Strikethrough")).toBeInTheDocument();
			expect(screen.getByTitle("Align Left")).toBeInTheDocument();
			expect(screen.getByTitle("Align Center")).toBeInTheDocument();
			expect(screen.getByTitle("Align Right")).toBeInTheDocument();
			expect(screen.getByTitle("Bullet List")).toBeInTheDocument();
			expect(screen.getByTitle("Ordered List")).toBeInTheDocument();
			expect(screen.getByTitle("Quote")).toBeInTheDocument();
			expect(screen.getByTitle("Heading 1")).toBeInTheDocument();
			expect(screen.getByTitle("Heading 2")).toBeInTheDocument();
			expect(screen.getByTitle("Heading 3")).toBeInTheDocument();
		});

		it("should render toolbar separators", () => {
			const { container } = render(<TiptapEditor />);

			const separators = container.querySelectorAll(".h-6.w-px.bg-border");
			expect(separators.length).toBeGreaterThan(0);
		});

		it("should style active buttons", () => {
			mockEditor.isActive.mockImplementation((type: string) => type === "bold");

			render(<TiptapEditor />);

			const boldButton = screen.getByTitle("Bold");
			expect(boldButton).toHaveClass("bg-muted");
		});
	});

	describe("Text Formatting", () => {
		it("should toggle bold formatting", async () => {
			const user = userEvent.setup();
			render(<TiptapEditor />);

			const boldButton = screen.getByTitle("Bold");
			await user.click(boldButton);

			expect(mockChain.focus).toHaveBeenCalled();
			expect(mockChain.toggleBold).toHaveBeenCalled();
			expect(mockChain.run).toHaveBeenCalled();
		});

		it("should toggle italic formatting", async () => {
			const user = userEvent.setup();
			render(<TiptapEditor />);

			const italicButton = screen.getByTitle("Italic");
			await user.click(italicButton);

			expect(mockChain.toggleItalic).toHaveBeenCalled();
		});

		it("should toggle strikethrough formatting", async () => {
			const user = userEvent.setup();
			render(<TiptapEditor />);

			const strikeButton = screen.getByTitle("Strikethrough");
			await user.click(strikeButton);

			expect(mockChain.toggleStrike).toHaveBeenCalled();
		});
	});

	describe("Text Alignment", () => {
		it("should align text left", async () => {
			const user = userEvent.setup();
			render(<TiptapEditor />);

			const alignLeftButton = screen.getByTitle("Align Left");
			await user.click(alignLeftButton);

			expect(mockChain.setTextAlign).toHaveBeenCalledWith("left");
		});

		it("should align text center", async () => {
			const user = userEvent.setup();
			render(<TiptapEditor />);

			const alignCenterButton = screen.getByTitle("Align Center");
			await user.click(alignCenterButton);

			expect(mockChain.setTextAlign).toHaveBeenCalledWith("center");
		});

		it("should align text right", async () => {
			const user = userEvent.setup();
			render(<TiptapEditor />);

			const alignRightButton = screen.getByTitle("Align Right");
			await user.click(alignRightButton);

			expect(mockChain.setTextAlign).toHaveBeenCalledWith("right");
		});

		it("should show active alignment state", () => {
			mockEditor.isActive.mockImplementation(
				(options: { textAlign?: string }) => options?.textAlign === "center"
			);

			render(<TiptapEditor />);

			const alignCenterButton = screen.getByTitle("Align Center");
			expect(alignCenterButton).toHaveClass("bg-muted");
		});
	});

	describe("List Formatting", () => {
		it("should toggle bullet list", async () => {
			const user = userEvent.setup();
			render(<TiptapEditor />);

			const bulletListButton = screen.getByTitle("Bullet List");
			await user.click(bulletListButton);

			expect(mockChain.toggleBulletList).toHaveBeenCalled();
		});

		it("should toggle ordered list", async () => {
			const user = userEvent.setup();
			render(<TiptapEditor />);

			const orderedListButton = screen.getByTitle("Ordered List");
			await user.click(orderedListButton);

			expect(mockChain.toggleOrderedList).toHaveBeenCalled();
		});

		it("should show active list state", () => {
			mockEditor.isActive.mockImplementation(
				(type: string) => type === "bulletList"
			);

			render(<TiptapEditor />);

			const bulletListButton = screen.getByTitle("Bullet List");
			expect(bulletListButton).toHaveClass("bg-muted");
		});
	});

	describe("Block Formatting", () => {
		it("should toggle blockquote", async () => {
			const user = userEvent.setup();
			render(<TiptapEditor />);

			const quoteButton = screen.getByTitle("Quote");
			await user.click(quoteButton);

			expect(mockChain.toggleBlockquote).toHaveBeenCalled();
		});

		it("should toggle heading 1", async () => {
			const user = userEvent.setup();
			render(<TiptapEditor />);

			const h1Button = screen.getByTitle("Heading 1");
			await user.click(h1Button);

			expect(mockChain.toggleHeading).toHaveBeenCalledWith({ level: 1 });
		});

		it("should toggle heading 2", async () => {
			const user = userEvent.setup();
			render(<TiptapEditor />);

			const h2Button = screen.getByTitle("Heading 2");
			await user.click(h2Button);

			expect(mockChain.toggleHeading).toHaveBeenCalledWith({ level: 2 });
		});

		it("should toggle heading 3", async () => {
			const user = userEvent.setup();
			render(<TiptapEditor />);

			const h3Button = screen.getByTitle("Heading 3");
			await user.click(h3Button);

			expect(mockChain.toggleHeading).toHaveBeenCalledWith({ level: 3 });
		});

		it("should show active heading state", () => {
			mockEditor.isActive.mockImplementation(
				(type: string, options: { level?: number }) =>
					type === "heading" && options?.level === 2
			);

			render(<TiptapEditor />);

			const h2Button = screen.getByTitle("Heading 2");
			expect(h2Button).toHaveClass("bg-muted");
		});
	});

	describe("Content Updates", () => {
		it("should call onChange when content updates", () => {
			const onChange = vi.fn();

			render(<TiptapEditor onChange={onChange} />);

			const editorConfig = mockUseEditor.mock.calls[0]?.[0];
			const mockEditorInstance = {
				getHTML: () => "<p>Updated content</p>",
			};

			editorConfig?.onUpdate?.({
				editor: mockEditorInstance as unknown as Parameters<
					NonNullable<typeof editorConfig.onUpdate>
				>[0]["editor"],
				transaction: {} as unknown as Parameters<
					NonNullable<typeof editorConfig.onUpdate>
				>[0]["transaction"],
			});

			expect(onChange).toHaveBeenCalledWith("<p>Updated content</p>");
		});

		it("should not error if onChange is not provided", () => {
			render(<TiptapEditor />);

			const editorConfig = mockUseEditor.mock.calls[0]?.[0];
			const mockEditorInstance = {
				getHTML: () => "<p>Updated content</p>",
			};

			expect(() => {
				editorConfig?.onUpdate?.({
					editor: mockEditorInstance as unknown as Parameters<
						NonNullable<typeof editorConfig.onUpdate>
					>[0]["editor"],
					transaction: {} as unknown as Parameters<
						NonNullable<typeof editorConfig.onUpdate>
					>[0]["transaction"],
				});
			}).not.toThrow();
		});
	});

	describe("Editor Configuration", () => {
		it("should configure StarterKit with correct options", () => {
			render(<TiptapEditor />);

			const editorConfig = mockUseEditor.mock.calls[0]?.[0];
			expect(editorConfig?.extensions).toBeDefined();
			expect(editorConfig?.extensions?.length).toBeGreaterThan(0);
		});

		it("should include all required extensions", () => {
			render(<TiptapEditor />);

			const editorConfig = mockUseEditor.mock.calls[0]?.[0];
			expect(editorConfig?.extensions).toHaveLength(6);
		});
	});

	describe("Styling", () => {
		it("should apply correct container styles", () => {
			const { container } = render(<TiptapEditor />);

			const wrapper = container.firstChild;
			expect(wrapper).toHaveClass("rounded-md", "border");
		});

		it("should apply correct toolbar styles", () => {
			const { container } = render(<TiptapEditor />);

			const toolbar = container.querySelector(
				".flex.flex-wrap.gap-1.border-b.p-2"
			);
			expect(toolbar).toBeInTheDocument();
		});

		it("should apply correct editor content styles", () => {
			render(<TiptapEditor />);

			const editorContent = screen.getByTestId("editor-content");
			expect(editorContent.className).toContain("prose");
			expect(editorContent.className).toContain("min-h-[200px]");
		});

		it("should style toolbar buttons correctly", () => {
			render(<TiptapEditor />);

			const boldButton = screen.getByTitle("Bold");
			expect(boldButton).toHaveClass("h-8", "w-8", "p-0");
		});
	});

	describe("Keyboard Shortcuts", () => {
		it("should focus editor when toolbar button is clicked", async () => {
			const user = userEvent.setup();
			render(<TiptapEditor />);

			const boldButton = screen.getByTitle("Bold");
			await user.click(boldButton);

			expect(mockChain.focus).toHaveBeenCalled();
		});

		it("should chain multiple operations", async () => {
			const user = userEvent.setup();
			render(<TiptapEditor />);

			const boldButton = screen.getByTitle("Bold");
			await user.click(boldButton);

			expect(mockChain.focus).toHaveBeenCalled();
			expect(mockChain.focus).toHaveReturnedWith(mockChain);
			expect(mockChain.toggleBold).toHaveReturnedWith(mockChain);
		});
	});

	describe("Edge Cases", () => {
		it("should handle empty initial value", () => {
			render(<TiptapEditor value="" />);

			const editorConfig = mockUseEditor.mock.calls[0]?.[0];
			expect(editorConfig?.content).toBe("");
		});

		it("should handle undefined onChange gracefully", () => {
			render(<TiptapEditor />);

			const editorConfig = mockUseEditor.mock.calls[0]?.[0];
			const mockEditorInstance = {
				getHTML: () => "<p>Content</p>",
			};

			expect(() => {
				editorConfig?.onUpdate?.({
					editor: mockEditorInstance as unknown as Parameters<
						NonNullable<typeof editorConfig.onUpdate>
					>[0]["editor"],
					transaction: {} as unknown as Parameters<
						NonNullable<typeof editorConfig.onUpdate>
					>[0]["transaction"],
				});
			}).not.toThrow();
		});

		it("should render all heading buttons with correct text", () => {
			render(<TiptapEditor />);

			expect(screen.getByText("H1")).toBeInTheDocument();
			expect(screen.getByText("H2")).toBeInTheDocument();
			expect(screen.getByText("H3")).toBeInTheDocument();
		});

		it("should handle multiple active states", () => {
			mockEditor.isActive.mockReturnValue(true);

			render(<TiptapEditor />);

			const toolbar = screen.getAllByRole("button");
			const activeButtons = toolbar.filter((button) =>
				button.className.includes("bg-muted")
			);

			expect(activeButtons.length).toBeGreaterThan(0);
		});
	});
});
