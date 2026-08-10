import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	addTeamMember,
	createTestCase,
	createTestElement,
	createTestPermission,
	createTestTeam,
	createTestTeamPermission,
	createTestUser,
} from "../utils/prisma-factories";

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

const NONEXISTENT_ID = "00000000-0000-0000-0000-000000000000";

beforeEach(async () => {
	await mockNoAuth();
});

function putRequest(elementId: string, body: unknown): NextRequest {
	return new NextRequest(`http://localhost:3000/api/elements/${elementId}`, {
		method: "PUT",
		body: JSON.stringify(body),
		headers: { "Content-Type": "application/json" },
	});
}

function getRequest(elementId: string): NextRequest {
	return new NextRequest(`http://localhost:3000/api/elements/${elementId}`);
}

function importRoute() {
	return import("@/app/api/elements/[id]/route");
}

// ============================================
// PUT /api/elements/[id] — urls forwarding
//
// Regression coverage for the silent no-op: the evidence edit dialog sends
// a validated `urls` array, but `buildUpdateInput` in the route dropped it
// before it ever reached `updateElement`, so edits appeared to succeed while
// the stored URLs never changed.
//
// The schema currently in effect on `staging` normalises entries via
// `lenientUrlSchema` (PR #873, merged) — a scheme-less value such as
// "example.com" is prepended with "https://" rather than rejected. Genuinely
// malformed input (no web scheme, e.g. "mailto:x@y.z") is still rejected;
// see lib/schemas/__tests__/element-url.test.ts for the schema's own
// coverage of the normalisation/rejection boundary.
// ============================================

