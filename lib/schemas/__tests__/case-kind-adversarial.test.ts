import { describe, expect, it } from "vitest";
import { CaseKind } from "@/src/generated/prisma";
import {
	createAssuranceCaseSchema,
	updateAssuranceCaseSchema,
} from "../assurance-case";
import { CaseExportNestedSchema, CaseExportV2Schema } from "../case-export";
import committedSchema from "../json-schema-v1.1.json";

/**
 * What a case file may say about the case's kind, and which request bodies
 * may not say anything about it.
 */

const NODE_ID = "00000000-0000-4000-8000-000000000001";
const EXPORTED_AT = "2030-01-01T00:00:00.000Z";

function nestedFile(
	version: "1.0" | "1.1",
	caseFields: Record<string, unknown>,
	extra: Record<string, unknown> = {}
) {
	return {
		version,
		exportedAt: EXPORTED_AT,
		case: { name: "A case", description: "About it", ...caseFields },
		tree: {
			id: NODE_ID,
			type: "GOAL",
			name: "G1",
			description: "The goal",
			inSandbox: false,
			role: "TOP_LEVEL",
			children: [],
		},
		...extra,
	};
}

function flatFile(
	caseFields: Record<string, unknown>,
	extra: Record<string, unknown> = {}
) {
	return {
		version: "2.0",
		exportedAt: EXPORTED_AT,
		case: { name: "A case", description: "About it", ...caseFields },
		elements: [
			{
				id: NODE_ID,
				elementType: "GOAL",
				role: "TOP_LEVEL",
				parentId: null,
				name: "G1",
				description: "The goal",
				inSandbox: false,
			},
		],
		evidenceLinks: [],
		...extra,
	};
}

const SCHEMAS = [
	[
		"nested 1.0",
		CaseExportNestedSchema,
		(c: Record<string, unknown>) => nestedFile("1.0", c),
	],
	[
		"nested 1.1",
		CaseExportNestedSchema,
		(c: Record<string, unknown>) => nestedFile("1.1", c),
	],
	["flat 2.0", CaseExportV2Schema, (c: Record<string, unknown>) => flatFile(c)],
] as const;

const REFUSED_KINDS: [string, unknown][] = [
	["an unknown word", "TEMPLATE"],
	["lowercase", "pattern"],
	["mixed case", "Pattern"],
	["lowercase case", "case"],
	["an empty string", ""],
	["a value with a leading space", " PATTERN"],
	["a value with a trailing space", "PATTERN "],
	["null", null],
	["zero", 0],
	["one", 1],
	["true", true],
	["false", false],
	["an array holding a valid value", ["PATTERN"]],
	["an empty array", []],
	["an object", {}],
	["an object holding a valid value", { value: "PATTERN" }],
];

describe("the kind a case file can name", () => {
	it("accepts exactly the values the database enum has", () => {
		const kinds = Object.values(CaseKind).sort();
		expect(kinds).toEqual(["CASE", "PATTERN"]);
		for (const [, schema, build] of SCHEMAS) {
			for (const kind of kinds) {
				const parsed = schema.safeParse(build({ kind }));
				expect(parsed.success).toBe(true);
				expect(parsed.data?.case.kind).toBe(kind);
			}
		}
	});

	it.each(
		SCHEMAS
	)("refuses an invalid kind in a %s file and names case.kind as the problem", (_label, schema, build) => {
		for (const [, value] of REFUSED_KINDS) {
			const parsed = schema.safeParse(build({ kind: value }));
			expect(parsed.success).toBe(false);
			const paths = (parsed.error?.issues ?? []).map((issue) =>
				issue.path.join(".")
			);
			expect(paths).toContain("case.kind");
		}
	});

	it.each(
		SCHEMAS
	)("leaves kind out of the parsed case when a %s file says nothing about it", (_label, schema, build) => {
		const parsed = schema.safeParse(build({}));
		expect(parsed.success).toBe(true);
		expect(parsed.data && "kind" in parsed.data.case).toBe(false);
	});

	it("lists in the JSON schema for the editor the same kinds the database has", () => {
		const kind = committedSchema.properties.case.properties.kind;
		expect(kind.type).toBe("string");
		expect([...kind.enum].sort()).toEqual(Object.values(CaseKind).sort());
		expect(committedSchema.properties.case.required).not.toContain("kind");
	});
});

describe("keys a file cannot use to link a case to a pattern", () => {
	const PLANTED = {
		sourcePatternId: "00000000-0000-4000-8000-0000000000aa",
		markFromPattern: true,
	};

	it.each(
		SCHEMAS
	)("drops them from the case object of a %s file", (_label, schema, build) => {
		const parsed = schema.safeParse(build(PLANTED));
		expect(parsed.success).toBe(true);
		expect(parsed.data?.case).not.toHaveProperty("sourcePatternId");
		expect(parsed.data?.case).not.toHaveProperty("markFromPattern");
	});

	it("drops them from the top level and from every element of a nested file", () => {
		const file = nestedFile("1.1", {}, PLANTED);
		file.tree = { ...file.tree, ...PLANTED };
		const parsed = CaseExportNestedSchema.safeParse(file);
		expect(parsed.success).toBe(true);
		expect(parsed.data).not.toHaveProperty("sourcePatternId");
		expect(parsed.data).not.toHaveProperty("markFromPattern");
		expect(parsed.data?.tree).not.toHaveProperty("sourcePatternId");
		expect(parsed.data?.tree).not.toHaveProperty("markFromPattern");
	});

	it("drops them from the top level and from every element of a flat file", () => {
		const file = flatFile({}, PLANTED);
		file.elements = file.elements.map((element) => ({
			...element,
			...PLANTED,
		}));
		const parsed = CaseExportV2Schema.safeParse(file);
		expect(parsed.success).toBe(true);
		expect(parsed.data).not.toHaveProperty("sourcePatternId");
		expect(parsed.data?.elements[0]).not.toHaveProperty("sourcePatternId");
		expect(parsed.data?.elements[0]).not.toHaveProperty("markFromPattern");
	});
});

describe("request bodies that create or change a case", () => {
	it("refuse a kind or a source pattern", () => {
		for (const extra of [
			{ kind: "PATTERN" },
			{ kind: "CASE" },
			{ sourcePatternId: "00000000-0000-4000-8000-0000000000aa" },
		]) {
			expect(
				createAssuranceCaseSchema.safeParse({
					name: "A case",
					description: "About it",
					...extra,
				}).success
			).toBe(false);
			expect(
				updateAssuranceCaseSchema.safeParse({ name: "A case", ...extra })
					.success
			).toBe(false);
		}
	});
});
