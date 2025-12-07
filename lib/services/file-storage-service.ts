import { randomUUID } from "node:crypto";
import { access, mkdir, rm, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
	deleteBlob,
	getExtensionFromMimeType,
	getMimeTypeFromExtension,
	isAzureStorageConfigured,
	uploadToBlob,
} from "./blob-storage-service";

/**
 * File Storage Service
 *
 * Provides file upload/delete functionality with automatic backend selection:
 * - Production: Azure Blob Storage (persistent, scalable)
 * - Development: Local filesystem (public/uploads directory)
 *
 * Environment variables for production:
 * - AZURE_STORAGE_ACCOUNT_NAME
 * - AZURE_STORAGE_ACCOUNT_KEY
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
 * Ensures the upload directory exists (for local storage)
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
 * Saves a file to local storage (development fallback)
 */
async function saveFileLocally(
	buffer: Buffer,
	subDirectory: string,
	extension: string
): Promise<SaveFileResult> {
	try {
		const dirPath = join(UPLOAD_DIR, subDirectory);
		await ensureDirectory(dirPath);

		const uniqueFilename = `${randomUUID()}${extension}`;
		const filePath = join(dirPath, uniqueFilename);

		await writeFile(filePath, buffer);

		const relativePath = `/uploads/${subDirectory}/${uniqueFilename}`;
		console.log(`[Dev] File saved locally: ${relativePath}`);

		return { success: true, path: relativePath };
	} catch (error) {
		console.error("Error saving file locally:", error);
		return { success: false, error: "Failed to save file" };
	}
}

/**
 * Saves a file to storage (Azure Blob in production, local in development)
 *
 * @param file - The file to save
 * @param subDirectory - Subdirectory/prefix for the file (e.g., "case-studies/123")
 * @returns Result with the URL/path to the saved file
 */
export async function saveFile(
	file: File,
	subDirectory: string
): Promise<SaveFileResult> {
	const validation = validateFile(file);
	if (validation.valid === false) {
		return { success: false, error: validation.error };
	}

	const extension = getExtensionFromMimeType(file.type);
	const arrayBuffer = await file.arrayBuffer();
	const buffer = Buffer.from(arrayBuffer);

	// Use Azure Blob Storage in production
	if (isAzureStorageConfigured()) {
		const uniqueFilename = `${randomUUID()}${extension}`;
		const blobPath = `${subDirectory}/${uniqueFilename}`;
		const contentType = getMimeTypeFromExtension(extension);

		const result = await uploadToBlob(buffer, blobPath, contentType);

		if (result.success === false) {
			return { success: false, error: result.error };
		}
		return { success: true, path: result.url };
	}

	// Fall back to local storage in development
	if (process.env.NODE_ENV === "development") {
		return saveFileLocally(buffer, subDirectory, extension);
	}

	// Production without Azure configured - error
	console.error("Azure Blob Storage not configured for production");
	return { success: false, error: "Storage not configured" };
}

/**
 * Deletes a file from storage
 *
 * @param filePath - The path/URL returned from saveFile
 * @returns true if deleted successfully, false otherwise
 */
export async function deleteFile(filePath: string): Promise<boolean> {
	if (!filePath) {
		return false;
	}

	// Azure Blob Storage URL
	if (filePath.includes("blob.core.windows.net")) {
		// Extract blob path from URL
		// URL format: https://account.blob.core.windows.net/container/path/to/file.ext
		try {
			const url = new URL(filePath);
			const pathParts = url.pathname.split("/");
			// Remove empty string and container name, keep the rest as blob path
			const blobPath = pathParts.slice(2).join("/");
			return deleteBlob(blobPath);
		} catch (error) {
			console.error("Failed to parse blob URL:", error);
			return false;
		}
	}

	// Local file path (starts with /uploads/)
	if (filePath.startsWith("/uploads/")) {
		try {
			const fullPath = join(process.cwd(), "public", filePath.slice(1));
			await unlink(fullPath);
			console.log(`[Dev] File deleted locally: ${filePath}`);
			return true;
		} catch (error) {
			console.error("Error deleting local file:", error);
			return false;
		}
	}

	console.warn("Unknown file path format:", filePath);
	return false;
}

/**
 * Deletes all files in a directory (local storage only)
 *
 * @param subDirectory - Subdirectory under uploads (e.g., "case-studies/123")
 * @returns true if deleted successfully, false otherwise
 */
export async function deleteDirectory(subDirectory: string): Promise<boolean> {
	// This only works for local storage
	// For Azure, you'd need to list and delete blobs with the prefix
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
 * Gets the full filesystem path for a relative URL (local storage only)
 */
export function getFilesystemPath(relativePath: string): string {
	return join(process.cwd(), "public", relativePath.slice(1));
}

/**
 * Checks if a file exists (local storage only)
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
