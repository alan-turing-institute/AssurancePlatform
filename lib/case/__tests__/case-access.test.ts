import { describe, expect, it } from "vitest";
import { type CaseAccessLevel, caseAccessAtLeast } from "../case-access";

const LEVELS: CaseAccessLevel[] = ["view", "comment", "edit", "manage"];

describe("caseAccessAtLeast", () => {
	it.each(
		LEVELS.flatMap((held, heldIndex) =>
			LEVELS.map((level, levelIndex) => ({
				held,
				level,
				expected: heldIndex >= levelIndex,
			}))
		)
	)("$held against $level is $expected", ({ held, level, expected }) => {
		expect(caseAccessAtLeast(held, level)).toBe(expected);
	});

	it.each([
		undefined,
		null,
		"",
		"review",
		"owner",
		["edit"],
		42,
	])("grants nothing for %j", (value) => {
		for (const level of LEVELS) {
			expect(caseAccessAtLeast(value, level)).toBe(false);
		}
	});
});
