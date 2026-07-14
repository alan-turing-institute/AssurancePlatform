import { describe, expect, it } from "vitest";

/**
 * Regression tests for the route matcher in `middleware.ts`.
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
 * plain `config` object exported from `middleware.ts` and exercises the
 * regex directly, which is why it lives at the repo root next to the file
 * it tests rather than under `src/__tests__/integration/`.
 */

async function getMatcherRegex(): Promise<RegExp> {
	const { config } = await import("./middleware");
	const pattern = config.matcher[0];
	return new RegExp(`^${pattern}$`);
}

describe("middleware route matcher", () => {
	it("exempts every route under api/public from session auth", async () => {
		const re = await getMatcherRegex();
		const publicApiPaths = [
			"/api/public",
			"/api/public/assurance-case/123",
			"/api/public/case-studies",
			"/api/public/case-studies/456",
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
		const protectedPaths = [
			"/dashboard",
			"/api/cases/123",
			"/api/case-studies",
		];
		for (const path of protectedPaths) {
			expect(re.test(path)).toBe(true);
		}
	});
});
