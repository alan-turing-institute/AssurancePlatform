import { NextResponse } from "next/server";
import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuth,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { validationError } from "@/lib/errors";
import { CASE_INFORMATION_FIELD_LABELS } from "@/lib/schemas/case-information";
import { updateCaseStatusSchema } from "@/lib/schemas/status";
import { checkCaseInformationCompleteness } from "@/lib/services/case-information-service";
import {
	getFullPublishStatus,
	getPublishStatus,
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
 * Republish is gated on case-information completeness (ADR 0003 §4), the
 * same check `POST /api/cases/[id]/publish` runs for first publish — lead
 * adjudication, 2026-08-11: without it, a published record could regress to
 * incomplete via an edit that clears a required field then a republish. The
 * case editor's "Update Published" action always goes through this route,
 * so this is the one place a republish-flavoured request can land; DRAFT ->
 * PUBLISHED here is unaffected — first publish is unreachable from the UI
 * except via the dedicated publish route, which already gates it.
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
			const currentStatus = await getPublishStatus(userId, id);
			if ("error" in currentStatus) {
				return apiError(serviceErrorToAppError(currentStatus.error));
			}

			const isRepublish = currentStatus.data.isPublished;
			if (isRepublish) {
				const completeness = await checkCaseInformationCompleteness(userId, id);
				if ("error" in completeness) {
					return apiError(serviceErrorToAppError(completeness.error));
				}
				if (!completeness.data.complete) {
					const fieldErrors = Object.fromEntries(
						completeness.data.missingFields.map((field) => [
							field,
							`${CASE_INFORMATION_FIELD_LABELS[field]} is required before publishing`,
						])
					);
					return apiError(
						validationError(
							"Case information is incomplete — add the missing fields before publishing",
							fieldErrors
						)
					);
				}
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
