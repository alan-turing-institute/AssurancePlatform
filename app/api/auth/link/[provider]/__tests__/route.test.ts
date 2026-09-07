import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LINK_COOKIE_NAME } from "@/lib/auth/config";
import type { ValidatedSession } from "@/lib/auth/validate-session";

/**
 * Route-level coverage for GET /api/auth/link/[provider].
 *
 * On Azure App Service, `request.url` reflects the container's internal
 * hostname and port (see the linked bug), so both cases here build a
 * request whose host is NOT the public one — the request host must never
 * leak into the redirect. `next/headers`'s `cookies()` is mocked because it
 * throws when called outside a real Next.js request context, matching
 * api-auth-forgot-password-route.test.ts's mocking of `headers()` for the
 * same reason.
 */

const { mockCookieStore } = vi.hoisted(() => ({
	mockCookieStore: { set: vi.fn(), get: vi.fn(), delete: vi.fn() },
}));

vi.mock("next/headers", () => ({
	cookies: vi.fn().mockResolvedValue(mockCookieStore),
}));

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn(),
}));

import { GET } from "@/app/api/auth/link/[provider]/route";
import { validateSession } from "@/lib/auth/validate-session";

const PUBLIC_ORIGIN = "https://public.example";
// The request's own host is the container's internal hostname, standing in
// for what Azure App Service actually puts on `request.url`.
const CONTAINER_REQUEST_URL = "http://container:3000/api/auth/link/google";
// Matches a `/` immediately followed by one or more further `/`s, as long as
// the character before it isn't `:` (so `https://` itself doesn't match).
const DOUBLED_SLASH_REGEX = /([^:]\/)\/+/;

const VALID_SESSION: ValidatedSession = {
	userId: "user-1",
	username: "chris",
	email: "chris@example.com",
};

function linkRequest(url: string = CONTAINER_REQUEST_URL): Request {
	return new Request(url);
}

function routeParams(provider: string) {
	return { params: Promise.resolve({ provider }) };
}

describe("GET /api/auth/link/[provider]", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubEnv("NEXTAUTH_URL", PUBLIC_ORIGIN);
	});

	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("redirects to the public sign-in URL for a valid session and a supported provider", async () => {
		vi.mocked(validateSession).mockResolvedValue(VALID_SESSION);

		const response = await GET(linkRequest(), routeParams("google"));

		const location = response.headers.get("location");
		expect(location).not.toBeNull();
		expect(location?.startsWith(PUBLIC_ORIGIN)).toBe(true);

		const locationUrl = new URL(location as string);
		expect(locationUrl.pathname).toBe("/api/auth/signin/google");
		expect(locationUrl.searchParams.get("callbackUrl")).toBe(
			"/dashboard/settings"
		);
		expect(mockCookieStore.set).toHaveBeenCalledWith(
			LINK_COOKIE_NAME,
			VALID_SESSION.userId,
			expect.objectContaining({ httpOnly: true, maxAge: 300 })
		);
	});

	it("redirects to the public login page when there is no session", async () => {
		vi.mocked(validateSession).mockResolvedValue(null);

		const response = await GET(linkRequest(), routeParams("google"));

		expect(response.headers.get("location")).toBe(
			`${PUBLIC_ORIGIN}/login?error=SessionRequired`
		);
		expect(mockCookieStore.set).not.toHaveBeenCalled();
	});

	it("returns 400 for an unsupported provider", async () => {
		vi.mocked(validateSession).mockResolvedValue(VALID_SESSION);

		const response = await GET(linkRequest(), routeParams("facebook"));

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.error).toBe("Invalid provider: facebook");
	});

	it("throws rather than redirecting to the request host when NEXTAUTH_URL is unset", async () => {
		vi.stubEnv("NEXTAUTH_URL", "");
		vi.mocked(validateSession).mockResolvedValue(null);

		await expect(GET(linkRequest(), routeParams("google"))).rejects.toThrow(
			"NEXTAUTH_URL must be configured for authentication redirects"
		);
	});

	it("redirects to the public origin for github, and lower-cases a mixed-case provider in the path", async () => {
		vi.mocked(validateSession).mockResolvedValue(VALID_SESSION);

		const githubResponse = await GET(linkRequest(), routeParams("github"));
		const githubLocation = githubResponse.headers.get("location");
		expect(githubLocation).toBe(
			`${PUBLIC_ORIGIN}/api/auth/signin/github?callbackUrl=%2Fdashboard%2Fsettings`
		);
		expect(new URL(githubLocation as string).host).not.toBe("container:3000");

		const mixedCaseResponse = await GET(linkRequest(), routeParams("Google"));
		const mixedCaseLocation = mixedCaseResponse.headers.get("location");
		expect(mixedCaseLocation).toBe(
			`${PUBLIC_ORIGIN}/api/auth/signin/google?callbackUrl=%2Fdashboard%2Fsettings`
		);
	});

	it("does not set the link cookie when the provider is invalid", async () => {
		vi.mocked(validateSession).mockResolvedValue(VALID_SESSION);

		const response = await GET(linkRequest(), routeParams("facebook"));

		expect(response.status).toBe(400);
		expect(mockCookieStore.set).not.toHaveBeenCalled();
	});

	it("sets the link cookie with the full expected shape before redirecting", async () => {
		vi.mocked(validateSession).mockResolvedValue(VALID_SESSION);

		const response = await GET(linkRequest(), routeParams("google"));

		expect(mockCookieStore.set).toHaveBeenCalledWith(
			LINK_COOKIE_NAME,
			VALID_SESSION.userId,
			expect.objectContaining({
				httpOnly: true,
				sameSite: "lax",
				maxAge: 300,
				path: "/",
			})
		);
		// Ordering: the mock records the call synchronously before GET returns,
		// and the redirect Location is already the final signIn URL, so the
		// cookie call happened strictly before the redirect was constructed.
		expect(response.headers.get("location")).toContain(
			"/api/auth/signin/google"
		);
	});

	it("throws on the valid-session branch too, after the cookie is already set", async () => {
		// publicBaseUrl() is only evaluated when building signInUrl, which is
		// AFTER the link cookie is already set — so this branch throws having
		// already set the cookie, unlike the no-session case above, which
		// throws before the cookie code is ever reached.
		vi.stubEnv("NEXTAUTH_URL", "");
		vi.mocked(validateSession).mockResolvedValue(VALID_SESSION);

		await expect(GET(linkRequest(), routeParams("google"))).rejects.toThrow(
			"NEXTAUTH_URL must be configured for authentication redirects"
		);
		expect(mockCookieStore.set).toHaveBeenCalledTimes(1);
	});

	it("produces a well-formed single-slash URL when NEXTAUTH_URL has a trailing slash", async () => {
		vi.stubEnv("NEXTAUTH_URL", `${PUBLIC_ORIGIN}/`);
		vi.mocked(validateSession).mockResolvedValue(VALID_SESSION);

		const response = await GET(linkRequest(), routeParams("google"));
		const location = response.headers.get("location") as string;

		expect(location).not.toBeNull();
		expect(location).not.toMatch(DOUBLED_SLASH_REGEX);
		expect(location).toBe(
			`${PUBLIC_ORIGIN}/api/auth/signin/google?callbackUrl=%2Fdashboard%2Fsettings`
		);
	});
});
