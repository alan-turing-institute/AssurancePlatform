/**
 * GitHub API Service
 *
 * Provides functions to interact with GitHub repositories using the user's
 * OAuth access token. Used for importing assurance cases from GitHub.
 */

import { Octokit } from "@octokit/rest";
import { prisma } from "@/lib/prisma";
import type { ErrorCode } from "@/types/domain";

// Top-level regex patterns for URL parsing
// Matches: raw.githubusercontent.com/owner/repo/branch/path (simple format)
const RAW_GITHUB_SIMPLE_REGEX =
	/^https?:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+?)(?:\?.*)?$/;
// Matches: raw.githubusercontent.com/owner/repo/refs/heads/branch/path (refs format)
const RAW_GITHUB_REFS_REGEX =
	/^https?:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/refs\/heads\/([^/]+)\/(.+?)(?:\?.*)?$/;
const BLOB_GITHUB_URL_REGEX =
	/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+?)(?:\?.*)?$/;
const SHORTHAND_PATH_REGEX = /^([^/]+)\/([^/]+)\/(.+)$/;

export type GitHubFileResult = {
	content: string;
	sha: string;
	path: string;
	size: number;
};

export type GitHubServiceError = {
	code:
		| "NO_TOKEN"
		| "TOKEN_EXPIRED"
		| "NOT_FOUND"
		| "FORBIDDEN"
		| "RATE_LIMITED"
		| "API_ERROR";
	message: string;
	status?: number;
};

/**
 * Retrieves the user's GitHub access token from the database.
 * Returns null if the user doesn't have a GitHub token stored.
 */
async function getUserGitHubToken(userId: string): Promise<string | null> {
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: {
			githubAccessToken: true,
			githubTokenExpiresAt: true,
		},
	});

	if (!user?.githubAccessToken) {
		return null;
	}

	// Check if token is expired (if expiry is set)
	if (user.githubTokenExpiresAt && user.githubTokenExpiresAt < new Date()) {
		return null;
	}

	return user.githubAccessToken;
}

/**
 * Maps GitHub service error codes to application error codes.
 * Moved here from the route layer so callers can use it without coupling to the route.
 */
export const GITHUB_ERROR_MAP: Record<string, ErrorCode> = {
	NO_TOKEN: "FORBIDDEN",
	TOKEN_EXPIRED: "UNAUTHORISED",
	NOT_FOUND: "NOT_FOUND",
	FORBIDDEN: "FORBIDDEN",
	RATE_LIMITED: "RATE_LIMITED",
	API_ERROR: "INTERNAL",
};

/**
 * Creates an authenticated Octokit client for the specified user.
 * Returns null if the user doesn't have a valid GitHub token.
 */
async function createOctokitClient(
	userId: string
): Promise<{ client: Octokit } | { serviceError: GitHubServiceError }> {
	const token = await getUserGitHubToken(userId);

	if (!token) {
		return {
			serviceError: {
				code: "NO_TOKEN",
				message:
					"No GitHub token found. Please sign in with GitHub to connect your account.",
			},
		};
	}

	return { client: new Octokit({ auth: token }) };
}

/**
 * Converts an Octokit error to a GitHubServiceError.
 */
function handleOctokitError(
	error: { status?: number; message?: string },
	path: string,
	owner: string,
	repo: string
): GitHubServiceError {
	if (error.status === 404) {
		return {
			code: "NOT_FOUND",
			message: `File not found: ${owner}/${repo}/${path}`,
			status: 404,
		};
	}

	if (error.status === 403) {
		if (error.message?.includes("rate limit")) {
			return {
				code: "RATE_LIMITED",
				message: "GitHub API rate limit exceeded. Please try again later.",
				status: 403,
			};
		}
		return {
			code: "FORBIDDEN",
			message:
				"Access denied. You may not have permission to access this repository.",
			status: 403,
		};
	}

	if (error.status === 401) {
		return {
			code: "TOKEN_EXPIRED",
			message:
				"GitHub token is invalid or expired. Please sign in again with GitHub.",
			status: 401,
		};
	}

	return {
		code: "API_ERROR",
		message:
			error.message || "An error occurred while fetching the file from GitHub.",
		status: error.status,
	};
}

