import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

export function GET() {
	try {
		// Read files from the file system using Node.js fs module
		const templatesDir = path.resolve(process.cwd(), "caseTemplates");
		let files: string[];

		try {
			files = fs.readdirSync(templatesDir);
		} catch (error) {
			// Directory doesn't exist or no permissions
			return NextResponse.json({ newTemplates: [], defaultCase: undefined });
		}

		// Filter JSON files
		const jsonFiles = files.filter((file) => file.endsWith(".json"));

		// Read JSON content and parse it
		const newTemplates = [];
		for (const file of jsonFiles) {
			try {
				const filePath = path.join(templatesDir, file);
				const content = fs.readFileSync(filePath, "utf-8");
				const parsed = JSON.parse(content);
				newTemplates.push(parsed);
			} catch (error) {
				// Skip files that can't be read or parsed
				console.error(`Error reading template ${file}:`, error);
			}
		}

		// Find default case
		const defaultCase =
			newTemplates.find((c) => c.name === "empty") || newTemplates[0];

		return NextResponse.json({ newTemplates, defaultCase });
	} catch (error) {
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}
