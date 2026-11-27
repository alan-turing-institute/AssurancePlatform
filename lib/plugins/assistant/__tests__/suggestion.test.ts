import { describe, expect, it } from "vitest";
import { trimmed, typeLabel } from "../suggestion";

describe("typeLabel", () => {
	it.each([
		["goal", "goal"],
		["strategy", "strategy"],
		["property_claim", "claim"],
		["evidence", "evidence"],
		["assumption", "assumption"],
		["justification", "justification"],
		["away_goal", "away goal"],
		["module", "module"],
	])("names %s as a %s for the reader", (type, label) => {
		expect(typeLabel(type)).toBe(label);
	});

	it("reads the type in any case, as the stored export spells it", () => {
		expect(typeLabel("PROPERTY_CLAIM")).toBe("claim");
		expect(typeLabel("AWAY_GOAL")).toBe("away goal");
	});

	it.each([
		"",
		"widget",
		"propertyClaim",
	])("calls a type it does not know (%j) an element", (type) => {
		expect(typeLabel(type)).toBe("element");
	});
});

describe("trimmed", () => {
	it("trims text and reads a missing value as empty", () => {
		expect(trimmed("  a b \n")).toBe("a b");
		expect(trimmed(undefined)).toBe("");
		expect(trimmed(null)).toBe("");
	});
});
