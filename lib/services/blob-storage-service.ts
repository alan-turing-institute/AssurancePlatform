/**
 * Azure Blob Storage service for handling file uploads.
 *
 * Provides secure upload functionality using environment-configured credentials.
 * Falls back to local file storage in development when Azure is not configured.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BlobServiceClient } from "@azure/storage-blob";

const CONTAINER_NAME = "sample-container";
const LOCAL_UPLOAD_DIR = "public/uploads/screenshots";

type UploadResult =
	| {
			success: true;
			url: string;
	  }
	| {
			success: false;
			error: string;
	  };

/**
 * Uploads a buffer to local file storage (development fallback).
 */
function uploadToLocalStorage(buffer: Buffer, filename: string): UploadResult {
	try {
		const uploadDir = join(process.cwd(), LOCAL_UPLOAD_DIR);

		// Ensure the upload directory exists
		if (!existsSync(uploadDir)) {
			mkdirSync(uploadDir, { recursive: true });
		}

		const filePath = join(uploadDir, filename);
		writeFileSync(filePath, buffer);

		// Return a URL relative to the public directory
		const url = `/uploads/screenshots/${filename}`;
		console.log(`[Dev] Screenshot saved locally: ${url}`);
		return { success: true, url };
	} catch (error) {
		console.error("Failed to save screenshot locally:", error);
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
 * @param filename - The name to save the file as
 * @param contentType - MIME type of the file (default: image/png)
 * @returns The URL of the uploaded file or an error
 */
export async function uploadToBlob(
	buffer: Buffer,
	filename: string,
	contentType = "image/png"
): Promise<UploadResult> {
	const sasToken = process.env.NEXT_PUBLIC_STORAGESASTOKEN;
	const accountName = process.env.NEXT_PUBLIC_STORAGESOURCENAME;

	// Fall back to local storage in development when Azure isn't configured
	if (!(sasToken && accountName)) {
		if (process.env.NODE_ENV === "development") {
			console.log(
				"[Dev] Azure Blob Storage not configured, using local file storage"
			);
			return uploadToLocalStorage(buffer, filename);
		}
		console.error("Azure Blob Storage credentials not configured");
		return {
			success: false,
			error: "Storage not configured",
		};
	}

	try {
		const blobServiceUrl = `https://${accountName}.blob.core.windows.net/?${sasToken}`;
		const blobServiceClient = new BlobServiceClient(blobServiceUrl);
		const containerClient =
			blobServiceClient.getContainerClient(CONTAINER_NAME);
		const blockBlobClient = containerClient.getBlockBlobClient(filename);

		await blockBlobClient.uploadData(buffer, {
			blobHTTPHeaders: { blobContentType: contentType },
		});

		const imageUrl = `https://${accountName}.blob.core.windows.net/${CONTAINER_NAME}/${filename}`;
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
 * Generates a unique filename for a case screenshot.
 *
 * @param caseId - The assurance case ID
 * @returns A unique filename with timestamp
 */
export function generateScreenshotFilename(caseId: string): string {
	const timestamp = Date.now();
	return `case-screenshot-${caseId}-${timestamp}.png`;
}
