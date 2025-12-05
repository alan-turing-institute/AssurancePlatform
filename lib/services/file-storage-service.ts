import { randomUUID } from "node:crypto";
import { access, mkdir, rm, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * File Storage Service for local development.
 *
 * Stores files in the public/uploads directory for easy serving.
 * In production, this should be replaced with cloud storage (e.g., Azure Blob Storage).
 */

const UPLOAD_DIR = join(process.cwd(), "public", "uploads");
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = [
	"image/jpeg",
	"image/png",
	"image/gif",
	"image/webp",
];

type SaveFileResult = {
	success: boolean;
	path?: string;
	error?: string;
};

/**
 * Ensures the upload directory exists
 */
async function ensureDirectory(dirPath: string): Promise<void> {
	try {
		await access(dirPath);
	} catch {
		await mkdir(dirPath, { recursive: true });
	}
}

/**
 * Validates a file before saving
 */
function validateFile(
	file: File
): { valid: true } | { valid: false; error: string } {
	if (file.size > MAX_FILE_SIZE) {
		return {
			valid: false,
			error: `File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
		};
	}

	if (!ALLOWED_MIME_TYPES.includes(file.type)) {
		return {
			valid: false,
			error: `Invalid file type. Allowed types: ${ALLOWED_MIME_TYPES.join(", ")}`,
		};
	}

	return { valid: true };
}

/**
 * Gets the file extension from MIME type
 */
function getExtensionFromMimeType(mimeType: string): string {
	const mimeToExt: Record<string, string> = {
		"image/jpeg": ".jpg",
		"image/png": ".png",
		"image/gif": ".gif",
		"image/webp": ".webp",
	};
	return mimeToExt[mimeType] ?? ".bin";
}

/**
 * Saves a file to local storage
 *
 * @param file - The file to save
 * @param subDirectory - Subdirectory under uploads (e.g., "case-studies/123")
 * @returns Result with the relative URL path to the saved file
 */
export async function saveFile(
	file: File,
	subDirectory: string
): Promise<SaveFileResult> {
	const validation = validateFile(file);
	if (!validation.valid) {
		return { success: false, error: validation.error };
	}

	try {
		const dirPath = join(UPLOAD_DIR, subDirectory);
		await ensureDirectory(dirPath);

		// Generate unique filename to avoid collisions
		const extension = getExtensionFromMimeType(file.type);
		const uniqueFilename = `${randomUUID()}${extension}`;
		const filePath = join(dirPath, uniqueFilename);

		// Convert File to Buffer and write
		const arrayBuffer = await file.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);
		await writeFile(filePath, buffer);

		// Return the relative URL path (for serving from /public)
		const relativePath = `/uploads/${subDirectory}/${uniqueFilename}`;

		return { success: true, path: relativePath };
	} catch (error) {
		console.error("Error saving file:", error);
		return { success: false, error: "Failed to save file" };
	}
}

/**
 * Deletes a file from local storage
 *
 * @param relativePath - The relative path returned from saveFile (e.g., "/uploads/case-studies/123/abc.jpg")
 * @returns true if deleted successfully, false otherwise
 */
export async function deleteFile(relativePath: string): Promise<boolean> {
	if (!relativePath?.startsWith("/uploads/")) {
		return false;
	}

	try {
		// Convert relative URL to filesystem path
		const filePath = join(process.cwd(), "public", relativePath.slice(1));

		await unlink(filePath);
		return true;
	} catch (error) {
		// File might not exist, which is fine
		console.error("Error deleting file:", error);
		return false;
	}
}

/**
 * Deletes all files in a directory
 *
 * @param subDirectory - Subdirectory under uploads (e.g., "case-studies/123")
 * @returns true if deleted successfully, false otherwise
 */
export async function deleteDirectory(subDirectory: string): Promise<boolean> {
	try {
		const dirPath = join(UPLOAD_DIR, subDirectory);
		await rm(dirPath, { recursive: true, force: true });
		return true;
	} catch (error) {
		console.error("Error deleting directory:", error);
		return false;
	}
}

/**
 * Gets the full filesystem path for a relative URL
 */
export function getFilesystemPath(relativePath: string): string {
	return join(process.cwd(), "public", relativePath.slice(1));
}

/**
 * Checks if a file exists
 */
export async function fileExists(relativePath: string): Promise<boolean> {
	if (!relativePath?.startsWith("/uploads/")) {
		return false;
	}

	try {
		const filePath = getFilesystemPath(relativePath);
		await access(filePath);
		return true;
	} catch {
		return false;
	}
}
