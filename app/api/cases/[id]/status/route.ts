import { NextResponse } from "next/server";
import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuth,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { validationError } from "@/lib/errors";
import { updateCaseStatusSchema } from "@/lib/schemas/status";
import {
	getFullPublishStatus,
	transitionStatus,
} from "@/lib/services/publish-service";
import type { PublishStatus as PrismaPublishStatus } from "@/src/generated/prisma";

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
	try {
		const userId = await requireAuth();
		const { id } = await params;

		const result = await getFullPublishStatus(userId, id);

		if (result.error) {
			return apiError(serviceErrorToAppError(result.error));
		}

		return apiSuccess(result.data);
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
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
	try {
		const userId = await requireAuth();
		const { id } = await params;

		const parsed = updateCaseStatusSchema.safeParse(
			await request.json().catch(() => null)
		);
		if (!parsed.success) {
			return apiError(
				validationError(parsed.error.errors[0]?.message ?? "Invalid input")
			);
		}

		const { targetStatus, description } = parsed.data;

		const result = await transitionStatus(
			userId,
			id,
			targetStatus as PrismaPublishStatus,
			description
		);

		if ("error" in result) {
			// Check for specific error types
			if (result.error === "Permission denied") {
				return apiError(serviceErrorToAppError(result.error));
			}

			// Include linkedCaseStudies in response if present (for unpublish warning)
			if (result.linkedCaseStudies) {
				return NextResponse.json(
					{
						error: result.error,
						code: "CONFLICT" as const,
						linkedCaseStudies: result.linkedCaseStudies,
					},
					{ status: 409 }
				);
			}

			return apiError(serviceErrorToAppError(result.error));
		}

		return apiSuccess({
			success: true,
			newStatus: result.data.newStatus,
			publishedId: result.data.publishedId,
			publishedAt: result.data.publishedAt,
		});
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
