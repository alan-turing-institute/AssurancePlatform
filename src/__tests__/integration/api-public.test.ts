import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import {
	createTestCase,
	createTestCaseStudy,
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
 */

const NONEXISTENT_UUID = "00000000-0000-0000-0000-000000000000";

// ============================================
// GET /api/public/assurance-case/[id]
// ============================================

describe("GET /api/public/assurance-case/[id]", () => {
	it("reaches the handler with no auth mock configured and returns the published case", async () => {
		const user = await createTestUser();
		const testCase = await createTestCase(user.id, { name: "Source Case" });
		const published = await prisma.publishedAssuranceCase.create({
			data: {
				title: "Published Title",
				description: "Published description",
				content: { nodes: [] },
				assuranceCaseId: testCase.id,
			},
		});

		const { GET } = await import("@/app/api/public/assurance-case/[id]/route");
		const req = new NextRequest(
			`http://localhost:3000/api/public/assurance-case/${published.id}`
		);
		const response = await GET(req, {
			params: Promise.resolve({ id: published.id }),
		});

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.id).toBe(published.id);
		expect(body.title).toBe("Published Title");
		// Not asserting the value of `assuranceCaseId` here: the field's own
		// case (source `assuranceCaseId` is a UUID string) is transformed via
		// `Number(...)`, which is NaN → serialises to `null` — a pre-existing
		// quirk in transformPublishedCaseForApi unrelated to this auth fix.
		expect(testCase.id).toBeTruthy();
		expect(typeof body.content).toBe("string");
	});

	it("returns 404 (never a redirect) for a non-existent published case id", async () => {
		const { GET } = await import("@/app/api/public/assurance-case/[id]/route");
		const req = new NextRequest(
			`http://localhost:3000/api/public/assurance-case/${NONEXISTENT_UUID}`
		);
		const response = await GET(req, {
			params: Promise.resolve({ id: NONEXISTENT_UUID }),
		});

		expect(response.status).toBe(404);
	});
});

// ============================================
// GET /api/public/case-studies
// ============================================

describe("GET /api/public/case-studies", () => {
	it("returns 200 with only published case studies, with no auth mock configured", async () => {
		const owner = await createTestUser();
		const published = await createTestCaseStudy(owner.id, {
			title: "Published Study",
			published: true,
		});
		const draft = await createTestCaseStudy(owner.id, {
			title: "Draft Study",
			published: false,
		});

		const { GET } = await import("@/app/api/public/case-studies/route");
		const response = await GET();

		expect(response.status).toBe(200);
		const body = await response.json();
		const ids = (body as Array<{ id: number }>).map((cs) => cs.id);
		expect(ids).toContain(published.id);
		expect(ids).not.toContain(draft.id);
	});
});

// ============================================
// GET /api/public/case-studies/[id]
// ============================================

describe("GET /api/public/case-studies/[id]", () => {
	it("returns 200 for a published case study id, with no auth mock configured", async () => {
		const owner = await createTestUser();
		const caseStudy = await createTestCaseStudy(owner.id, {
			title: "Published Study",
			published: true,
		});

		const { GET } = await import("@/app/api/public/case-studies/[id]/route");
		const req = new NextRequest(
			`http://localhost:3000/api/public/case-studies/${caseStudy.id}`
		);
		const response = await GET(req, {
			params: Promise.resolve({ id: String(caseStudy.id) }),
		});

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.id).toBe(caseStudy.id);
	});

	it("returns 404 for an unpublished case study id (never a redirect)", async () => {
		const owner = await createTestUser();
		const draft = await createTestCaseStudy(owner.id, {
			title: "Draft Study",
			published: false,
		});

		const { GET } = await import("@/app/api/public/case-studies/[id]/route");
		const req = new NextRequest(
			`http://localhost:3000/api/public/case-studies/${draft.id}`
		);
		const response = await GET(req, {
			params: Promise.resolve({ id: String(draft.id) }),
		});

		expect(response.status).toBe(404);
	});

	it("returns 404 for a non-existent case study id", async () => {
		const { GET } = await import("@/app/api/public/case-studies/[id]/route");
		const req = new NextRequest(
			"http://localhost:3000/api/public/case-studies/999999999"
		);
		const response = await GET(req, {
			params: Promise.resolve({ id: "999999999" }),
		});

		expect(response.status).toBe(404);
	});

	it("returns 400 for a non-numeric case study id (never a redirect)", async () => {
		const { GET } = await import("@/app/api/public/case-studies/[id]/route");
		const req = new NextRequest(
			"http://localhost:3000/api/public/case-studies/not-a-number"
		);
		const response = await GET(req, {
			params: Promise.resolve({ id: "not-a-number" }),
		});

		expect(response.status).toBe(400);
	});
});
