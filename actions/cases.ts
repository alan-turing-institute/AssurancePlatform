"use server";

import { validateSession } from "@/lib/auth/validate-session";
import { uuidSchema } from "@/lib/schemas/base";
import type { CommentResponse } from "@/lib/services/comment-service";
import type { ActionResult } from "@/types";

/**
 * Fetches threaded case-level comments (notes) for a given case.
 * Validates auth and permission before querying.
 */
export async function fetchCaseComments(
	caseId: string
): Promise<CommentResponse[] | null> {
	const session = await validateSession();
	if (!session) {
		return null;
	}

	const idResult = uuidSchema.safeParse(caseId);
	if (!idResult.success) {
		return null;
	}

	try {
		const { fetchCaseComments: fetchComments } = await import(
			"@/lib/services/comment-service"
		);
		const result = await fetchComments(idResult.data, session.userId);
		if ("error" in result) {
			return null;
		}
		return result.data;
	} catch {
		return null;
	}
}

/**
 * Soft-deletes an assurance case, moving it to the trash.
 * Requires ADMIN permission on the case.
 */
export async function deleteAssuranceCase(
	caseId: string
): Promise<ActionResult<null>> {
	const session = await validateSession();
	if (!session) {
		return { success: false, error: "Unauthorised" };
	}

	const idResult = uuidSchema.safeParse(caseId);
	if (!idResult.success) {
		return { success: false, error: "Invalid case ID" };
	}

	try {
		const { softDeleteCase } = await import(
			"@/lib/services/case-trash-service"
		);
		const result = await softDeleteCase(session.userId, idResult.data);

		if ("error" in result) {
			return { success: false, error: result.error };
		}

		return { success: true, data: null };
	} catch {
		return { success: false, error: "Failed to delete case" };
	}
}

/**
 * Resets all element identifiers for a case so they are sequential.
 * Requires EDIT permission on the case.
 */
export async function updateCaseIdentifiers(
	caseId: string
): Promise<ActionResult<null>> {
	const session = await validateSession();
	if (!session) {
		return { success: false, error: "Unauthorised" };
	}

	const idResult = uuidSchema.safeParse(caseId);
	if (!idResult.success) {
		return { success: false, error: "Invalid case ID" };
	}

	try {
		const { resetIdentifiers } = await import(
			"@/lib/services/identifier-service"
		);
		const result = await resetIdentifiers(idResult.data, session.userId);

		if ("error" in result) {
			return { success: false, error: result.error };
		}

		return { success: true, data: null };
	} catch {
		return { success: false, error: "Failed to reset identifiers" };
	}
}
