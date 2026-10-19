"use server";

import { validateSession } from "@/lib/auth/validate-session";
import { type PlainCase, toPlainCase } from "@/lib/case/defined-terms";
import { uuidSchema } from "@/lib/schemas/base";

interface DocumentExportOptions {
	includeComments: boolean;
}

type DocumentExportResult = { data: PlainCase } | { error: string };

/**
 * Server action to get case data for document export.
 * Validates user authentication and VIEW permission before returning data.
 * The data is the plain-text copy of the case: every context entry a string and
 * every reference written as `{name}`, so the exporters never see the stored
 * shape.
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

	return { data: toPlainCase(result.data) };
}
