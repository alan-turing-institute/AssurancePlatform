import type { NextRequest, NextResponse } from "next/server";
import type { z } from "zod";
import { parseJsonBody } from "@/lib/api-request";
import {
	apiError,
	apiErrorFromUnknown,
	requireAuthSession,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { validationError } from "@/lib/errors";
import { uuidSchema } from "@/lib/schemas/base";
import {
	type HealthStatus,
	refreshHealthSummary,
} from "@/lib/services/health-status-service";
import { emitSSEEvent } from "@/lib/services/sse-connection-manager";
import type { ServiceResult } from "@/types/service";

/**
 * Shared steps of the health plugin's routes that change a claim's
 * evidence: after a change has committed, recompute the claim's status,
 * refresh its snapshot summary and tell open browsers.
 */

/**
 * Recomputes `claimId`'s status after a committed change, writes the
 * snapshot summary, and emits `tea.health/state-changed` to the claim's case
 * (never from inside a transaction). Returns the new status.
 */
export async function announceHealthChange(
	userId: string,
	claimId: string,
	caseId: string,
	extraPayload: Record<string, unknown> = {}
): Promise<HealthStatus | null> {
	const status = await refreshHealthSummary(userId, claimId, caseId);
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

		const claimId = uuidSchema.safeParse(id);
		const parsedRecordId = uuidSchema.safeParse(recordId);
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

		const status = await announceHealthChange(
			session.userId,
			claimId.data,
			result.data.caseId
		);
		return respond(result.data, status);
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
