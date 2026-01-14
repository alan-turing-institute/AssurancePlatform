import { NextResponse } from "next/server";
import { z } from "zod";
import { validateSession } from "@/lib/auth/validate-session";
import { importCase } from "@/lib/services/case-import-service";
import {
	fetchFileFromGitHub,
	type GitHubServiceError,
	hasGitHubToken,
	parseGitHubUrl,
} from "@/lib/services/github-api-service";

/**
 * Request body schema for GitHub import
 */
const GitHubImportSchema = z
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

type GitHubImportInput = z.infer<typeof GitHubImportSchema>;

/**
 * Parsed GitHub location
 */
type GitHubLocation = {
	owner: string;
	repo: string;
	path: string;
	branch?: string;
};

/**
 * Maps GitHubServiceError codes to HTTP status codes
 */
const ERROR_STATUS_MAP: Record<string, number> = {
	NO_TOKEN: 403,
	TOKEN_EXPIRED: 401,
	NOT_FOUND: 404,
	FORBIDDEN: 403,
	RATE_LIMITED: 429,
	API_ERROR: 500,
};

/**
 * Parses and validates the request body
 */
async function parseRequestBody(
	request: Request
): Promise<
	| { success: true; data: GitHubImportInput }
	| { success: false; response: Response }
> {
	try {
		const json = await request.json();
		const data = GitHubImportSchema.parse(json);
		return { success: true, data };
	} catch (error) {
		if (error instanceof z.ZodError) {
			return {
				success: false,
				response: NextResponse.json(
					{
						error: "Invalid request body",
						validationErrors: error.errors.map((e) => ({
							path: e.path.join("."),
							message: e.message,
						})),
					},
					{ status: 400 }
				),
			};
		}
		return {
			success: false,
			response: NextResponse.json(
				{ error: "Invalid JSON in request body" },
				{ status: 400 }
			),
		};
	}
}

/**
 * Resolves GitHub location from request body
 */
function resolveGitHubLocation(
	body: GitHubImportInput
):
	| { success: true; location: GitHubLocation }
	| { success: false; response: Response } {
	if (body.owner && body.repo && body.path) {
		return {
			success: true,
			location: {
				owner: body.owner,
				repo: body.repo,
				path: body.path,
				branch: body.branch,
			},
		};
	}

	const parsed = parseGitHubUrl(body.url);
	if (!parsed) {
		return {
			success: false,
			response: NextResponse.json(
				{
					error: "Invalid GitHub URL",
					message:
						"Could not parse the GitHub URL. Supported formats: github.com/owner/repo/blob/branch/path, raw.githubusercontent.com URLs, or owner/repo/path shorthand.",
				},
				{ status: 400 }
			),
		};
	}

	return {
		success: true,
		location: {
			owner: parsed.owner,
			repo: parsed.repo,
			path: parsed.path,
			branch: body.branch || parsed.branch,
		},
	};
}

/**
 * POST /api/cases/import/github
 *
 * Imports an assurance case from a GitHub repository.
 * Requires the user to have connected their GitHub account via OAuth.
 *
 * @body GitHubImportSchema
 * @response ImportResult
 * @auth bearer
 * @tag Cases
 */
export async function POST(request: Request) {
	const validated = await validateSession();
	if (!validated) {
		return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
	}

	// Check if user has GitHub connected
	const hasToken = await hasGitHubToken(validated.userId);
	if (!hasToken) {
		return NextResponse.json(
			{
				error: "GitHub not connected",
				code: "NO_TOKEN",
				message:
					"Please sign in with GitHub to connect your account before importing from GitHub.",
			},
			{ status: 403 }
		);
	}

	// Parse request body
	const bodyResult = await parseRequestBody(request);
	if (!bodyResult.success) {
		return bodyResult.response;
	}

	// Resolve GitHub location
	const locationResult = resolveGitHubLocation(bodyResult.data);
	if (!locationResult.success) {
		return locationResult.response;
	}

	const { owner, repo, path, branch } = locationResult.location;

	// Fetch file from GitHub
	let fileContent: string;
	try {
		const result = await fetchFileFromGitHub(
			validated.userId,
			owner,
			repo,
			path,
			branch
		);
		fileContent = result.content;
	} catch (error) {
		const gitHubError = error as GitHubServiceError;
		return NextResponse.json(
			{
				error: "GitHub fetch failed",
				code: gitHubError.code,
				message: gitHubError.message,
			},
			{ status: ERROR_STATUS_MAP[gitHubError.code] || 500 }
		);
	}

	// Parse JSON content
	let jsonData: unknown;
	try {
		jsonData = JSON.parse(fileContent);
	} catch {
		return NextResponse.json(
			{
				error: "Invalid JSON file",
				message: `The file at ${path} is not valid JSON.`,
			},
			{ status: 400 }
		);
	}

	// Import the case
	const importResult = await importCase(validated.userId, jsonData);
	if (!importResult.success) {
		return NextResponse.json(
			{
				error: importResult.error,
				validationErrors: importResult.validationErrors,
			},
			{ status: 400 }
		);
	}

	return NextResponse.json({
		id: importResult.caseId,
		name: importResult.caseName,
		elementCount: importResult.elementCount,
		evidenceLinkCount: importResult.evidenceLinkCount,
		warnings: importResult.warnings,
		source: {
			type: "github",
			owner,
			repo,
			path,
			branch: branch || "default",
		},
	});
}

/**
 * GET /api/cases/import/github/status
 *
 * Checks if the current user has GitHub connected for imports.
 *
 * @response { connected: boolean }
 * @auth bearer
 * @tag Cases
 */
export async function GET() {
	const validated = await validateSession();
	if (!validated) {
		return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
	}

	const connected = await hasGitHubToken(validated.userId);
	return NextResponse.json({ connected });
}
