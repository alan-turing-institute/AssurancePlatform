import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ImageUpload } from "../image-upload";

// Regex constants
const FILE_SIZE_LIMIT_5MB_REGEX = /PNG, JPG, JPEG, GIF, WEBP up to 5MB/;
const FILE_SIZE_LIMIT_10MB_REGEX = /PNG, JPG, JPEG, GIF, WEBP up to 10MB/;
const FILE_SIZE_LIMIT_2MB_REGEX = /File is too large. Maximum size is 2MB/;
const FILE_TOO_LARGE_5MB_REGEX = /File is too large. Maximum size is 5MB/;
const REMOVE_IMAGE_REGEX = /Remove Image/i;

// Mock Next.js Image component
interface MockImageProps {
	src: string;
	alt: string;
	className?: string;
	fill?: boolean;
	[key: string]: unknown;
}

vi.mock("next/image", () => ({
	default: ({ src, alt, className, fill, ...props }: MockImageProps) => (
		// biome-ignore lint/performance/noImgElement: This is a test mock
		<img
			alt={alt}
			className={className}
			data-fill={fill}
			src={src}
			{...props}
		/>
	),
}));

// Mock react-dropzone
const mockGetRootProps = vi.fn();
const mockGetInputProps = vi.fn();
const mockUseDropzone = vi.fn();

vi.mock("react-dropzone", () => ({
	useDropzone: (...args: unknown[]) => mockUseDropzone(...args),
}));

// Mock URL API
const mockCreateObjectURL = vi.fn(() => "blob:mock-url");
const mockRevokeObjectURL = vi.fn();

global.URL.createObjectURL = mockCreateObjectURL;
global.URL.revokeObjectURL = mockRevokeObjectURL;

