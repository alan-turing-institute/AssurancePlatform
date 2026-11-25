import { describe, expect, it } from "vitest";
import {
	CaseExportNestedSchema,
	CaseExportV2Schema,
	ElementV2Schema,
	EvidenceLinkV2Schema,
} from "../case-export";

const ID_A = "11111111-1111-4111-8111-111111111111";
const ID_B = "22222222-2222-4222-8222-222222222222";
const ID_C = "33333333-3333-4333-8333-333333333333";
const ID_D = "44444444-4444-4444-8444-444444444444";
const EXPORTED_AT = "2026-01-01T00:00:00.000Z";

const flatElement = (extra: Record<string, unknown> = {}) => ({
	id: ID_A,
	elementType: "GOAL",
	parentId: null,
	name: "G1",
	description: "The system is safe",
	...extra,
});

const node = (id: string, extra: Record<string, unknown> = {}) => ({
	id,
	type: "GOAL",
	name: "G",
	description: "text",
	inSandbox: false,
	children: [],
	...extra,
});

const nestedDocument = (
	version: string,
	tree: unknown,
	caseExtra: Record<string, unknown> = {}
) => ({
	version,
	exportedAt: EXPORTED_AT,
	case: { name: "Case", description: "About it", ...caseExtra },
	tree,
});

const issuesOf = (
	schema: { safeParse: (v: unknown) => unknown },
	v: unknown
) => {
	const result = schema.safeParse(v) as {
		success: boolean;
		error?: {
			issues: { code: string; path: PropertyKey[]; message: string }[];
		};
	};
	return result.error?.issues ?? [];
};

describe("ElementV2Schema", () => {
	it("keeps the fields of the element it is given", () => {
		const parsed = ElementV2Schema.parse(flatElement({ assumption: "A" }));
		expect(parsed).toMatchObject({
			id: ID_A,
			elementType: "GOAL",
			parentId: null,
			name: "G1",
			description: "The system is safe",
			assumption: "A",
		});
	});

	it("fills in false for each flag the element leaves out", () => {
		const parsed = ElementV2Schema.parse(flatElement());
		expect(parsed).toMatchObject({
			inSandbox: false,
			isDefeater: false,
			fromPattern: false,
			modifiedFromPattern: false,
			isPlaceholder: false,
		});
	});

	it("keeps the comments attached to an element", () => {
		const comment = { author: "ada", content: "Looks fine", createdAt: "now" };
		const parsed = ElementV2Schema.parse(flatElement({ comments: [comment] }));
		expect(parsed.comments).toEqual([comment]);
	});

	it.each([
		[500, true],
		[501, false],
	])("accepts a placeholder hint of %i characters: %s", (length, ok) => {
		const element = flatElement({ placeholderHint: "h".repeat(length) });
		expect(ElementV2Schema.safeParse(element).success).toBe(ok);
	});
});

describe("EvidenceLinkV2Schema", () => {
	it("keeps the evidence and claim ids of a link", () => {
		expect(
			EvidenceLinkV2Schema.parse({ evidenceId: ID_A, claimId: ID_B })
		).toEqual({ evidenceId: ID_A, claimId: ID_B });
	});
});

describe("case name in an export document", () => {
	const v2 = (name: string) => ({
		version: "2.0",
		exportedAt: EXPORTED_AT,
		case: { name, description: "" },
		elements: [],
		evidenceLinks: [],
	});

	it.each([
		["flat", CaseExportV2Schema, v2("")],
		["nested", CaseExportNestedSchema, nestedDocument("1.1", node(ID_A))],
	] as const)("reports an empty name in the %s format", (_label, schema, doc) => {
		const empty = { ...doc, case: { ...doc.case, name: "" } };
		const issue = issuesOf(schema, empty)[0];
		expect(issue?.path).toEqual(["case", "name"]);
		expect(issue?.message).toBe("Case name is required");
	});

	it("accepts a one character name in the flat format", () => {
		expect(CaseExportV2Schema.safeParse(v2("X")).success).toBe(true);
	});
});

describe("CaseExportNestedSchema — version 1.0 files", () => {
	const named = { id: "abcde12345", name: "Dog", text: "A dog" };

	// The import response includes each issue's code, so the codes below are checked.
	it("points to a named context entry in a nested child, with a custom issue code", () => {
		const tree = node(ID_A, {
			children: [
				node(ID_B),
				node(ID_C, { children: [node(ID_D, { context: [named] })] }),
			],
		});
		const issue = issuesOf(
			CaseExportNestedSchema,
			nestedDocument("1.0", tree)
		)[0];
		expect(issue?.code).toBe("custom");
		expect(issue?.path).toEqual([
			"tree",
			"children",
			1,
			"children",
			0,
			"context",
			0,
		]);
	});

	it("points to a placeholder in a later child, with a custom issue code", () => {
		const tree = node(ID_A, {
			children: [node(ID_B), node(ID_C, { isPlaceholder: true })],
		});
		const issue = issuesOf(
			CaseExportNestedSchema,
			nestedDocument("1.0", tree)
		)[0];
		expect(issue?.code).toBe("custom");
		expect(issue?.path).toEqual(["tree", "children", 1, "isPlaceholder"]);
	});

	it("points to the case kind when a 1.0 file marks the case as a pattern", () => {
		const issue = issuesOf(
			CaseExportNestedSchema,
			nestedDocument("1.0", node(ID_A), { kind: "PATTERN" })
		)[0];
		expect(issue?.code).toBe("custom");
		expect(issue?.path).toEqual(["case", "kind"]);
	});

	it("accepts a plain 1.0 file with children", () => {
		const tree = node(ID_A, { children: [node(ID_B)] });
		expect(
			CaseExportNestedSchema.safeParse(nestedDocument("1.0", tree)).success
		).toBe(true);
	});
});
