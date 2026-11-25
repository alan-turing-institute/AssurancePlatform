import { describe, expect, it } from "vitest";
import {
	cleanElementDataForType,
	ELEMENT_TYPES,
	ElementValidationSchema,
	fieldAppliesTo,
	fieldRequiredFor,
	getValidFieldsForType,
	isAttributeType,
	validateElementData,
	validateElementName,
} from "../element-validation";

const UUID = "3f2b8c1e-9a4d-4e6b-8c7a-1d2e3f4a5b6c";

/** Fields every element type carries, in the order they are listed. */
const BASE_FIELDS = [
	"id",
	"caseId",
	"elementType",
	"parentId",
	"name",
	"description",
	"inSandbox",
	"fromPattern",
	"modifiedFromPattern",
	"isDefeater",
	"defeatsElementId",
	"assertionStatus",
	"createdAt",
	"updatedAt",
	"createdById",
];

/** The type-specific fields each element type may carry. */
const SPECIFIC_FIELDS: Record<string, string[]> = {
	GOAL: ["justification", "assumption", "context", "role"],
	STRATEGY: ["justification", "assumption", "context"],
	PROPERTY_CLAIM: ["justification", "assumption", "context", "level"],
	EVIDENCE: ["url", "urls"],
	JUSTIFICATION: ["justification"],
	ASSUMPTION: ["assumption"],
	MODULE: ["moduleReferenceId", "moduleEmbedType", "modulePublicSummary"],
	AWAY_GOAL: ["assumption", "moduleReferenceId", "citedElementId"],
	CONTRACT: [],
};

/** Every type-specific field, with a value to hand to the cleaner. */
const ALL_SPECIFIC_VALUES: Record<string, unknown> = {
	url: "u",
	urls: ["u"],
	justification: "j",
	assumption: "a",
	context: ["c"],
	level: 1,
	role: "TOP_LEVEL",
	moduleReferenceId: UUID,
	moduleEmbedType: "COPY",
	modulePublicSummary: "s",
	citedElementId: UUID,
};

const ELEMENT_TYPE_ROWS = Object.keys(SPECIFIC_FIELDS).map((type) => [type]);

const errorsOf = (type: string, data: Record<string, unknown>): string[] => {
	const result = validateElementData(type, data);
	return result.valid ? [] : result.errors;
};

describe("fieldAppliesTo", () => {
	it.each(
		Object.keys(ALL_SPECIFIC_VALUES)
	)("applies %s only to the element types that carry it", (field) => {
		for (const type of ELEMENT_TYPES) {
			expect(fieldAppliesTo(field, type)).toBe(
				SPECIFIC_FIELDS[type]?.includes(field)
			);
		}
	});

	it.each([
		"isDefeater",
		"defeatsElementId",
		"name",
		"description",
		"unknown",
	])("applies %s to every element type", (field) => {
		for (const type of ELEMENT_TYPES) {
			expect(fieldAppliesTo(field, type)).toBe(true);
		}
	});
});

describe("fieldRequiredFor", () => {
	it.each([
		["moduleReferenceId", "MODULE", true],
		["moduleReferenceId", "AWAY_GOAL", true],
		["moduleReferenceId", "GOAL", false],
		["moduleEmbedType", "MODULE", true],
		["moduleEmbedType", "AWAY_GOAL", false],
		["description", "MODULE", false],
		["citedElementId", "AWAY_GOAL", false],
	])("reports %s on %s as required: %s", (field, type, expected) => {
		expect(fieldRequiredFor(field, type)).toBe(expected);
	});
});

describe("isAttributeType", () => {
	it.each([
		["JUSTIFICATION", true],
		["ASSUMPTION", true],
		["GOAL", false],
		["EVIDENCE", false],
	])("reports %s as attribute-like: %s", (type, expected) => {
		expect(isAttributeType(type)).toBe(expected);
	});
});

