"use server";

import { validateSession } from "@/lib/auth/validate-session";
import type { CaseExportNested } from "@/lib/schemas/case-export";
import { exportCase } from "@/lib/services/case-export-service";

type DocumentExportOptions = {
	includeComments: boolean;
};

type DocumentExportResult = { data: CaseExportNested } | { error: string };

/**
 * Server action to get case data for document export.
 * Validates user authentication and VIEW permission before returning data.
 */
export async function getDocumentExportData(
	caseId: string,
	options: DocumentExportOptions
): Promise<DocumentExportResult> {
	const session = await validateSession();

	if (!session) {
		return { error: "Not authenticated" };
	}

	const result = await exportCase(session.userId, caseId, {
		includeComments: options.includeComments,
	});

	if ("error" in result) {
		return { error: result.error };
	}

	return { data: result.data };
}
