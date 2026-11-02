"use server";

import { revalidatePath } from "next/cache";
import { validateSession } from "@/lib/auth/validate-session";
import type { ActionResult } from "@/lib/errors";
import { uuidSchema } from "@/lib/schemas/base";
import type { CaseKind } from "@/lib/schemas/case-export";
import { convertCaseKindSchema } from "@/lib/schemas/case-kind";
import type { AssuranceCaseSummary } from "@/lib/services/case-fetch-service";
import type { ConversionConsequences } from "@/lib/services/case-kind-service";

/**
 * Converts a case to a pattern, or a pattern back to a case, in place.
 * Requires ADMIN permission on the case; the service refuses a published,
 * archived-copy or trashed case.
 */
export async function convertCaseKind(
	caseId: string,
	targetKind: CaseKind
): Promise<ActionResult<{ kind: CaseKind }>> {
	const session = await validateSession();
	if (!session) {
		return { success: false, error: "Unauthorised" };
	}

	const parsed = convertCaseKindSchema.safeParse({ caseId, targetKind });
	if (!parsed.success) {
		const invalidCaseId = parsed.error.issues.some(
			(issue) => issue.path[0] === "caseId"
		);
		return {
			success: false,
			error: invalidCaseId ? "Invalid case ID" : "Invalid kind",
		};
	}

	try {
		const { convertCaseKind: convert } = await import(
			"@/lib/services/case-kind-service"
		);
		const result = await convert(
			session.userId,
			parsed.data.caseId,
			parsed.data.targetKind
		);
		if ("error" in result) {
			return { success: false, error: result.error };
		}

		revalidatePath("/dashboard");
		revalidatePath("/dashboard/patterns");
		return { success: true, data: result.data };
	} catch {
		return { success: false, error: "Failed to convert the case" };
	}
}

/**
 * Reads what converting a case would affect, for the confirmation dialog.
 * Requires ADMIN permission on the case.
 */
export async function fetchConversionConsequences(
	caseId: string
): Promise<ActionResult<ConversionConsequences>> {
	const session = await validateSession();
	if (!session) {
		return { success: false, error: "Unauthorised" };
	}

	const idResult = uuidSchema.safeParse(caseId);
	if (!idResult.success) {
		return { success: false, error: "Invalid case ID" };
	}

	try {
		const { getConversionConsequences } = await import(
			"@/lib/services/case-kind-service"
		);
		const result = await getConversionConsequences(
			session.userId,
			idResult.data
		);
		if ("error" in result) {
			return { success: false, error: result.error };
		}
		return { success: true, data: result.data };
	} catch {
		return { success: false, error: "Failed to read the consequences" };
	}
}

/** The My Patterns list: patterns the user owns or has been given directly. */
export async function fetchUserPatterns(): Promise<
	AssuranceCaseSummary[] | null
> {
	const validated = await validateSession();
	if (!validated) {
		return null;
	}

	const { listUserPatterns } = await import("@/lib/services/case-kind-service");
	const result = await listUserPatterns(validated.userId);
	if ("error" in result) {
		return null;
	}
	return result.data;
}
