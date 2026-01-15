/**
 * GitHub API Service
 *
 * Provides functions to interact with GitHub repositories using the user's
 * OAuth access token. Used for importing assurance cases from GitHub.
 */

import { Octokit } from "@octokit/rest";
import { prismaNew } from "@/lib/prisma";

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
	const user = await prismaNew.user.findUnique({
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
 * Creates an authenticated Octokit client for the specified user.
 * Throws if the user doesn't have a valid GitHub token.
 */
async function createOctokitClient(userId: string): Promise<Octokit> {
	const token = await getUserGitHubToken(userId);

	if (!token) {
		throw {
			code: "NO_TOKEN",
			message:
				"No GitHub token found. Please sign in with GitHub to connect your account.",
		} as GitHubServiceError;
	}

	return new Octokit({ auth: token });
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
 * @returns The file content and metadata
 * @throws GitHubServiceError if the request fails
 */
export async function fetchFileFromGitHub(
	userId: string,
	owner: string,
	repo: string,
	path: string,
	branch?: string
): Promise<GitHubFileResult> {
	const octokit = await createOctokitClient(userId);

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
			throw {
				code: "API_ERROR",
				message: `Path "${path}" is a directory, not a file.`,
			} as GitHubServiceError;
		}

		if (data.type !== "file") {
			throw {
				code: "API_ERROR",
				message: `Path "${path}" is not a regular file (type: ${data.type}).`,
			} as GitHubServiceError;
		}

		// File content is base64 encoded
		if (!data.content) {
			throw {
				code: "API_ERROR",
				message: "File has no content.",
			} as GitHubServiceError;
		}

		const content = Buffer.from(data.content, "base64").toString("utf-8");

		return {
			content,
			sha: data.sha,
			path: data.path,
			size: data.size,
		};
	} catch (error) {
		// Re-throw our custom errors
		if ((error as GitHubServiceError).code) {
			throw error;
		}

		// Handle Octokit errors
		throw handleOctokitError(
			error as { status?: number; message?: string },
			path,
			owner,
			repo
		);
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
export function parseGitHubUrl(url: string): {
	owner: string;
	repo: string;
	path: string;
	branch?: string;
} | null {
	// Try raw.githubusercontent.com with refs/heads format first (more specific)
	const rawRefsMatch = url.match(RAW_GITHUB_REFS_REGEX);
	if (rawRefsMatch) {
		return {
			owner: rawRefsMatch[1],
			repo: rawRefsMatch[2],
			branch: rawRefsMatch[3],
			path: decodeURIComponent(rawRefsMatch[4]),
		};
	}

	// Try raw.githubusercontent.com simple format
	const rawSimpleMatch = url.match(RAW_GITHUB_SIMPLE_REGEX);
	if (rawSimpleMatch) {
		return {
			owner: rawSimpleMatch[1],
			repo: rawSimpleMatch[2],
			branch: rawSimpleMatch[3],
			path: decodeURIComponent(rawSimpleMatch[4]),
		};
	}

	// Try github.com blob format
	const blobMatch = url.match(BLOB_GITHUB_URL_REGEX);
	if (blobMatch) {
		return {
			owner: blobMatch[1],
			repo: blobMatch[2],
			branch: blobMatch[3],
			path: decodeURIComponent(blobMatch[4]),
		};
	}

	// Try shorthand format: owner/repo/path (assumes main branch)
	const shorthandMatch = url.match(SHORTHAND_PATH_REGEX);
	if (shorthandMatch && !url.includes("://")) {
		return {
			owner: shorthandMatch[1],
			repo: shorthandMatch[2],
			path: decodeURIComponent(shorthandMatch[3]),
		};
	}

	return null;
}
