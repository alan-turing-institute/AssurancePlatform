import { describe, expect, it } from "vitest";
import { getAssertionStatusIndicator } from "../assertion-status-badge";

/**
 * Pins the badge-side of ADR 0004 D5's read/write asymmetry: the badge
 * DISPLAYS all six statuses including the derived `AS_CITED`; only the
 * setter (node-edit-dialog-assertion-status.test.ts) excludes it from
 * what an author can choose. `ASSERTED` is the unremarkable default, so it
 * — like absent/invalid data — renders no badge at all.
 */
describe("getAssertionStatusIndicator", () => {
	it("returns null for the default ASSERTED status", () => {
		expect(getAssertionStatusIndicator("ASSERTED")).toBeNull();
	});

	it("returns null for null", () => {
		expect(getAssertionStatusIndicator(null)).toBeNull();
	});

	it("returns null for undefined", () => {
		expect(getAssertionStatusIndicator(undefined)).toBeNull();
	});

	it("returns null for an invalid value", () => {
		expect(getAssertionStatusIndicator("NOT_A_REAL_STATUS")).toBeNull();
	});

	it.each([
		"NEEDS_SUPPORT",
		"ASSUMED",
		"AXIOMATIC",
		"DEFEATED",
		"AS_CITED",
	] as const)("returns a badge for %s", (status) => {
		expect(getAssertionStatusIndicator(status)).not.toBeNull();
	});

	it("returns a badge for AS_CITED even though the setter excludes it", () => {
		// AS_CITED is derived-only (ADR 0004 D5) and never author-selectable
		// (see AUTHOR_ASSERTION_STATUS_VALUES / getInitialAssertionStatus), but
		// it is still a real, displayable status once the server has derived
		// it — the badge must show it like any other non-default status.
		expect(getAssertionStatusIndicator("AS_CITED")).not.toBeNull();
	});
});
