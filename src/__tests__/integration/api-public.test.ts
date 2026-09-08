import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { publishAssuranceCase } from "@/lib/services/publish-service";
import {
	createTestCaseWithGoal,
	createTestUser,
} from "../utils/prisma-factories";

/**
 * Regression tests for the `app/api/public/**` routes — see the
 * "TEA — Public assurance-case API is behind the login wall" issue.
 *
 * Scope note: these tests call the route handlers directly, which is this
 * suite's established pattern (see `api-cases.test.ts` etc.) and bypasses
 * Next.js middleware entirely — there is no harness here that runs an
 * incoming request through actual middleware + a route handler together.
 * They confirm the HANDLER side of the fix: no auth mock is configured
 * anywhere in this file, and every route still returns a normal 200/404
 * JSON response — never a redirect, because these handlers never call
 * `requireAuth()`/`requireAuthSession()` in the first place. The other
 * half of the fix — that Next.js's own middleware no longer intercepts
 * `/api/public/*` before the handler ever runs — is covered by the
 * matcher-regex tests in `middleware.test.ts` at the repo root.
 *
 * The numeric-id `/api/public/assurance-case/[id]` and legacy
 * `/api/public/case-studies*` routes this file used to cover were retired
 * with the case-study system (ADR 0003 §6/§7) — superseded by
 * `/api/public/discover/[slug]` below.
 */

// ============================================
// GET /api/public/discover/[slug]
// ============================================

describe("GET /api/public/discover/[slug]", () => {
	it("reaches the handler with no auth mock configured and returns the published item's snapshot by slug", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCaseWithGoal(
			owner.id,
			"Discover Slug Case"
		);
		const published = await publishAssuranceCase(owner.id, testCase.id);
		if ("error" in published) {
			throw new Error(published.error);
		}

		const { GET } = await import("@/app/api/public/discover/[slug]/route");
		const req = new NextRequest(
			"http://localhost:3000/api/public/discover/discover-slug-case"
		);
		const response = await GET(req, {
			params: Promise.resolve({ slug: "discover-slug-case" }),
		});

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.slug).toBe("discover-slug-case");
		expect(body.title).toBe("Discover Slug Case");
		expect(body.type).toBe("ASSURANCE_CASE");
		expect(body.content).toBeDefined();
	});

	it("returns 404 (never a redirect) for an unknown slug", async () => {
		const { GET } = await import("@/app/api/public/discover/[slug]/route");
		const req = new NextRequest(
			"http://localhost:3000/api/public/discover/no-such-slug"
		);
		const response = await GET(req, {
			params: Promise.resolve({ slug: "no-such-slug" }),
		});

		expect(response.status).toBe(404);
	});

	it("returns 404 (never a redirect) for a legacy numeric id — the retired /discover/[id] path", async () => {
		const { GET } = await import("@/app/api/public/discover/[slug]/route");
		const req = new NextRequest(
			"http://localhost:3000/api/public/discover/123"
		);
		const response = await GET(req, {
			params: Promise.resolve({ slug: "123" }),
		});

		expect(response.status).toBe(404);
	});

	it("returns 400 for an invalid slug shape", async () => {
		const { GET } = await import("@/app/api/public/discover/[slug]/route");
		const req = new NextRequest(
			"http://localhost:3000/api/public/discover/Not%20A%20Slug!"
		);
		const response = await GET(req, {
			params: Promise.resolve({ slug: "Not A Slug!" }),
		});

		expect(response.status).toBe(400);
	});
});
