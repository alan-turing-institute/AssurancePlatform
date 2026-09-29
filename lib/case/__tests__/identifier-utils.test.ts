import { describe, expect, it } from "vitest";
import { compareIdentifiers } from "../identifier-utils";

describe("compareIdentifiers", () => {
	it("sorts same-prefix identifiers numerically, not lexically (G/P/S/E unchanged)", () => {
		expect(compareIdentifiers("G1", "G2")).toBeLessThan(0);
		expect(compareIdentifiers("G9", "G10")).toBeLessThan(0);
		expect(compareIdentifiers("P1.2", "P1.10")).toBeLessThan(0);
		expect(compareIdentifiers("S1", "S2")).toBeLessThan(0);
		expect(compareIdentifiers("E1", "E2")).toBeLessThan(0);
		expect(compareIdentifiers("P1", "P1")).toBe(0);
	});

	it("sorts multi-letter prefixes numerically past nine (the bug this fixes)", () => {
		expect(compareIdentifiers("AG2", "AG10")).toBeLessThan(0);
		expect(compareIdentifiers("CP2", "CP10")).toBeLessThan(0);
		expect(compareIdentifiers("CG2", "CG10")).toBeLessThan(0);
		expect(compareIdentifiers("CE2", "CE10")).toBeLessThan(0);
		expect(compareIdentifiers("Ct2", "Ct10")).toBeLessThan(0);
	});

	it("sorts dotted multi-letter identifiers numerically", () => {
		expect(compareIdentifiers("CP1.2", "CP1.10")).toBeLessThan(0);
	});

	it("is case-sensitive on prefix — Ct and CT are different prefixes, so it falls back to string comparison", () => {
		// "Ct1" and "CT1" don't share a prefix under case-sensitive matching,
		// so they fall back to plain string comparison rather than numeric.
		expect(compareIdentifiers("Ct1", "CT1")).toBe("Ct1".localeCompare("CT1"));
	});

	it("leaves different-prefix ordering exactly as today (string comparison)", () => {
		// Today's (pre- and post-fix) behaviour for different prefixes is an
		// unchanged localeCompare fallback: alphabetical, so "P1" < "S1" and
		// "G1" < "P1".
		expect(compareIdentifiers("G1", "P1")).toBeLessThan(0);
		expect(compareIdentifiers("P1", "S1")).toBeLessThan(0);
		expect(compareIdentifiers("S1", "P1")).toBeGreaterThan(0);
	});

	it("falls back to string comparison for null/non-matching identifiers", () => {
		expect(compareIdentifiers(null, null)).toBe(0);
		expect(compareIdentifiers(null, "G1")).toBe("".localeCompare("G1"));
		expect(compareIdentifiers("G1", null)).toBe("G1".localeCompare(""));
		expect(compareIdentifiers("not-an-identifier", "G1")).toBe(
			"not-an-identifier".localeCompare("G1")
		);
	});
});
