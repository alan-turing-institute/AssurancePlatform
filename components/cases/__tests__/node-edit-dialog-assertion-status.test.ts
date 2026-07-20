import { describe, expect, it } from "vitest";
import { AUTHOR_ASSERTION_STATUS_VALUES } from "@/lib/assertion-status";
import { getInitialAssertionStatus } from "../node-edit-dialog";

/**
 * Pins the write-side of ADR 0004 D5: `AS_CITED` is derived-only and must
 * never be offered as an author choice in the setter, even though the badge
 * (assertion-status-badge.test.tsx) displays it. Covers both halves of that
 * rule — the initial-value resolver never surfaces `AS_CITED`, and the
 * setter's option set excludes it entirely.
 */
describe("getInitialAssertionStatus", () => {
	it("falls back to ASSERTED for a node whose assertionStatus is AS_CITED", () => {
		expect(getInitialAssertionStatus({ assertionStatus: "AS_CITED" })).toBe(
			"ASSERTED"
		);
	});

	it("falls back to ASSERTED for null", () => {
		expect(getInitialAssertionStatus({ assertionStatus: null })).toBe(
			"ASSERTED"
		);
	});

	it("falls back to ASSERTED for undefined", () => {
		expect(getInitialAssertionStatus({ assertionStatus: undefined })).toBe(
			"ASSERTED"
		);
	});

	it("falls back to ASSERTED for an invalid string", () => {
		expect(
			getInitialAssertionStatus({ assertionStatus: "NOT_A_REAL_STATUS" })
		).toBe("ASSERTED");
	});

	it("returns one of the five author-declarable values for a valid status", () => {
		expect(getInitialAssertionStatus({ assertionStatus: "DEFEATED" })).toBe(
			"DEFEATED"
		);
	});
});

describe("AUTHOR_ASSERTION_STATUS_VALUES", () => {
	it("does not contain AS_CITED", () => {
		expect(AUTHOR_ASSERTION_STATUS_VALUES).not.toContain("AS_CITED");
	});

	it("contains exactly the five author-declarable values", () => {
		expect([...AUTHOR_ASSERTION_STATUS_VALUES].sort()).toEqual(
			["ASSERTED", "ASSUMED", "AXIOMATIC", "DEFEATED", "NEEDS_SUPPORT"].sort()
		);
	});
});
