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
const HTTPS_SCHEME_PATTERN = /^https:\/\//i;
const CASE_FEATURE_IMAGE_KEY_PREFIX = "cases/";

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

/**
 * True for a genuine external `https://` address a case-information write
 * may store directly — stricter than `isExternalMediaUrl` (which also
 * accepts a legacy `http://` address, for reading values written before
 * this check existed): a new write may only ever point at a scheme this
 * app's own storage never uses, so it can never be mistaken for one of the
 * three internal shapes `toMediaKey` resolves.
 */
export function isAcceptableExternalMediaUrl(stored: string): boolean {
	return HTTPS_SCHEME_PATTERN.test(stored) && !BLOB_URL_PATTERN.test(stored);
}

/**
 * True when `key` is safe to resolve against storage on either backend: no
 * empty, `.` or `..` path segment, no backslash, no NUL byte, and no
 * leading `/`. Checked before a key ever reaches the filesystem or the
 * Azure SDK — on Azure the SDK normalises `..` itself, so an unvalidated
 * key can reach any container in the account; locally it can escape the
 * uploads root. `readMedia`, `copyMedia` and `deleteMedia`
 * (`file-storage-service.ts`) and every function in `azure-blob-adapter.ts`
 * all check this before doing anything with the key they were given.
 */
export function isValidMediaKey(key: string): boolean {
	if (!key || key.startsWith("/") || key.includes("\\") || key.includes("\0")) {
		return false;
	}
	return key
		.split("/")
		.every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

/**
 * True when `key` is a feature-image storage key this app could have
 * written for `caseId` — the only shape a feature-image upload has ever
 * produced, `cases/<caseId>/case-information/<uuid>.<ext>`. Refuses to act
 * on a key that doesn't belong to the case its own record is attached to,
 * so a case-information row pointed at a key outside its own case (a
 * pre-fix write, or a row edited directly) can never be read, copied at
 * publish time, or deleted through that case's own media routes.
 */
export function isCaseFeatureImageKey(caseId: string, key: string): boolean {
	return key.startsWith(`${CASE_FEATURE_IMAGE_KEY_PREFIX}${caseId}/`);
}
