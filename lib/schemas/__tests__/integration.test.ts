import { afterEach, describe, expect, it, vi } from "vitest";
import { SCOPES } from "@/lib/auth/scopes";
import { issuesOf } from "@/src/__tests__/utils/schema-issues-kit";
import {
	grantCaseAccessSchema,
	integrationScopesSchema,
	issueTokenSchema,
	registerIntegrationSchema,
	updateIntegrationSchema,
} from "../integration";

/**
 * Pins the zod caps that gate `POST /api/integrations` and
 * `PATCH /api/integrations/[id]` — `lib/schemas/base.ts`'s
 * `requiredString`/`optionalString` factories take the max length as a
 * plain argument, so these boundaries are only as good as the numbers the
 * schema passes them; a future edit that silently changes 100 to 1000 (or
 * vice versa) should break a test, not slip through unnoticed (nanaki
 * info finding, work item 11).
 */
describe("registerIntegrationSchema — boundary caps", () => {
	it("accepts a name at exactly 100 characters", () => {
		const result = registerIntegrationSchema.safeParse({
			name: "a".repeat(100),
			scopes: ["case:read"],
		});
		expect(result.success).toBe(true);
	});

	it("rejects a name at 101 characters", () => {
		const result = registerIntegrationSchema.safeParse({
			name: "a".repeat(101),
			scopes: ["case:read"],
		});
		expect(result.success).toBe(false);
	});

	it("accepts a description at exactly 1000 characters", () => {
		const result = registerIntegrationSchema.safeParse({
			name: "boundary-description",
			description: "a".repeat(1000),
			scopes: ["case:read"],
		});
		expect(result.success).toBe(true);
	});

	it("rejects a description at 1001 characters", () => {
		const result = registerIntegrationSchema.safeParse({
			name: "boundary-description",
			description: "a".repeat(1001),
			scopes: ["case:read"],
		});
		expect(result.success).toBe(false);
	});
});

describe("updateIntegrationSchema — description is capped at 1000 characters", () => {
	it("accepts a description at exactly 1000 characters", () => {
		const result = updateIntegrationSchema.safeParse({
			description: "a".repeat(1000),
		});
		expect(result.success).toBe(true);
	});

	it("rejects a description at 1001 characters", () => {
		const result = updateIntegrationSchema.safeParse({
			description: "a".repeat(1001),
		});
		expect(result.success).toBe(false);
	});
});

/**
 * `MAX_SCOPES` is 20, but the CLOSED scope vocabulary (`SCOPES`,
 * `lib/auth/scopes.ts`) currently has only 3 members — there is no way to
 * construct a 21-item array of 21 DISTINCT valid scopes to pin the true
 * "one over the cap" boundary with unique values. Padding the array with
 * repeated valid scope values is the only way to reach the length that
 * matters. `integrationScopesSchema` has no separate uniqueness rule, so
 * this pins the CURRENT behaviour (duplicates count towards the cap and
 * are otherwise allowed) rather than testing the cap in total isolation —
 * noted per work item 11's instruction for when the catalogue is smaller
 * than the cap.
 */
describe("integrationScopesSchema — MAX_SCOPES=20 cap (padded with duplicates)", () => {
	it("accepts exactly 20 scopes, even with repeats (catalogue has only 3 distinct values)", () => {
		const scopes = Array.from(
			{ length: 20 },
			(_, i) => SCOPES[i % SCOPES.length]
		);
		const result = integrationScopesSchema.safeParse(scopes);
		expect(result.success).toBe(true);
	});

	it("rejects 21 scopes", () => {
		const scopes = Array.from(
			{ length: 21 },
			(_, i) => SCOPES[i % SCOPES.length]
		);
		const result = integrationScopesSchema.safeParse(scopes);
		expect(result.success).toBe(false);
	});

	it("rejects an empty array", () => {
		const result = integrationScopesSchema.safeParse([]);
		expect(result.success).toBe(false);
	});
});

