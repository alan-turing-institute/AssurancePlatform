import { randomUUID } from "node:crypto";
import {
	access,
	mkdir,
	readFile,
	rm,
	unlink,
	writeFile,
} from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import { logger } from "@/lib/logger";
import { isExternalMediaUrl, toMediaKey } from "@/lib/media-key";
import {
	deleteBlob,
	downloadFromBlob,
	getMimeTypeFromExtension,
	isAzureStorageConfigured,
	UPLOADS_DIR,
	uploadToBlob,
} from "./blob-storage-service";

const log = logger.child({ service: "file-storage-service" });

/**
 * File Storage Service
 *
 * Provides file upload/delete functionality with automatic backend selection:
 * - Production: Azure Blob Storage (persistent, scalable)
 * - Development: Local filesystem (`UPLOADS_DIR`, outside `public/`)
 *
 * Environment variables for production:
 * - AZURE_STORAGE_ACCOUNT_NAME
 * - AZURE_STORAGE_ACCOUNT_KEY
 */

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = [
	"image/jpeg",
	"image/png",
	"image/gif",
	"image/webp",
];

type SaveFileResult = { data: { key: string } } | { error: string };

export interface DetectedImageFormat {
	extension: string;
	mimeType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
}

/** PNG's fixed 8-byte signature (RFC 2083 §3.1). */
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * One entry per allowed image format, each testing the buffer's leading
 * magic bytes rather than trusting a declared MIME type — the check that
 * catches a file whose extension/`Content-Type` lies about its content.
 */
const MAGIC_BYTE_CHECKS: Array<{
	extension: string;
	matches: (buffer: Buffer) => boolean;
	mimeType: DetectedImageFormat["mimeType"];
}> = [
	{
		mimeType: "image/jpeg",
		extension: ".jpg",
		matches: (buffer) =>
			buffer.length >= 3 &&
			buffer[0] === 0xff &&
			buffer[1] === 0xd8 &&
			buffer[2] === 0xff,
	},
	{
		mimeType: "image/png",
		extension: ".png",
		matches: (buffer) =>
			buffer.length >= PNG_SIGNATURE.length &&
			PNG_SIGNATURE.every((byte, index) => buffer[index] === byte),
	},
	{
		mimeType: "image/gif",
		extension: ".gif",
		matches: (buffer) => {
			if (buffer.length < 6) {
				return false;
			}
			const header = buffer.subarray(0, 6).toString("ascii");
			return header === "GIF87a" || header === "GIF89a";
		},
	},
	{
		mimeType: "image/webp",
		extension: ".webp",
		matches: (buffer) =>
			buffer.length >= 12 &&
			buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
			buffer.subarray(8, 12).toString("ascii") === "WEBP",
	},
];

/**
 * Detects an image's real format from its leading bytes ("magic bytes"),
 * independent of any declared MIME type or file extension. Returns `null`
 * when nothing matches — including a near-miss such as a RIFF container
 * that isn't WebP.
 */
export function detectImageFormat(buffer: Buffer): DetectedImageFormat | null {
	for (const check of MAGIC_BYTE_CHECKS) {
		if (check.matches(buffer)) {
			return { mimeType: check.mimeType, extension: check.extension };
		}
	}
	return null;
}

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
 * Validates a file before saving: size and declared MIME type, then the
 * buffer's actual content signature — both that it is one of the four
 * allowed formats, and that it matches the declared `file.type` (a lying
 * `Content-Type` no longer gets a free pass). The stored extension is
 * derived from the detected format, not the declared one.
 */
function validateFile(
	file: File,
	buffer: Buffer
): { valid: true; extension: string } | { valid: false; error: string } {
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

	const detected = detectImageFormat(buffer);
	if (!detected || detected.mimeType !== file.type) {
		return {
			valid: false,
			error:
				"Invalid file type. The file's content does not match an allowed image format.",
		};
	}

	return { valid: true, extension: detected.extension };
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
		const dirPath = join(UPLOADS_DIR, subDirectory);
		await ensureDirectory(dirPath);

		const uniqueFilename = `${randomUUID()}${extension}`;
		const filePath = join(dirPath, uniqueFilename);

		await writeFile(filePath, buffer);

		const key = `${subDirectory}/${uniqueFilename}`;
		log.info("Dev file saved locally", { key });

		return { data: { key } };
	} catch (error) {
		log.error("Error saving file locally", { error });
		return { error: "Failed to save file" };
	}
}

