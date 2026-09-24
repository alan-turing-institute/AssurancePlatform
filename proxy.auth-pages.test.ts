import { NextRequest, NextResponse } from "next/server";
import type { NextRequestWithAuth } from "next-auth/middleware";
import { describe, expect, it, vi } from "vitest";

/**
 * Exercises the exported default middleware directly — same technique as
 * `proxy.unauthenticated-api.test.ts` (see that file's header for why
 * `next-auth/middleware` is stubbed rather than driven with a real cookie).
 *
 * Regression coverage for AP-QA-003: `proxy.ts` used to redirect any request
 * carrying a token away from `/login` and `/register`, decided purely off
 * `token?.id != null` from `getToken` — which never runs `callbacks.jwt`, so
 * it cannot tell a live token from one revoked by a password change or
 * reset. A revoked cookie on `/login` looped: the page saw no session and
 * redirected here, and this redirected straight back. That branch is now
 * gone — the pages themselves (`app/(auth)/login/page.tsx`,
 * `app/(auth)/register/page.tsx`) redirect a signed-in user via the
 * database-checked `validateSession()` instead.
 */

type Token = { id?: string } | null;

vi.mock("next-auth/middleware", () => ({
	withAuth: (
		middleware: (req: NextRequestWithAuth, event: unknown) => unknown,
		options: {
			callbacks: {
				authorized: (params: {
					token: Token;
					req: NextRequest;
				}) => boolean | Promise<boolean>;
			};
			pages: { signIn: string };
		}
	) => {
		return async (req: NextRequest, event: unknown) => {
			const tokenHeader = req.headers.get("x-test-token");
			const token: Token = tokenHeader ? JSON.parse(tokenHeader) : null;
			const isAuthorized = await options.callbacks.authorized({ token, req });
			if (isAuthorized) {
				const requestWithAuth: NextRequestWithAuth = Object.assign(req, {
					nextauth: { token },
				});
				return middleware(requestWithAuth, event);
			}
			return NextResponse.redirect(new URL(options.pages.signIn, req.url));
		};
	},
}));

async function callMiddleware(pathname: string, token?: { id: string }) {
	const { default: middleware } = await import("./proxy");
	const request = new NextRequest(new URL(pathname, "http://localhost:3000"), {
		headers: token ? { "x-test-token": JSON.stringify(token) } : undefined,
	});
	return middleware(request as NextRequestWithAuth, {} as never);
}

describe("middleware — auth pages carrying a token", () => {
	it("passes a /login request carrying a token through, not redirected", async () => {
		const response = await callMiddleware("/login", { id: "user-1" });

		expect(response?.status).toBe(200);
		expect(response?.headers.get("location")).toBeNull();
	});

	it("passes a /register request carrying a token through, not redirected", async () => {
		const response = await callMiddleware("/register", { id: "user-1" });

		expect(response?.status).toBe(200);
		expect(response?.headers.get("location")).toBeNull();
	});
});
