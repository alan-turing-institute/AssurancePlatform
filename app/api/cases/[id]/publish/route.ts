import type { NextRequest } from "next/server";
import { readJsonBody } from "@/lib/api-request";
import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuthSession,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { validationError } from "@/lib/errors";
import { publishCaseBodySchema } from "@/lib/schemas/publish";
import { requireCaseInformationComplete } from "@/lib/services/case-information-service";
import {
	getPublishStatus,
	publishAssuranceCase,
	unpublishAssuranceCase,
} from "@/lib/services/publish-service";

interface RouteParams {
	params: Promise<{ id: string }>;
}

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
		});
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}

/**
 * POST /api/cases/[id]/publish
 * Publishes an assurance case.
 * Body: { description?: string } (optional — no body at all is valid)
 *
 * Gated on case-information completeness (ADR 0003 §4 — "the admission
 * ticket to Discover"): the guided publish flow in the case editor already
 * runs this same check before it ever shows a confirm step, so a 400 here
 * means either a direct API call bypassing that flow, or the record
 * changed after the client checked it.
 */
export async function POST(
	request: NextRequest,
	{ params }: RouteParams
): Promise<Response> {
	try {
		const session = await requireAuthSession();
		const { id: caseId } = await params;

		// Body is optional — an empty/absent body parses to {} and validates
		// fine, since `description` itself is optional. `readJsonBody`
		// returns `undefined` (not `{}`) for an absent body, and the schema
		// is a z.strictObject (which rejects `undefined` outright), so the
		// `?? {}` default is applied here rather than via parseJsonBody.
		const raw = await readJsonBody(request);
		const parsed = publishCaseBodySchema.safeParse(raw ?? {});
		if (!parsed.success) {
			return apiError(
				validationError(parsed.error.issues[0]?.message ?? "Invalid input")
			);
		}
		const { description } = parsed.data;

		const completeness = await requireCaseInformationComplete(
			session.userId,
			caseId
		);
		if ("error" in completeness) {
			return apiError(
				completeness.fieldErrors
					? validationError(completeness.error, completeness.fieldErrors)
					: serviceErrorToAppError(completeness.error)
			);
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
 */
export async function DELETE(
	_request: NextRequest,
	{ params }: RouteParams
): Promise<Response> {
	try {
		const session = await requireAuthSession();
		const { id: caseId } = await params;

		const result = await unpublishAssuranceCase(session.userId, caseId);

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
