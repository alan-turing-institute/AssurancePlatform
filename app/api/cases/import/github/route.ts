import { z } from "zod";
import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuth,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { AppError, forbidden, validationError } from "@/lib/errors";
import { importCase } from "@/lib/services/case-import-service";
import {
	fetchFileFromGitHub,
	hasGitHubToken,
	parseGitHubUrl,
} from "@/lib/services/github-api-service";
import type { ErrorCode } from "@/types/domain";

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
 * Maps GitHub service error codes to application error codes.
 */
const GITHUB_ERROR_MAP: Record<string, ErrorCode> = {
	NO_TOKEN: "FORBIDDEN",
	TOKEN_EXPIRED: "UNAUTHORISED",
	NOT_FOUND: "NOT_FOUND",
	FORBIDDEN: "FORBIDDEN",
	RATE_LIMITED: "RATE_LIMITED",
	API_ERROR: "INTERNAL",
};

/**
 * Parses and validates the request body.
 * Returns the parsed data or throws a validation AppError.
 */
async function parseRequestBody(request: Request): Promise<GitHubImportInput> {
	let json: unknown;
	try {
		json = await request.json();
	} catch {
		throw validationError("Invalid JSON in request body");
	}

	const parsed = GitHubImportSchema.safeParse(json);
	if (!parsed.success) {
		throw validationError(
			parsed.error.errors[0]?.message ?? "Invalid request body"
		);
	}
	return parsed.data;
}

/**
 * Resolves GitHub location from request body.
 * Returns the location or throws a validation AppError.
 */
function resolveGitHubLocation(body: GitHubImportInput): GitHubLocation {
	if (body.owner && body.repo && body.path) {
		return {
			owner: body.owner,
			repo: body.repo,
			path: body.path,
			branch: body.branch,
		};
	}

	const parsed = parseGitHubUrl(body.url);
	if (!parsed) {
		throw validationError(
			"Could not parse the GitHub URL. Supported formats: github.com/owner/repo/blob/branch/path, raw.githubusercontent.com URLs, or owner/repo/path shorthand."
		);
	}

	return {
		owner: parsed.owner,
		repo: parsed.repo,
		path: parsed.path,
		branch: body.branch || parsed.branch,
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
	try {
		const userId = await requireAuth();

		// Check if user has GitHub connected
		const hasToken = await hasGitHubToken(userId);
		if (!hasToken) {
			return apiError(
				forbidden(
					"GitHub not connected. Please sign in with GitHub to connect your account before importing from GitHub."
				)
			);
		}

		// Parse request body
		const body = await parseRequestBody(request);

		// Resolve GitHub location
		const { owner, repo, path, branch } = resolveGitHubLocation(body);

		// Fetch file from GitHub
		const fetchResult = await fetchFileFromGitHub(
			userId,
			owner,
			repo,
			path,
			branch
		);

		if ("error" in fetchResult) {
			const code =
				GITHUB_ERROR_MAP[fetchResult.serviceError.code] ?? "INTERNAL";
			return apiError(new AppError({ code, message: fetchResult.error }));
		}

		const fileContent = fetchResult.data.content;

		// Parse JSON content
		let jsonData: unknown;
		try {
			jsonData = JSON.parse(fileContent);
		} catch {
			return apiError(
				validationError(`The file at ${path} is not valid JSON.`)
			);
		}

		// Import the case
		const importResult = await importCase(userId, jsonData);
		if ("error" in importResult) {
			return apiError(serviceErrorToAppError(importResult.error));
		}

		return apiSuccess({
			id: importResult.data.caseId,
			name: importResult.data.caseName,
			elementCount: importResult.data.elementCount,
			evidenceLinkCount: importResult.data.evidenceLinkCount,
			warnings: importResult.data.warnings,
			source: {
				type: "github",
				owner,
				repo,
				path,
				branch: branch || "default",
			},
		});
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
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
	try {
		const userId = await requireAuth();
		const connected = await hasGitHubToken(userId);
		return apiSuccess({ connected });
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
