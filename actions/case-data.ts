"use server";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Loads static case data from the public/data directory.
 * No auth required — these are public static files.
 */
export async function loadStaticCaseData(
	caseFile: string
): Promise<{ data: unknown } | { error: string }> {
	// Validate filename to prevent path traversal
	if (caseFile.includes("..") || caseFile.includes("/")) {
		return { error: "Invalid case file name" };
	}

	try {
		const filePath = join(process.cwd(), "public", "data", caseFile);
		const content = await readFile(filePath, "utf-8");
		const data: unknown = JSON.parse(content);
		return { data };
	} catch {
		return { error: `Failed to load case data: ${caseFile}` };
	}
}
