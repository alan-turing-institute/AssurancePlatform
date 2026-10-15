import type { NextRequest, NextResponse } from "next/server";
import type { z } from "zod";
import { parseJsonBody, readJsonBody } from "@/lib/api-request";
import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuthSession,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { validationError } from "@/lib/errors";
import { uuidSchema } from "@/lib/schemas/base";
import { describeEvidenceIssues } from "@/lib/schemas/health-evidence";
import type {
	CriteriaChange,
	CriteriaView,
	ElementEvent,
	InvalidSettings,
} from "@/lib/services/health-criteria-service";
import {
	computeHealthStatus,
	type HealthStatus,
} from "@/lib/services/health-status-service";
import { emitSSEEvent } from "@/lib/services/sse-connection-manager";
import type { ServiceResult } from "@/types/service";

/**
 * Shared steps of the health plugin's routes that change a claim's
 * evidence: after a change has committed, recompute the claim's status
 * and tell open browsers.
 */

/**
 * Recomputes `claimId`'s status after a committed change and emits
 * `tea.health/state-changed` to the claim's case (never from inside a
 * transaction). Writes nothing. Returns the new status.
 */
export async function announceHealthChange(
	claimId: string,
	caseId: string,
	extraPayload: Record<string, unknown> = {}
): Promise<HealthStatus | null> {
	const status = await computeHealthStatus(claimId, caseId);
	emitSSEEvent("tea.health/state-changed", caseId, {
		claimId,
		status,
		...extraPayload,
	});
	return status;
}

/**
 * Tells open browsers that an element changed along with the claim's
 * settings, as a core `element:*` event, so the canvas reloads the case. Call
 * it after the change has committed and before `announceHealthChange`, whose
 * recomputation can throw: the case must reload even if that fails.
 */
function announceElementEvent(
	change: ElementEvent | undefined,
	caseId: string,
	who: { userId: string; username: string }
): void {
	if (!change) {
		return;
	}
	emitSSEEvent(`element:${change.kind}`, caseId, {
		...(change.element ? { element: change.element } : {}),
		elementId: change.elementId,
		elementName: change.elementName,
		username: who.username,
		userId: who.userId,
	});
}

/** The response to a read of a claim's evidence settings: the settings, or the failure. */
export function answerCriteriaRead(
	result: { data: CriteriaView } | { error: string }
): NextResponse {
	return "error" in result ? criteriaFailure(result) : apiSuccess(result.data);
}

/**
 * The response to a change of a claim's evidence settings: the failure, or,
 * after announcing the element change and then the health change, the
 * settings as read after the change.
 */
export async function answerCriteriaChange(
	result:
		| { data: CriteriaChange }
		| { error: string }
		| { invalid: InvalidSettings },
	claimId: string,
	who: { userId: string; username: string }
): Promise<NextResponse> {
	if ("error" in result || "invalid" in result) {
		return criteriaFailure(result);
	}
	announceElementEvent(result.data.elementEvent, result.data.caseId, who);
	await announceHealthChange(claimId, result.data.caseId);
	return apiSuccess(result.data.view);
}

/**
 * The whole of a session-only route that acts on one record of a claim
 * (`/api/elements/[id]/health/records/[recordId]/...`): authenticates,
 * validates both ids and the body, runs `action`, announces the change and
 * builds the response with `respond`.
 */
export async function handleHealthRecordAction<
	S extends z.ZodType,
	D extends { caseId: string },
>(
	request: NextRequest,
	params: Promise<{ id: string; recordId: string }>,
	schema: S,
	action: (
		userId: string,
		claimId: string,
		recordId: string,
		body: z.output<S>
	) => ServiceResult<D>,
	respond: (data: D, status: HealthStatus | null) => NextResponse
): Promise<NextResponse> {
	try {
		const session = await requireAuthSession();
		const { id, recordId } = await params;

		const claimId = uuidSchema.safeParse(id.toLowerCase());
		const parsedRecordId = uuidSchema.safeParse(recordId.toLowerCase());
		if (!(claimId.success && parsedRecordId.success)) {
			return apiError(validationError("Invalid element or record id"));
		}
		const body = await parseJsonBody(request, schema);

		const result = await action(
			session.userId,
			claimId.data,
			parsedRecordId.data,
			body
		);
		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}

		const status = await announceHealthChange(claimId.data, result.data.caseId);
		return respond(result.data, status);
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}

/**
 * Parses a JSON body against `schema`. A failure is a 400 that names the
 * offending field (`<path>: <message>`) and lists every field's message.
 */
export async function parseHealthBody<S extends z.ZodType>(
	request: NextRequest,
	schema: S,
	options?: { maxBytes?: number }
): Promise<z.output<S>> {
	const parsed = schema.safeParse(await readJsonBody(request, options));
	if (!parsed.success) {
		const { message, fieldErrors } = describeEvidenceIssues(parsed.error);
		throw validationError(message, fieldErrors);
	}
	return parsed.data;
}

/** The response for a failed save: a 400 naming the fields, or the mapped service error. */
function criteriaFailure(
	failure: { error: string } | { invalid: InvalidSettings }
): NextResponse {
	if ("invalid" in failure) {
		return apiError(
			validationError(failure.invalid.message, failure.invalid.fieldErrors)
		);
	}
	return apiError(serviceErrorToAppError(failure.error));
}

/**
 * The first steps of a session-only route addressed to one claim: the
 * signed-in user (with the name other people see in announcements) and the
 * claim id from the path (a 400 when it is not a UUID).
 */
export async function requireClaimRequest(
	params: Promise<{ id: string }>
): Promise<{ claimId: string; userId: string; username: string }> {
	const session = await requireAuthSession();
	const claimId = uuidSchema.safeParse((await params).id.toLowerCase());
	if (!claimId.success) {
		throw validationError("Invalid element id");
	}
	return {
		userId: session.userId,
		username: session.username || session.email || "Someone",
		claimId: claimId.data,
	};
}
