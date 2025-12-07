/**
 * Azure Blob Storage service for handling file uploads.
 *
 * Provides secure upload functionality using environment-configured credentials.
 * Falls back to local file storage in development when Azure is not configured.
 *
 * Environment variables required for production:
 * - AZURE_STORAGE_ACCOUNT_NAME: The storage account name (e.g., 'teastorageaccount')
 * - AZURE_STORAGE_ACCOUNT_KEY: The storage account access key
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
	BlobServiceClient,
	StorageSharedKeyCredential,
} from "@azure/storage-blob";

const CONTAINER_NAME = "media";
const LOCAL_UPLOAD_DIR = "public/uploads";

export type UploadResult =
	| {
			success: true;
			url: string;
	  }
	| {
			success: false;
			error: string;
	  };

/**
 * Checks if Azure Blob Storage is configured.
 */
export function isAzureStorageConfigured(): boolean {
	return !!(
		process.env.AZURE_STORAGE_ACCOUNT_NAME &&
		process.env.AZURE_STORAGE_ACCOUNT_KEY
	);
}

/**
 * Gets a configured BlobServiceClient for Azure Storage.
 * Returns null if not configured.
 */
function getBlobServiceClient(): BlobServiceClient | null {
	const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
	const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;

	if (!(accountName && accountKey)) {
		return null;
	}

	const sharedKeyCredential = new StorageSharedKeyCredential(
		accountName,
		accountKey
	);
	const blobServiceUrl = `https://${accountName}.blob.core.windows.net`;
	return new BlobServiceClient(blobServiceUrl, sharedKeyCredential);
}

/**
 * Uploads a buffer to local file storage (development fallback).
 *
 * @param buffer - The file data as a Buffer
 * @param blobPath - The path including any subdirectories (e.g., 'images/screenshot.png')
 */
export function uploadToLocalStorage(
	buffer: Buffer,
	blobPath: string
): UploadResult {
	try {
		const fullPath = join(process.cwd(), LOCAL_UPLOAD_DIR, blobPath);
		const dirPath = join(fullPath, "..");

		// Ensure the upload directory exists
		if (!existsSync(dirPath)) {
			mkdirSync(dirPath, { recursive: true });
		}

		writeFileSync(fullPath, buffer);

		// Return a URL relative to the public directory
		const url = `/uploads/${blobPath}`;
		console.log(`[Dev] File saved locally: ${url}`);
		return { success: true, url };
	} catch (error) {
		console.error("Failed to save file locally:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Local upload failed",
		};
	}
}

/**
 * Uploads a buffer to Azure Blob Storage.
 * Falls back to local storage in development when Azure is not configured.
 *
 * @param buffer - The file data as a Buffer
 * @param blobPath - The path within the container (e.g., 'images/screenshot.png')
 * @param contentType - MIME type of the file (default: image/png)
 * @returns The URL of the uploaded file or an error
 */
export async function uploadToBlob(
	buffer: Buffer,
	blobPath: string,
	contentType = "image/png"
): Promise<UploadResult> {
	const blobServiceClient = getBlobServiceClient();
	const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;

	// Fall back to local storage when Azure isn't configured
	if (!blobServiceClient) {
		if (process.env.NODE_ENV === "development") {
			console.log(
				"[Dev] Azure Blob Storage not configured, using local file storage"
			);
			return uploadToLocalStorage(buffer, blobPath);
		}
		console.error("Azure Blob Storage credentials not configured");
		return {
			success: false,
			error: "Storage not configured",
		};
	}

	try {
		const containerClient =
			blobServiceClient.getContainerClient(CONTAINER_NAME);
		const blockBlobClient = containerClient.getBlockBlobClient(blobPath);

		await blockBlobClient.uploadData(buffer, {
			blobHTTPHeaders: { blobContentType: contentType },
		});

		const imageUrl = `https://${accountName}.blob.core.windows.net/${CONTAINER_NAME}/${blobPath}`;
		return { success: true, url: imageUrl };
	} catch (error) {
		console.error("Failed to upload to Azure Blob Storage:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Upload failed",
		};
	}
}

/**
 * Deletes a blob from Azure Blob Storage.
 * Falls back to local file deletion in development.
 *
 * @param blobPath - The path within the container (e.g., 'images/screenshot.png')
 * @returns true if deleted successfully
 */
export async function deleteBlob(blobPath: string): Promise<boolean> {
	const blobServiceClient = getBlobServiceClient();

	// Fall back to local storage when Azure isn't configured
	if (!blobServiceClient) {
		if (process.env.NODE_ENV === "development") {
			try {
				const { unlink } = await import("node:fs/promises");
				const fullPath = join(process.cwd(), LOCAL_UPLOAD_DIR, blobPath);
				await unlink(fullPath);
				console.log(`[Dev] File deleted locally: ${blobPath}`);
				return true;
			} catch (error) {
				console.error("Failed to delete local file:", error);
				return false;
			}
		}
		return false;
	}

	try {
		const containerClient =
			blobServiceClient.getContainerClient(CONTAINER_NAME);
		const blockBlobClient = containerClient.getBlockBlobClient(blobPath);
		await blockBlobClient.delete();
		return true;
	} catch (error) {
		console.error("Failed to delete blob:", error);
		return false;
	}
}

/**
 * Generates a unique blob path for a case screenshot.
 *
 * @param caseId - The assurance case ID
 * @returns A blob path with timestamp (e.g., 'images/case-screenshot-abc-123456.png')
 */
export function generateScreenshotBlobPath(caseId: string): string {
	const timestamp = Date.now();
	return `images/case-screenshot-${caseId}-${timestamp}.png`;
}

/**
 * Generates a unique blob path for a case study image.
 *
 * @param caseStudyId - The case study ID
 * @param extension - The file extension (e.g., '.png', '.jpg')
 * @returns A blob path (e.g., 'case_study_images/case-study-123-456789.png')
 */
export function generateCaseStudyImageBlobPath(
	caseStudyId: number,
	extension: string
): string {
	const timestamp = Date.now();
	return `case_study_images/case-study-${caseStudyId}-${timestamp}${extension}`;
}

/**
 * Gets the MIME type from a file extension.
 */
export function getMimeTypeFromExtension(extension: string): string {
	const mimeTypes: Record<string, string> = {
		".png": "image/png",
		".jpg": "image/jpeg",
		".jpeg": "image/jpeg",
		".gif": "image/gif",
		".webp": "image/webp",
	};
	return mimeTypes[extension.toLowerCase()] ?? "application/octet-stream";
}

/**
 * Gets the file extension from a MIME type.
 */
export function getExtensionFromMimeType(mimeType: string): string {
	const extensions: Record<string, string> = {
		"image/png": ".png",
		"image/jpeg": ".jpg",
		"image/gif": ".gif",
		"image/webp": ".webp",
	};
	return extensions[mimeType] ?? ".bin";
}