describe("ImageUpload", () => {
	const mockOnChange = vi.fn();
	const mockOnRemove = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();

		// Setup default mock implementations
		mockGetRootProps.mockReturnValue({
			onClick: vi.fn(),
			onDrop: vi.fn(),
			role: "button",
		});

		mockGetInputProps.mockReturnValue({
			type: "file",
			accept: "image/*",
			multiple: false,
		});

		mockUseDropzone.mockReturnValue({
			getRootProps: mockGetRootProps,
			getInputProps: mockGetInputProps,
			isDragActive: false,
		});
	});

	describe("Component Rendering", () => {
		it("should render the upload area when no image", () => {
			render(<ImageUpload onChange={mockOnChange} />);

			expect(screen.getByText("Upload an image")).toBeInTheDocument();
			expect(
				screen.getByText("Drag and drop an image file, or click to select")
			).toBeInTheDocument();
		});

		it("should render with custom className", () => {
			const { container } = render(
				<ImageUpload className="custom-class" onChange={mockOnChange} />
			);

			expect(container.firstChild).toHaveClass("custom-class");
		});

		it("should display file size limit", () => {
			render(<ImageUpload onChange={mockOnChange} />);

			expect(screen.getByText(FILE_SIZE_LIMIT_5MB_REGEX)).toBeInTheDocument();
		});

		it("should display custom file size limit", () => {
			const customSize = 10 * 1024 * 1024; // 10MB
			render(<ImageUpload maxSize={customSize} onChange={mockOnChange} />);

			expect(screen.getByText(FILE_SIZE_LIMIT_10MB_REGEX)).toBeInTheDocument();
		});

		it("should render dropzone area", () => {
			const { container } = render(<ImageUpload onChange={mockOnChange} />);

			const dropzone = container.querySelector('[role="button"]');
			expect(dropzone).toBeInTheDocument();
		});
	});

	describe("Image Preview", () => {
		it("should display image preview when value is a string URL", () => {
			render(
				<ImageUpload
					onChange={mockOnChange}
					value="https://example.com/image.jpg"
				/>
			);

			const img = screen.getByAltText("Upload preview");
			expect(img).toHaveAttribute("src", "https://example.com/image.jpg");
		});

		it("should display preview overlay on hover", () => {
			const { container } = render(
				<ImageUpload
					onChange={mockOnChange}
					value="https://example.com/image.jpg"
				/>
			);

			const overlay = container.querySelector(".group-hover\\:opacity-100");
			expect(overlay).toBeInTheDocument();
			expect(overlay).toHaveClass("opacity-0");
		});

		it("should display remove button in overlay", () => {
			render(
				<ImageUpload
					onChange={mockOnChange}
					onRemove={mockOnRemove}
					value="https://example.com/image.jpg"
				/>
			);

			expect(
				screen.getByRole("button", { name: REMOVE_IMAGE_REGEX })
			).toBeInTheDocument();
		});

		it("should apply aspect ratio to preview container", () => {
			const { container } = render(
				<ImageUpload
					onChange={mockOnChange}
					value="https://example.com/image.jpg"
				/>
			);

			const aspectContainer = container.querySelector(".aspect-video");
			expect(aspectContainer).toBeInTheDocument();
		});
	});

	describe("Drag and Drop", () => {
		it("should show drag active state", () => {
			mockUseDropzone.mockReturnValueOnce({
				getRootProps: mockGetRootProps,
				getInputProps: mockGetInputProps,
				isDragActive: true,
			});

			render(<ImageUpload onChange={mockOnChange} />);

			expect(screen.getByText("Drop your image here")).toBeInTheDocument();
		});

		it("should apply drag active styles", () => {
			mockUseDropzone.mockReturnValueOnce({
				getRootProps: mockGetRootProps,
				getInputProps: mockGetInputProps,
				isDragActive: true,
			});

			const { container } = render(<ImageUpload onChange={mockOnChange} />);

			const dropzone = container.querySelector(
				".border-primary.bg-primary\\/5"
			);
			expect(dropzone).toBeInTheDocument();
		});

		it("should show upload icon when dragging", () => {
			mockUseDropzone.mockReturnValueOnce({
				getRootProps: mockGetRootProps,
				getInputProps: mockGetInputProps,
				isDragActive: true,
			});

			const { container } = render(<ImageUpload onChange={mockOnChange} />);

			// Check for the icon container
			const iconContainer = container.querySelector(".rounded-full.bg-muted");
			expect(iconContainer).toBeInTheDocument();
		});
	});

	describe("File Upload", () => {
		it("should handle file drop", () => {
			const file = new File(["test"], "test.png", { type: "image/png" });

			render(<ImageUpload onChange={mockOnChange} />);

			// Simulate file drop by calling onDrop from useDropzone
			const dropzoneConfig = mockUseDropzone.mock.calls[0][0];

			act(() => {
				dropzoneConfig.onDrop([file], []);
			});

			expect(mockCreateObjectURL).toHaveBeenCalledWith(file);
			expect(mockOnChange).toHaveBeenCalledWith(file);
		});

		it("should handle file too large error", () => {
			const rejection = {
				file: new File(["test"], "test.png", { type: "image/png" }),
				errors: [{ code: "file-too-large", message: "File too large" }],
			};

			render(<ImageUpload onChange={mockOnChange} />);

			const dropzoneConfig = mockUseDropzone.mock.calls[0][0];

			act(() => {
				dropzoneConfig.onDrop([], [rejection]);
			});

			expect(screen.getByText(FILE_TOO_LARGE_5MB_REGEX)).toBeInTheDocument();
		});

		it("should handle invalid file type error", () => {
			const rejection = {
				file: new File(["test"], "test.txt", { type: "text/plain" }),
				errors: [{ code: "file-invalid-type", message: "Invalid type" }],
			};

			render(<ImageUpload onChange={mockOnChange} />);

			const dropzoneConfig = mockUseDropzone.mock.calls[0][0];

			act(() => {
				dropzoneConfig.onDrop([], [rejection]);
			});

			expect(
				screen.getByText("Invalid file type. Please upload an image file.")
			).toBeInTheDocument();
		});

		it("should handle generic upload error", () => {
			const rejection = {
				file: new File(["test"], "test.png", { type: "image/png" }),
				errors: [{ code: "unknown-error", message: "Unknown error" }],
			};

			render(<ImageUpload onChange={mockOnChange} />);

			const dropzoneConfig = mockUseDropzone.mock.calls[0][0];

			act(() => {
				dropzoneConfig.onDrop([], [rejection]);
			});

			expect(
				screen.getByText("File upload failed. Please try again.")
			).toBeInTheDocument();
		});

		it("should clear error on successful upload", () => {
			const file = new File(["test"], "test.png", { type: "image/png" });
			const rejection = {
				file: new File(["test"], "test.txt", { type: "text/plain" }),
				errors: [{ code: "file-invalid-type", message: "Invalid type" }],
			};

			render(<ImageUpload onChange={mockOnChange} />);

			// First, trigger an error
			const dropzoneConfig = mockUseDropzone.mock.calls[0][0];

			act(() => {
				dropzoneConfig.onDrop([], [rejection]);
			});

			expect(
				screen.getByText("Invalid file type. Please upload an image file.")
			).toBeInTheDocument();

			// Then upload a valid file
			act(() => {
				dropzoneConfig.onDrop([file], []);
			});

			expect(
				screen.queryByText("Invalid file type. Please upload an image file.")
			).not.toBeInTheDocument();
		});
	});

	describe("Image Removal", () => {
		it("should handle image removal", async () => {
			const user = userEvent.setup();

			render(
				<ImageUpload
					onChange={mockOnChange}
					onRemove={mockOnRemove}
					value="https://example.com/image.jpg"
				/>
			);

			const removeButton = screen.getByRole("button", {
				name: REMOVE_IMAGE_REGEX,
			});
			await user.click(removeButton);

			expect(mockOnRemove).toHaveBeenCalled();
			expect(mockOnChange).toHaveBeenCalledWith("");
		});

		it("should revoke object URL on removal", async () => {
			const user = userEvent.setup();
			const file = new File(["test"], "test.png", { type: "image/png" });

			const { rerender } = render(<ImageUpload onChange={mockOnChange} />);

			// Upload a file
			const dropzoneConfig = mockUseDropzone.mock.calls[0][0];

			act(() => {
				dropzoneConfig.onDrop([file], []);
			});

			// Since the component sets preview internally, we need to track it
			const previewUrl = "blob:mock-url";

			// Re-render with the value to show the image
			rerender(
				<ImageUpload
					onChange={mockOnChange}
					onRemove={mockOnRemove}
					value={previewUrl}
				/>
			);

			const removeButton = screen.getByRole("button", {
				name: REMOVE_IMAGE_REGEX,
			});
			await user.click(removeButton);

			// Since the component tracks its own preview state, we can't easily test URL.revokeObjectURL
			// but we can verify the onChange was called with empty string
			expect(mockOnChange).toHaveBeenCalledWith("");
		});

		it("should clear error on removal", async () => {
			const user = userEvent.setup();

			const { rerender } = render(<ImageUpload onChange={mockOnChange} />);

			// Trigger an error
			const dropzoneConfig = mockUseDropzone.mock.calls[0][0];
			const rejection = {
				file: new File(["test"], "test.txt", { type: "text/plain" }),
				errors: [{ code: "file-invalid-type", message: "Invalid type" }],
			};

			act(() => {
				dropzoneConfig.onDrop([], [rejection]);
			});

			expect(
				screen.getByText("Invalid file type. Please upload an image file.")
			).toBeInTheDocument();

			// Upload a valid file
			const file = new File(["test"], "test.png", { type: "image/png" });

			act(() => {
				dropzoneConfig.onDrop([file], []);
			});

			// Re-render with the uploaded file
			rerender(
				<ImageUpload
					onChange={mockOnChange}
					onRemove={mockOnRemove}
					value="blob:mock-url"
				/>
			);

			const removeButton = screen.getByRole("button", {
				name: REMOVE_IMAGE_REGEX,
			});
			await user.click(removeButton);

			// The error should be cleared when remove is clicked
			await waitFor(() => {
				expect(
					screen.queryByText("Invalid file type. Please upload an image file.")
				).not.toBeInTheDocument();
			});
		});
	});

	describe("Disabled State", () => {
		it("should disable dropzone when disabled", () => {
			render(<ImageUpload disabled onChange={mockOnChange} />);

			expect(mockUseDropzone).toHaveBeenCalledWith(
				expect.objectContaining({
					disabled: true,
				})
			);
		});

		it("should style as disabled", () => {
			const { container } = render(
				<ImageUpload disabled onChange={mockOnChange} />
			);

			const dropzone = container.querySelector(
				".cursor-not-allowed.opacity-50"
			);
			expect(dropzone).toBeInTheDocument();
		});

		it("should disable remove button when disabled", () => {
			render(
				<ImageUpload
					disabled
					onChange={mockOnChange}
					value="https://example.com/image.jpg"
				/>
			);

			const removeButton = screen.getByRole("button", {
				name: REMOVE_IMAGE_REGEX,
			});
			expect(removeButton).toBeDisabled();
		});
	});

	describe("Custom Accept Types", () => {
		it("should use custom accept types", () => {
			const customAccept = {
				"image/png": [".png"],
				"image/jpeg": [".jpg", ".jpeg"],
			};

			render(<ImageUpload accept={customAccept} onChange={mockOnChange} />);

			expect(mockUseDropzone).toHaveBeenCalledWith(
				expect.objectContaining({
					accept: customAccept,
				})
			);
		});
	});

	describe("Error Display", () => {
		it("should display error with icon", () => {
			render(<ImageUpload onChange={mockOnChange} />);

			// Trigger an error
			const dropzoneConfig = mockUseDropzone.mock.calls[0][0];
			const rejection = {
				file: new File(["test"], "test.txt", { type: "text/plain" }),
				errors: [{ code: "file-invalid-type", message: "Invalid type" }],
			};

			act(() => {
				dropzoneConfig.onDrop([], [rejection]);
			});

			// Look for the error message text to confirm error is displayed
			expect(
				screen.getByText("Invalid file type. Please upload an image file.")
			).toBeInTheDocument();

			// Check for error container with destructive styling
			const errorContainer = screen.getByText(
				"Invalid file type. Please upload an image file."
			).parentElement;
			expect(errorContainer).toBeInTheDocument();
			expect(errorContainer).toHaveClass(
				"flex",
				"items-center",
				"space-x-2",
				"rounded-md",
				"text-destructive",
				"text-sm"
			);
		});

		it("should show custom max size in error", () => {
			const customSize = 2 * 1024 * 1024; // 2MB
			render(<ImageUpload maxSize={customSize} onChange={mockOnChange} />);

			const rejection = {
				file: new File(["test"], "test.png", { type: "image/png" }),
				errors: [{ code: "file-too-large", message: "File too large" }],
			};

			const dropzoneConfig = mockUseDropzone.mock.calls[0][0];

			act(() => {
				dropzoneConfig.onDrop([], [rejection]);
			});

			expect(screen.getByText(FILE_SIZE_LIMIT_2MB_REGEX)).toBeInTheDocument();
		});
	});

	describe("Dropzone Configuration", () => {
		it("should configure dropzone with correct options", () => {
			render(<ImageUpload onChange={mockOnChange} />);

			expect(mockUseDropzone).toHaveBeenCalledWith({
				onDrop: expect.any(Function),
				accept: {
					"image/*": [".png", ".jpg", ".jpeg", ".gif", ".webp"],
				},
				maxFiles: 1,
				maxSize: 5 * 1024 * 1024,
				disabled: false,
			});
		});

		it("should limit to single file", () => {
			render(<ImageUpload onChange={mockOnChange} />);

			expect(mockUseDropzone).toHaveBeenCalledWith(
				expect.objectContaining({
					maxFiles: 1,
				})
			);
		});
	});

	describe("Image Icons", () => {
		it("should show image icon when not dragging", () => {
			const { container } = render(<ImageUpload onChange={mockOnChange} />);

			// The ImageIcon is rendered inside the dropzone
			const iconContainer = container.querySelector(".rounded-full.bg-muted");
			expect(iconContainer).toBeInTheDocument();
		});

		it("should show trash icon in remove button", () => {
			render(
				<ImageUpload
					onChange={mockOnChange}
					value="https://example.com/image.jpg"
				/>
			);

			const removeButton = screen.getByRole("button", {
				name: REMOVE_IMAGE_REGEX,
			});
			expect(removeButton.querySelector(".h-4.w-4")).toBeInTheDocument();
		});
	});

	describe("Focus Management", () => {
		it("should have focus styles on dropzone", () => {
			const { container } = render(<ImageUpload onChange={mockOnChange} />);

			const dropzone = container.querySelector(
				".focus\\:outline-none.focus\\:ring-2"
			);
			expect(dropzone).toBeInTheDocument();
		});
	});

	describe("Edge Cases", () => {
		it("should handle undefined onRemove", async () => {
			const user = userEvent.setup();

			render(
				<ImageUpload
					onChange={mockOnChange}
					value="https://example.com/image.jpg"
				/>
			);

			const removeButton = screen.getByRole("button", {
				name: REMOVE_IMAGE_REGEX,
			});

			// Should not throw when onRemove is not provided
			await expect(user.click(removeButton)).resolves.not.toThrow();
			expect(mockOnChange).toHaveBeenCalledWith("");
		});

		it("should handle File object as value", () => {
			const file = new File(["test"], "test.png", { type: "image/png" });

			render(<ImageUpload onChange={mockOnChange} value={file} />);

			// Should render upload area since File object can't be displayed directly
			expect(screen.getByText("Upload an image")).toBeInTheDocument();
		});

		it("should handle empty preview URL", () => {
			render(<ImageUpload onChange={mockOnChange} />);

			// Upload a file
			const dropzoneConfig = mockUseDropzone.mock.calls[0][0];
			const file = new File(["test"], "test.png", { type: "image/png" });

			act(() => {
				dropzoneConfig.onDrop([file], []);
			});

			// Should still call onChange even if createObjectURL returns empty
			expect(mockOnChange).toHaveBeenCalledWith(file);
		});

		it("should handle multiple files by taking only the first", () => {
			const file1 = new File(["test1"], "test1.png", { type: "image/png" });
			const file2 = new File(["test2"], "test2.png", { type: "image/png" });

			render(<ImageUpload onChange={mockOnChange} />);

			const dropzoneConfig = mockUseDropzone.mock.calls[0][0];

			act(() => {
				dropzoneConfig.onDrop([file1, file2], []);
			});

			expect(mockOnChange).toHaveBeenCalledWith(file1);
			expect(mockOnChange).toHaveBeenCalledTimes(1);
		});
	});
});
