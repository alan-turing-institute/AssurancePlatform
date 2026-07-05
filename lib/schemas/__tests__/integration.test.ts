import { describe, expect, it } from "vitest";
import { SCOPES } from "@/lib/auth/scopes";
import {
	integrationScopesSchema,
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

describe("updateIntegrationSchema — description cap (shares optionalString(1000))", () => {
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
