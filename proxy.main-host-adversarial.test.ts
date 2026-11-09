import { type NextRequest, NextResponse } from "next/server";
import type { NextRequestWithAuth } from "next-auth/middleware";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	LISTENING,
	MAIN,
	MAIN_HOST,
	normalised,
	OLD_HOST,
	outcome,
	PASSES_THROUGH,
	permanentRedirect,
	run,
	type Settled,
	targetOf,
} from "@/src/__tests__/helpers/proxy-requests";

/**
 * Adversarial coverage for the redirect to the main address.
 *
 * `next-auth/middleware`'s `withAuth` is replaced by a stand-in that keeps its
 * contract (ask the `authorized` callback; on refusal redirect to the sign-in
 * page, otherwise run the wrapped function) and takes the visitor's session
 * from a test header. The ordering with the real library is covered in
 * `proxy.main-host-sign-in.test.ts`.
 */

vi.mock("next-auth/middleware", () => ({
	withAuth:
		(
			wrapped: (req: NextRequestWithAuth, event: unknown) => unknown,
			options: {
				callbacks: {
					authorized: (params: {
						req: NextRequest;
						token: { id: string } | null;
					}) => boolean;
				};
				pages: { signIn: string };
			}
		) =>
		(req: NextRequest, event: unknown) => {
			const token = req.headers.has("x-test-signed-in")
				? { id: "user-1" }
				: null;
			if (!options.callbacks.authorized({ req, token })) {
				return NextResponse.redirect(new URL(options.pages.signIn, req.url));
			}
			return wrapped(Object.assign(req, { nextauth: { token } }), event);
		},
}));

beforeEach(() => {
	vi.stubEnv("NEXTAUTH_URL", MAIN);
});

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("a page visit on another host", () => {
	const paths = [
		"/",
		"/dashboard",
		"/cases/abc/edit?tab=evidence&x=1",
		"/login?callbackUrl=%2Fdashboard%2Fcases%2F1",
		"/search?q=a%20b&q=%E2%9C%93&empty=",
		"/with%20space/caf%C3%A9",
		"/a.b/c",
		"/dashboard?next=/image.png",
		"/discover/some-case?utm_source=a&utm_source=b",
	];

	it.each(
		paths
	)("%s goes to the same path and query on the main host", async (path) => {
		const response = await run(path);

		expect(outcome(response)).toEqual(
			permanentRedirect(`${MAIN}${normalised(path)}`)
		);
	});

	it("keeps a very long query intact", async () => {
		const path = `/long?${"k=value&".repeat(1000)}`;

		const response = await run(path);

		expect(outcome(response)).toEqual(
			permanentRedirect(`${MAIN}${normalised(path)}`)
		);
	});

	it("is redirected for a HEAD request too", async () => {
		const response = await run("/dashboard?x=1", { method: "HEAD" });

		expect(outcome(response)).toEqual(
			permanentRedirect(`${MAIN}/dashboard?x=1`)
		);
	});

	it("is redirected before the sign-in check for a signed-out visitor", async () => {
		const response = await run("/dashboard?x=1", { signedIn: false });

		expect(outcome(response)).toEqual(
			permanentRedirect(`${MAIN}/dashboard?x=1`)
		);
	});

	it("takes the sign-in page itself to the main host's sign-in page", async () => {
		const response = await run("/login?callbackUrl=%2Fdashboard", {
			signedIn: false,
		});

		expect(outcome(response)).toEqual(
			permanentRedirect(`${MAIN}/login?callbackUrl=%2Fdashboard`)
		);
	});

	it("reaches the main host's sign-in page for a signed-out visitor after following the redirect", async () => {
		const first = await run("/dashboard?x=1", { signedIn: false });
		const target = targetOf(first);

		const second = await run(`${target.pathname}${target.search}`, {
			host: target.host,
			signedIn: false,
		});

		const signIn = targetOf(second);
		expect(second?.status).toBe(307);
		expect(signIn.pathname).toBe("/login");
	});
});

describe("the redirect response", () => {
	function cacheDirectives(response: Settled): string[] {
		const header = response?.headers.get("cache-control") ?? "";
		return header.split(",").map((directive) => directive.trim().toLowerCase());
	}

	it.each([
		"GET",
		"HEAD",
	])("to a %s request says it must not be stored, so putting the main address back is not undone by a browser's copy", async (method) => {
		const response = await run("/dashboard?x=1", { method });

		expect(cacheDirectives(response)).toContain("no-store");
	});

	it("says so for a signed-out visitor too", async () => {
		const response = await run("/dashboard?x=1", { signedIn: false });

		expect(cacheDirectives(response)).toContain("no-store");
	});
});

