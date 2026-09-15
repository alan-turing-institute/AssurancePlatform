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

	// `listUserCases` already returns own OR directly-shared cases, and
	// `listSharedCases` returns direct-or-team shares (excluding own) — so a
	// directly-shared case comes back from BOTH calls. De-duplicate by case
	// id, first occurrence wins (owned.data first), so each case appears
	// exactly once regardless of which call(s) produced it.
	const byId = new Map<string, CitableCaseSummary>();
	for (const c of [...owned.data, ...shared.data]) {
		if (!byId.has(c.id)) {
			byId.set(c.id, { id: c.id, name: c.name });
		}
	}

	return { success: true, data: Array.from(byId.values()) };
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
