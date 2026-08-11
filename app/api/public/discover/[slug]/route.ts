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
 * Fetch a published item's frozen snapshot by slug (ADR 0003 §6) — public,
 * anonymous access; no session required (the `/api/public` prefix is
 * exempted from auth at the middleware matcher, `middleware.ts`). Powers the
 * Discover detail page's rendering and its JSON download, and supersedes
 * the numeric-id `/api/public/assurance-case/[id]` lookup for this surface.
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
