import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DownloadCaseButton from "../download-case-button";

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
	DownloadIcon: ({ className }: any) => (
		<svg className={className} data-testid="download-icon">
			<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
			<polyline points="7,10 12,15 17,10" />
			<line x1="12" y1="15" x2="12" y2="3" />
		</svg>
	),
}));

// Mock UI components
vi.mock("@/components/ui/button", () => ({
	Button: ({ children, onClick, variant, className }: any) => (
		<button
			onClick={onClick}
			className={className}
			data-variant={variant}
		>
			{children}
		</button>
	),
}));

describe("DownloadCaseButton", () => {
	// Mock DOM APIs
	const mockCreateObjectURL = vi.fn();
	const mockRevokeObjectURL = vi.fn();
	const mockAnchorClick = vi.fn();

	// Store original methods
	let originalCreateObjectURL: typeof URL.createObjectURL;
	let originalRevokeObjectURL: typeof URL.revokeObjectURL;
	let createElementSpy: any;
	let appendChildSpy: any;
	let removeChildSpy: any;

	beforeEach(() => {
		vi.clearAllMocks();

		// Store originals
		originalCreateObjectURL = URL.createObjectURL;
		originalRevokeObjectURL = URL.revokeObjectURL;

		// Mock URL methods
		mockCreateObjectURL.mockReturnValue("blob:mock-url");
		URL.createObjectURL = mockCreateObjectURL;
		URL.revokeObjectURL = mockRevokeObjectURL;

		// Get original methods before spying
		const originalCreateElement = document.createElement.bind(document);
		const originalAppendChild = document.body.appendChild.bind(document.body);
		const originalRemoveChild = document.body.removeChild.bind(document.body);

		// Spy on DOM methods
		createElementSpy = vi.spyOn(document, 'createElement');
		appendChildSpy = vi.spyOn(document.body, 'appendChild');
		removeChildSpy = vi.spyOn(document.body, 'removeChild');

		// Override behavior for anchor elements
		createElementSpy.mockImplementation((tagName: string) => {
			const element = originalCreateElement(tagName);
			if (tagName === "a" && element instanceof HTMLAnchorElement) {
				// Override click method for anchor elements
				element.click = mockAnchorClick;
			}
			return element;
		});

		// Make appendChild and removeChild no-ops for anchor elements
		appendChildSpy.mockImplementation((child: Node) => {
			if (child instanceof HTMLAnchorElement) {
				return child;
			}
			return originalAppendChild(child);
		});

		removeChildSpy.mockImplementation((child: Node) => {
			if (child instanceof HTMLAnchorElement) {
				return child;
			}
			return originalRemoveChild(child);
		});

		// Mock Blob constructor
		global.Blob = vi.fn().mockImplementation((parts: any[], options: any) => ({
			parts,
			options,
		}));
	});

	afterEach(() => {
		// Restore original methods
		createElementSpy.mockRestore();
		appendChildSpy.mockRestore();
		removeChildSpy.mockRestore();
		URL.createObjectURL = originalCreateObjectURL;
		URL.revokeObjectURL = originalRevokeObjectURL;
	});

	describe("Component Rendering", () => {
		it("should render download button", () => {
			const mockContent = '{"name": "test"}';
			const mockTitle = "Test Case";

			render(<DownloadCaseButton content={mockContent} title={mockTitle} />);

			const button = screen.getByRole("button", { name: /download/i });
			expect(button).toBeInTheDocument();
			expect(button).toHaveAttribute("data-variant", "primary");
		});

		it("should render download icon", () => {
			const mockContent = '{"name": "test"}';
			const mockTitle = "Test Case";

			render(<DownloadCaseButton content={mockContent} title={mockTitle} />);

			const icon = screen.getByTestId("download-icon");
			expect(icon).toBeInTheDocument();
			expect(icon).toHaveClass("ml-2", "size-4");
		});

		it("should have correct container styling", () => {
			const mockContent = '{"name": "test"}';
			const mockTitle = "Test Case";

			render(<DownloadCaseButton content={mockContent} title={mockTitle} />);

			const container = screen.getByRole("button").closest("div");
			expect(container).toHaveClass("mt-4", "flex", "shrink-0", "items-center", "gap-x-4");
		});
	});

	describe("Download Functionality", () => {
		it("should trigger download when button is clicked", async () => {
			const user = userEvent.setup();
			const mockContent = '{"name": "test", "description": "A test case"}';
			const mockTitle = "Test Case";

			render(<DownloadCaseButton content={mockContent} title={mockTitle} />);

			const button = screen.getByRole("button", { name: /download/i });
			await user.click(button);

			expect(createElementSpy).toHaveBeenCalledWith("a");
			expect(mockCreateObjectURL).toHaveBeenCalled();
			expect(appendChildSpy).toHaveBeenCalled();
			expect(mockAnchorClick).toHaveBeenCalled();
			expect(removeChildSpy).toHaveBeenCalled();
			expect(mockRevokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
		});

		it("should create blob with correct content and type", async () => {
			const user = userEvent.setup();
			const mockContent = '{"name": "test", "id": 123}';
			const mockTitle = "Test Case";

			render(<DownloadCaseButton content={mockContent} title={mockTitle} />);

			const button = screen.getByRole("button", { name: /download/i });
			await user.click(button);

			// Check if Blob was created with correct parameters
			expect(global.Blob).toHaveBeenCalledWith(
				[JSON.stringify(JSON.parse(mockContent), null, 2)],
				{ type: "application/json" }
			);
		});

		it("should set correct filename with underscores replacing spaces", async () => {
			const user = userEvent.setup();
			const mockContent = '{"name": "test"}';
			const mockTitle = "Test Case With Spaces";

			render(<DownloadCaseButton content={mockContent} title={mockTitle} />);

			const button = screen.getByRole("button", { name: /download/i });
			await user.click(button);

			// Check that createElement was called with 'a'
			expect(createElementSpy).toHaveBeenCalledWith("a");

			// Get the created anchor element from the spy
			const anchorCall = createElementSpy.mock.calls.find((call: any[]) => call[0] === "a");
			const anchorCallIndex = createElementSpy.mock.calls.findIndex((call: any[]) => call[0] === "a");
			const createdAnchor = anchorCallIndex >= 0 ? createElementSpy.mock.results[anchorCallIndex]?.value : null;

			expect(createdAnchor?.download).toBe("Test_Case_With_Spaces.json");
		});

		it("should set correct blob URL as href", async () => {
			const user = userEvent.setup();
			const mockContent = '{"name": "test"}';
			const mockTitle = "Test Case";

			render(<DownloadCaseButton content={mockContent} title={mockTitle} />);

			const button = screen.getByRole("button", { name: /download/i });
			await user.click(button);

			// Get the created anchor element
			const anchorCallIndex = createElementSpy.mock.calls.findIndex((call: any[]) => call[0] === "a");
			const createdAnchor = anchorCallIndex >= 0 ? createElementSpy.mock.results[anchorCallIndex]?.value : null;

			expect(createdAnchor?.href).toBe("blob:mock-url");
		});

		it("should handle multiple spaces in title correctly", async () => {
			const user = userEvent.setup();
			const mockContent = '{"name": "test"}';
			const mockTitle = "Test  Case    With   Multiple     Spaces";

			render(<DownloadCaseButton content={mockContent} title={mockTitle} />);

			const button = screen.getByRole("button", { name: /download/i });
			await user.click(button);

			// Get the created anchor element
			const anchorCallIndex = createElementSpy.mock.calls.findIndex((call: any[]) => call[0] === "a");
			const createdAnchor = anchorCallIndex >= 0 ? createElementSpy.mock.results[anchorCallIndex]?.value : null;

			expect(createdAnchor?.download).toBe("Test_Case_With_Multiple_Spaces.json");
		});
	});

	describe("JSON Processing", () => {
		it("should pretty-print JSON with 2-space indentation", async () => {
			const user = userEvent.setup();
			const mockContent = '{"name":"test","nested":{"key":"value"}}';
			const mockTitle = "Test Case";

			render(<DownloadCaseButton content={mockContent} title={mockTitle} />);

			const button = screen.getByRole("button", { name: /download/i });
			await user.click(button);

			const expectedFormattedJSON = JSON.stringify(
				JSON.parse(mockContent),
				null,
				2
			);

			expect(global.Blob).toHaveBeenCalledWith(
				[expectedFormattedJSON],
				{ type: "application/json" }
			);
		});

		it("should handle complex nested JSON objects", async () => {
			const user = userEvent.setup();
			const complexJSON = {
				name: "Complex Test Case",
				metadata: {
					version: "1.0",
					tags: ["test", "complex"],
					settings: {
						enabled: true,
						threshold: 0.95
					}
				},
				items: [
					{ id: 1, value: "first" },
					{ id: 2, value: "second" }
				]
			};
			const mockContent = JSON.stringify(complexJSON);
			const mockTitle = "Complex Case";

			render(<DownloadCaseButton content={mockContent} title={mockTitle} />);

			const button = screen.getByRole("button", { name: /download/i });
			await user.click(button);

			expect(global.Blob).toHaveBeenCalledWith(
				[JSON.stringify(complexJSON, null, 2)],
				{ type: "application/json" }
			);
		});

		it("should handle empty JSON object", async () => {
			const user = userEvent.setup();
			const mockContent = '{}';
			const mockTitle = "Empty Case";

			render(<DownloadCaseButton content={mockContent} title={mockTitle} />);

			const button = screen.getByRole("button", { name: /download/i });
			await user.click(button);

			expect(global.Blob).toHaveBeenCalledWith(
				[JSON.stringify({}, null, 2)],
				{ type: "application/json" }
			);
		});
	});

	describe("Error Handling", () => {
		it("should handle invalid JSON gracefully", async () => {
			const user = userEvent.setup();
			const invalidJSON = '{"name": "test", invalid}';
			const mockTitle = "Test Case";

			render(<DownloadCaseButton content={invalidJSON} title={mockTitle} />);

			const button = screen.getByRole("button", { name: /download/i });

			// Should not throw an error
			await expect(user.click(button)).resolves.not.toThrow();

			// Should not create blob or trigger download
			expect(mockCreateObjectURL).not.toHaveBeenCalled();
			expect(mockAnchorClick).not.toHaveBeenCalled();
		});

		it("should handle empty content string", async () => {
			const user = userEvent.setup();
			const mockContent = "";
			const mockTitle = "Test Case";

			render(<DownloadCaseButton content={mockContent} title={mockTitle} />);

			const button = screen.getByRole("button", { name: /download/i });
			await user.click(button);

			// Should not create blob or trigger download due to JSON parsing error
			expect(mockCreateObjectURL).not.toHaveBeenCalled();
			expect(mockAnchorClick).not.toHaveBeenCalled();
		});

		it("should handle malformed JSON without throwing", async () => {
			const user = userEvent.setup();
			const malformedJSON = '{"unclosed": "object"';
			const mockTitle = "Test Case";

			render(<DownloadCaseButton content={malformedJSON} title={mockTitle} />);

			const button = screen.getByRole("button", { name: /download/i });

			// Should silently handle the error
			await expect(user.click(button)).resolves.not.toThrow();
		});

		it("should handle DOM manipulation errors gracefully", async () => {
			const user = userEvent.setup();
			const mockContent = '{"name": "test"}';
			const mockTitle = "Test Case";

			render(<DownloadCaseButton content={mockContent} title={mockTitle} />);

			// Mock appendChild to throw an error only for anchor elements
			appendChildSpy.mockImplementation((child: Node) => {
				if (child instanceof HTMLAnchorElement) {
					throw new Error("DOM error");
				}
				// For other elements, use the original method
				const originalAppendChild = document.body.appendChild.bind(document.body);
				return originalAppendChild(child);
			});

			const button = screen.getByRole("button", { name: /download/i });

			// Should not throw an error even if DOM manipulation fails
			await expect(user.click(button)).resolves.not.toThrow();
		});
	});

	describe("Edge Cases", () => {
		it("should handle title with special characters", async () => {
			const user = userEvent.setup();
			const mockContent = '{"name": "test"}';
			const mockTitle = "Test/Case@#$%^&*()";

			render(<DownloadCaseButton content={mockContent} title={mockTitle} />);

			const button = screen.getByRole("button", { name: /download/i });
			await user.click(button);

			// Get the created anchor element
			const anchorCallIndex = createElementSpy.mock.calls.findIndex((call: any[]) => call[0] === "a");
			const createdAnchor = anchorCallIndex >= 0 ? createElementSpy.mock.results[anchorCallIndex]?.value : null;

			// Should only replace spaces, not other special characters
			expect(createdAnchor?.download).toBe("Test/Case@#$%^&*().json");
		});

		it("should handle very long title", async () => {
			const user = userEvent.setup();
			const mockContent = '{"name": "test"}';
			const longTitle = "A".repeat(300) + " " + "B".repeat(300);

			render(<DownloadCaseButton content={mockContent} title={longTitle} />);

			const button = screen.getByRole("button", { name: /download/i });
			await user.click(button);

			// Get the created anchor element
			const anchorCallIndex = createElementSpy.mock.calls.findIndex((call: any[]) => call[0] === "a");
			const createdAnchor = anchorCallIndex >= 0 ? createElementSpy.mock.results[anchorCallIndex]?.value : null;

			const expectedFilename = longTitle.replace(/\s+/g, "_") + ".json";
			expect(createdAnchor?.download).toBe(expectedFilename);
		});

		it("should handle title with only spaces", async () => {
			const user = userEvent.setup();
			const mockContent = '{"name": "test"}';
			const mockTitle = "   ";

			render(<DownloadCaseButton content={mockContent} title={mockTitle} />);

			const button = screen.getByRole("button", { name: /download/i });
			await user.click(button);

			// Get the created anchor element
			const anchorCallIndex = createElementSpy.mock.calls.findIndex((call: any[]) => call[0] === "a");
			const createdAnchor = anchorCallIndex >= 0 ? createElementSpy.mock.results[anchorCallIndex]?.value : null;

			expect(createdAnchor?.download).toBe("_.json");
		});

		it("should handle multiple rapid clicks", async () => {
			const user = userEvent.setup();
			const mockContent = '{"name": "test"}';
			const mockTitle = "Test Case";

			render(<DownloadCaseButton content={mockContent} title={mockTitle} />);

			const button = screen.getByRole("button", { name: /download/i });

			// Click multiple times rapidly
			await user.click(button);
			await user.click(button);
			await user.click(button);

			// Each click should trigger the download process
			expect(mockAnchorClick).toHaveBeenCalledTimes(3);
			expect(mockCreateObjectURL).toHaveBeenCalledTimes(3);
			expect(mockRevokeObjectURL).toHaveBeenCalledTimes(3);
		});
	});

	describe("Accessibility", () => {
		it("should be keyboard accessible", async () => {
			const user = userEvent.setup();
			const mockContent = '{"name": "test"}';
			const mockTitle = "Test Case";

			render(<DownloadCaseButton content={mockContent} title={mockTitle} />);

			const button = screen.getByRole("button", { name: /download/i });

			// Focus the button
			button.focus();
			expect(button).toHaveFocus();

			// Trigger with Enter key
			await user.keyboard("{Enter}");

			expect(mockAnchorClick).toHaveBeenCalled();
		});

		it("should have proper button role", () => {
			const mockContent = '{"name": "test"}';
			const mockTitle = "Test Case";

			render(<DownloadCaseButton content={mockContent} title={mockTitle} />);

			const button = screen.getByRole("button");
			expect(button).toBeInTheDocument();
		});

		it("should have descriptive button text", () => {
			const mockContent = '{"name": "test"}';
			const mockTitle = "Test Case";

			render(<DownloadCaseButton content={mockContent} title={mockTitle} />);

			expect(screen.getByRole("button", { name: /download/i })).toBeInTheDocument();
		});
	});
});
