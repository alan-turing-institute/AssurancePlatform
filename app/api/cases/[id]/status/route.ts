import { parseJsonBody } from "@/lib/api-request";
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
import { withTimeout } from "@/lib/with-timeout";
import type { PublishStatus as PrismaPublishStatus } from "@/src/generated/prisma";

// Local baseline for this route is ~185ms; the observed CI hang was silent
// for 20s+ with no server-side response. 15s gives the DB-pool acquisition
// timeout (`lib/prisma.ts`, 5s) room to fire and surface its own error first
// in the pool-contention case, while still guaranteeing this route always
// answers the client — see "TEA — Status endpoint can hang indefinitely".
//
// The two timeouts therefore cover different failure shapes, on purpose:
// pool-acquisition contention surfaces as the pool's own fast error (pg
// rejects at ~5s, mapped to a generic 500/INTERNAL — see
// `api-status-pool-starvation.test.ts`), while this 15s `withTimeout` is
// the backstop for slow-but-not-erroring work with no bounded wait of its
// own (mapped to 504/GATEWAY_TIMEOUT). Pool exhaustion never reaches the
// 504 path, because the pool errors out first.
const STATUS_REQUEST_TIMEOUT_MS = 15_000;

/**
 * GET /api/cases/[id]/status
 *
 * Returns the full publish status of an assurance case including:
 * - publishStatus (DRAFT, PUBLISHED)
 * - isPublished
 * - publishedAt
 * - markedReadyAt
 * - hasChanges
 */
export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const userId = await requireAuth();
		const { id } = await params;

		const result = await withTimeout(
			getFullPublishStatus(userId, id),
			STATUS_REQUEST_TIMEOUT_MS
		);

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
 * @response 413 - Payload too large
 */
export async function PATCH(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const userId = await requireAuth();
		const { id } = await params;

		const { targetStatus, description } = await parseJsonBody(
			request,
			updateCaseStatusSchema
		);

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
