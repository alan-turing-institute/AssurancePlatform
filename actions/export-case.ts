"use server";

import { validateSession } from "@/lib/auth/validate-session";
import { exportCase as exportCaseService } from "@/lib/services/case-export-service";

export type {
	ExportOptions,
	ExportResult,
} from "@/lib/services/case-export-service";

export async function exportCase(
	caseId: string,
	options: Parameters<typeof exportCaseService>[2] = { includeComments: true }
): Promise<ReturnType<typeof exportCaseService>> {
	const session = await validateSession();
	if (!session) {
		return { success: false, error: "Not authenticated" };
	}
	return exportCaseService(session.userId, caseId, options);
}
