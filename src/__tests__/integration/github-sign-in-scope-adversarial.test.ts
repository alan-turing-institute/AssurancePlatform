import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { NextApiRequest, NextApiResponse } from "next";
import NextAuth from "next-auth";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * What GitHub is asked for, observed at the point the sign-in handler builds
 * the authorise address. The provider's setting is read through NextAuth's own
 * handler (the one `app/api/auth/[...nextauth]/route.ts` wraps), so a scope
 * that the library merges, defaults or overrides is seen as GitHub would see
 * it, not as the config file spells it.
 *
 * The provider is configured from the environment when `lib/auth/config.ts`
 * is first imported, so the values are set before any import below runs.
 */
vi.hoisted(() => {
	process.env.GITHUB_APP_CLIENT_ID = "scope-test-client-id";
	process.env.GITHUB_APP_CLIENT_SECRET = "scope-test-client-secret";
	process.env.NEXTAUTH_URL = "http://localhost:3000";
	process.env.NEXTAUTH_SECRET = "github-sign-in-scope-test-secret";
});

const { mockCookieStore } = vi.hoisted(() => ({
	mockCookieStore: { set: vi.fn(), get: vi.fn(), delete: vi.fn() },
}));

vi.mock("next/headers", () => ({
	cookies: vi.fn().mockResolvedValue(mockCookieStore),
}));

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn(),
}));

import { GET as linkRouteGET } from "@/app/api/auth/link/[provider]/route";
import { authOptions } from "@/lib/auth/config";
import { validateSession } from "@/lib/auth/validate-session";

const EXPECTED_SCOPE = "read:user user:email";
const SCOPE_SEPARATOR = /[\s,]+/;
const REPO_ROOT = path.join(import.meta.dirname, "../../..");

interface HandlerResult {
	body: unknown;
	headers: Map<string, unknown>;
	status: number;
}

function fakeResponse(): { res: NextApiResponse; result: HandlerResult } {
	const result: HandlerResult = {
		status: 200,
		headers: new Map(),
		body: undefined,
	};
	const res = {
		status(code: number) {
			result.status = code;
			return res;
		},
		setHeader(name: string, value: unknown) {
			result.headers.set(name.toLowerCase(), value);
			return res;
		},
		getHeader(name: string) {
			return result.headers.get(name.toLowerCase());
		},
		json(body: unknown) {
			result.body = body;
		},
		send(body: unknown) {
			result.body = body;
		},
		end() {
			return res;
		},
	};
	return { res: res as unknown as NextApiResponse, result };
}

async function callAuth(request: {
	body?: Record<string, string>;
	cookies?: Record<string, string>;
	method: "GET" | "POST";
	query: Record<string, string | string[]>;
}): Promise<HandlerResult> {
	const req = {
		body: request.body,
		cookies: request.cookies ?? {},
		headers: { host: "localhost:3000" },
		method: request.method,
		query: request.query,
	} as unknown as NextApiRequest;
	const { res, result } = fakeResponse();
	await NextAuth(req, res, authOptions);
	return result;
}

/** Splits a `Set-Cookie` value into the decoded name and value of its first pair. */
function parseSetCookie(header: string): { name: string; value: string } {
	const pair = header.split(";")[0] ?? "";
	const separator = pair.indexOf("=");
	return {
		name: pair.slice(0, separator),
		value: decodeURIComponent(pair.slice(separator + 1)),
	};
}

async function csrfCredentials(): Promise<{
	cookies: Record<string, string>;
	csrfToken: string;
}> {
	const result = await callAuth({
		method: "GET",
		query: { nextauth: ["csrf"] },
	});
	const { csrfToken } = result.body as { csrfToken: string };
	const setCookie = [result.headers.get("set-cookie")].flat() as string[];
	const cookies = Object.fromEntries(
		setCookie.map((header) => {
			const { name, value } = parseSetCookie(header);
			return [name, value];
		})
	);
	return { csrfToken, cookies };
}

