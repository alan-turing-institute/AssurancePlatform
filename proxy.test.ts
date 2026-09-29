import { describe, expect, it } from "vitest";

/**
 * Regression tests for the route matcher in `proxy.ts`.
 *
 * Next.js only runs the exported `withAuth()` middleware (session-auth
 * enforcement) for pathnames that match `config.matcher`. A pathname that
 * does NOT match is skipped entirely — no session check, no redirect —
 * which is how the `api/auth`, `api/cron`, `api/machine`, `api/health` and
 * (as of this fix) `api/public` prefixes are made reachable anonymously.
 *
 * The matcher source string has no `^`/`$` anchors of its own — Next.js
 * compiles it into a fully-anchored routing regex internally. These tests
 * reproduce that by anchoring the pattern with `^...$` before testing it,
 * which was verified against the pre-fix behaviour: with the anchors, the
 * known 2026-07-14 bug (anonymous `GET /api/public/assurance-case/[id]`
 * 307-redirecting to `/login`) reproduces as `matcher.test() === true`
 * (middleware runs, auth is enforced); without the anchors, `.test()`
 * finds a spurious match at an inner "/" and gives false negatives.
 *
 * This file does not spin up Next.js or an HTTP server — it imports the
 * plain `config` object exported from `proxy.ts` and exercises the
 * regex directly, which is why it lives at the repo root next to the file
 * it tests rather than under `src/__tests__/integration/`.
 */

async function getMatcherRegex(): Promise<RegExp> {
	const { config } = await import("./proxy");
	const pattern = config.matcher[0];
	return new RegExp(`^${pattern}$`);
}

describe("middleware route matcher", () => {
	it("exempts every route under api/public from session auth", async () => {
		const re = await getMatcherRegex();
		const publicApiPaths = [
			"/api/public",
			"/api/public/discover/medium-case",
			"/api/public/discover/some-other-slug",
		];
		for (const path of publicApiPaths) {
			expect(re.test(path)).toBe(false);
		}
	});

	it("keeps the pre-existing api/auth, api/cron, api/machine and api/health exemptions intact", async () => {
		const re = await getMatcherRegex();
		const exemptPaths = [
			"/api/auth/session",
			"/api/cron/some-job",
			"/api/machine/health",
			"/api/health",
		];
		for (const path of exemptPaths) {
			expect(re.test(path)).toBe(false);
		}
	});

	it("boundary-anchors api/public — a hypothetical /api/publicfoo stays protected", async () => {
		const re = await getMatcherRegex();
		expect(re.test("/api/publicfoo")).toBe(true);
	});

	it("still enforces session auth on unrelated API and page routes", async () => {
		const re = await getMatcherRegex();
		const protectedPaths = ["/dashboard", "/api/cases/123", "/api/teams"];
		for (const path of protectedPaths) {
			expect(re.test(path)).toBe(true);
		}
	});

	it("no longer exempts /uploads by prefix — the route it used to serve is gone", async () => {
		const re = await getMatcherRegex();
		// `.gif` and `.webp` carry no other exemption, so these prove the
		// dedicated `uploads` prefix is really gone, not just shadowed by
		// something else.
		const uploadPaths = [
			"/uploads",
			"/uploads/cases/123/case-information/abc.gif",
			"/uploads/cases/123/case-information/abc.webp",
		];
		for (const path of uploadPaths) {
			expect(re.test(path)).toBe(true);
		}
	});

	it("a .png under /uploads still matches the pre-existing, unrelated extension exemption — harmless now the route it used to serve is gone (404, not the app)", async () => {
		const re = await getMatcherRegex();
		expect(re.test("/uploads/cases/123/case-information/abc.png")).toBe(false);
	});

	it("exempts the version-scoped public discover image route from session auth", async () => {
		const re = await getMatcherRegex();
		const path =
			"/api/public/discover/medium-case/image/11111111-1111-1111-1111-111111111111";
		expect(re.test(path)).toBe(false);
	});

	it("still enforces session auth on the private case-media routes", async () => {
		const re = await getMatcherRegex();
		const protectedPaths = [
			"/api/cases/123/media/screenshot",
			"/api/cases/123/media/feature",
		];
		for (const path of protectedPaths) {
			expect(re.test(path)).toBe(true);
		}
	});
});