/**
 * Saves a file to storage (Azure Blob in production, local in development)
 * and returns its storage key — never a URL. A caller resolves its own
 * route address from the key rather than handing this value to a browser.
 *
 * @param file - The file to save
 * @param subDirectory - Subdirectory/prefix for the file (e.g., "case-studies/123")
 * @returns `{ data: { key } }` on success, `{ error }` on failure
 */
export async function saveFile(
	file: File,
	subDirectory: string
): Promise<SaveFileResult> {
	const arrayBuffer = await file.arrayBuffer();
	const buffer = Buffer.from(arrayBuffer);

	const validation = validateFile(file, buffer);
	if (validation.valid === false) {
		return { error: validation.error };
	}
	const { extension } = validation;

	// Use Azure Blob Storage in production
	if (isAzureStorageConfigured()) {
		const uniqueFilename = `${randomUUID()}${extension}`;
		const blobPath = `${subDirectory}/${uniqueFilename}`;
		const contentType = getMimeTypeFromExtension(extension);

		const result = await uploadToBlob(buffer, blobPath, contentType);

		if ("error" in result) {
			return result;
		}
		return { data: { key: result.data.key } };
	}

	// Fall back to local storage in development or when explicitly enabled for self-hosting
	if (
		process.env.NODE_ENV === "development" ||
		process.env.USE_LOCAL_STORAGE === "true"
	) {
		return saveFileLocally(buffer, subDirectory, extension);
	}

	// Production without Azure configured and local storage not enabled
	log.error(
		"Storage not configured. Set USE_LOCAL_STORAGE=true for local filesystem storage, or configure Azure Blob Storage."
	);
	return { error: "Storage not configured" };
}

// ============================================
// Stored-value shapes (D3): a row written before this change may still hold
// a `/uploads/<key>` path or a full Azure blob URL; a row written after it
// holds the bare key. `toMediaKey` accepts all three and returns the key,
// so nothing has to be rewritten for old rows to keep working.
// ============================================

const UPLOADS_PATH_PREFIX = "/uploads/";

// `toMediaKey`/`isExternalMediaUrl` themselves live in the dependency-free
// `lib/media-key.ts` (imported above) and are NOT re-exported from here —
// a Client Component (Discover's render sites, via `lib/discover-image.ts`)
// reaches them too, and re-exporting from this file would pull this file's
// `node:fs`/`node:crypto`/Azure-SDK imports into that client bundle. Every
// other caller (`discover-service.ts`, `publish-service.ts`,
// `case-information-service.ts`, `case-image-service.ts`) imports them
// straight from `lib/media-key.ts` as well.

/**
 * Resolves a media key to an absolute path under `UPLOADS_DIR`, rejecting
 * anything that could escape it — traversal segments (`..`, `.`), empty
 * segments, and segments carrying a raw separator or NUL byte. Returns
 * `null` for anything rejected, and re-checks containment on the resolved
 * path as a second, independent guard. Moved from the deleted
 * `app/uploads/[...path]/route.ts`, adapted to take a key string rather than
 * pre-split route segments.
 */
function resolveSafeUploadsPath(key: string): string | null {
	const segments = key.split("/");
	if (segments.length === 0) {
		return null;
	}

	for (const segment of segments) {
		if (
			!segment ||
			segment === "." ||
			segment === ".." ||
			segment.includes("\\") ||
			segment.includes("\0")
		) {
			return null;
		}
	}

	const root = resolve(UPLOADS_DIR);
	const candidate = resolve(root, ...segments);
	const isWithinRoot = candidate === root || candidate.startsWith(root + sep);

	return isWithinRoot ? candidate : null;
}

async function readLocalMedia(
	key: string
): Promise<{ data: Buffer; contentType: string } | null> {
	const filePath = resolveSafeUploadsPath(key);
	if (!filePath) {
		return null;
	}
	try {
		const data = await readFile(filePath);
		return { data, contentType: getMimeTypeFromExtension(extname(filePath)) };
	} catch {
		return null;
	}
}

