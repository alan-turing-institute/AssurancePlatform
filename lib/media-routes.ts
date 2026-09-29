import {
	isAcceptableExternalMediaUrl,
	isExternalMediaUrl,
} from "@/lib/media-key";

/**
 * The address the private screenshot route serves for a case — the only
 * `image` value `GET /api/cases/[id]/image` ever returns to a browser.
 * `versionToken`, when given, is appended as a `?v=` query so the address
 * itself changes on every re-upload — the route ignores the query; it
 * exists only so a browser (or `next/image` with `unoptimized`) sees a
 * fresh address to fetch rather than reusing bytes it already cached for
 * the old one.
 */
export function caseScreenshotMediaRoute(
	caseId: string,
	versionToken?: string
): string {
	const base = `/api/cases/${caseId}/media/screenshot`;
	return versionToken ? `${base}?v=${versionToken}` : base;
}

/**
 * The address the private feature-image route serves for a case — what
 * `GET /api/cases/[id]/information` and `POST .../information/image` return
 * for a stored key. See `caseScreenshotMediaRoute` above for `versionToken`.
 */
export function caseFeatureImageMediaRoute(
	caseId: string,
	versionToken?: string
): string {
	const base = `/api/cases/${caseId}/media/feature`;
	return versionToken ? `${base}?v=${versionToken}` : base;
}

/**
 * The address the public route serves for one published version of one
 * slug — version-scoped, so republishing changes the address.
 */
export function publicDiscoverImageRoute(
	slug: string,
	versionId: string
): string {
	return `/api/public/discover/${slug}/image/${versionId}`;
}

/**
 * True when `value` is this case's own feature-image route address, with or
 * without the `?v=` query `caseFeatureImageMediaRoute` can append — so the
 * case-information write path can recognise the address the form was shown
 * and treat it as "unchanged" rather than a new value to store, whatever
 * query the currently-displayed address happens to carry.
 */
export function isOwnCaseFeatureImageAddress(
	caseId: string,
	value: string
): boolean {
	const ownRoute = caseFeatureImageMediaRoute(caseId);
	return value === ownRoute || value.startsWith(`${ownRoute}?v=`);
}

/**
 * True for a feature-image value the case-information write path (`PUT
 * .../information`) may store: empty, this case's own route address (see
 * `isOwnCaseFeatureImageAddress` above), or a genuine external `https://`
 * address. Refuses anything else — a bare storage key, another case's route
 * address, a legacy `/uploads/...` path or blob address — none of which a
 * caller may ever set directly: accepting one would let a case's own
 * feature image be pointed at storage it does not own.
 */
export function isAcceptableFeatureImageValue(
	caseId: string,
	value: string
): boolean {
	return (
		value === "" ||
		isOwnCaseFeatureImageAddress(caseId, value) ||
		isAcceptableExternalMediaUrl(value)
	);
}

/**
 * Projects a case-information record's stored `featureImageUrl` to what the
 * browser should be given: this case's own private-media route address for
 * anything this app wrote (a bare key, or a legacy `/uploads/...`/blob
 * value), unchanged for a genuine external address, and unchanged for an
 * empty value. The route layer applies this — `case-information-service.ts`
 * itself keeps returning the raw stored value to every other caller
 * (the publish snapshot capture, the edit-form access guard), which must see
 * the real key, not the route address. `versionToken` is passed straight
 * through to `caseFeatureImageMediaRoute`.
 */
export function resolveCaseFeatureImageAddress(
	caseId: string,
	stored: string | null,
	versionToken?: string
): string | null {
	if (!stored) {
		return stored;
	}
	if (isExternalMediaUrl(stored)) {
		return stored;
	}
	return caseFeatureImageMediaRoute(caseId, versionToken);
}

/**
 * Projects a published snapshot's raw stored `featureImageUrl` to what a
 * public Discover response should carry: the version-scoped public route
 * address for anything internal (a bare key, or a legacy `/uploads/...`/blob
 * value the snapshot recorded before this app started copying images at
 * publish time), unchanged for a genuine external address, and unchanged for
 * an empty value. The public counterpart of `resolveCaseFeatureImageAddress`
 * above — applied wherever a published item leaves the server (the
 * summary, the detail response, and the embedded snapshot `content`), never
 * to a live case's own value.
 */
export function resolvePublicFeatureImageAddress(
	slug: string,
	versionId: string,
	stored: string | null
): string | null {
	if (!stored) {
		return stored;
	}
	if (isExternalMediaUrl(stored)) {
		return stored;
	}
	return publicDiscoverImageRoute(slug, versionId);
}
