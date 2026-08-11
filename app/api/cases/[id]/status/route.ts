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
import { requireCaseInformationComplete } from "@/lib/services/case-information-service";
import {
	getFullPublishStatus,
	transitionStatus,
} from "@/lib/services/publish-service";
import type { PublishStatus as PrismaPublishStatus } from "@/src/generated/prisma";

/**
 * GET /api/cases/[id]/status
 *
 * Returns the full publish status of an assurance case including:
 * - publishStatus (DRAFT, PUBLISHED)
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
 *   targetStatus: "DRAFT" | "PUBLISHED"
 *   description?: string  // Optional description for publish
 * }
 *
 * Valid transitions:
 * - DRAFT -> PUBLISHED (publish)
 * - PUBLISHED -> DRAFT (unpublish)
 * - PUBLISHED -> PUBLISHED (republish: fresh snapshot, same slug)
 *
 * DRAFT -> PUBLISHED and republish (PUBLISHED -> PUBLISHED) are both gated
 * on case-information completeness (ADR 0003 §4), via the same
 * `requireCaseInformationComplete` helper `POST /api/cases/[id]/publish`
 * uses for its own first-publish path. The case editor's guided publish flow
 * always goes through the dedicated publish route, which already gated this
 * — but this route is a raw API surface too (QA finding, 2026-08-11: a
 * direct PATCH here bypassed the gate for first publish, since the check
 * used to run `if (isRepublish)` only). Republish is gated for the same
 * reason it always was: without it, a published record could regress to
 * incomplete via an edit that clears a required field then a republish.
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
				validationError(parsed.error.issues[0]?.message ?? "Invalid input")
			);
		}

		const { targetStatus, description } = parsed.data;

		if (targetStatus === "PUBLISHED") {
			const completeness = await requireCaseInformationComplete(userId, id);
			if ("error" in completeness) {
				return apiError(
					completeness.fieldErrors
						? validationError(completeness.error, completeness.fieldErrors)
						: serviceErrorToAppError(completeness.error)
				);
			}
		}

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
