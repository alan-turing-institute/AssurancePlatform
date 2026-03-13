import fs from "node:fs";
import path from "node:path";
import {
	apiErrorFromUnknown,
	apiSuccess,
	requireAuth,
} from "@/lib/api-response";

interface Template {
	name: string;
	[key: string]: unknown;
}

export async function GET() {
	try {
		await requireAuth();
		// Read files from the file system using Node.js fs module
		const templatesDir = path.resolve(process.cwd(), "caseTemplates");
		let files: string[];

		try {
			files = fs.readdirSync(templatesDir);
		} catch (_error) {
			// Directory doesn't exist or no permissions
			return apiSuccess({ newTemplates: [], defaultCase: undefined });
		}

		// Filter JSON files
		const jsonFiles = files.filter((file) => file.endsWith(".json"));

		// Read JSON content and parse it
		const newTemplates: Template[] = [];
		for (const file of jsonFiles) {
			try {
				const filePath = path.join(templatesDir, file);
				const content = fs.readFileSync(filePath, "utf-8");
				const parsed = JSON.parse(content);
				newTemplates.push(parsed);
			} catch (_error) {
				// Skip files that can't be parsed
			}
		}

		// Find default case
		const defaultCase =
			newTemplates.find((c) => c.name === "empty") || newTemplates[0];

		return apiSuccess({ newTemplates, defaultCase });
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
