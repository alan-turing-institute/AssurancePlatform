"use server";

import { validateSession } from "@/lib/auth/validate-session";
import { uuidSchema } from "@/lib/schemas/base";
import type { CaseExportNested } from "@/lib/schemas/case-export";

type ExportOptions = {
	includeComments: boolean;
};

type ExportResult = { data: CaseExportNested } | { error: string };

export async function exportCase(
	caseId: string,
	options: ExportOptions = { includeComments: true }
): Promise<ExportResult> {
	const session = await validateSession();
	if (!session) {
		return { error: "Not authenticated" };
	}

	const idResult = uuidSchema.safeParse(caseId);
	if (!idResult.success) {
		return { error: "Invalid case ID" };
	}

	const { exportCase: exportCaseService } = await import(
		"@/lib/services/case-export-service"
	);
	return exportCaseService(session.userId, idResult.data, options);
}
