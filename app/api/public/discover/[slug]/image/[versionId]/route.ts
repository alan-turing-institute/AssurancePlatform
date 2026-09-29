import type { NextRequest } from "next/server";
import { mediaResponse } from "@/lib/media-response";
import { uuidSchema } from "@/lib/schemas/base";
import { publishableItemSlugSchema } from "@/lib/schemas/publishable-item";
import { getPublishedItemMedia } from "@/lib/services/discover-service";

interface RouteParams {
	params: Promise<{ slug: string; versionId: string }>;
}

/**
 * GET /api/public/discover/[slug]/image/[versionId]
 *
 * @description Streams a published item's feature image — public, anonymous
 * access; no session required (the `/api/public` prefix is exempted from
 * auth at the proxy matcher, `proxy.ts`). Outside the JSON envelope, like
 * the SSE and health routes. `versionId` must match the row Discover
 * currently serves for `slug` (including an archived copy); anything
 * else — an unpublished case, a superseded version, a malformed id — gets
 * the same empty 404. Cached for a year and immutable: republishing writes a
 * new copy at a new address rather than changing this one.
 *
 * @pathParam slug - Published item slug
 * @pathParam versionId - Published version ID (UUID)
 * @response 200 - The feature image's bytes
 * @response 404 - No matching current version, or no feature image stored
 * @tag Discover
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
	const { slug, versionId } = await params;

	const slugResult = publishableItemSlugSchema.safeParse(slug);
	const versionIdResult = uuidSchema.safeParse(versionId);
	if (!(slugResult.success && versionIdResult.success)) {
		return mediaResponse({ status: "not-found" });
	}

	const result = await getPublishedItemMedia(
		slugResult.data,
		versionIdResult.data
	);
	return mediaResponse(result, {
		cacheControl: "public, max-age=31536000, immutable",
	});
}
