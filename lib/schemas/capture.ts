import { z } from "zod";

/**
 * Regex for validating base64 image data URL prefix
 */
const BASE64_IMAGE_REGEX = /^data:image\/(png|jpeg|jpg|gif|webp);base64,/;

/**
 * Regex for validating raw base64 data (without data URL prefix)
 * Matches base64 characters: A-Z, a-z, 0-9, +, /, =
 * Also allows whitespace (for line breaks in encoded data)
 */
const RAW_BASE64_REGEX = /^[A-Za-z0-9+/=\s]+$/;

/**
 * Regex for validating Windows absolute paths
 */
const WINDOWS_ABSOLUTE_PATH_REGEX = /^[a-zA-Z]:\\/;

/**
 * Check if a string is valid base64 (either with data URL prefix or raw)
 */
function isValidBase64Image(val: string): boolean {
	// Check for data URL format first
	if (BASE64_IMAGE_REGEX.test(val)) {
		return true;
	}

	// For raw base64, be more lenient - just check it's not empty
	// The actual base64 decoding will handle invalid data
	return val.length > 0 && RAW_BASE64_REGEX.test(val);
}

/**
 * Schema for capturing and uploading an image
 * Accepts either data URL format (data:image/...;base64,...) or raw base64 data
 */
export const captureImageSchema = z.object({
	base64Image: z
		.string()
		.min(1, "Image data is required")
		.refine(isValidBase64Image, {
			message:
				"Invalid image format. Must be a base64-encoded image or data URL.",
		}),
	assuranceCaseId: z.string().min(1, "Assurance case ID is required"),
});

export type CaptureImageInput = z.input<typeof captureImageSchema>;
export type CaptureImageData = z.output<typeof captureImageSchema>;

/**
 * Schema for checking if a file exists
 */
export const filePathSchema = z.object({
	filePath: z
		.string()
		.min(1, "File path is required")
		.refine(
			(path) => path.startsWith("/") || WINDOWS_ABSOLUTE_PATH_REGEX.test(path),
			{
				message: "Must be an absolute file path",
			}
		),
});

export type FilePathInput = z.input<typeof filePathSchema>;
export type FilePathData = z.output<typeof filePathSchema>;
