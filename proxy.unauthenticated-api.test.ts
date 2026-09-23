import { NextRequest, NextResponse } from "next/server";
import type { NextRequestWithAuth } from "next-auth/middleware";
import { describe, expect, it, vi } from "vitest";
import { apiError } from "@/lib/api-response";
import { unauthorised } from "@/lib/errors";

/**
 * Exercises the exported default middleware directly — `withAuth(...)` from
 * `proxy.ts` — rather than the matcher regex covered in
 * `proxy.test.ts`.
 *
 * `next-auth/middleware`'s `withAuth` is replaced with a small stand-in that
 * mirrors its real authorized/redirect contract (call the `authorized`
 * callback; on `true` attach `req.nextauth.token` and run the wrapped
 * middleware; on `false` redirect to `pages.signIn`), reading the token to
 * use straight off a test-only `x-test-token` request header. This keeps the
 * test focused on `proxy.ts`'s own logic — the new JSON-401 branch and
 * the `authorized` callback's API pass-through — without depending on
 * `next-auth/jwt`'s real cookie decryption (which needs a genuine session
 * cookie and, under Vitest's jsdom environment, hits an unrelated
 * cross-realm `Uint8Array` failure in `jose`).
 *
 * Regression coverage for: unauthenticated `/api/*` requests used to get
 * next-auth's default 307 redirect to `/login` (an HTML flow) instead of the
 * JSON 401 the route handlers' own `requireAuth()` produces.
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
	// `middleware`'s real type (from `next-auth/middleware`) requires a
	// `NextRequestWithAuth` — the mocked `withAuth` above is what actually
	// attaches `.nextauth` at runtime, so this cast just tells TypeScript
	// what the mock guarantees. The event parameter is unused by both the
	// wrapped middleware function and the `authorized` callback.
	return middleware(request as NextRequestWithAuth, {} as never);
}

describe("middleware — unauthenticated API requests", () => {
	it("returns a JSON 401 in the standard error shape, not a redirect", async () => {
		const response = await callMiddleware("/api/user/plugins");

		expect(response?.status).toBe(401);
		expect(response?.headers.get("location")).toBeNull();
		await expect(response?.json()).resolves.toEqual({
			error: "Unauthorised",
			code: "UNAUTHORISED",
		});
	});

	it("matches the body and status apiError(unauthorised()) produces — the pair proxy.ts's inline literal must not drift from", async () => {
		// proxy.ts avoids importing lib/api-response.ts (it drags in
		// lib/errors.ts -> lib/db-pool-config.ts -> lib/logger.ts) because the
		// proxy runs on every matched request, not because the proxy runtime
		// can't bundle it — Next 16's `proxy` runtime is always `nodejs`. Its
		// 401 body is a hand-written literal, and this test imports both sides
		// and keeps them in sync by assertion instead.
		const response = await callMiddleware("/api/user/plugins");
		const expected = apiError(unauthorised());

		expect(response?.status).toBe(expected.status);
		await expect(response?.json()).resolves.toEqual(await expected.json());
	});

	it("still 307-redirects an unauthenticated page request to /login", async () => {
		const response = await callMiddleware("/dashboard");

		expect(response?.status).toBe(307);
		expect(response?.headers.get("location")).toContain("/login");
	});

	it("passes an authenticated API request through unchanged", async () => {
		const response = await callMiddleware("/api/user/plugins", {
			id: "user-1",
		});

		// NextResponse.next() carries no body and a 200 status by construction.
		expect(response?.status).toBe(200);
		await expect(response?.text()).resolves.toBe("");
	});
});