async function writeLocalMedia(key: string, data: Buffer): Promise<boolean> {
	const filePath = resolveSafeUploadsPath(key);
	if (!filePath) {
		return false;
	}
	try {
		await ensureDirectory(join(filePath, ".."));
		await writeFile(filePath, data);
		return true;
	} catch (error) {
		log.error("Failed to write local media", { key, error });
		return false;
	}
}

async function deleteLocalMedia(key: string): Promise<boolean> {
	const filePath = resolveSafeUploadsPath(key);
	if (!filePath) {
		return false;
	}
	try {
		await unlink(filePath);
		return true;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return true;
		}
		log.error("Failed to delete local media", { key, error });
		return false;
	}
}

/**
 * Reads a media key's full contents from whichever backend is active
 * (D2) — Azure when configured, local disk otherwise. `null` for a missing
 * or unreadable key on either backend; callers turn that into a 404, never
 * a distinguishable error.
 */
export async function readMedia(
	key: string
): Promise<{ data: Buffer; contentType: string } | null> {
	if (isAzureStorageConfigured()) {
		return await downloadFromBlob(key);
	}
	return await readLocalMedia(key);
}

/**
 * Copies a media key to a new key on the same backend, by reading its full
 * contents and writing them to `toKey` — used at publish time (D5) to give a
 * published snapshot its own, independent copy of the feature image.
 * `false` when the source key doesn't exist or the write fails; never
 * throws.
 */
export async function copyMedia(
	fromKey: string,
	toKey: string
): Promise<boolean> {
	const media = await readMedia(fromKey);
	if (!media) {
		return false;
	}
	if (isAzureStorageConfigured()) {
		const result = await uploadToBlob(media.data, toKey, media.contentType);
		return "data" in result;
	}
	return await writeLocalMedia(toKey, media.data);
}

/**
 * Deletes a media key from whichever backend is active. `true` when the key
 * is gone (deleted now, or already absent); `false` on a genuine failure.
 * Used for `published/` copies (D5) — call sites treat a `false` as
 * best-effort and log it rather than fail the caller's own operation.
 */
export async function deleteMedia(key: string): Promise<boolean> {
	if (isAzureStorageConfigured()) {
		return await deleteBlob(key);
	}
	return await deleteLocalMedia(key);
}

/**
 * Deletes a file from storage, given any of the shapes a stored value can
 * take: a bare key (new uploads, D3), a legacy `/uploads/<key>` path, or a
 * legacy Azure blob URL. The legacy shapes name their own backend
 * unambiguously; a bare key is deleted from whichever backend is currently
 * active.
 *
 * @param filePath - The value stored on the record (key or legacy URL/path)
 * @returns true if deleted successfully, false otherwise
 */
export async function deleteFile(filePath: string): Promise<boolean> {
	if (!filePath) {
		return false;
	}

	if (filePath.includes("blob.core.windows.net")) {
		const key = toMediaKey(filePath);
		return await deleteBlob(key);
	}

	if (filePath.startsWith(UPLOADS_PATH_PREFIX)) {
		return await deleteLocalMedia(toMediaKey(filePath));
	}

	if (isExternalMediaUrl(filePath)) {
		log.warn("Unknown file path format", { filePath });
		return false;
	}

	// A bare key from a post-D3 upload — delete from whichever backend is
	// currently active.
	return await deleteMedia(filePath);
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
		const dirPath = join(UPLOADS_DIR, subDirectory);
		await rm(dirPath, { recursive: true, force: true });
		return true;
	} catch (error) {
		log.error("Error deleting directory", { error });
		return false;
	}
}

/**
 * Gets the full filesystem path for a stored local value (local storage only)
 */
export function getFilesystemPath(relativePath: string): string {
	return join(UPLOADS_DIR, toMediaKey(relativePath));
}

/**
 * Checks if a file exists (local storage only)
 */
export async function fileExists(relativePath: string): Promise<boolean> {
	if (!relativePath) {
		return false;
	}
	if (isExternalMediaUrl(relativePath)) {
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
