"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import type { CaseExportNested } from "@/lib/schemas/case-export";
import { exportCase } from "@/lib/services/case-export-service";

export type DocumentExportOptions = {
	includeComments: boolean;
};

export type DocumentExportResult =
	| { success: true; data: CaseExportNested }
	| { success: false; error: string };

/**
 * Server action to get case data for document export.
 * Validates user authentication and VIEW permission before returning data.
 */
export async function getDocumentExportData(
	caseId: string,
	options: DocumentExportOptions
): Promise<DocumentExportResult> {
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return { success: false, error: "Not authenticated" };
	}

	const result = await exportCase(session.user.id, caseId, {
		includeComments: options.includeComments,
	});

	return result;
}
