import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DownloadCaseButton from "../download-case-button";

// Constants for regex patterns
const DOWNLOAD_BUTTON_REGEX = /download/i;

// Type definitions for mocks
type MockIconProps = {
	className?: string;
};

type MockButtonProps = {
	children: ReactNode;
	onClick?: () => void;
	variant?: string;
	className?: string;
};

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
	DownloadIcon: ({ className }: MockIconProps) => (
		<svg
			aria-label="Download icon"
			className={className}
			data-testid="download-icon"
		>
			<title>Download</title>
			<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
			<polyline points="7,10 12,15 17,10" />
			<line x1="12" x2="12" y1="15" y2="3" />
		</svg>
	),
}));

// Mock UI components
vi.mock("@/components/ui/button", () => ({
	Button: ({ children, onClick, variant, className }: MockButtonProps) => (
		<button
			className={className}
			data-variant={variant}
			onClick={onClick}
			type="button"
		>
			{children}
		</button>
	),
}));

describe("DownloadCaseButton", () => {
	// Mock DOM APIs
	const mockCreateObjectURL = vi.fn();
	const mockRevokeObjectURL = vi.fn();

	// Store original methods
	let originalCreateObjectURL: typeof URL.createObjectURL;
	let originalRevokeObjectURL: typeof URL.revokeObjectURL;
	let originalCreateElement: typeof document.createElement;

	// Mock anchor element for all tests
	const mockAnchor = {
		href: "",
		download: "",
		click: vi.fn(),
		style: {},
		remove: vi.fn(),
	};

	beforeEach(() => {
		vi.clearAllMocks();

		// Mock getComputedStyle for accessibility tests
		window.getComputedStyle = vi.fn().mockImplementation(() => ({
			visibility: "visible",
			display: "block",
			opacity: "1",
			getPropertyValue: vi.fn().mockImplementation((prop: string) => {
				const properties: Record<string, string> = {
					visibility: "visible",
					display: "block",
					opacity: "1",
				};
				return properties[prop] || "";
			}),
		}));

		// Store originals
		originalCreateObjectURL = URL.createObjectURL;
		originalRevokeObjectURL = URL.revokeObjectURL;
		originalCreateElement = document.createElement;

		// Mock URL methods
		mockCreateObjectURL.mockReturnValue("blob:mock-url");
		URL.createObjectURL = mockCreateObjectURL;
		URL.revokeObjectURL = mockRevokeObjectURL;

		// Mock Blob constructor
		global.Blob = vi
			.fn()
			.mockImplementation((parts: BlobPart[], options: BlobPropertyBag) => ({
				parts,
				options,
				size: JSON.stringify(parts[0]).length,
				type: options.type,
			}));

		// Reset mock anchor for each test
		mockAnchor.href = "";
		mockAnchor.download = "";
		mockAnchor.click.mockClear();
	});

	afterEach(() => {
		// Restore original methods
		vi.restoreAllMocks();
		URL.createObjectURL = originalCreateObjectURL;
		URL.revokeObjectURL = originalRevokeObjectURL;
		if (document.createElement !== originalCreateElement) {
			document.createElement = originalCreateElement;
		}
	});

	describe("Component Rendering", () => {
		it("should render download button", () => {
			const mockContent = '{"name": "test"}';
			const mockTitle = "Test Case";

			render(<DownloadCaseButton content={mockContent} title={mockTitle} />);

			const button = screen.getByRole("button", {
				name: DOWNLOAD_BUTTON_REGEX,
			});
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

			const { container } = render(
				<DownloadCaseButton content={mockContent} title={mockTitle} />
			);

			const wrapper = container.firstChild;
			expect(wrapper).toHaveClass(
				"mt-4",
				"flex",
				"shrink-0",
				"items-center",
				"gap-x-4"
			);
		});
	});

	describe("Download Functionality", () => {
		it("should trigger download when button is clicked", async () => {
			const user = userEvent.setup();
			const mockContent = '{"name": "test", "description": "A test case"}';
			const mockTitle = "Test Case";

			render(<DownloadCaseButton content={mockContent} title={mockTitle} />);

			// Mock DOM methods just before clicking
			const createElementSpy = vi
				.spyOn(document, "createElement")
				.mockImplementation((tagName: string) => {
					if (tagName === "a") {
						return mockAnchor as unknown as HTMLElement;
					}
					return originalCreateElement.call(document, tagName);
				});

			const appendChildSpy = vi
				.spyOn(document.body, "appendChild")
				.mockImplementation(() => mockAnchor as unknown as Node);
			const removeChildSpy = vi
				.spyOn(document.body, "removeChild")
				.mockImplementation(() => mockAnchor as unknown as Node);

			const button = screen.getByRole("button", {
				name: DOWNLOAD_BUTTON_REGEX,
			});
			await user.click(button);

			// Verify URL methods were called
			expect(mockCreateObjectURL).toHaveBeenCalled();
			expect(mockRevokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
			expect(mockAnchor.click).toHaveBeenCalled();

			createElementSpy.mockRestore();
			appendChildSpy.mockRestore();
			removeChildSpy.mockRestore();
		});

		it("should create blob with correct content and type", async () => {
			const user = userEvent.setup();
			const mockContent = '{"name": "test", "id": 123}';
			const mockTitle = "Test Case";

			render(<DownloadCaseButton content={mockContent} title={mockTitle} />);

			// Mock DOM methods just before clicking
			const createElementSpy = vi
				.spyOn(document, "createElement")
				.mockImplementation((tagName: string) => {
					if (tagName === "a") {
						return mockAnchor as unknown as HTMLElement;
					}
					return originalCreateElement.call(document, tagName);
				});

			const appendChildSpy = vi
				.spyOn(document.body, "appendChild")
				.mockImplementation(() => mockAnchor as unknown as Node);
			const removeChildSpy = vi
				.spyOn(document.body, "removeChild")
				.mockImplementation(() => mockAnchor as unknown as Node);

			const button = screen.getByRole("button", {
				name: DOWNLOAD_BUTTON_REGEX,
			});
			await user.click(button);

			// Check if Blob was created with correct parameters
			expect(global.Blob).toHaveBeenCalledWith(
				[JSON.stringify(JSON.parse(mockContent), null, 2)],
				{ type: "application/json" }
			);

			createElementSpy.mockRestore();
			appendChildSpy.mockRestore();
			removeChildSpy.mockRestore();
		});

		it("should set correct filename with underscores replacing spaces", async () => {
			const user = userEvent.setup();
			const mockContent = '{"name": "test"}';
			const mockTitle = "Test Case With Spaces";

			render(<DownloadCaseButton content={mockContent} title={mockTitle} />);

			// Set up mocks before clicking
			document.createElement = vi.fn().mockImplementation((tagName: string) => {
				if (tagName === "a") {
					return mockAnchor as unknown as HTMLElement;
				}
				return originalCreateElement.call(document, tagName);
			});
			document.body.appendChild = vi.fn();
			document.body.removeChild = vi.fn();

			const button = screen.getByRole("button", {
				name: DOWNLOAD_BUTTON_REGEX,
			});
			await user.click(button);

			// Verify the filename was set correctly
			expect(mockAnchor.download).toBe("Test_Case_With_Spaces.json");
			expect(mockAnchor.click).toHaveBeenCalled();

			// Restore mocks
			document.createElement = originalCreateElement;
		});

		it("should set correct blob URL as href", async () => {
			const user = userEvent.setup();
			const mockContent = '{"name": "test"}';
			const mockTitle = "Test Case";

			render(<DownloadCaseButton content={mockContent} title={mockTitle} />);

			// Set up mocks before clicking
			document.createElement = vi.fn().mockImplementation((tagName: string) => {
				if (tagName === "a") {
					return mockAnchor as unknown as HTMLElement;
				}
				return originalCreateElement.call(document, tagName);
			});
			document.body.appendChild = vi.fn();
			document.body.removeChild = vi.fn();

			const button = screen.getByRole("button", {
				name: DOWNLOAD_BUTTON_REGEX,
			});
			await user.click(button);

			// Verify blob URL was created and set
			expect(mockCreateObjectURL).toHaveBeenCalled();
			expect(mockAnchor.href).toBe("blob:mock-url");

			// Restore mocks
			document.createElement = originalCreateElement;
		});

		it("should handle multiple spaces in title correctly", async () => {
			const user = userEvent.setup();
			const mockContent = '{"name": "test"}';
			const mockTitle = "Test  Case    With   Multiple     Spaces";

			render(<DownloadCaseButton content={mockContent} title={mockTitle} />);

			// Mock DOM methods just before clicking
			const createElementSpy = vi
				.spyOn(document, "createElement")
				.mockImplementation((tagName: string) => {
					if (tagName === "a") {
						return mockAnchor as unknown as HTMLElement;
					}
					return originalCreateElement.call(document, tagName);
				});

			const appendChildSpy = vi
				.spyOn(document.body, "appendChild")
				.mockImplementation(() => mockAnchor as unknown as Node);
			const removeChildSpy = vi
				.spyOn(document.body, "removeChild")
				.mockImplementation(() => mockAnchor as unknown as Node);

			const button = screen.getByRole("button", {
				name: DOWNLOAD_BUTTON_REGEX,
			});
			await user.click(button);

			// Verify spaces are replaced with underscores
			expect(mockAnchor.download).toBe("Test_Case_With_Multiple_Spaces.json");

			createElementSpy.mockRestore();
			appendChildSpy.mockRestore();
			removeChildSpy.mockRestore();
		});
	});

	describe("JSON Processing", () => {
		it("should pretty-print JSON with 2-space indentation", async () => {
			const user = userEvent.setup();
			const mockContent = '{"name":"test","id":123,"nested":{"value":true}}';
			const mockTitle = "Test Case";

			render(<DownloadCaseButton content={mockContent} title={mockTitle} />);

			// Mock DOM methods just before clicking
			const createElementSpy = vi
				.spyOn(document, "createElement")
				.mockImplementation((tagName: string) => {
					if (tagName === "a") {
						return mockAnchor as unknown as HTMLElement;
					}
					return originalCreateElement.call(document, tagName);
				});

			const appendChildSpy = vi
				.spyOn(document.body, "appendChild")
				.mockImplementation(() => mockAnchor as unknown as Node);
			const removeChildSpy = vi
				.spyOn(document.body, "removeChild")
				.mockImplementation(() => mockAnchor as unknown as Node);

			const button = screen.getByRole("button", {
				name: DOWNLOAD_BUTTON_REGEX,
			});
			await user.click(button);

			// Verify JSON was pretty-printed
			const expectedJSON = JSON.stringify(JSON.parse(mockContent), null, 2);
			expect(global.Blob).toHaveBeenCalledWith([expectedJSON], {
				type: "application/json",
			});

			createElementSpy.mockRestore();
			appendChildSpy.mockRestore();
			removeChildSpy.mockRestore();
		});

		it("should handle complex nested JSON objects", async () => {
			const user = userEvent.setup();
			const mockContent = JSON.stringify({
				name: "test",
				metadata: {
					version: 1,
					tags: ["tag1", "tag2"],
					settings: {
						enabled: true,
						config: {
							timeout: 5000,
						},
					},
				},
			});
			const mockTitle = "Complex Case";

			render(<DownloadCaseButton content={mockContent} title={mockTitle} />);

			// Mock DOM methods just before clicking
			const createElementSpy = vi
				.spyOn(document, "createElement")
				.mockImplementation((tagName: string) => {
					if (tagName === "a") {
						return mockAnchor as unknown as HTMLElement;
					}
					return originalCreateElement.call(document, tagName);
				});

			const appendChildSpy = vi
				.spyOn(document.body, "appendChild")
				.mockImplementation(() => mockAnchor as unknown as Node);
			const removeChildSpy = vi
				.spyOn(document.body, "removeChild")
				.mockImplementation(() => mockAnchor as unknown as Node);

			const button = screen.getByRole("button", {
				name: DOWNLOAD_BUTTON_REGEX,
			});
			await user.click(button);

			expect(global.Blob).toHaveBeenCalled();
			expect(mockCreateObjectURL).toHaveBeenCalled();

			createElementSpy.mockRestore();
			appendChildSpy.mockRestore();
			removeChildSpy.mockRestore();
		});

		it("should handle empty JSON object", async () => {
			const user = userEvent.setup();
			const mockContent = "{}";
			const mockTitle = "Empty Case";

			render(<DownloadCaseButton content={mockContent} title={mockTitle} />);

			// Mock DOM methods just before clicking
			const createElementSpy = vi
				.spyOn(document, "createElement")
				.mockImplementation((tagName: string) => {
					if (tagName === "a") {
						return mockAnchor as unknown as HTMLElement;
					}
					return originalCreateElement.call(document, tagName);
				});

			const appendChildSpy = vi
				.spyOn(document.body, "appendChild")
				.mockImplementation(() => mockAnchor as unknown as Node);
			const removeChildSpy = vi
				.spyOn(document.body, "removeChild")
				.mockImplementation(() => mockAnchor as unknown as Node);

			const button = screen.getByRole("button", {
				name: DOWNLOAD_BUTTON_REGEX,
			});
			await user.click(button);

			expect(global.Blob).toHaveBeenCalledWith(["{}"], {
				type: "application/json",
			});

			createElementSpy.mockRestore();
			appendChildSpy.mockRestore();
			removeChildSpy.mockRestore();
		});
	});

	describe("Error Handling", () => {
		it("should handle invalid JSON gracefully", async () => {
			const user = userEvent.setup();
			const mockContent = "invalid json";
			const mockTitle = "Test Case";

			render(<DownloadCaseButton content={mockContent} title={mockTitle} />);

			const button = screen.getByRole("button", {
				name: DOWNLOAD_BUTTON_REGEX,
			});

			// Should not throw error
			await expect(user.click(button)).resolves.not.toThrow();

			// Should not create blob or trigger download
			expect(mockCreateObjectURL).not.toHaveBeenCalled();
		});

		it("should handle empty content string", async () => {
			const user = userEvent.setup();
			const mockContent = "";
			const mockTitle = "Test Case";

			render(<DownloadCaseButton content={mockContent} title={mockTitle} />);

			const button = screen.getByRole("button", {
				name: DOWNLOAD_BUTTON_REGEX,
			});

			// Should not throw error
			await expect(user.click(button)).resolves.not.toThrow();

			// Should not create blob or trigger download due to JSON parsing error
			expect(mockCreateObjectURL).not.toHaveBeenCalled();
		});

		it("should handle malformed JSON without throwing", async () => {
			const user = userEvent.setup();
			const mockContent = '{"name": "test", "unclosed": ';
			const mockTitle = "Test Case";

			render(<DownloadCaseButton content={mockContent} title={mockTitle} />);

			const button = screen.getByRole("button", {
				name: DOWNLOAD_BUTTON_REGEX,
			});

			// Should not throw error
			await expect(user.click(button)).resolves.not.toThrow();
		});

		it("should handle DOM manipulation errors gracefully", async () => {
			const user = userEvent.setup();
			const mockContent = '{"name": "test"}';
			const mockTitle = "Test Case";

			render(<DownloadCaseButton content={mockContent} title={mockTitle} />);

			// Mock appendChild to throw an error
			const appendChildSpy = vi
				.spyOn(document.body, "appendChild")
				.mockImplementation(() => {
					throw new Error("DOM error");
				});

			const button = screen.getByRole("button", {
				name: DOWNLOAD_BUTTON_REGEX,
			});

			// Should not throw error even if DOM manipulation fails
			await expect(user.click(button)).resolves.not.toThrow();

			appendChildSpy.mockRestore();
		});
	});

	describe("Edge Cases", () => {
		it("should handle title with special characters", async () => {
			const user = userEvent.setup();
			const mockContent = '{"name": "test"}';
			const mockTitle = "Test/Case\\With:Special*Characters?";

			render(<DownloadCaseButton content={mockContent} title={mockTitle} />);

			// Mock DOM methods just before clicking
			const createElementSpy = vi
				.spyOn(document, "createElement")
				.mockImplementation((tagName: string) => {
					if (tagName === "a") {
						return mockAnchor as unknown as HTMLElement;
					}
					return originalCreateElement.call(document, tagName);
				});

			const appendChildSpy = vi
				.spyOn(document.body, "appendChild")
				.mockImplementation(() => mockAnchor as unknown as Node);
			const removeChildSpy = vi
				.spyOn(document.body, "removeChild")
				.mockImplementation(() => mockAnchor as unknown as Node);

			const button = screen.getByRole("button", {
				name: DOWNLOAD_BUTTON_REGEX,
			});
			await user.click(button);

			// Verify filename with special characters
			expect(mockAnchor.download).toBe(
				"Test/Case\\With:Special*Characters?.json"
			);

			createElementSpy.mockRestore();
			appendChildSpy.mockRestore();
			removeChildSpy.mockRestore();
		});

		it("should handle very long title", async () => {
			const user = userEvent.setup();
			const mockContent = '{"name": "test"}';
			const mockTitle = `${"A".repeat(200)} Very Long Title`;

			render(<DownloadCaseButton content={mockContent} title={mockTitle} />);

			// Mock DOM methods just before clicking
			const createElementSpy = vi
				.spyOn(document, "createElement")
				.mockImplementation((tagName: string) => {
					if (tagName === "a") {
						return mockAnchor as unknown as HTMLElement;
					}
					return originalCreateElement.call(document, tagName);
				});

			const appendChildSpy = vi
				.spyOn(document.body, "appendChild")
				.mockImplementation(() => mockAnchor as unknown as Node);
			const removeChildSpy = vi
				.spyOn(document.body, "removeChild")
				.mockImplementation(() => mockAnchor as unknown as Node);

			const button = screen.getByRole("button", {
				name: DOWNLOAD_BUTTON_REGEX,
			});
			await user.click(button);

			const expectedFilename = `${"A".repeat(200)}_Very_Long_Title.json`;
			expect(mockAnchor.download).toBe(expectedFilename);

			createElementSpy.mockRestore();
			appendChildSpy.mockRestore();
			removeChildSpy.mockRestore();
		});

		it("should handle title with only spaces", async () => {
			const user = userEvent.setup();
			const mockContent = '{"name": "test"}';
			const mockTitle = "     ";

			render(<DownloadCaseButton content={mockContent} title={mockTitle} />);

			// Mock DOM methods just before clicking
			const createElementSpy = vi
				.spyOn(document, "createElement")
				.mockImplementation((tagName: string) => {
					if (tagName === "a") {
						return mockAnchor as unknown as HTMLElement;
					}
					return originalCreateElement.call(document, tagName);
				});

			const appendChildSpy = vi
				.spyOn(document.body, "appendChild")
				.mockImplementation(() => mockAnchor as unknown as Node);
			const removeChildSpy = vi
				.spyOn(document.body, "removeChild")
				.mockImplementation(() => mockAnchor as unknown as Node);

			const button = screen.getByRole("button", {
				name: DOWNLOAD_BUTTON_REGEX,
			});
			await user.click(button);

			expect(mockAnchor.download).toBe("_.json");

			createElementSpy.mockRestore();
			appendChildSpy.mockRestore();
			removeChildSpy.mockRestore();
		});

		it("should handle multiple rapid clicks", async () => {
			const user = userEvent.setup();
			const mockContent = '{"name": "test"}';
			const mockTitle = "Test Case";

			render(<DownloadCaseButton content={mockContent} title={mockTitle} />);

			// Mock DOM methods just before clicking
			const createElementSpy = vi
				.spyOn(document, "createElement")
				.mockImplementation((tagName: string) => {
					if (tagName === "a") {
						return mockAnchor as unknown as HTMLElement;
					}
					return originalCreateElement.call(document, tagName);
				});

			const appendChildSpy = vi
				.spyOn(document.body, "appendChild")
				.mockImplementation(() => mockAnchor as unknown as Node);
			const removeChildSpy = vi
				.spyOn(document.body, "removeChild")
				.mockImplementation(() => mockAnchor as unknown as Node);

			const button = screen.getByRole("button", {
				name: DOWNLOAD_BUTTON_REGEX,
			});

			// Click rapidly
			await user.click(button);
			await user.click(button);
			await user.click(button);

			// Should create blob for each click
			expect(mockCreateObjectURL).toHaveBeenCalledTimes(3);
			expect(mockRevokeObjectURL).toHaveBeenCalledTimes(3);

			createElementSpy.mockRestore();
			appendChildSpy.mockRestore();
			removeChildSpy.mockRestore();
		});
	});

	describe("Accessibility", () => {
		it("should be keyboard accessible", async () => {
			const user = userEvent.setup();
			const mockContent = '{"name": "test"}';
			const mockTitle = "Test Case";

			render(<DownloadCaseButton content={mockContent} title={mockTitle} />);

			const button = screen.getByRole("button", {
				name: DOWNLOAD_BUTTON_REGEX,
			});

			// Focus and activate with keyboard
			await user.tab();
			expect(button).toHaveFocus();

			// Mock DOM methods just before keyboard interaction
			const createElementSpy = vi
				.spyOn(document, "createElement")
				.mockImplementation((tagName: string) => {
					if (tagName === "a") {
						return mockAnchor as unknown as HTMLElement;
					}
					return originalCreateElement.call(document, tagName);
				});

			const appendChildSpy = vi
				.spyOn(document.body, "appendChild")
				.mockImplementation(() => mockAnchor as unknown as Node);
			const removeChildSpy = vi
				.spyOn(document.body, "removeChild")
				.mockImplementation(() => mockAnchor as unknown as Node);

			await user.keyboard("{Enter}");
			expect(mockCreateObjectURL).toHaveBeenCalled();

			createElementSpy.mockRestore();
			appendChildSpy.mockRestore();
			removeChildSpy.mockRestore();
		});

		it("should have proper button role", () => {
			const mockContent = '{"name": "test"}';
			const mockTitle = "Test Case";

			render(<DownloadCaseButton content={mockContent} title={mockTitle} />);

			const button = screen.getByRole("button", {
				name: DOWNLOAD_BUTTON_REGEX,
			});
			expect(button).toBeInTheDocument();
		});

		it("should have descriptive button text", () => {
			const mockContent = '{"name": "test"}';
			const mockTitle = "Test Case";

			render(<DownloadCaseButton content={mockContent} title={mockTitle} />);

			const button = screen.getByRole("button", {
				name: DOWNLOAD_BUTTON_REGEX,
			});
			expect(button).toHaveTextContent("Download");
		});
	});
});