describe("what is never redirected", () => {
	const methods = ["POST", "PUT", "PATCH", "DELETE", "OPTIONS"];

	it.each(methods)("a %s request for a page", async (method) => {
		const response = await run("/dashboard", { method });

		expect(outcome(response)).toEqual(PASSES_THROUGH);
	});

	const apiPaths = [
		"/api/cases/1",
		"/api/cases/1/elements?x=1",
		"/api/machine/whoami",
		"/api/health",
		"/api/cron/retention-sweep",
		"/api/public/discover/some-case",
		"/api/auth/session",
	];

	it.each(apiPaths)("a GET request for %s", async (path) => {
		const response = await run(path);

		expect(outcome(response)).toEqual(PASSES_THROUGH);
	});

	it("a HEAD request for an API path", async () => {
		const response = await run("/api/health", { method: "HEAD" });

		expect(outcome(response)).toEqual(PASSES_THROUGH);
	});

	it("an unauthenticated API call, which still gets its JSON refusal", async () => {
		const response = await run("/api/cases/1", { signedIn: false });

		expect(response?.status).toBe(401);
		expect(await response?.json()).toEqual({
			error: "Unauthorised",
			code: "UNAUTHORISED",
		});
	});

	const internalPaths = [
		"/_next/static/chunks/main.js",
		"/_next/image?url=%2Fa.png&w=64&q=75",
		"/_next/webpack-hmr",
	];

	it.each(internalPaths)("a GET request for %s", async (path) => {
		const response = await run(path);

		expect(outcome(response)).toEqual(PASSES_THROUGH);
	});

	const files = [
		"/robots.txt",
		"/sitemap.xml",
		"/favicon.ico",
		"/manifest.webmanifest",
		"/images/logo.png",
		"/LOGO.PNG",
		"/documentation/guide.pdf",
		"/robots.txt?next=%2Fdashboard",
	];

	it.each(files)("a GET request for the file %s", async (path) => {
		const response = await run(path);

		expect(outcome(response)).toEqual(PASSES_THROUGH);
	});
});

describe("a page visit on the main host", () => {
	const hosts = [MAIN_HOST, MAIN_HOST.toUpperCase(), `  ${MAIN_HOST}  `];

	it.each(
		hosts
	)("is not redirected when the Host header is %j", async (host) => {
		const response = await run("/dashboard?x=1", { host });

		expect(outcome(response)).toEqual(PASSES_THROUGH);
	});

	it("is not redirected when there is no Host header", async () => {
		const response = await run("/dashboard", { host: null });

		expect(outcome(response)).toEqual(PASSES_THROUGH);
	});

	it("still sends a signed-out visitor to the sign-in page", async () => {
		const response = await run("/dashboard?x=1", {
			host: MAIN_HOST,
			signedIn: false,
		});

		const signIn = targetOf(response);
		expect(response?.status).toBe(307);
		expect(signIn.pathname).toBe("/login");
	});

	it("lets a signed-out visitor see a public page", async () => {
		const response = await run("/discover", {
			host: MAIN_HOST,
			signedIn: false,
		});

		expect(outcome(response)).toEqual(PASSES_THROUGH);
	});
});