/** Starts a GitHub sign-in the way the sign-in button does and returns GitHub's address. */
async function startGitHubSignIn(
	query: Record<string, string> = {}
): Promise<URL> {
	const { csrfToken, cookies } = await csrfCredentials();
	const result = await callAuth({
		method: "POST",
		query: { nextauth: ["signin", "github"], ...query },
		body: { csrfToken, callbackUrl: "/dashboard" },
		cookies,
	});
	const location = result.headers.get("location");
	if (typeof location !== "string") {
		throw new Error(`sign-in did not redirect (status ${result.status})`);
	}
	return new URL(location);
}

interface ProviderWithOptions {
	id: string;
	options?: { authorization?: { params?: { scope?: string } } };
}

/** The scope the config file itself passes to the GitHub provider, before the library merges its defaults. */
function suppliedGitHubScope(): string | undefined {
	const providers = authOptions.providers as unknown as ProviderWithOptions[];
	return providers.find((provider) => provider.id === "github")?.options
		?.authorization?.params?.scope;
}

describe("GitHub provider configuration", () => {
	it("spells the scope out instead of leaving it to the library's default", () => {
		expect(suppliedGitHubScope()).toBe(EXPECTED_SCOPE);
	});
});

describe("GitHub authorise request", () => {
	it("asks GitHub for exactly the profile and email scopes on sign-in", async () => {
		const authorise = await startGitHubSignIn();

		expect(authorise.origin + authorise.pathname).toBe(
			"https://github.com/login/oauth/authorize"
		);
		expect(authorise.searchParams.get("scope")).toBe(EXPECTED_SCOPE);
		expect(authorise.searchParams.getAll("scope")).toHaveLength(1);
	});

	it("never lets the repo scope appear anywhere in the authorise address", async () => {
		const authorise = await startGitHubSignIn();

		const scopes = (authorise.searchParams.get("scope") ?? "").split(
			SCOPE_SEPARATOR
		);
		expect(scopes).not.toContain("repo");
		expect(scopes).not.toContain("public_repo");
		expect(scopes.sort()).toEqual(["read:user", "user:email"]);
	});
});

describe("GitHub link entry point (Settings' Connect and the import tab's connect)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(validateSession).mockResolvedValue({
			userId: "user-1",
			username: "chris",
			email: "chris@example.com",
		});
	});

	it("hands over to the same GitHub sign-in without carrying a scope of its own", async () => {
		const response = await linkRouteGET(new Request("http://container:3000/"), {
			params: Promise.resolve({ provider: "github" }),
		});

		const location = new URL(response.headers.get("location") as string);
		expect(location.pathname).toBe("/api/auth/signin/github");
		expect([...location.searchParams.keys()]).not.toContain("scope");

		// Whatever the redirect carries is what NextAuth would merge over the
		// provider's setting, so the address it then builds is checked again.
		const authorise = await startGitHubSignIn(
			Object.fromEntries(location.searchParams)
		);
		expect(authorise.searchParams.get("scope")).toBe(EXPECTED_SCOPE);
	});
});

const SOURCE_ROOTS = [
	"app",
	"components",
	"lib",
	"hooks",
	"actions",
	"providers",
];
// A `scope` assignment or query parameter whose value names the full `repo`
// scope (`public_repo` has no word boundary before `repo`, so it is not matched).
const WIDE_GITHUB_SCOPE =
	/scope["']?\s*[:=,]\s*["'`][^"'`\n]*\brepo\b|scope=[^&\s"'`]*\brepo\b/;

function isProductionSource(file: string): boolean {
	const isSource = file.endsWith(".ts") || file.endsWith(".tsx");
	const isTest =
		file.includes("__tests__") ||
		file.endsWith(".test.ts") ||
		file.endsWith(".test.tsx");
	return isSource && !isTest;
}

function filesAskingForRepoScope(): string[] {
	return SOURCE_ROOTS.flatMap((root) =>
		readdirSync(path.join(REPO_ROOT, root), { recursive: true })
			.map(String)
			.filter(isProductionSource)
			.map((file) => path.join(root, file))
	).filter((file) =>
		WIDE_GITHUB_SCOPE.test(readFileSync(path.join(REPO_ROOT, file), "utf8"))
	);
}

describe("GitHub scope in source", () => {
	it("no production source asks for the repo scope through a scope setting or query", () => {
		expect(filesAskingForRepoScope()).toEqual([]);
	});
});
