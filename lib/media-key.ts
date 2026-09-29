/**
 * Pure string helpers for the three shapes a stored media value can take —
 * kept dependency-free (no `node:*`, no service imports) so this module is
 * safe to import from a Client Component (`discover-image.ts`,
 * `media-routes.ts` both reach here). Anything that touches disk or the
 * Azure SDK belongs in `lib/services/file-storage-service.ts`, not here.
 */

const UPLOADS_PATH_PREFIX = "/uploads/";
const BLOB_URL_PATTERN =
	/^https:\/\/[^/]+\.blob\.core\.windows\.net\/media\/(.+)$/;
const URL_SCHEME_PATTERN = /^https?:\/\//i;

/**
 * Normalises any of the three shapes a stored media value can take — a bare
 * key, a legacy `/uploads/<key>` path, or a legacy Azure blob URL — to the
 * bare key. A value that doesn't match any of those (a genuine external
 * address, or the Unsplash fallback) is returned unchanged: it was never
 * ours to resolve, and it was already public.
 */
export function toMediaKey(stored: string): string {
	if (stored.startsWith(UPLOADS_PATH_PREFIX)) {
		return stored.slice(UPLOADS_PATH_PREFIX.length);
	}
	const blobMatch = stored.match(BLOB_URL_PATTERN);
	if (blobMatch?.[1]) {
		return blobMatch[1];
	}
	return stored;
}

/**
 * True when `stored` is a genuine external address (some scheme other than
 * this app's own blob storage) rather than one of the three internal shapes
 * `toMediaKey` recognises. Used to decide whether a value should be routed
 * through a private/public media route (internal) or returned to the
 * browser as-is (external — nothing to protect or copy).
 */
export function isExternalMediaUrl(stored: string): boolean {
	return URL_SCHEME_PATTERN.test(stored) && !BLOB_URL_PATTERN.test(stored);
}
