import { describe, expect, it } from "vitest";
import { findUnknownScopes, isValidScope, SCOPES, sameScopes } from "../scopes";

describe("scopes", () => {
	/**
	 * Pins the exact v1 machine-access scope vocabulary (ADR 0002 v2 §2.4).
	 * Breaks loudly if a scope is added, removed, or renamed without this
	 * test being deliberately updated — the registry is meant to change only
	 * via an ADR amendment, never silently.
	 */
	it("locks the exact v1 scope vocabulary", () => {
		expect(SCOPES).toEqual([
			"case:read",
			"health:evidence:read",
			"health:evidence:write",
		]);
	});

	describe("isValidScope", () => {
		it("accepts every scope in the registry", () => {
			for (const scope of SCOPES) {
				expect(isValidScope(scope)).toBe(true);
			}
		});

		it("rejects a scope not in the registry", () => {
			expect(isValidScope("case:write")).toBe(false);
			expect(isValidScope("")).toBe(false);
		});
	});

	describe("findUnknownScopes", () => {
		it("returns an empty array when every scope is known", () => {
			expect(findUnknownScopes(["case:read", "health:evidence:write"])).toEqual(
				[]
			);
		});

		it("returns only the unknown scopes, preserving order", () => {
			expect(
				findUnknownScopes(["case:read", "not-a-real-scope", "case:write"])
			).toEqual(["not-a-real-scope", "case:write"]);
		});

		it("returns an empty array for an empty input", () => {
			expect(findUnknownScopes([])).toEqual([]);
		});
	});

	/**
	 * Smoke coverage for the scope-reconciliation logic reused by
	 * `scripts/seed-darter-integration.ts` (item 10 of the fix round) — the
	 * script itself is untested end-to-end (it talks to a real database and
	 * takes CLI args), but the comparison it hinges on is a pure function and
	 * cheap to pin here.
	 */
	describe("sameScopes", () => {
		it("treats identically-ordered sets as the same", () => {
			expect(
				sameScopes(
					["case:read", "health:evidence:write"],
					["case:read", "health:evidence:write"]
				)
			).toBe(true);
		});

		it("treats differently-ordered sets as the same (order-independent)", () => {
			expect(
				sameScopes(
					["health:evidence:write", "case:read"],
					["case:read", "health:evidence:write"]
				)
			).toBe(true);
		});

		it("treats sets of different length as different", () => {
			expect(
				sameScopes(["case:read"], ["case:read", "health:evidence:write"])
			).toBe(false);
		});

		it("treats same-length sets with different members as different", () => {
			expect(
				sameScopes(
					["case:read", "health:evidence:read"],
					["case:read", "health:evidence:write"]
				)
			).toBe(false);
		});

		it("treats two empty sets as the same", () => {
			expect(sameScopes([], [])).toBe(true);
		});
	});
});
