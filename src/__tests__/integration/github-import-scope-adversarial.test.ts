import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { encryptToken } from "@/lib/auth/token-encryption";
import prisma from "@/lib/prisma";
import {
	fetchFileFromGitHub,
	hasGitHubToken,
} from "@/lib/services/github-api-service";
import { captureLogs } from "../helpers/capture-logs";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	createNestedCaseJSON,
	createTestUser,
} from "../utils/prisma-factories";

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

/**
 * GitHub import after the sign-in change. The GitHub API is replaced at the
 * network edge (`fetch`), so Octokit's own response handling turns a real
 * `Response` and its `x-oauth-scopes` header into what the service reads. A
 * token that GitHub reports as carrying the full `repo` scope must never be
 * used to bring a file in: nothing comes back, no case is created, the stored
 * token is cleared and the person is asked to connect again.
 */

const TOKEN = "gho_s3cretTokenValueThatMustNeverBeLogged0123456789";
const CASE_NAME = "Case Behind The Scope Check";
const LOCATION = "octo/hello/cases/case.json";

interface GitHubReply {
	body: unknown;
	headers?: [string, string][];
	status: number;
}

interface SeenRequest {
	authorization: string | undefined;
	url: string;
}

let seenRequests: SeenRequest[] = [];

function fileBody(): Record<string, unknown> {
	const content = Buffer.from(
		JSON.stringify(
			createNestedCaseJSON({ case: { name: CASE_NAME, description: "d" } })
		)
	).toString("base64");
	return {
		type: "file",
		name: "case.json",
		path: "cases/case.json",
		sha: "abc123",
		size: content.length,
		content,
		encoding: "base64",
	};
}

function scopeHeader(scopes: string | null): [string, string][] {
	return scopes === null ? [] : [["x-oauth-scopes", scopes]];
}

function fileReply(headers: [string, string][]): GitHubReply {
	return { status: 200, body: fileBody(), headers };
}

function notFoundReply(scopes = "read:user, user:email"): GitHubReply {
	return {
		status: 404,
		body: { message: "Not Found" },
		headers: scopeHeader(scopes),
	};
}

/** Replaces `fetch` so that api.github.com answers with `reply`; other hosts go through. */
function githubReplies(reply: GitHubReply) {
	const realFetch = globalThis.fetch;
	const stub = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = input instanceof Request ? input.url : String(input);
		if (!url.startsWith("https://api.github.com/")) {
			return await realFetch(input, init);
		}
		const sent = init?.headers as Record<string, string> | undefined;
		seenRequests.push({ url, authorization: sent?.authorization });
		return new Response(JSON.stringify(reply.body), {
			status: reply.status,
			headers: [
				["content-type", "application/json; charset=utf-8"],
				...(reply.headers ?? []),
			],
		});
	});
	vi.stubGlobal("fetch", stub);
	return stub;
}

async function userWithToken() {
	const user = await createTestUser();
	await prisma.user.update({
		where: { id: user.id },
		data: {
			githubId: `gh-${user.id}`,
			githubUsername: "octo",
			githubAccessToken: encryptToken(TOKEN),
			githubTokenExpiresAt: new Date("2031-01-01T00:00:00Z"),
		},
	});
	return user;
}

async function storedToken(userId: string) {
	return await prisma.user.findUniqueOrThrow({
		where: { id: userId },
		select: { githubAccessToken: true, githubTokenExpiresAt: true },
	});
}

function importRequest(url = LOCATION): NextRequest {
	return new NextRequest("http://localhost:3000/api/cases/import/github", {
		method: "POST",
		body: JSON.stringify({ url }),
		headers: { "Content-Type": "application/json" },
	});
}

async function importViaRoute(userId: string, url?: string) {
	const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
	await mockAuth(user.id, user.username, user.email);
	const { POST } = await import("@/app/api/cases/import/github/route");
	return await POST(importRequest(url));
}

async function noTokenMessage(): Promise<string> {
	const stranger = await createTestUser();
	const result = await fetchFileFromGitHub(stranger.id, "o", "r", "p.json");
	if (!("error" in result)) {
		throw new Error("a user without a token must not get a file");
	}
	return result.error;
}