describe("registering an integration: messages", () => {
	const register = (fields: Record<string, unknown>) => ({
		name: "Tool",
		scopes: ["case:read"],
		...fields,
	});

	it("asks for a name", () => {
		expect(
			issuesOf(registerIntegrationSchema, register({ name: " " }))
		).toEqual(["name: Name is required"]);
	});

	it("asks for at least one scope", () => {
		expect(
			issuesOf(registerIntegrationSchema, register({ scopes: [] }))
		).toEqual(["scopes: At least one scope is required"]);
	});

	it("refuses more than 20 scopes with a message", () => {
		const scopes = Array.from({ length: 21 }, () => SCOPES[0]);
		expect(issuesOf(registerIntegrationSchema, register({ scopes }))).toEqual([
			"scopes: At most 20 scopes are allowed",
		]);
	});
});

describe("updateIntegrationSchema: something to update", () => {
	it("refuses a body with nothing to update, with a message", () => {
		expect(issuesOf(updateIntegrationSchema, {})).toEqual([
			": At least one field to update must be provided",
		]);
	});

	it.each([
		["a description alone", { description: "New text" }],
		["scopes alone", { scopes: ["case:read"] }],
		["a description and scopes", { description: "x", scopes: ["case:read"] }],
		["a null description alone", { description: null }],
		["an empty description alone", { description: "" }],
		["a description of only spaces alone", { description: "  " }],
	])("accepts %s", (_name, body) => {
		expect(issuesOf(updateIntegrationSchema, body)).toEqual([]);
	});

	it.each([
		["absent", { scopes: ["case:read"] }, undefined],
		["null", { description: null }, null],
		["empty", { description: "" }, null],
		["only spaces", { description: "   " }, null],
		["text", { description: " New text " }, "New text"],
	])("reads a %s description", (_name, body, expected) => {
		const result = updateIntegrationSchema.safeParse(body);
		expect(result.success).toBe(true);
		expect(result.data?.description).toBe(expected);
	});
});

describe("issueTokenSchema: expiry", () => {
	const NOW = new Date("2030-01-01T00:00:00.000Z");

	afterEach(() => {
		vi.useRealTimers();
	});

	it("accepts a body with no expiry", () => {
		expect(issuesOf(issueTokenSchema, {})).toEqual([]);
	});

	it("accepts an expiry one millisecond ahead and refuses the present moment", () => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
		expect(
			issuesOf(issueTokenSchema, { expiresAt: new Date(NOW.getTime() + 1) })
		).toEqual([]);
		expect(issuesOf(issueTokenSchema, { expiresAt: NOW })).toEqual([
			"expiresAt: expiresAt must be in the future",
		]);
	});

	it("refuses a past expiry given as text", () => {
		expect(issuesOf(issueTokenSchema, { expiresAt: "2001-01-01" })).toEqual([
			"expiresAt: expiresAt must be in the future",
		]);
	});

	it("accepts a future expiry given as text", () => {
		expect(issuesOf(issueTokenSchema, { expiresAt: "2999-01-01" })).toEqual([]);
	});
});

describe("grantCaseAccessSchema", () => {
	const CASE_ID = "3f2b8c1e-5d4a-4b6f-8a7c-9e0d1f2a3b4c";

	it.each(["VIEW", "COMMENT", "EDIT"])("accepts the level %s", (permission) => {
		expect(
			issuesOf(grantCaseAccessSchema, { caseId: CASE_ID, permission })
		).toEqual([]);
	});

	it.each([
		"ADMIN",
		"",
		"view",
	])("refuses the level %j with a message", (permission) => {
		expect(
			issuesOf(grantCaseAccessSchema, { caseId: CASE_ID, permission })
		).toEqual(["permission: Invalid permission level"]);
	});

	it("refuses a case id that is not an identifier", () => {
		expect(
			issuesOf(grantCaseAccessSchema, { caseId: "nope", permission: "VIEW" })
		).toEqual(["caseId: Invalid ID format"]);
	});
});
