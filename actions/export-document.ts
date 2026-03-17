"use server";

import { validateSession } from "@/lib/auth/validate-session";
import { uuidSchema } from "@/lib/schemas/base";
import type { CaseExportNested } from "@/lib/schemas/case-export";

interface DocumentExportOptions {
	includeComments: boolean;
}

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

	const idResult = uuidSchema.safeParse(caseId);
	if (!idResult.success) {
		return { error: "Invalid case ID" };
	}

	const { exportCase } = await import("@/lib/services/case-export-service");
	const result = await exportCase(session.userId, idResult.data, {
		includeComments: options.includeComments,
	});

	if ("error" in result) {
		return { error: result.error };
	}

	return { data: result.data };
}
