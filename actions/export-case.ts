"use server";

import { validateSession } from "@/lib/auth/validate-session";
import { exportCase as exportCaseService } from "@/lib/services/case-export-service";

export async function exportCase(
	caseId: string,
	options: Parameters<typeof exportCaseService>[2] = { includeComments: true }
): Promise<ReturnType<typeof exportCaseService>> {
	const session = await validateSession();
	if (!session) {
		return { error: "Not authenticated" };
	}
	return exportCaseService(session.userId, caseId, options);
}
