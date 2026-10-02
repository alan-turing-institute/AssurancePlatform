import type { NextRequest, NextResponse } from "next/server";
import type { z } from "zod";
import { parseJsonBody, readJsonBody } from "@/lib/api-request";
import {
	apiError,
	apiErrorFromUnknown,
	requireAuthSession,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { validationError } from "@/lib/errors";
import { uuidSchema } from "@/lib/schemas/base";
import { describeEvidenceIssues } from "@/lib/schemas/health-evidence";
import type { InvalidSettings } from "@/lib/services/health-criteria-service";
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
export function criteriaFailure(
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
 * signed-in user and the claim id from the path (a 400 when it is not a UUID).
 */
export async function requireClaimRequest(
	params: Promise<{ id: string }>
): Promise<{ claimId: string; userId: string }> {
	const session = await requireAuthSession();
	const claimId = uuidSchema.safeParse((await params).id.toLowerCase());
	if (!claimId.success) {
		throw validationError("Invalid element id");
	}
	return { userId: session.userId, claimId: claimId.data };
}
