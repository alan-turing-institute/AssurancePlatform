import { NextRequest, NextResponse } from "next/server";
import type { NextRequestWithAuth } from "next-auth/middleware";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Exercises the host redirect in the exported default middleware of
 * `proxy.ts`: a page visit on any host other than `NEXTAUTH_URL`'s goes to
 * the same path and query on that host, and nothing else is redirected.
 *
 * `withAuth` is replaced with the same small stand-in
 * `proxy.unauthenticated-api.test.ts` uses (an `authorized` check, then a
 * redirect to the sign-in page or the wrapped middleware), so the tests see
 * `proxy.ts`'s own ordering without next-auth's cookie decryption.
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

const MAIN_ORIGIN = "https://main.example";
const OLD_HOST = "old.example";

interface VisitOptions {
	host?: string | null;
	method?: string;
	signedIn?: boolean;
}

async function visit(requestUrl: string, options: VisitOptions = {}) {
	const { default: middleware } = await import("./proxy");
	const headers: Record<string, string> = {};
	const host = options.host === undefined ? OLD_HOST : options.host;
	if (host !== null) {
		headers.host = host;
	}
	if (options.signedIn) {
		headers["x-test-token"] = JSON.stringify({ id: "user-1" });
	}
	const request = new NextRequest(requestUrl, {
		method: options.method ?? "GET",
		headers,
	});
	return middleware(request as NextRequestWithAuth, {} as never);
}

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("proxy — redirect to the NEXTAUTH_URL host", () => {
	it("redirects a page on another host to the same path and query on the main host", async () => {
		vi.stubEnv("NEXTAUTH_URL", MAIN_ORIGIN);

		const response = await visit(
			`http://${OLD_HOST}/discover/some-case?tab=evidence&page=2`,
			{ signedIn: true }
		);

		expect(response?.status).toBe(308);
		expect(response?.headers.get("location")).toBe(
			`${MAIN_ORIGIN}/discover/some-case?tab=evidence&page=2`
		);
	});

	it("redirects a signed-out visitor to the main host, not to the sign-in page on the old host", async () => {
		vi.stubEnv("NEXTAUTH_URL", MAIN_ORIGIN);

		const response = await visit(`http://${OLD_HOST}/dashboard`);

		expect(response?.status).toBe(308);
		expect(response?.headers.get("location")).toBe(`${MAIN_ORIGIN}/dashboard`);
	});

	it("redirects a HEAD request the same way", async () => {
		vi.stubEnv("NEXTAUTH_URL", MAIN_ORIGIN);

		const response = await visit(`http://${OLD_HOST}/discover`, {
			method: "HEAD",
		});

		expect(response?.status).toBe(308);
		expect(response?.headers.get("location")).toBe(`${MAIN_ORIGIN}/discover`);
	});

	it("keeps a path that starts with two slashes on the main host", async () => {
		vi.stubEnv("NEXTAUTH_URL", MAIN_ORIGIN);

		const response = await visit(`http://${OLD_HOST}//other.example/x`);

		expect(response?.status).toBe(308);
		const location = new URL(response?.headers.get("location") ?? "");
		expect(location.origin).toBe(MAIN_ORIGIN);
		expect(location.pathname).toBe("//other.example/x");
	});

	it("takes the target from NEXTAUTH_URL, not from the Host header", async () => {
		vi.stubEnv("NEXTAUTH_URL", `${MAIN_ORIGIN}/`);

		const response = await visit("http://evil.example/dashboard", {
			host: "evil.example",
		});

		expect(response?.headers.get("location")).toBe(`${MAIN_ORIGIN}/dashboard`);
	});

	it("does not redirect a page on the main host", async () => {
		vi.stubEnv("NEXTAUTH_URL", MAIN_ORIGIN);

		const response = await visit("http://main.example/dashboard", {
			host: "main.example",
			signedIn: true,
		});

		expect(response?.status).toBe(200);
		expect(response?.headers.get("location")).toBeNull();
	});

	it("matches the main host including its port, ignoring case", async () => {
		vi.stubEnv("NEXTAUTH_URL", "http://localhost:3000");

		const response = await visit("http://localhost:3000/dashboard", {
			host: "LocalHost:3000",
			signedIn: true,
		});

		expect(response?.status).toBe(200);
	});

	it("does not redirect to the origin the server itself listens on, which Next.js would turn into a loop", async () => {
		vi.stubEnv("NEXTAUTH_URL", "http://localhost:3000");

		const response = await visit("http://localhost:3000/dashboard", {
			host: "127.0.0.1:3000",
			signedIn: true,
		});

		expect(response?.status).toBe(200);
		expect(response?.headers.get("location")).toBeNull();
	});

	it("leaves /api requests alone on another host", async () => {
		vi.stubEnv("NEXTAUTH_URL", MAIN_ORIGIN);

		const signedIn = await visit(`http://${OLD_HOST}/api/user/plugins`, {
			signedIn: true,
		});
		const signedOut = await visit(`http://${OLD_HOST}/api/user/plugins`);

		expect(signedIn?.status).toBe(200);
		expect(signedOut?.status).toBe(401);
		expect(signedOut?.headers.get("location")).toBeNull();
	});

	it("leaves a non-GET page request alone on another host", async () => {
		vi.stubEnv("NEXTAUTH_URL", MAIN_ORIGIN);

		for (const method of ["POST", "PUT", "DELETE"]) {
			const response = await visit(`http://${OLD_HOST}/dashboard`, {
				method,
				signedIn: true,
			});

			expect(response?.status).toBe(200);
		}
	});

	it("leaves static files and /_next paths alone on another host", async () => {
		vi.stubEnv("NEXTAUTH_URL", MAIN_ORIGIN);

		for (const path of [
			"/_next/static/chunks/app.js",
			"/_next/webpack-hmr",
			"/documentation/sitemap.xml",
			"/robots.txt",
		]) {
			const response = await visit(`http://${OLD_HOST}${path}`, {
				signedIn: true,
			});

			expect(response?.headers.get("location")).toBeNull();
		}
	});

	it("does not redirect when NEXTAUTH_URL is unset", async () => {
		vi.stubEnv("NEXTAUTH_URL", "");

		const response = await visit(`http://${OLD_HOST}/dashboard`, {
			signedIn: true,
		});

		expect(response?.status).toBe(200);
		expect(response?.headers.get("location")).toBeNull();
	});

	it("does not redirect when NEXTAUTH_URL cannot be parsed or is not http(s)", async () => {
		for (const value of ["not a url", "ftp://main.example", "main.example"]) {
			vi.stubEnv("NEXTAUTH_URL", value);

			const response = await visit(`http://${OLD_HOST}/dashboard`, {
				signedIn: true,
			});

			expect(response?.status).toBe(200);
		}
	});

	it("does not redirect a request that carries no Host header", async () => {
		vi.stubEnv("NEXTAUTH_URL", MAIN_ORIGIN);

		const response = await visit(`http://${OLD_HOST}/dashboard`, {
			host: null,
			signedIn: true,
		});

		expect(response?.status).toBe(200);
	});
});
