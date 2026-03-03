import { z } from "zod";

/**
 * Request body schema for GitHub import
 */
export const GitHubImportSchema = z
	.object({
		url: z
			.string()
			.min(1, "GitHub URL is required")
			.describe("GitHub URL or shorthand path to the JSON file"),
		owner: z
			.string()
			.optional()
			.describe("Repository owner (overrides URL parsing)"),
		repo: z
			.string()
			.optional()
			.describe("Repository name (overrides URL parsing)"),
		path: z.string().optional().describe("File path (overrides URL parsing)"),
		branch: z
			.string()
			.optional()
			.describe("Branch name (optional, uses default branch if not specified)"),
	})
	.describe("GitHub import request parameters");

export type GitHubImportInput = z.infer<typeof GitHubImportSchema>;
