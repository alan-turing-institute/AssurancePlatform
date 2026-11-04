import { describe, expect, it } from "vitest";
import { compareElementNames, compareIdentifiers } from "../identifier-utils";

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

describe("compareElementNames", () => {
	const POOL: (string | null)[] = [
		"P2",
		"P10",
		"P1a",
		"P1.2",
		"P1.10",
		"P1",
		"P01",
		"P001",
		"P0",
		null,
		"",
		"Ct1",
		"CT1",
		"CCt1",
		"AG2",
		"A10",
		"G1",
		"S1",
		"E3",
		"E3 ",
		"e3",
		"1",
		"1a",
		"a1",
		"Évidence 2",
		"evidence 10",
		"Evidence 9",
		"my claim",
		"My Claim",
		"P99999999999999999999",
		"P100000000000000000000",
	];

	const sign = (value: number) => Math.sign(value);

	it("orders numbers by value, not by their digits as text", () => {
		expect(compareElementNames("P2", "P10")).toBeLessThan(0);
		expect(compareElementNames("P1.2", "P1.10")).toBeLessThan(0);
		expect(compareElementNames("P9", "P10")).toBeLessThan(0);
		expect(compareElementNames("AG2", "AG10")).toBeLessThan(0);
		expect(
			compareElementNames("P99999999999999999999", "P100000000000000000000")
		).toBeLessThan(0);
	});

	it("puts a name before the longer names that start with it, and a number before text", () => {
		expect(compareElementNames("P1", "P1.2")).toBeLessThan(0);
		expect(compareElementNames("P1", "P1a")).toBeLessThan(0);
		expect(compareElementNames("P1a", "P2")).toBeLessThan(0);
		expect(compareElementNames("P1.10", "P1a")).toBeLessThan(0);
		expect(compareElementNames("1", "a")).toBeLessThan(0);
	});

	it("compares text without regard to case, then by case, never by locale", () => {
		expect(compareElementNames("e3", "F1")).toBeLessThan(0);
		expect(compareElementNames("CT1", "Ct1")).toBeLessThan(0);
		expect(compareElementNames("Ct1", "CCt1")).toBeGreaterThan(0);
		expect(compareElementNames("My Claim", "my claim")).toBeLessThan(0);
		// "É" (U+00C9) comes after "z" by character code, as it does in any locale.
		expect(compareElementNames("z", "Évidence")).toBeLessThan(0);
	});

	it("orders equal numbers with different leading zeros by their text", () => {
		expect(compareElementNames("P01", "P1")).toBeLessThan(0);
		expect(compareElementNames("P001", "P01")).toBeLessThan(0);
		expect(compareElementNames("P0", "P1")).toBeLessThan(0);
	});

	it("puts a missing name first, then an empty one, then every other name", () => {
		expect(compareElementNames(null, "")).toBeLessThan(0);
		expect(compareElementNames("", null)).toBeGreaterThan(0);
		expect(compareElementNames("", "P1")).toBeLessThan(0);
		expect(compareElementNames(null, "P1")).toBeLessThan(0);
		expect(compareElementNames(null, null)).toBe(0);
	});

	it("is zero only for identical strings", () => {
		for (const a of POOL) {
			for (const b of POOL) {
				expect(compareElementNames(a, b) === 0, `${a} / ${b}`).toBe(a === b);
			}
		}
	});

	it("gives opposite signs when the arguments swap", () => {
		for (const a of POOL) {
			for (const b of POOL) {
				expect(
					sign(compareElementNames(a, b)) + sign(compareElementNames(b, a)),
					`${a} / ${b}`
				).toBe(0);
			}
		}
	});

	it("is transitive across every triple", () => {
		for (const a of POOL) {
			for (const b of POOL) {
				for (const c of POOL) {
					if (
						compareElementNames(a, b) <= 0 &&
						compareElementNames(b, c) <= 0
					) {
						expect(
							compareElementNames(a, c),
							`${a} / ${b} / ${c}`
						).toBeLessThanOrEqual(0);
					}
				}
			}
		}
	});

	it("sorts the pool the same way from any starting order", () => {
		const expected = [...POOL].sort(compareElementNames);
		for (let shift = 1; shift < POOL.length; shift++) {
			const rotated = [...POOL.slice(shift), ...POOL.slice(0, shift)];
			expect(rotated.sort(compareElementNames)).toEqual(expected);
		}
		expect([...POOL].reverse().sort(compareElementNames)).toEqual(expected);
	});

	it("agrees with compareIdentifiers on well-formed identifiers it tells apart", () => {
		const identifiers = [
			"G1",
			"G2",
			"G10",
			"S1",
			"S2",
			"P1",
			"P2",
			"P10",
			"P1.1",
			"P1.2",
			"P1.10",
			"P2.1",
			"E1",
			"E2",
			"E10",
			"AG1",
			"AG2",
			"AG10",
			"A2",
			"CP1",
			"CP10",
			"CG2",
			"CE1",
			"Ct1",
			"Ct10",
			"M1",
		];
		for (const a of identifiers) {
			for (const b of identifiers) {
				const expected = compareIdentifiers(a, b);
				if (expected !== 0) {
					expect(sign(compareElementNames(a, b)), `${a} / ${b}`).toBe(
						sign(expected)
					);
				}
			}
		}
	});
});
