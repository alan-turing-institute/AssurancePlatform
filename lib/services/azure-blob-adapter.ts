/**
 * Azure Blob Storage adapter — the one place this application calls the
 * `@azure/storage-blob` SDK. Every other module reaches Azure through
 * `blob-storage-service.ts`'s key-based helpers, never through this file's
 * exports directly, and never through the SDK itself: keeping the SDK calls
 * in one small file is what lets a test mock exactly this module and still
 * exercise the real local-storage branch and the real backend-selection
 * logic around it.
 */

import {
	BlobServiceClient,
	StorageSharedKeyCredential,
} from "@azure/storage-blob";
import { logger } from "@/lib/logger";

const log = logger.child({ service: "azure-blob-adapter" });

const CONTAINER_NAME = "media";

function getContainerClient() {
	const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
	const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
	if (!(accountName && accountKey)) {
		return null;
	}

	const credential = new StorageSharedKeyCredential(accountName, accountKey);
	const client = new BlobServiceClient(
		`https://${accountName}.blob.core.windows.net`,
		credential
	);
	return client.getContainerClient(CONTAINER_NAME);
}

/** True for the SDK's "no such blob" error — every other failure re-throws. */
function isBlobNotFoundError(error: unknown): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		"statusCode" in error &&
		(error as { statusCode?: number }).statusCode === 404
	);
}

async function streamToBuffer(
	stream: NodeJS.ReadableStream | undefined
): Promise<Buffer> {
	if (!stream) {
		return Buffer.alloc(0);
	}
	const chunks: Buffer[] = [];
	for await (const chunk of stream) {
		chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
	}
	return Buffer.concat(chunks);
}

/** Uploads `data` to `key`, overwriting anything already there. Returns `false` when Azure isn't configured. */
export async function azureUploadBlob(
	key: string,
	data: Buffer,
	contentType: string
): Promise<boolean> {
	const container = getContainerClient();
	if (!container) {
		return false;
	}
	try {
		await container
			.getBlockBlobClient(key)
			.uploadData(data, { blobHTTPHeaders: { blobContentType: contentType } });
		return true;
	} catch (error) {
		log.error("Failed to upload blob", { key, error });
		return false;
	}
}

/** Downloads `key`'s full contents. `null` when Azure isn't configured, the blob doesn't exist, or the download fails. */
export async function azureDownloadBlob(
	key: string
): Promise<{ data: Buffer; contentType: string } | null> {
	const container = getContainerClient();
	if (!container) {
		return null;
	}
	try {
		const download = await container.getBlockBlobClient(key).download();
		const data = await streamToBuffer(download.readableStreamBody);
		return {
			data,
			contentType: download.contentType ?? "application/octet-stream",
		};
	} catch (error) {
		if (isBlobNotFoundError(error)) {
			return null;
		}
		log.error("Failed to download blob", { key, error });
		return null;
	}
}

/** Deletes `key`. Returns `true` when the blob is gone (deleted now, or already absent), `false` on a genuine failure or when Azure isn't configured. */
export async function azureDeleteBlob(key: string): Promise<boolean> {
	const container = getContainerClient();
	if (!container) {
		return false;
	}
	try {
		await container.getBlockBlobClient(key).delete();
		return true;
	} catch (error) {
		if (isBlobNotFoundError(error)) {
			return true;
		}
		log.error("Failed to delete blob", { key, error });
		return false;
	}
}
