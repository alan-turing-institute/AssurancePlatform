import { describe, expect, it } from "vitest";
import {
	detectAndValidate,
	detectVersion,
	validateImport,
} from "../version-detection";

const ID = "123e4567-e89b-42d3-a456-426614174000";
const OTHER_ID = "223e4567-e89b-42d3-a456-426614174000";

const UNRECOGNISED_MESSAGE =
	"Could not parse import format. Ensure the JSON has a 'tree' object (nested) or 'elements' array (flat).";

function nestedFile(overrides: Record<string, unknown> = {}) {
	return {
		version: "1.1",
		exportedAt: "2025-01-01T00:00:00.000Z",
		case: { name: "Case", description: "About" },
		tree: {
			id: ID,
			type: "GOAL",
			name: "G1",
			description: "Top",
			children: [],
		},
		...overrides,
	};
}

function flatFile(overrides: Record<string, unknown> = {}) {
	return {
		version: "2.0",
		exportedAt: "2025-01-01T00:00:00.000Z",
		case: { name: "Case", description: "About" },
		elements: [],
		evidenceLinks: [],
		...overrides,
	};
}

describe("detectVersion", () => {
	it.each([
		["a 1.0 marker", { version: "1.0" }],
		["a 1.1 marker", { version: "1.1" }],
		["a tree with a children list", { tree: { children: [] } }],
	])("reads %s as nested", (_name, input) => {
		expect(detectVersion(input)).toBe("nested");
	});

	it.each([
		["a 2.0 marker", { version: "2.0" }],
		["elements with evidence links", { elements: [], evidenceLinks: [] }],
	])("reads %s as flat", (_name, input) => {
		expect(detectVersion(input)).toBe("flat");
	});

	it.each([
		["an empty object", {}],
		["an unknown version marker", { version: "3.0" }],
		["elements without evidence links", { elements: [] }],
		["evidence links without elements", { evidenceLinks: [] }],
		["elements that are not a list", { elements: "x", evidenceLinks: [] }],
		["a tree that is not an object", { tree: "text" }],
		["a null tree", { tree: null }],
		["a tree without children", { tree: {} }],
		["a tree whose children are not a list", { tree: { children: "x" } }],
		["an empty array", []],
	])("returns null for %s", (_name, input) => {
		expect(detectVersion(input)).toBeNull();
	});

	it.each([
		["null", null],
		["undefined", undefined],
		["text", "text"],
		["a number", 42],
		["zero", 0],
		["true", true],
	])("returns null for %s", (_name, input) => {
		expect(detectVersion(input)).toBeNull();
	});
});

describe("detectAndValidate", () => {
	it("accepts a nested file and returns its data", () => {
		const result = detectAndValidate(nestedFile());
		expect(result.isValid).toBe(true);
		expect(result.version).toBe("nested");
		if (result.isValid) {
			expect(result.data).toMatchObject({ case: { name: "Case" } });
		}
	});

	it("accepts a flat file and returns its data", () => {
		const result = detectAndValidate(flatFile());
		expect(result.isValid).toBe(true);
		expect(result.version).toBe("flat");
		if (result.isValid) {
			expect(result.data).toMatchObject({ case: { name: "Case" } });
		}
	});

	it.each([
		["null", null],
		["undefined", undefined],
		["text", "text"],
		["a number", 42],
		["true", true],
		// The import response includes each issue's code, so the codes in this block are checked.
	])("rejects %s as not an object", (_name, input) => {
		const result = detectAndValidate(input);
		expect(result.isValid).toBe(false);
		expect(result.version).toBeNull();
		if (!result.isValid) {
			expect(result.errors).toHaveLength(1);
			expect(result.errors[0]?.path).toBe("root");
			expect(result.errors[0]?.message).toBe(
				"Invalid input: expected a JSON object"
			);
			expect(result.errors[0]?.code).toBe("invalid_type");
		}
	});

	it.each([
		["an empty object", {}],
		["an object with other keys", { name: "x" }],
		["elements without evidence links", { elements: [] }],
	])("gives the unrecognised-format error for %s", (_name, input) => {
		const result = detectAndValidate(input);
		expect(result.isValid).toBe(false);
		expect(result.version).toBeNull();
		if (!result.isValid) {
			expect(result.errors).toHaveLength(1);
			expect(result.errors[0]?.path).toBe("root");
			expect(result.errors[0]?.message).toBe(UNRECOGNISED_MESSAGE);
			expect(result.errors[0]?.code).toBe("invalid_format");
		}
	});

	it("reports a nested problem at its dotted path", () => {
		const file = nestedFile({
			tree: {
				id: ID,
				type: "GOAL",
				name: "G1",
				description: "Top",
				children: [
					{ id: "nope", type: "CONTEXT", name: "C1", description: "d" },
				],
			},
		});
		const result = detectAndValidate(file);
		expect(result.isValid).toBe(false);
		if (!result.isValid) {
			const paths = result.errors.map((e) => e.path);
			expect(paths).toContain("tree.children.0.id");
			expect(paths).toContain("tree.children.0.children");
		}
	});

	it("rejects a flat file with an empty case name, naming the field", () => {
		const result = detectAndValidate(
			flatFile({ case: { name: "", description: "d" } })
		);
		expect(result.isValid).toBe(false);
		expect(result.version).toBeNull();
		if (!result.isValid) {
			const error = result.errors.find((e) => e.path === "case.name");
			expect(error?.message).toBe("Case name is required");
			expect(error?.code).toBe("too_small");
		}
	});
});

describe("validateImport", () => {
	it("summarises a valid nested file", () => {
		const result = validateImport(nestedFile());
		expect(result.isValid).toBe(true);
		expect(result.version).toBe("nested");
		expect(result.errors).toEqual([]);
		expect(result.warnings).toEqual([]);
	});

	it("summarises a valid flat file", () => {
		const result = validateImport(flatFile());
		expect(result.isValid).toBe(true);
		expect(result.version).toBe("flat");
		expect(result.errors).toEqual([]);
		expect(result.warnings).toEqual([]);
	});

	it("summarises an invalid file with its errors and no warnings", () => {
		const result = validateImport(
			nestedFile({ tree: { id: OTHER_ID, type: "GOAL" } })
		);
		expect(result.isValid).toBe(false);
		expect(result.version).toBeNull();
		expect(result.warnings).toEqual([]);
		expect(result.errors.map((e) => e.path)).toContain("tree.description");
	});

	it("reports the unrecognised-format error for an unknown shape", () => {
		const result = validateImport({});
		expect(result.isValid).toBe(false);
		expect(result.version).toBeNull();
		expect(result.errors.map((e) => e.message)).toEqual([UNRECOGNISED_MESSAGE]);
		expect(result.warnings).toEqual([]);
	});
});