describe("getValidFieldsForType", () => {
	it.each(
		ELEMENT_TYPE_ROWS
	)("lists the base fields then the fields specific to %s", (type) => {
		expect(getValidFieldsForType(type as string)).toEqual([
			...BASE_FIELDS,
			...(SPECIFIC_FIELDS[type as string] ?? []),
		]);
	});

	it("lists only the base fields for an unknown type", () => {
		expect(getValidFieldsForType("NOPE")).toEqual(BASE_FIELDS);
	});
});

describe("cleanElementDataForType", () => {
	it.each(
		ELEMENT_TYPE_ROWS
	)("keeps only the type-specific fields that apply to %s", (type) => {
		const cleaned = cleanElementDataForType(type as string, {
			...ALL_SPECIFIC_VALUES,
			name: "n",
		});
		expect(Object.keys(cleaned).sort()).toEqual(
			[...(SPECIFIC_FIELDS[type as string] ?? []), "name"].sort()
		);
	});

	it("keeps the values of the fields it keeps", () => {
		expect(
			cleanElementDataForType("EVIDENCE", { url: "u", urls: ["a"], level: 1 })
		).toEqual({ url: "u", urls: ["a"] });
	});

	it("drops undefined values but keeps null", () => {
		expect(
			cleanElementDataForType("GOAL", {
				name: undefined,
				description: null,
				assumption: undefined,
				justification: null,
			})
		).toEqual({ description: null, justification: null });
	});

	it("keeps the dialogical fields and unrecognised keys for every type", () => {
		for (const type of ELEMENT_TYPES) {
			expect(
				cleanElementDataForType(type, {
					isDefeater: true,
					defeatsElementId: UUID,
					extra: 1,
				})
			).toEqual({ isDefeater: true, defeatsElementId: UUID, extra: 1 });
		}
	});
});

describe("validateElementData", () => {
	const VALID: Record<string, Record<string, unknown>> = {
		GOAL: { description: "d" },
		STRATEGY: { description: "d" },
		PROPERTY_CLAIM: { description: "d" },
		EVIDENCE: { description: "d" },
		JUSTIFICATION: { description: "d" },
		ASSUMPTION: { description: "d" },
		MODULE: {
			description: "d",
			moduleReferenceId: UUID,
			moduleEmbedType: "COPY",
		},
		AWAY_GOAL: { description: "d", moduleReferenceId: UUID },
		CONTRACT: { description: "d" },
	};

	it.each(ELEMENT_TYPE_ROWS)("accepts minimal data for %s", (type) => {
		expect(
			validateElementData(type as string, VALID[type as string] ?? {})
		).toEqual({ valid: true });
	});

	it("rejects an unknown element type", () => {
		expect(validateElementData("NOPE", { description: "d" }).valid).toBe(false);
	});

	it("rejects data for a type whose own fields are missing", () => {
		expect(validateElementData("MODULE", { description: "d" }).valid).toBe(
			false
		);
		expect(validateElementData("AWAY_GOAL", { description: "d" }).valid).toBe(
			false
		);
	});

	it("validates against the type argument, not a type inside the data", () => {
		expect(
			validateElementData("GOAL", { description: "d", elementType: "MODULE" })
		).toEqual({ valid: true });
		expect(
			validateElementData("MODULE", { description: "d", elementType: "GOAL" })
				.valid
		).toBe(false);
	});

	it("reports each error as the dotted path, a colon and the message", () => {
		const errors = errorsOf("GOAL", { name: "n" });
		expect(errors).toHaveLength(1);
		expect(errors[0]?.startsWith("description: ")).toBe(true);
		expect(errors[0]?.length).toBeGreaterThan("description: ".length);
	});

	it("joins the nested path with dots", () => {
		const errors = errorsOf("GOAL", { description: "d", context: [123] });
		expect(errors.some((e) => e.startsWith("context.0: "))).toBe(true);
	});

	it("reports the module embed type as the field at fault when it is not allowed", () => {
		const errors = errorsOf("MODULE", {
			...VALID.MODULE,
			moduleEmbedType: "OTHER",
		});
		expect(errors).toHaveLength(1);
		expect(errors[0]?.startsWith("moduleEmbedType: ")).toBe(true);
	});

	it.each(["COPY", "REFERENCE"])("accepts the module embed type %s", (v) => {
		expect(
			validateElementData("MODULE", { ...VALID.MODULE, moduleEmbedType: v })
		).toEqual({ valid: true });
	});

	it("accepts a goal role of TOP_LEVEL or SUPPORTING and no other", () => {
		for (const role of ["TOP_LEVEL", "SUPPORTING", null]) {
			expect(
				validateElementData("GOAL", { description: "d", role }).valid
			).toBe(true);
		}
		expect(
			errorsOf("GOAL", { description: "d", role: "OTHER" })[0]?.startsWith(
				"role: "
			)
		).toBe(true);
	});

	it("requires a property claim level of at least 1", () => {
		const level = (value: unknown) =>
			validateElementData("PROPERTY_CLAIM", { description: "d", level: value })
				.valid;
		expect(level(1)).toBe(true);
		expect(level(5)).toBe(true);
		expect(level(null)).toBe(true);
		expect(level(0)).toBe(false);
		expect(level(1.5)).toBe(false);
	});

	it("requires module and cited element references to be UUIDs", () => {
		const away = (extra: Record<string, unknown>) =>
			validateElementData("AWAY_GOAL", { ...VALID.AWAY_GOAL, ...extra }).valid;
		expect(away({ citedElementId: UUID })).toBe(true);
		expect(away({ citedElementId: null })).toBe(true);
		expect(away({ citedElementId: "nope" })).toBe(false);
		expect(away({ moduleReferenceId: "nope" })).toBe(false);
	});
});

