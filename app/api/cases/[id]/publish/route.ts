import type { NextRequest } from "next/server";
import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuthSession,
	serviceErrorToAppError,
} from "@/lib/api-response";
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
		const session = await requireAuthSession();
		const { id: caseId } = await params;

		const result = await getPublishStatus(session.userId, caseId);

		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}

		return apiSuccess({
			is_published: result.data.isPublished,
			published_id: result.data.publishedId,
			published_at: result.data.publishedAt?.toISOString() ?? null,
			linked_case_study_count: result.data.linkedCaseStudyCount,
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
		const session = await requireAuthSession();
		const { id: caseId } = await params;

		// Parse request body
		let description: string | undefined;
		try {
			const body = await request.json();
			description = body.description;
		} catch {
			// Body is optional, ignore parse errors
		}

		const result = await publishAssuranceCase(
			session.userId,
			caseId,
			description
		);

		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}

		// Emit SSE event for real-time updates
		const { emitSSEEvent } = await import(
			"@/lib/services/sse-connection-manager"
		);
		const username = session.username ?? session.email ?? "Someone";
		emitSSEEvent("case:updated", caseId, {
			action: "published",
			username,
			userId: session.userId,
		});

		return apiSuccess({
			published_id: result.data.publishedId,
			published_at: result.data.publishedAt.toISOString(),
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
		const session = await requireAuthSession();
		const { id: caseId } = await params;
		const force = request.nextUrl.searchParams.get("force") === "true";

		const result = await unpublishAssuranceCase(session.userId, caseId, force);

		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}

		// Emit SSE event for real-time updates
		const { emitSSEEvent } = await import(
			"@/lib/services/sse-connection-manager"
		);
		const username = session.username ?? session.email ?? "Someone";
		emitSSEEvent("case:updated", caseId, {
			action: "unpublished",
			username,
			userId: session.userId,
		});

		return apiSuccess({ success: true });
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
