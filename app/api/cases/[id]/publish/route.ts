import { type NextRequest, NextResponse } from "next/server";
import { validateSession } from "@/lib/auth/validate-session";
import {
	getPublishStatus,
	publishAssuranceCase,
	unpublishAssuranceCase,
} from "@/lib/services/publish-service";

type RouteParams = {
	params: Promise<{ id: string }>;
};

/**
 * Maps error messages to HTTP status codes.
 */
function getErrorStatus(error: string): number {
	if (error === "Permission denied") {
		return 403;
	}
	if (error === "Case not found") {
		return 404;
	}
	if (error === "Cannot unpublish: linked to case studies") {
		return 409;
	}
	return 400;
}

/**
 * GET /api/cases/[id]/publish
 * Returns the publish status of an assurance case.
 */
export async function GET(
	_request: NextRequest,
	{ params }: RouteParams
): Promise<NextResponse> {
	const validated = await validateSession();

	if (!validated) {
		return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
	}

	const { id: caseId } = await params;

	const status = await getPublishStatus(validated.userId, caseId);

	if (!status) {
		return NextResponse.json(
			{ error: "Case not found or access denied" },
			{ status: 404 }
		);
	}

	return NextResponse.json({
		is_published: status.isPublished,
		published_id: status.publishedId,
		published_at: status.publishedAt?.toISOString() ?? null,
		linked_case_study_count: status.linkedCaseStudyCount,
	});
}

/**
 * POST /api/cases/[id]/publish
 * Publishes an assurance case.
 * Body: { description?: string }
 */
export async function POST(
	request: NextRequest,
	{ params }: RouteParams
): Promise<NextResponse> {
	const validated = await validateSession();

	if (!validated) {
		return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
	}

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
		validated.userId,
		caseId,
		description
	);

	if (!result.success) {
		const status = getErrorStatus(result.error);
		return NextResponse.json({ error: result.error }, { status });
	}

	return NextResponse.json({
		published_id: result.publishedId,
		published_at: result.publishedAt.toISOString(),
	});
}

/**
 * DELETE /api/cases/[id]/publish
 * Unpublishes an assurance case.
 * Query: ?force=true to bypass case study link warning
 */
export async function DELETE(
	request: NextRequest,
	{ params }: RouteParams
): Promise<NextResponse> {
	const validated = await validateSession();

	if (!validated) {
		return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
	}

	const { id: caseId } = await params;
	const force = request.nextUrl.searchParams.get("force") === "true";

	const result = await unpublishAssuranceCase(validated.userId, caseId, force);

	if (!result.success) {
		const status = getErrorStatus(result.error);
		return NextResponse.json(
			{
				error: result.error,
				linked_case_studies: result.linkedCaseStudies ?? undefined,
			},
			{ status }
		);
	}

	return NextResponse.json({ success: true });
}