describe("PUT /api/elements/[id] — urls forwarding", () => {
	it("stores a changed urls array (regression: urls must not be dropped)", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const evidence = await createTestElement(testCase.id, owner.id, {
			elementType: "EVIDENCE",
			url: "https://example.com/original",
		});
		await mockAuth(owner.id, owner.username, owner.email);

		const { PUT } = await importRoute();
		const response = await PUT(
			putRequest(evidence.id, {
				description: evidence.description,
				urls: [
					"https://example.com/updated-one",
					"https://example.com/updated-two",
				],
			}),
			{ params: Promise.resolve({ id: evidence.id }) }
		);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.urls).toEqual([
			"https://example.com/updated-one",
			"https://example.com/updated-two",
		]);
		// Legacy single-URL field stays in sync with urls[0]
		expect(body.URL).toBe("https://example.com/updated-one");

		const { GET } = await importRoute();
		const refetched = await GET(getRequest(evidence.id), {
			params: Promise.resolve({ id: evidence.id }),
		});
		const refetchedBody = await refetched.json();
		expect(refetchedBody.urls).toEqual([
			"https://example.com/updated-one",
			"https://example.com/updated-two",
		]);
	});

	it("clears urls when sent an empty array", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const evidence = await createTestElement(testCase.id, owner.id, {
			elementType: "EVIDENCE",
			url: "https://example.com/original",
		});
		await mockAuth(owner.id, owner.username, owner.email);

		const { PUT } = await importRoute();
		const response = await PUT(
			putRequest(evidence.id, {
				description: evidence.description,
				urls: [],
			}),
			{ params: Promise.resolve({ id: evidence.id }) }
		);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.urls).toBeUndefined();
		expect(body.URL).toBeUndefined();
	});

	it("urls wins unconditionally over url/URL when all three are present in one body", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const evidence = await createTestElement(testCase.id, owner.id, {
			elementType: "EVIDENCE",
			url: "https://example.com/original",
		});
		await mockAuth(owner.id, owner.username, owner.email);

		const { PUT } = await importRoute();
		const response = await PUT(
			putRequest(evidence.id, {
				description: evidence.description,
				urls: ["https://example.com/urls-wins"],
				url: "https://example.com/url-loses",
				URL: "https://example.com/URL-loses",
			}),
			{ params: Promise.resolve({ id: evidence.id }) }
		);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.urls).toEqual(["https://example.com/urls-wins"]);
		expect(body.URL).toBe("https://example.com/urls-wins");

		const { GET } = await importRoute();
		const refetched = await GET(getRequest(evidence.id), {
			params: Promise.resolve({ id: evidence.id }),
		});
		const refetchedBody = await refetched.json();
		expect(refetchedBody.urls).toEqual(["https://example.com/urls-wins"]);
	});

	it("an explicit empty urls array still wins over a present url/URL, clearing rather than falling back", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const evidence = await createTestElement(testCase.id, owner.id, {
			elementType: "EVIDENCE",
			url: "https://example.com/original",
		});
		await mockAuth(owner.id, owner.username, owner.email);

		const { PUT } = await importRoute();
		const response = await PUT(
			putRequest(evidence.id, {
				description: evidence.description,
				urls: [],
				url: "https://example.com/url-loses",
				URL: "https://example.com/URL-loses",
			}),
			{ params: Promise.resolve({ id: evidence.id }) }
		);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.urls).toBeUndefined();
		expect(body.URL).toBeUndefined();
	});

	it("leaves stored urls untouched when the field is omitted from the request", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const evidence = await createTestElement(testCase.id, owner.id, {
			elementType: "EVIDENCE",
			url: "https://example.com/untouched",
		});
		await mockAuth(owner.id, owner.username, owner.email);

		const { PUT } = await importRoute();
		const response = await PUT(
			putRequest(evidence.id, { description: "Updated description only" }),
			{ params: Promise.resolve({ id: evidence.id }) }
		);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.description).toBe("Updated description only");
		expect(body.URL).toBe("https://example.com/untouched");
	});

	it("returns 400 for a non-web scheme that lenientUrlSchema rejects rather than mangles", async () => {
		// "not-a-url" is no longer a valid regression fixture here: since
		// PR #873, a scheme-less entry is normalised to "https://not-a-url"
		// (a syntactically valid, if useless, URL) rather than rejected.
		// "mailto:x@y.z" carries an explicit non-http(s) scheme, which
		// lenientUrlSchema still rejects outright instead of prepending
		// "https://" onto it.
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const evidence = await createTestElement(testCase.id, owner.id, {
			elementType: "EVIDENCE",
		});
		await mockAuth(owner.id, owner.username, owner.email);

		const { PUT } = await importRoute();
		const response = await PUT(
			putRequest(evidence.id, { urls: ["mailto:x@y.z"] }),
			{ params: Promise.resolve({ id: evidence.id }) }
		);

		expect(response.status).toBe(400);
	});

	it("returns 404 when a VIEW-only permission holder attempts the update (anti-enumeration: same error as not-found)", async () => {
		const owner = await createTestUser();
		const viewer = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const evidence = await createTestElement(testCase.id, owner.id, {
			elementType: "EVIDENCE",
			url: "https://example.com/protected",
		});
		await createTestPermission(testCase.id, viewer.id, owner.id, "VIEW");
		await mockAuth(viewer.id, viewer.username, viewer.email);

		const { PUT } = await importRoute();
		const response = await PUT(
			putRequest(evidence.id, { urls: ["https://example.com/hijacked"] }),
			{ params: Promise.resolve({ id: evidence.id }) }
		);

		expect(response.status).toBe(404);
	});
});

// ============================================
// PUT /api/elements/[id] — anti-enumeration hardening
//
// nanaki's G3 review of PR #885: the VIEW-only-permission 404 and a
// genuine not-found 404 both currently return the literal string
// "Element not found" (element-service.ts:847 for the not-found branch,
// :857 for the no-permission branch) — but that's two separate string
// literals that happen to match today. A future edit to either message
// alone would keep both responses at 404 while making their bodies
// diverge, handing an attacker an enumeration oracle even though the
// status code still looks identical. Asserting body equality (not just
// status) is what would catch that drift.
// ============================================

