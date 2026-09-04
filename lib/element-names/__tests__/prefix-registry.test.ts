import { afterEach, describe, expect, it } from "vitest";
import {
	describeExpectedFormat,
	getAcceptedPatterns,
	getCorePrefix,
	isValidElementName,
	registerPluginNamePatterns,
	resetPluginNamePatternsForTests,
} from "../prefix-registry";

const CONFLICTING_REGISTRATION_MESSAGE = /conflicting registration/i;
const REGISTERED_FORMAT_MESSAGE = /registered format/;
const FAKE_GSN_EVIDENCE_PATTERN = /^Sn[0-9]+$/;
const FAKE_GSN_EVIDENCE_PATTERN_ALT = /^Different[0-9]+$/;
const OTHER_PLUGIN_EVIDENCE_PATTERN = /^Ev[0-9]+$/;

describe("prefix-registry", () => {
	afterEach(() => {
		resetPluginNamePatternsForTests();
	});

	describe("getCorePrefix", () => {
		it("returns the ruled prefix for each of the ten core element types", () => {
			expect(getCorePrefix("GOAL")).toBe("G");
			expect(getCorePrefix("PROPERTY_CLAIM")).toBe("P");
			expect(getCorePrefix("STRATEGY")).toBe("S");
			expect(getCorePrefix("EVIDENCE")).toBe("E");
			expect(getCorePrefix("CONTEXT")).toBe("C");
			expect(getCorePrefix("JUSTIFICATION")).toBe("J");
			expect(getCorePrefix("ASSUMPTION")).toBe("A");
			expect(getCorePrefix("MODULE")).toBe("M");
			expect(getCorePrefix("AWAY_GOAL")).toBe("AG");
			expect(getCorePrefix("CONTRACT")).toBe("Ct");
		});

		it("returns undefined for a type it doesn't know", () => {
			expect(getCorePrefix("NOT_A_REAL_TYPE")).toBeUndefined();
		});
	});

	describe("isValidElementName — full format", () => {
		it("accepts each core type's own prefix format", () => {
			expect(isValidElementName("GOAL", "G1")).toBe(true);
			expect(isValidElementName("PROPERTY_CLAIM", "P1")).toBe(true);
			expect(isValidElementName("STRATEGY", "S1")).toBe(true);
			expect(isValidElementName("EVIDENCE", "E1")).toBe(true);
			expect(isValidElementName("CONTEXT", "C1")).toBe(true);
			expect(isValidElementName("JUSTIFICATION", "J1")).toBe(true);
			expect(isValidElementName("ASSUMPTION", "A1")).toBe(true);
			expect(isValidElementName("MODULE", "M1")).toBe(true);
			expect(isValidElementName("AWAY_GOAL", "AG1")).toBe(true);
			expect(isValidElementName("CONTRACT", "Ct1")).toBe(true);
		});

		it("rejects another type's prefix — P1 on a GOAL fails", () => {
			expect(isValidElementName("GOAL", "P1")).toBe(false);
		});

		it("rejects a name that only starts with the right letter (prefix-only would pass, full format must not)", () => {
			expect(isValidElementName("PROPERTY_CLAIM", "Precision claim")).toBe(
				false
			);
		});

		it("accepts dotted sub-numbering to any depth", () => {
			expect(isValidElementName("PROPERTY_CLAIM", "P1.2.3")).toBe(true);
		});

		it("rejects a bare prefix with no number, and a trailing dot with no number after it", () => {
			expect(isValidElementName("PROPERTY_CLAIM", "P")).toBe(false);
			expect(isValidElementName("PROPERTY_CLAIM", "P1.")).toBe(false);
		});
	});

	describe("getAcceptedPatterns / registerPluginNamePatterns — plugin seam", () => {
		it("a plugin-registered pattern is accepted only when its plugin id is in the enabled set", () => {
			registerPluginNamePatterns(
				"tea.fake-gsn",
				"EVIDENCE",
				FAKE_GSN_EVIDENCE_PATTERN
			);

			expect(isValidElementName("EVIDENCE", "Sn1", ["tea.fake-gsn"])).toBe(
				true
			);
			expect(isValidElementName("EVIDENCE", "Sn1", [])).toBe(false);
			expect(isValidElementName("EVIDENCE", "Sn1", ["tea.other"])).toBe(false);
			// The core pattern is unaffected either way.
			expect(isValidElementName("EVIDENCE", "E1", [])).toBe(true);
		});

		it("is additive only — a plugin's pattern never displaces the core pattern", () => {
			registerPluginNamePatterns(
				"tea.fake-gsn",
				"EVIDENCE",
				FAKE_GSN_EVIDENCE_PATTERN
			);

			const patterns = getAcceptedPatterns("EVIDENCE", ["tea.fake-gsn"]);
			expect(patterns.some((p) => p.test("E1"))).toBe(true);
			expect(patterns.some((p) => p.test("Sn1"))).toBe(true);
		});

		it("first-registration-wins on an identical re-registration (no throw)", () => {
			registerPluginNamePatterns(
				"tea.fake-gsn",
				"EVIDENCE",
				FAKE_GSN_EVIDENCE_PATTERN
			);

			expect(() =>
				registerPluginNamePatterns(
					"tea.fake-gsn",
					"EVIDENCE",
					FAKE_GSN_EVIDENCE_PATTERN
				)
			).not.toThrow();
			expect(getAcceptedPatterns("EVIDENCE", ["tea.fake-gsn"])).toHaveLength(2);
		});

		it("throws on a conflicting re-registration for the same plugin and type", () => {
			registerPluginNamePatterns(
				"tea.fake-gsn",
				"EVIDENCE",
				FAKE_GSN_EVIDENCE_PATTERN
			);

			expect(() =>
				registerPluginNamePatterns(
					"tea.fake-gsn",
					"EVIDENCE",
					FAKE_GSN_EVIDENCE_PATTERN_ALT
				)
			).toThrow(CONFLICTING_REGISTRATION_MESSAGE);
		});

		it("lets two different plugins register independently for the same type", () => {
			registerPluginNamePatterns(
				"tea.fake-gsn",
				"EVIDENCE",
				FAKE_GSN_EVIDENCE_PATTERN
			);
			registerPluginNamePatterns(
				"tea.other-plugin",
				"EVIDENCE",
				OTHER_PLUGIN_EVIDENCE_PATTERN
			);

			expect(isValidElementName("EVIDENCE", "Sn1", ["tea.fake-gsn"])).toBe(
				true
			);
			expect(isValidElementName("EVIDENCE", "Ev1", ["tea.other-plugin"])).toBe(
				true
			);
			// Enabling only one plugin doesn't grant the other's pattern.
			expect(isValidElementName("EVIDENCE", "Ev1", ["tea.fake-gsn"])).toBe(
				false
			);
		});
	});

	describe("describeExpectedFormat", () => {
		it("names the type and shows both a flat and a dotted example", () => {
			expect(describeExpectedFormat("PROPERTY_CLAIM")).toBe(
				"Property Claim names must look like P1 or P1.1"
			);
		});

		it("falls back to a generic message for an unknown type", () => {
			expect(describeExpectedFormat("NOT_A_REAL_TYPE")).toMatch(
				REGISTERED_FORMAT_MESSAGE
			);
		});
	});
});
