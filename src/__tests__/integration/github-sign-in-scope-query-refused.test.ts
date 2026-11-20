import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The sign-in route is exercised through its own exported handlers. The
 * library handler it wraps is replaced by a recording stand-in, so the tests
 * show which requests reach the library at all; what the library then asks
 * GitHub for is covered by the GitHub scope tests that call it directly.
 */
vi.hoisted(() => {
	process.env.GITHUB_APP_CLIENT_ID = "scope-query-client-id";
	process.env.GITHUB_APP_CLIENT_SECRET = "scope-query-client-secret";
	process.env.NEXTAUTH_URL = "http://localhost:3000";
	process.env.NEXTAUTH_SECRET = "github-sign-in-scope-query-test-secret";
});

const { libraryHandler } = vi.hoisted(() => ({
	libraryHandler: vi.fn(),
}));

vi.mock("next-auth", () => ({
	default: vi.fn(() => libraryHandler),
}));

import { POST } from "@/app/api/auth/[...nextauth]/route";

const BASE = "http://localhost:3000/api/auth";
const LIBRARY_ANSWER = "handled by the library";

function params(...nextauth: string[]) {
	return { params: Promise.resolve({ nextauth }) };
}

function post(path: string, query = "") {
	return POST(
		new NextRequest(`${BASE}/${path}${query}`, {
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({ csrfToken: "token" }),
		}),
		params(...path.split("/"))
	);
}

describe("POST /api/auth/signin/github with a scope in the query", () => {
	beforeEach(() => {
		libraryHandler.mockReset();
		libraryHandler.mockResolvedValue(new Response(LIBRARY_ANSWER));
	});

	it("is refused with a 400 and the standard error body", async () => {
		const response = await post("signin/github", "?scope=repo");

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			error: "A GitHub sign-in request cannot set its own scope",
			code: "VALIDATION",
		});
	});

	it("never reaches the library, so no GitHub address is built", async () => {
		const response = await post("signin/github", "?scope=repo");

		expect(libraryHandler).not.toHaveBeenCalled();
		expect(response.headers.get("location")).toBeNull();
	});

	it("is refused whatever the scope names", async () => {
		const response = await post("signin/github", "?scope=read:user");

		expect(response.status).toBe(400);
		expect(libraryHandler).not.toHaveBeenCalled();
	});
});

describe("other POST requests to the sign-in route", () => {
	beforeEach(() => {
		libraryHandler.mockReset();
		libraryHandler.mockResolvedValue(new Response(LIBRARY_ANSWER));
	});

	it("pass a GitHub sign-in without a scope through to the library", async () => {
		const response = await post("signin/github");

		expect(libraryHandler).toHaveBeenCalledTimes(1);
		expect(await response.text()).toBe(LIBRARY_ANSWER);
	});

	it("pass a query that names a scope on another provider's sign-in through", async () => {
		const response = await post("signin/google", "?scope=openid");

		expect(libraryHandler).toHaveBeenCalledTimes(1);
		expect(await response.text()).toBe(LIBRARY_ANSWER);
	});

	it("pass credential sign-in through", async () => {
		await post("callback/credentials");

		expect(libraryHandler).toHaveBeenCalledTimes(1);
	});
});