describe("PUT /api/elements/[id] — anti-enumeration hardening", () => {
	it("returns a byte-identical body for a VIEW-only-permission 404 and a genuinely-not-found 404", async () => {
		const owner = await createTestUser();
		const viewer = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const evidence = await createTestElement(testCase.id, owner.id, {
			elementType: "EVIDENCE",
			url: "https://example.com/protected",
		});
		await createTestPermission(testCase.id, viewer.id, owner.id, "VIEW");
		await mockAuth(viewer.id, viewer.username, viewer.email);

		const { PUT } = await importRoute();
		const viewOnlyResponse = await PUT(
			putRequest(evidence.id, { urls: ["https://example.com/hijacked"] }),
			{ params: Promise.resolve({ id: evidence.id }) }
		);
		const nonexistentResponse = await PUT(
			putRequest(NONEXISTENT_ID, { urls: ["https://example.com/hijacked"] }),
			{ params: Promise.resolve({ id: NONEXISTENT_ID }) }
		);

		expect(viewOnlyResponse.status).toBe(404);
		expect(viewOnlyResponse.status).toBe(nonexistentResponse.status);
		const viewOnlyBody = await viewOnlyResponse.json();
		const nonexistentBody = await nonexistentResponse.json();
		expect(viewOnlyBody).toEqual(nonexistentBody);
	});
});

// ============================================
// PUT /api/elements/[id] — permission matrix backfill
//
// nanaki's G3 review of PR #885: the existing coverage in this file only
// exercised owner (implicit ADMIN) and VIEW-via-direct-share. Backfilling
// the remaining cases from the repo's secured-endpoint convention
// (CLAUDE.md "Testing") that were genuinely missing across all four
// api-elements*.test.ts files for THIS route: COMMENT-level via direct
// share, EDIT via a team grant, unauthenticated, and a genuinely
// nonexistent element id.
// ============================================

describe("PUT /api/elements/[id] — permission matrix backfill", () => {
	it("returns 404 for a COMMENT-level permission holder (COMMENT < EDIT, same anti-enumeration error as not-found)", async () => {
		const owner = await createTestUser();
		const commenter = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const evidence = await createTestElement(testCase.id, owner.id, {
			elementType: "EVIDENCE",
			url: "https://example.com/protected",
		});
		await createTestPermission(testCase.id, commenter.id, owner.id, "COMMENT");
		await mockAuth(commenter.id, commenter.username, commenter.email);

		const { PUT } = await importRoute();
		const response = await PUT(
			putRequest(evidence.id, { urls: ["https://example.com/hijacked"] }),
			{ params: Promise.resolve({ id: evidence.id }) }
		);

		expect(response.status).toBe(404);
		const body = await response.json();
		expect(body.error).toBe("Element not found");
	});

	it("succeeds for a user with EDIT access via a team grant (not a direct share)", async () => {
		const owner = await createTestUser();
		const teamMember = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const evidence = await createTestElement(testCase.id, owner.id, {
			elementType: "EVIDENCE",
			url: "https://example.com/original",
		});
		const team = await createTestTeam(owner.id);
		await addTeamMember(team.id, teamMember.id);
		await createTestTeamPermission(testCase.id, team.id, owner.id, "EDIT");
		await mockAuth(teamMember.id, teamMember.username, teamMember.email);

		const { PUT } = await importRoute();
		const response = await PUT(
			putRequest(evidence.id, {
				description: evidence.description,
				urls: ["https://example.com/via-team-grant"],
			}),
			{ params: Promise.resolve({ id: evidence.id }) }
		);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.urls).toEqual(["https://example.com/via-team-grant"]);
	});

	it("returns 401 with no session", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const evidence = await createTestElement(testCase.id, owner.id, {
			elementType: "EVIDENCE",
		});

		const { PUT } = await importRoute();
		const response = await PUT(
			putRequest(evidence.id, {
				description: "Attempted unauthenticated edit",
			}),
			{ params: Promise.resolve({ id: evidence.id }) }
		);

		expect(response.status).toBe(401);
	});

	it("returns 404 for a genuinely nonexistent element id", async () => {
		const owner = await createTestUser();
		await mockAuth(owner.id, owner.username, owner.email);

		const { PUT } = await importRoute();
		const response = await PUT(
			putRequest(NONEXISTENT_ID, { description: "Does not matter" }),
			{ params: Promise.resolve({ id: NONEXISTENT_ID }) }
		);

		expect(response.status).toBe(404);
		const body = await response.json();
		expect(body.error).toBe("Element not found");
	});
});
