import { describe, expect, it } from "vitest";
import {
	countPlaceholders,
	patternMarkersForEdit,
	placeholderCountMessage,
	recordedStates,
	writingClearsPlaceholder,
} from "../placeholders";

describe("placeholderCountMessage", () => {
	it("agrees with the number", () => {
		expect(placeholderCountMessage(1)).toBe("1 element still to fill in");
		expect(placeholderCountMessage(3)).toBe("3 elements still to fill in");
	});
});

describe("countPlaceholders", () => {
	it("counts an element listed more than once as one", () => {
		const count = countPlaceholders([
			{ id: "e1", isPlaceholder: true },
			{ id: "e1", isPlaceholder: true },
			{ id: "p1", isPlaceholder: false },
			{ id: "p2" },
		]);

		expect(count).toBe(1);
	});
});

describe("writingClearsPlaceholder", () => {
	it.each([
		["new text in a case", "CASE", "", "Written", true],
		["new text in a pattern", "PATTERN", "", "Written", false],
		["the stored text again", "CASE", "Same", "Same", false],
		["empty text", "CASE", "Sample", "  ", false],
		["no text at all", "CASE", "", undefined, false],
	] as const)("%s: %s", (_label, kind, stored, written, expected) => {
		expect(writingClearsPlaceholder(kind, stored, written)).toBe(expected);
	});
});

describe("patternMarkersForEdit", () => {
	const stored = {
		description: "Sample",
		assumption: null,
		justification: null,
		context: [],
		fromPattern: true,
	};

	it("marks an element from a pattern as modified for changed text only", () => {
		const base = { kind: "CASE", placeholderSetByEdit: false, stored } as const;

		expect(
			patternMarkersForEdit({
				...base,
				edit: { description: "Sample", context: [] },
			})
		).toEqual({});
		expect(
			patternMarkersForEdit({ ...base, edit: { justification: "Because" } })
		).toEqual({ modifiedFromPattern: true });
		expect(
			patternMarkersForEdit({ ...base, edit: { context: ["A named thing"] } })
		).toEqual({ modifiedFromPattern: true });
	});

	it("leaves the placeholder marker to an edit that sets it", () => {
		const input = {
			kind: "CASE",
			stored: { ...stored, fromPattern: false },
			edit: { description: "Written" },
		} as const;

		expect(
			patternMarkersForEdit({ ...input, placeholderSetByEdit: false })
		).toEqual({ isPlaceholder: false });
		expect(
			patternMarkersForEdit({ ...input, placeholderSetByEdit: true })
		).toEqual({});
	});
});

describe("recordedStates", () => {
	const before = { id: "e1", description: "", isPlaceholder: true };

	it("records a placeholder as cleared once its description is written in a case", () => {
		const recorded = recordedStates("CASE", before, { description: "Written" });

		expect(recorded.before).toBe(before);
		expect(recorded.after).toEqual({
			id: "e1",
			description: "Written",
			isPlaceholder: false,
		});
	});

	it("records the marker as it stands in a pattern, spelling out the state before", () => {
		const recorded = recordedStates(
			"PATTERN",
			{ id: "e1", description: "Sample" },
			{ description: "Edited", isPlaceholder: true, placeholderHint: "Hint" }
		);

		expect(recorded.before).toMatchObject({
			isPlaceholder: false,
			placeholderHint: null,
		});
		expect(recorded.after).toMatchObject({
			isPlaceholder: true,
			placeholderHint: "Hint",
		});
	});
});