beforeEach(async () => {
	seenRequests = [];
	await mockNoAuth();
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

const REPO_SCOPE_HEADERS = [
	"repo",
	"repo, read:user, user:email",
	"read:user, repo, user:email",
	"read:user, user:email, repo",
	"read:user,user:email,repo",
	"read:user ,   repo   , user:email",
	"admin:org, repo, workflow, gist",
];

const NOT_REPO_SCOPE_HEADERS = [
	"public_repo",
	"repo:status",
	"read:user, user:email, public_repo, repo:status, repo_deployment",
	"read:user, user:email",
	"",
	"repository, repos, reporter",
];

describe("fetchFileFromGitHub — scopes reported by GitHub", () => {
	it.each(
		REPO_SCOPE_HEADERS
	)("refuses a response that lists the repo scope (%j): no file, token cleared", async (scopes) => {
		const user = await userWithToken();
		githubReplies(fileReply(scopeHeader(scopes)));

		const result = await fetchFileFromGitHub(
			user.id,
			"octo",
			"hello",
			"c.json"
		);

		expect("data" in result).toBe(false);
		expect("serviceError" in result && result.serviceError.code).toBe(
			"NO_TOKEN"
		);
		expect(await storedToken(user.id)).toEqual({
			githubAccessToken: null,
			githubTokenExpiresAt: null,
		});
		expect(await hasGitHubToken(user.id)).toBe(false);
	});

	it.each(
		NOT_REPO_SCOPE_HEADERS
	)("does not treat %j as the repo scope: the file comes back and the token stays", async (scopes) => {
		const user = await userWithToken();
		const before = await storedToken(user.id);
		githubReplies(fileReply(scopeHeader(scopes)));

		const result = await fetchFileFromGitHub(
			user.id,
			"octo",
			"hello",
			"c.json"
		);

		expect("data" in result).toBe(true);
		expect(await storedToken(user.id)).toEqual(before);
	});

	it("does not treat a response with no scopes header as the repo scope", async () => {
		const user = await userWithToken();
		const before = await storedToken(user.id);
		githubReplies(fileReply(scopeHeader(null)));

		const result = await fetchFileFromGitHub(
			user.id,
			"octo",
			"hello",
			"c.json"
		);

		expect("data" in result).toBe(true);
		expect(await storedToken(user.id)).toEqual(before);
	});

	it("reads the scopes the token carries, not the scopes the endpoint would accept", async () => {
		const user = await userWithToken();
		const before = await storedToken(user.id);
		githubReplies(
			fileReply([
				["x-oauth-scopes", "read:user, user:email"],
				["x-accepted-oauth-scopes", "repo"],
			])
		);

		const result = await fetchFileFromGitHub(
			user.id,
			"octo",
			"hello",
			"c.json"
		);

		expect("data" in result).toBe(true);
		expect(await storedToken(user.id)).toEqual(before);
	});

	it("refuses when the scopes arrive as two separate header lines and repo is on the second", async () => {
		const user = await userWithToken();
		githubReplies(
			fileReply([
				["x-oauth-scopes", "read:user"],
				["X-OAuth-Scopes", "repo"],
			])
		);

		const result = await fetchFileFromGitHub(
			user.id,
			"octo",
			"hello",
			"c.json"
		);

		expect("data" in result).toBe(false);
		expect((await storedToken(user.id)).githubAccessToken).toBeNull();
	});

	it("uses the stored token for the request it checks", async () => {
		const user = await userWithToken();
		githubReplies(fileReply(scopeHeader("repo")));

		await fetchFileFromGitHub(user.id, "octo", "hello", "c.json");

		expect(seenRequests).toHaveLength(1);
		expect(seenRequests[0]?.authorization).toContain(TOKEN);
	});

	it("clears only the refused user's token and leaves another user's stored token alone", async () => {
		const refused = await userWithToken();
		const bystander = await userWithToken();
		const before = await storedToken(bystander.id);
		githubReplies(fileReply(scopeHeader("repo")));

		await fetchFileFromGitHub(refused.id, "octo", "hello", "c.json");

		expect((await storedToken(refused.id)).githubAccessToken).toBeNull();
		expect(await storedToken(bystander.id)).toEqual(before);
	});
});

describe("POST /api/cases/import/github — a token that still carries repo", () => {
	it("answers 403 with the no-token message, returns nothing from the file, creates no case and clears the token", async () => {
		const user = await userWithToken();
		const expectedMessage = await noTokenMessage();
		githubReplies(fileReply(scopeHeader("read:user, repo, user:email")));

		const response = await importViaRoute(user.id);

		expect(response.status).toBe(403);
		const text = await response.text();
		const body = JSON.parse(text) as { code: string; error: string };
		expect(body.error).toBe(expectedMessage);
		expect(body.code).toBe("FORBIDDEN");
		expect(text).not.toContain(CASE_NAME);
		expect(text).not.toContain(TOKEN);
		expect(await prisma.assuranceCase.count()).toBe(0);
		expect(await storedToken(user.id)).toEqual({
			githubAccessToken: null,
			githubTokenExpiresAt: null,
		});
	});

	it("does not reach GitHub again on the next attempt, which is asked to connect", async () => {
		const user = await userWithToken();
		const stub = githubReplies(fileReply(scopeHeader("repo")));
		await importViaRoute(user.id);
		expect(stub).toHaveBeenCalledTimes(1);

		const second = await importViaRoute(user.id);

		expect(second.status).toBe(403);
		expect(stub).toHaveBeenCalledTimes(1);
		expect(await prisma.assuranceCase.count()).toBe(0);
	});

	it("still refuses, and creates no case, when the stored token cannot be cleared", async () => {
		const user = await userWithToken();
		githubReplies(fileReply(scopeHeader("repo")));
		const failingUpdate = vi
			.spyOn(prisma.user, "update")
			.mockRejectedValue(new Error("database unavailable"));

		const response = await importViaRoute(user.id);

		expect(failingUpdate).toHaveBeenCalled();
		expect(response.status).toBe(403);
		expect(await response.text()).not.toContain(CASE_NAME);
		expect(await prisma.assuranceCase.count()).toBe(0);
	});

	it("imports normally for a token with only public_repo, and keeps the token", async () => {
		const user = await userWithToken();
		const before = await storedToken(user.id);
		githubReplies(fileReply(scopeHeader("read:user, user:email, public_repo")));

		const response = await importViaRoute(user.id);

		expect(response.status).toBe(200);
		const created = await prisma.assuranceCase.findMany({
			where: { createdById: user.id },
		});
		expect(created.map((c) => c.name)).toEqual([CASE_NAME]);
		expect(await storedToken(user.id)).toEqual(before);
	});
});

describe("POST /api/cases/import/github — a file GitHub cannot show", () => {
	it("answers 404 with a message that names public repositories only, and keeps the token", async () => {
		const user = await userWithToken();
		const before = await storedToken(user.id);
		githubReplies(notFoundReply());

		const response = await importViaRoute(user.id, "octo/secret/dir/case.json");

		expect(response.status).toBe(404);
		const { error } = (await response.json()) as { error: string };
		expect(error).toContain("octo/secret/dir/case.json");
		expect(error).toContain("public GitHub repositories");
		expect(await storedToken(user.id)).toEqual(before);
		expect(await prisma.assuranceCase.count()).toBe(0);
	});

	it("does not answer a missing file with the no-token message", async () => {
		const user = await userWithToken();
		const noToken = await noTokenMessage();
		githubReplies(notFoundReply());

		const response = await importViaRoute(user.id);

		const { error } = (await response.json()) as { error: string };
		expect(error).not.toBe(noToken);
	});
});

describe("GitHub token in logs", () => {
	it("is never written, as plaintext or as stored, when a wide token is discarded", async () => {
		const user = await userWithToken();
		const ciphertext = (await storedToken(user.id)).githubAccessToken as string;
		githubReplies(fileReply(scopeHeader("read:user, repo")));
		const logs = captureLogs();
		try {
			await importViaRoute(user.id);
			await importViaRoute(user.id);
		} finally {
			logs.restore();
		}

		const written = JSON.stringify(logs.entries);
		expect(logs.entries.length).toBeGreaterThan(0);
		expect(written).not.toContain(TOKEN);
		expect(written).not.toContain(ciphertext);
	});

	it("is never written when clearing the token fails", async () => {
		const user = await userWithToken();
		githubReplies(fileReply(scopeHeader("repo")));
		vi.spyOn(prisma.user, "update").mockRejectedValue(
			new Error("database unavailable")
		);
		const logs = captureLogs();
		try {
			await importViaRoute(user.id);
		} finally {
			logs.restore();
		}

		expect(logs.entries.length).toBeGreaterThan(0);
		expect(JSON.stringify(logs.entries)).not.toContain(TOKEN);
	});
});
