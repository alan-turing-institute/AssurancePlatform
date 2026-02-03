import type { NextRequest } from "next/server";
import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuth,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { notFound } from "@/lib/errors";
import {
	getPublishStatus,
	publishAssuranceCase,
	unpublishAssuranceCase,
} from "@/lib/services/publish-service";

type RouteParams = {
	params: Promise<{ id: string }>;
};

/**
 * GET /api/cases/[id]/publish
 * Returns the publish status of an assurance case.
 */
export async function GET(
	_request: NextRequest,
	{ params }: RouteParams
): Promise<Response> {
	try {
		const userId = await requireAuth();
		const { id: caseId } = await params;

		const status = await getPublishStatus(userId, caseId);

		if (!status) {
			return apiError(notFound("Case"));
		}

		return apiSuccess({
			is_published: status.isPublished,
			published_id: status.publishedId,
			published_at: status.publishedAt?.toISOString() ?? null,
			linked_case_study_count: status.linkedCaseStudyCount,
		});
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}

/**
 * POST /api/cases/[id]/publish
 * Publishes an assurance case.
 * Body: { description?: string }
 */
export async function POST(
	request: NextRequest,
	{ params }: RouteParams
): Promise<Response> {
	try {
		const userId = await requireAuth();
		const { id: caseId } = await params;

		// Parse request body
		let description: string | undefined;
		try {
			const body = await request.json();
			description = body.description;
		} catch {
			// Body is optional, ignore parse errors
		}

		const result = await publishAssuranceCase(userId, caseId, description);

		if (!result.success) {
			return apiError(serviceErrorToAppError(result.error));
		}

		return apiSuccess({
			published_id: result.publishedId,
			published_at: result.publishedAt.toISOString(),
		});
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}

/**
 * DELETE /api/cases/[id]/publish
 * Unpublishes an assurance case.
 * Query: ?force=true to bypass case study link warning
 */
export async function DELETE(
	request: NextRequest,
	{ params }: RouteParams
): Promise<Response> {
	try {
		const userId = await requireAuth();
		const { id: caseId } = await params;
		const force = request.nextUrl.searchParams.get("force") === "true";

		const result = await unpublishAssuranceCase(userId, caseId, force);

		if (!result.success) {
			return apiError(serviceErrorToAppError(result.error));
		}

		return apiSuccess({ success: true });
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