/**
 * Fetches a file from a GitHub repository.
 *
 * @param userId - The ID of the user making the request
 * @param owner - Repository owner (username or organisation)
 * @param repo - Repository name
 * @param path - Path to the file within the repository
 * @param branch - Branch name (optional, defaults to repo's default branch)
 * @returns `{ data: GitHubFileResult }` on success, `{ error: string, serviceError: GitHubServiceError }` on failure
 */
export async function fetchFileFromGitHub(
	userId: string,
	owner: string,
	repo: string,
	path: string,
	branch?: string
): Promise<
	| { data: GitHubFileResult }
	| { error: string; serviceError: GitHubServiceError }
> {
	const octokitResult = await createOctokitClient(userId);

	if ("serviceError" in octokitResult) {
		return {
			error: octokitResult.serviceError.message,
			serviceError: octokitResult.serviceError,
		};
	}

	const octokit = octokitResult.client;

	try {
		const response = await octokit.repos.getContent({
			owner,
			repo,
			path,
			...(branch && { ref: branch }),
		});

		// The API returns an array for directories, a single object for files
		const data = response.data;

		if (Array.isArray(data)) {
			const serviceError: GitHubServiceError = {
				code: "API_ERROR",
				message: `Path "${path}" is a directory, not a file.`,
			};
			return { error: serviceError.message, serviceError };
		}

		if (data.type !== "file") {
			const serviceError: GitHubServiceError = {
				code: "API_ERROR",
				message: `Path "${path}" is not a regular file (type: ${data.type}).`,
			};
			return { error: serviceError.message, serviceError };
		}

		// File content is base64 encoded
		if (!data.content) {
			const serviceError: GitHubServiceError = {
				code: "API_ERROR",
				message: "File has no content.",
			};
			return { error: serviceError.message, serviceError };
		}

		const content = Buffer.from(data.content, "base64").toString("utf-8");

		return {
			data: {
				content,
				sha: data.sha,
				path: data.path,
				size: data.size,
			},
		};
	} catch (error) {
		const serviceError = handleOctokitError(
			error as { status?: number; message?: string },
			path,
			owner,
			repo
		);
		return { error: serviceError.message, serviceError };
	}
}

/**
 * Checks if a user has a valid GitHub token stored.
 *
 * @param userId - The ID of the user to check
 * @returns True if the user has a valid (non-expired) GitHub token
 */
export async function hasGitHubToken(userId: string): Promise<boolean> {
	const token = await getUserGitHubToken(userId);
	return token !== null;
}

/**
 * Parses a GitHub URL into owner, repo, and path components.
 * Supports various GitHub URL formats:
 * - https://github.com/owner/repo/blob/branch/path/to/file.json
 * - https://raw.githubusercontent.com/owner/repo/branch/path/to/file.json
 * - owner/repo/path/to/file.json (shorthand)
 *
 * @param url - The GitHub URL or shorthand to parse
 * @returns Parsed components or null if the URL is invalid
 */
type ParsedGitHubUrl = {
	owner: string;
	repo: string;
	path: string;
	branch?: string;
};

/** Build a parsed result from a 4-group regex match (owner, repo, branch, path). */
function buildParsedUrl(
	match: RegExpMatchArray,
	includeBranch: boolean
): ParsedGitHubUrl {
	return {
		owner: match[1] ?? "",
		repo: match[2] ?? "",
		...(includeBranch ? { branch: match[3] } : {}),
		path: decodeURIComponent(match[includeBranch ? 4 : 3] ?? ""),
	};
}

export function parseGitHubUrl(url: string): ParsedGitHubUrl | null {
	// Try raw.githubusercontent.com with refs/heads format first (more specific)
	const rawRefsMatch = url.match(RAW_GITHUB_REFS_REGEX);
	if (rawRefsMatch) {
		return buildParsedUrl(rawRefsMatch, true);
	}

	// Try raw.githubusercontent.com simple format
	const rawSimpleMatch = url.match(RAW_GITHUB_SIMPLE_REGEX);
	if (rawSimpleMatch) {
		return buildParsedUrl(rawSimpleMatch, true);
	}

	// Try github.com blob format
	const blobMatch = url.match(BLOB_GITHUB_URL_REGEX);
	if (blobMatch) {
		return buildParsedUrl(blobMatch, true);
	}

	// Try shorthand format: owner/repo/path (assumes main branch)
	const shorthandMatch = url.match(SHORTHAND_PATH_REGEX);
	if (shorthandMatch && !url.includes("://")) {
		return buildParsedUrl(shorthandMatch, false);
	}

	return null;
}
