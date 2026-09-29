import { isExternalMediaUrl } from "@/lib/media-key";

/**
 * The address the private screenshot route serves for a case — the only
 * `image` value `GET /api/cases/[id]/image` ever returns to a browser (D6).
 */
export function caseScreenshotMediaRoute(caseId: string): string {
	return `/api/cases/${caseId}/media/screenshot`;
}

/**
 * The address the private feature-image route serves for a case — what
 * `GET /api/cases/[id]/information` and `POST .../information/image` return
 * for a stored key (D6).
 */
export function caseFeatureImageMediaRoute(caseId: string): string {
	return `/api/cases/${caseId}/media/feature`;
}

/**
 * The address the public route serves for one published version of one
 * slug (D5) — version-scoped, so republishing changes the address.
 */
export function publicDiscoverImageRoute(
	slug: string,
	versionId: string
): string {
	return `/api/public/discover/${slug}/image/${versionId}`;
}

/**
 * Projects a case-information record's stored `featureImageUrl` to what the
 * browser should be given: this case's own private-media route address for
 * anything this app wrote (a bare key, or a legacy `/uploads/...`/blob
 * value), unchanged for a genuine external address, and unchanged for an
 * empty value. The route layer applies this — `case-information-service.ts`
 * itself keeps returning the raw stored value to every other caller
 * (the publish snapshot capture, the edit-form access guard), which must see
 * the real key, not the route address.
 */
export function resolveCaseFeatureImageAddress(
	caseId: string,
	stored: string | null
): string | null {
	if (!stored) {
		return stored;
	}
	if (isExternalMediaUrl(stored)) {
		return stored;
	}
	return caseFeatureImageMediaRoute(caseId);
}