describe("hosts that are not the main host", () => {
	const lookalikes = [
		`evil-${MAIN_HOST}`,
		`x${MAIN_HOST}`,
		`${MAIN_HOST}.evil.test`,
		`sub.${MAIN_HOST}`,
		"example.test",
		"127.0.0.1",
		"[::1]",
		"localhost:8080",
	];

	it.each(lookalikes)("%s is sent to the main host", async (host) => {
		const response = await run("/dashboard", { host });

		expect(outcome(response)).toEqual(permanentRedirect(`${MAIN}/dashboard`));
	});

	const variants = [
		OLD_HOST,
		OLD_HOST.toUpperCase(),
		`${MAIN_HOST}.`,
		`${MAIN_HOST}:443`,
		`${MAIN_HOST}:8443`,
		`${MAIN_HOST}:80`,
		`evil-${MAIN_HOST}`,
		`${MAIN_HOST}.evil.test`,
		"127.0.0.1:8080",
		`user@${MAIN_HOST}`,
		`${MAIN_HOST}/elsewhere`,
		`${MAIN_HOST}:not-a-port`,
	];

	it.each(
		variants
	)("a redirect from %s ends on the main host and does not loop", async (host) => {
		const first = await run("/dashboard?x=1", { host });
		const target = targetOf(first);

		const again = await run(`${target.pathname}${target.search}`, {
			host: target.host,
		});

		expect(target.origin).toBe(MAIN);
		expect(outcome(again)).toEqual(PASSES_THROUGH);
	});

	it("does not take the redirect target from forwarding headers", async () => {
		const response = await run("/dashboard", {
			headers: {
				"x-forwarded-host": "evil.example.test",
				"x-forwarded-proto": "http",
				forwarded: "host=evil.example.test;proto=http",
				"x-original-url": "http://evil.example.test/other",
				"x-rewrite-url": "/other",
				"x-middleware-rewrite": "http://evil.example.test/other",
			},
		});

		expect(outcome(response)).toEqual(permanentRedirect(`${MAIN}/dashboard`));
	});

	it("does not redirect a visitor on the main host whatever the forwarding headers say", async () => {
		const response = await run("/dashboard", {
			host: MAIN_HOST,
			headers: { "x-forwarded-host": "evil.example.test" },
		});

		expect(outcome(response)).toEqual(PASSES_THROUGH);
	});
});

describe("the redirect target is built from the main address only", () => {
	const hostile = [
		"//evil.example.test/x",
		"///evil.example.test/",
		"/\\evil.example.test/x",
		"/%5Cevil.example.test/x",
		"/%2F%2Fevil.example.test/x",
		"/%2f/evil.example.test/x",
		"/@evil.example.test/x",
		"/.evil.example.test/x",
		"/https://evil.example.test/",
		"/..//evil.example.test/x",
		"/%2e%2e/%2e%2e/evil",
		"/a/b/../../evil",
		"/?next=//evil.example.test",
		"/?u=https%3A%2F%2Fevil.example.test",
		"/x?a=https://evil.example.test@main",
		"/x;jsessionid=1?y=2",
		"/\t//evil.example.test/x",
	];

	it.each(hostile)("%j stays a path on the main host", async (path) => {
		const response = await run(path);

		const target = targetOf(response);
		expect(target.origin).toBe(MAIN);
		expect(target.username).toBe("");
		expect(outcome(response)).toEqual(
			permanentRedirect(`${MAIN}${normalised(path)}`)
		);
	});
});

describe("how the main address is read", () => {
	const variants: [string, string, string][] = [
		["a trailing slash", `${MAIN}/`, MAIN],
		["a path", `${MAIN}/some/path`, MAIN],
		["a query and a fragment", `${MAIN}?x=1#y`, MAIN],
		["credentials", "https://user:secret@main.example.test", MAIN],
		["an upper-case name", "https://MAIN.EXAMPLE.TEST", MAIN],
		["the default port written out", "https://main.example.test:443", MAIN],
		[
			"another port",
			"http://main.example.test:8080",
			"http://main.example.test:8080",
		],
	];

	it.each(
		variants
	)("with %s the target is the origin alone", async (_label, configured, origin) => {
		vi.stubEnv("NEXTAUTH_URL", configured);

		const response = await run("/page?x=1");

		expect(outcome(response)).toEqual(permanentRedirect(`${origin}/page?x=1`));
	});

	it.each(
		variants
	)("with %s a visit on that host is not redirected", async (_label, configured, origin) => {
		vi.stubEnv("NEXTAUTH_URL", configured);

		const response = await run("/page?x=1", { host: new URL(origin).host });

		expect(outcome(response)).toEqual(PASSES_THROUGH);
	});
});

describe("when the main address is the one the server listens on", () => {
	it("a visit on another host is not redirected, so the framework cannot turn it into a loop", async () => {
		vi.stubEnv("NEXTAUTH_URL", LISTENING);

		const response = await run("/dashboard?x=1", { host: "127.0.0.1:8080" });

		expect(outcome(response)).toEqual(PASSES_THROUGH);
	});
});

describe("when the main address is unusable nothing is redirected", () => {
	const unusable: (string | undefined)[] = [
		undefined,
		"",
		"   ",
		"main.example.test",
		"localhost:3000",
		"ftp://main.example.test",
		"file:///etc/hosts",
		"data:text/plain,hi",
		"//main.example.test",
	];

	it.each(unusable)("NEXTAUTH_URL = %j", async (configured) => {
		vi.stubEnv("NEXTAUTH_URL", configured);

		const response = await run("/dashboard?x=1");

		expect(outcome(response)).toEqual(PASSES_THROUGH);
	});
});
