import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { encryptToken } from "@/lib/auth/token-encryption";
import prisma from "@/lib/prisma";
import {
	fetchFileFromGitHub,
	hasGitHubToken,
} from "@/lib/services/github-api-service";
import { captureLogs } from "../helpers/capture-logs";
import { createTestUser } from "../utils/prisma-factories";

/**
 * Mock boundary: the network only. Octokit runs for real against a stubbed
 * `fetch`, so the scopes header is read from a genuine Octokit response.
 * Postgres stays real throughout.
 */
const TOKEN = "gho_import_test_token";
const NARROW_SCOPES = "read:user, user:email";
const WIDE_SCOPES = "read:user, repo, user:email";
const FILE_JSON = JSON.stringify({ name: "a case" });

function githubResponse(
	status: number,
	body: unknown,
	scopes: string | null
): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			"content-type": "application/json; charset=utf-8",
			...(scopes === null ? {} : { "x-oauth-scopes": scopes }),
		},
	});
}

function fileBody() {
	return {
		type: "file",
		name: "case.json",
		path: "docs/case.json",
		sha: "abc123",
		size: FILE_JSON.length,
		encoding: "base64",
		content: Buffer.from(FILE_JSON).toString("base64"),
	};
}

async function userWithStoredToken() {
	const user = await createTestUser();
	await prisma.user.update({
		where: { id: user.id },
		data: {
			githubId: `gh-${user.id}`,
			githubAccessToken: encryptToken(TOKEN),
			githubTokenExpiresAt: new Date("2030-01-01T00:00:00Z"),
		},
	});
	return user;
}

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
	fetchMock.mockReset();
	vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("GitHub import reads public repositories only", () => {
	it("reports a missing or private file with the public-repositories message", async () => {
		const user = await userWithStoredToken();
		fetchMock.mockResolvedValue(
			githubResponse(404, { message: "Not Found" }, NARROW_SCOPES)
		);

		const result = await fetchFileFromGitHub(
			user.id,
			"octo",
			"secret-repo",
			"docs/case.json"
		);

		expect(result).toEqual({
			error:
				"No file found at octo/secret-repo/docs/case.json. TEA can import only from public GitHub repositories. Check the address, or download the file and import it on the File tab.",
			serviceError: expect.objectContaining({ code: "NOT_FOUND", status: 404 }),
		});
		expect(await hasGitHubToken(user.id)).toBe(true);
	});

	it("returns the file for a token with only the profile and email scopes", async () => {
		const user = await userWithStoredToken();
		fetchMock.mockResolvedValue(githubResponse(200, fileBody(), NARROW_SCOPES));

		const result = await fetchFileFromGitHub(
			user.id,
			"octo",
			"public-repo",
			"docs/case.json"
		);

		expect(result).toEqual({
			data: expect.objectContaining({ content: FILE_JSON, sha: "abc123" }),
		});
		expect(await hasGitHubToken(user.id)).toBe(true);
	});

	it("does not treat narrower repository scopes as the full repo scope", async () => {
		const user = await userWithStoredToken();
		fetchMock.mockResolvedValue(
			githubResponse(200, fileBody(), "public_repo, repo:status, user:email")
		);

		const result = await fetchFileFromGitHub(
			user.id,
			"octo",
			"public-repo",
			"docs/case.json"
		);

		expect("data" in result).toBe(true);
		expect(await hasGitHubToken(user.id)).toBe(true);
	});

	it("discards a token that carries the repo scope and asks the person to reconnect", async () => {
		const user = await userWithStoredToken();
		fetchMock.mockResolvedValue(githubResponse(200, fileBody(), WIDE_SCOPES));
		const logs = captureLogs();

		try {
			const result = await fetchFileFromGitHub(
				user.id,
				"octo",
				"private-repo",
				"docs/case.json"
			);

			expect("data" in result).toBe(false);
			expect(result).toEqual({
				error: expect.stringContaining("No GitHub token found."),
				serviceError: expect.objectContaining({ code: "NO_TOKEN" }),
			});

			const stored = await prisma.user.findUniqueOrThrow({
				where: { id: user.id },
			});
			expect(stored.githubAccessToken).toBeNull();
			expect(stored.githubTokenExpiresAt).toBeNull();
			expect(stored.githubId).toBe(`gh-${user.id}`);
			expect(await hasGitHubToken(user.id)).toBe(false);

			const logged = JSON.stringify(logs.entries);
			expect(logged).toContain(WIDE_SCOPES);
			expect(logged).not.toContain(TOKEN);
		} finally {
			logs.restore();
		}
	});
});
