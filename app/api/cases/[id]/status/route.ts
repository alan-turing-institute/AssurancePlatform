import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import {
	getFullPublishStatus,
	transitionStatus,
} from "@/lib/services/publish-service";
import type { PublishStatus as PrismaPublishStatus } from "@/src/generated/prisma-new";

/**
 * GET /api/cases/[id]/status
 *
 * Returns the full publish status of an assurance case including:
 * - publishStatus (DRAFT, READY_TO_PUBLISH, PUBLISHED)
 * - isPublished
 * - publishedAt
 * - markedReadyAt
 * - linkedCaseStudyCount
 * - hasChanges
 */
export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { id } = await params;

	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
	}

	const result = await getFullPublishStatus(session.user.id, id);

	if (result.error) {
		const status = result.error === "Permission denied" ? 403 : 400;
		return NextResponse.json({ error: result.error }, { status });
	}

	return NextResponse.json(result.data);
}

/**
 * PATCH /api/cases/[id]/status
 *
 * Transitions the publish status of an assurance case.
 *
 * Request body:
 * {
 *   targetStatus: "DRAFT" | "READY_TO_PUBLISH" | "PUBLISHED"
 *   description?: string  // Optional description for publish
 * }
 *
 * Valid transitions:
 * - DRAFT -> READY_TO_PUBLISH (mark as ready)
 * - READY_TO_PUBLISH -> DRAFT (unmark)
 * - READY_TO_PUBLISH -> PUBLISHED (publish)
 * - PUBLISHED -> DRAFT (unpublish)
 */
export async function PATCH(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { id } = await params;

	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
	}

	let body: { targetStatus?: string; description?: string };
	try {
		body = await request.json();
	} catch {
		return NextResponse.json(
			{ error: "Invalid request body" },
			{ status: 400 }
		);
	}

	const { targetStatus, description } = body;

	// Validate targetStatus
	const validStatuses = ["DRAFT", "READY_TO_PUBLISH", "PUBLISHED"];
	if (!(targetStatus && validStatuses.includes(targetStatus))) {
		return NextResponse.json(
			{
				error: `Invalid targetStatus. Must be one of: ${validStatuses.join(", ")}`,
			},
			{ status: 400 }
		);
	}

	const result = await transitionStatus(
		session.user.id,
		id,
		targetStatus as PrismaPublishStatus,
		description
	);

	if (!result.success) {
		// Check for specific error types
		if (result.error === "Permission denied") {
			return NextResponse.json({ error: result.error }, { status: 403 });
		}

		// Include linkedCaseStudies in response if present (for unpublish warning)
		if (result.linkedCaseStudies) {
			return NextResponse.json(
				{
					error: result.error,
					linkedCaseStudies: result.linkedCaseStudies,
				},
				{ status: 409 }
			);
		}

		return NextResponse.json({ error: result.error }, { status: 400 });
	}

	return NextResponse.json({
		success: true,
		newStatus: result.newStatus,
		publishedId: result.publishedId,
		publishedAt: result.publishedAt,
	});
}
