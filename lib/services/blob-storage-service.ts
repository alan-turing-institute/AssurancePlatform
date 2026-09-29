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
import { join, resolve, sep } from "node:path";
import { logger } from "@/lib/logger";
import { isValidMediaKey } from "@/lib/media-key";
import {
	azureDeleteBlob,
	azureDownloadBlob,
	azureUploadBlob,
} from "./azure-blob-adapter";

const log = logger.child({ service: "blob-storage-service" });

/**
 * Local upload root — never under `public/`, so nothing written here is
 * served by Next's static-file handling. Shared with `file-storage-service.ts`
 * (which imports this constant) so both files' local-storage fallbacks agree
 * on one root. `UPLOADS_DIR` overrides the default for deployments that need
 * a different mount point (Docker, self-hosting); the default suits `next
 * dev` and the bare-Node local path.
 */
export const UPLOADS_DIR = process.env.UPLOADS_DIR
	? resolve(process.env.UPLOADS_DIR)
	: join(process.cwd(), "uploads");

export type UploadResult =
	| {
			success: true;
			key: string;
	  }
	| {
			success: false;
			error: string;
	  };

/**
 * Service-layer upload result using the canonical `{ data } | { error }` discriminated union.
 * Carries the storage key only — never a URL — so a caller never has anything
 * to hand a browser directly; every uploader resolves its own route address
 * from the key instead.
 */
export type BlobUploadResult = { data: { key: string } } | { error: string };

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
 * Resolves a media key to an absolute path under `UPLOADS_DIR`, rejecting
 * anything that could escape it. `isValidMediaKey` does the actual
 * segment-level check (empty, `.`/`..`, backslash, NUL, leading `/`); the
 * `resolve`-and-containment check here is a second, independent guard on the
 * resulting path. The one function every local-storage path goes through —
 * `file-storage-service.ts` imports this rather than keeping its own copy,
 * so there is exactly one place a local path is ever built from a key.
 */
export function resolveSafeUploadsPath(key: string): string | null {
	if (!isValidMediaKey(key)) {
		return null;
	}
	const root = resolve(UPLOADS_DIR);
	const candidate = resolve(root, ...key.split("/"));
	const isWithinRoot = candidate === root || candidate.startsWith(root + sep);
	return isWithinRoot ? candidate : null;
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
	const fullPath = resolveSafeUploadsPath(blobPath);
	if (!fullPath) {
		log.error("Refused to save a file outside the uploads root", { blobPath });
		return { success: false, error: "Invalid storage key" };
	}
	try {
		const dirPath = join(fullPath, "..");

		// Ensure the upload directory exists
		if (!existsSync(dirPath)) {
			mkdirSync(dirPath, { recursive: true });
		}

		writeFileSync(fullPath, buffer);

		log.info("Dev file saved locally", { key: blobPath });
		return { success: true, key: blobPath };
	} catch (error) {
		log.error("Failed to save file locally", { error });
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
 * @param blobPath - The path within the container (e.g., 'images/screenshot.png') — also the storage key returned on success
 * @param contentType - MIME type of the file (default: image/png)
 * @returns `{ data: { key } }` on success, `{ error }` on failure
 */
export async function uploadToBlob(
	buffer: Buffer,
	blobPath: string,
	contentType = "image/png"
): Promise<BlobUploadResult> {
	if (isAzureStorageConfigured()) {
		const uploaded = await azureUploadBlob(blobPath, buffer, contentType);
		if (!uploaded) {
			return { error: "Upload failed" };
		}
		return { data: { key: blobPath } };
	}

	// Fall back to local storage when Azure isn't configured
	if (process.env.NODE_ENV === "development") {
		log.info("Dev Azure Blob Storage not configured, using local file storage");
		const localResult = uploadToLocalStorage(buffer, blobPath);
		if (!localResult.success) {
			return { error: localResult.error };
		}
		return { data: { key: localResult.key } };
	}
	log.error("Azure Blob Storage credentials not configured");
	return { error: "Storage not configured" };
}

/**
 * Deletes a blob from Azure Blob Storage.
 * Falls back to local file deletion in development.
 *
 * @param blobPath - The path within the container (e.g., 'images/screenshot.png')
 * @returns true if deleted successfully
 */
export async function deleteBlob(blobPath: string): Promise<boolean> {
	if (isAzureStorageConfigured()) {
		return azureDeleteBlob(blobPath);
	}

	// Fall back to local storage when Azure isn't configured
	if (process.env.NODE_ENV === "development") {
		const fullPath = resolveSafeUploadsPath(blobPath);
		if (!fullPath) {
			log.error("Refused to delete a file outside the uploads root", {
				blobPath,
			});
			return false;
		}
		try {
			const { unlink } = await import("node:fs/promises");
			await unlink(fullPath);
			log.info("Dev file deleted locally", { blobPath });
			return true;
		} catch (error) {
			log.error("Failed to delete local file", { error });
			return false;
		}
	}
	return false;
}

/**
 * Reads a blob's full contents from Azure Blob Storage. Used by
 * `file-storage-service.ts`'s `readMedia` for the Azure branch — kept here
 * (rather than calling the adapter directly from that file) so every
 * Azure-configuration check stays behind this file's `isAzureStorageConfigured`.
 */
export function downloadFromBlob(
	blobPath: string
): Promise<{ data: Buffer; contentType: string } | null> {
	if (!isAzureStorageConfigured()) {
		return Promise.resolve(null);
	}
	return azureDownloadBlob(blobPath);
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
