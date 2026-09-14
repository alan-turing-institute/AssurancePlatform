"use server";

import { validateSession } from "@/lib/auth/validate-session";
import type { ActionResult } from "@/lib/errors";
import { uuidSchema } from "@/lib/schemas/base";

export interface CitableCaseSummary {
	id: string;
	name: string;
}

export interface CitableGoalSummary {
	description: string;
	id: string;
	name: string;
}

/**
 * Lists the cases the current user can cite from an away goal or module —
 * their own cases plus cases shared with them (ADR 0005 D7, the "Add away
 * goal"/"Add module" picker's first step).
 */
export async function listCitableCases(): Promise<
	ActionResult<CitableCaseSummary[]>
> {
	const session = await validateSession();
	if (!session) {
		return { success: false, error: "Unauthorised" };
	}

	const { listUserCases, listSharedCases } = await import(
		"@/lib/services/case-fetch-service"
	);
	const [owned, shared] = await Promise.all([
		listUserCases(session.userId),
		listSharedCases(session.userId),
	]);

	if ("error" in owned) {
		return { success: false, error: owned.error };
	}
	if ("error" in shared) {
		return { success: false, error: shared.error };
	}

	const cases = [...owned.data, ...shared.data].map((c) => ({
		id: c.id,
		name: c.name,
	}));

	return { success: true, data: cases };
}

/**
 * Lists the GOAL elements of one case, for the "Add away goal" picker's
 * second step (ADR 0005 D7). Requires the current user to have at least
 * VIEW access on that case — delegated to `case-fetch-service.ts`'s own
 * permission check.
 */
export async function listCitableGoals(
	caseId: string
): Promise<ActionResult<CitableGoalSummary[]>> {
	const session = await validateSession();
	if (!session) {
		return { success: false, error: "Unauthorised" };
	}

	const idResult = uuidSchema.safeParse(caseId);
	if (!idResult.success) {
		return { success: false, error: "Invalid case ID" };
	}

	const { listCaseGoalElements } = await import(
		"@/lib/services/case-fetch-service"
	);
	const result = await listCaseGoalElements(session.userId, idResult.data);
	if ("error" in result) {
		return { success: false, error: result.error };
	}
	return { success: true, data: result.data };
}