describe("ElementValidationSchema defaults", () => {
	it("defaults the draft, pattern and defeater flags to false", () => {
		const parsed = ElementValidationSchema.parse({
			elementType: "GOAL",
			description: "d",
		});
		expect(parsed).toMatchObject({
			inSandbox: false,
			fromPattern: false,
			modifiedFromPattern: false,
			isDefeater: false,
		});
	});

	it("defaults the urls of an evidence element to an empty list", () => {
		const parsed = ElementValidationSchema.parse({
			elementType: "EVIDENCE",
			description: "d",
		});
		expect(parsed).toMatchObject({ urls: [] });
	});

	it("drops keys the element type does not define", () => {
		const parsed = ElementValidationSchema.parse({
			elementType: "CONTRACT",
			description: "d",
			url: "x",
		});
		expect(parsed).not.toHaveProperty("url");
	});
});

describe("validateElementName", () => {
	it.each([null, undefined, ""])("accepts the empty name %j", (name) => {
		expect(validateElementName("GOAL", name)).toEqual({ valid: true });
	});

	it.each([
		["GOAL", "G1"],
		["GOAL", "G1.2.3"],
		["PROPERTY_CLAIM", "P1.1"],
	])("accepts %s named %s", (type, name) => {
		expect(validateElementName(type, name)).toEqual({ valid: true });
	});

	it("rejects a name in the wrong format and says what is expected", () => {
		expect(validateElementName("GOAL", "Safety")).toEqual({
			valid: false,
			error: "Goal names must look like G1 or G1.1",
		});
	});

	it("takes the C-prefixed form for a defeater and rejects the plain form", () => {
		expect(validateElementName("GOAL", "CG1", [], true)).toEqual({
			valid: true,
		});
		expect(validateElementName("GOAL", "G1", [], true)).toEqual({
			valid: false,
			error: "Goal names must look like CG1 or CG1.1",
		});
	});

	it("rejects the C-prefixed form for a plain element by default", () => {
		expect(validateElementName("GOAL", "CG1").valid).toBe(false);
	});
});
