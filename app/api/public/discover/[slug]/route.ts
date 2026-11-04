import type { NextRequest } from "next/server";
import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { validationError } from "@/lib/errors";
import { publishableItemSlugSchema } from "@/lib/schemas/publishable-item";
import { getPublishedItemBySlug } from "@/lib/services/discover-service";
import { transformPublishableItemDetailForApi } from "@/lib/services/discover-transforms";

interface RouteParams {
	params: Promise<{ slug: string }>;
}

/**
 * GET /api/public/discover/[slug]
 *
 * Public, anonymous access; no session is required (the `/api/public` prefix
 * is exempted from auth at the proxy matcher, `proxy.ts`). Powers the
 * Discover detail page's rendering and its JSON download, and supersedes
 * the numeric-id `/api/public/assurance-case/[id]` lookup for this surface.
 * Text fields are the stored snapshot, passed through without cleaning.
 *
 * @description Returns the current published version of a Discover item by slug; no sign-in needed. Text fields, including description and every description inside content, are returned exactly as the publisher stored them, without cleaning, and may contain HTML markup: escape or sanitise them before showing them as HTML.
 * @pathParam slug - Published item slug
 * @tag Discover
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
	try {
		const { slug } = await params;
		const validation = publishableItemSlugSchema.safeParse(slug);
		if (!validation.success) {
			return apiError(validationError("Invalid slug"));
		}

		const result = await getPublishedItemBySlug(validation.data);
		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}

		return apiSuccess(transformPublishableItemDetailForApi(result.data));
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
