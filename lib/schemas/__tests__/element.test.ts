import { describe, expect, it } from "vitest";
import {
	attachElementSchema,
	createElementSchema,
	elementAttributesFormSchema,
	elementDescriptionFormSchema,
	elementUrlsFormSchema,
	moveElementSchema,
	nodeEditFormSchema,
} from "../element";

const UUID = "3f2b8c1e-9a4d-4e6b-8c7a-1d2e3f4a5b6c";

const firstIssue = (
	result: { success: boolean; error?: { issues: unknown[] } },
	key: "message" | "path"
) => (result.error?.issues[0] as Record<string, unknown> | undefined)?.[key];

describe("createElementSchema — element type and module embed type", () => {
	it.each([
		"type",
		"elementType",
	])("rejects an empty %s with its own message", (field) => {
		const result = createElementSchema.safeParse({ [field]: "" });
		expect(result.success).toBe(false);
		expect(firstIssue(result, "message")).toBe("Element type is required");
		expect(firstIssue(result, "path")).toEqual([field]);
	});

	it.each(["COPY", "REFERENCE"])("accepts the module embed type %s", (v) => {
		const result = createElementSchema.safeParse({ moduleEmbedType: v });
		expect(result.success && result.data.moduleEmbedType).toBe(v);
	});

	it("rejects a module embed type that is not allowed", () => {
		const result = createElementSchema.safeParse({ moduleEmbedType: "OTHER" });
		expect(result.success).toBe(false);
		expect(firstIssue(result, "path")).toEqual(["moduleEmbedType"]);
	});
});

describe.each([
	["moveElementSchema", moveElementSchema],
	["attachElementSchema", attachElementSchema],
])("%s", (_name, schema) => {
	it("accepts a UUID parent and keeps it", () => {
		const result = schema.safeParse({ parentId: UUID });
		expect(result.success && result.data).toEqual({ parentId: UUID });
	});

	it("rejects a parent that is not a UUID with its own message", () => {
		const result = schema.safeParse({ parentId: "nope" });
		expect(result.success).toBe(false);
		expect(firstIssue(result, "message")).toBe("Invalid parent ID format");
		expect(firstIssue(result, "path")).toEqual(["parentId"]);
	});

	it("rejects a missing parent", () => {
		expect(schema.safeParse({}).success).toBe(false);
	});
});

describe("elementDescriptionFormSchema", () => {
	it("accepts a description of exactly two characters", () => {
		expect(
			elementDescriptionFormSchema.safeParse({ description: "ab" })
		).toMatchObject({ success: true, data: { description: "ab" } });
	});

	it("rejects a one-character description with its own message", () => {
		const result = elementDescriptionFormSchema.safeParse({ description: "a" });
		expect(result.success).toBe(false);
		expect(firstIssue(result, "message")).toBe(
			"Description must be at least 2 characters"
		);
	});
});

describe("elementAttributesFormSchema", () => {
	it("accepts and keeps the assumption, justification and context", () => {
		const input = { assumption: "a", justification: "j", context: ["c"] };
		const result = elementAttributesFormSchema.safeParse(input);
		expect(result.success && result.data).toEqual(input);
	});

	it("accepts no attributes at all", () => {
		expect(elementAttributesFormSchema.safeParse({}).success).toBe(true);
	});
});

describe("elementUrlsFormSchema", () => {
	it("accepts a list of entries with a value and keeps them", () => {
		const input = { urls: [{ value: "x" }, { value: "" }] };
		const result = elementUrlsFormSchema.safeParse(input);
		expect(result.success && result.data).toEqual(input);
	});

	it("rejects an entry that is a bare string or has an extra key", () => {
		expect(elementUrlsFormSchema.safeParse({ urls: ["x"] }).success).toBe(
			false
		);
		expect(
			elementUrlsFormSchema.safeParse({ urls: [{ value: "x", other: 1 }] })
				.success
		).toBe(false);
	});
});

describe("nodeEditFormSchema", () => {
	const base = { description: "ab", urls: [] };
	const parse = (extra: Record<string, unknown>) =>
		nodeEditFormSchema.safeParse({ ...base, ...extra });

	it("accepts and keeps a url entry", () => {
		const result = parse({ urls: [{ value: "x" }] });
		expect(result.success && result.data.urls).toEqual([{ value: "x" }]);
	});

	it("rejects a url entry that is a bare string or has an extra key", () => {
		expect(parse({ urls: ["x"] }).success).toBe(false);
		expect(parse({ urls: [{ value: "x", other: 1 }] }).success).toBe(false);
	});

	it("accepts a placeholder hint of 500 characters and rejects 501", () => {
		expect(parse({ placeholderHint: "h".repeat(500) }).success).toBe(true);
		const result = parse({ placeholderHint: "h".repeat(501) });
		expect(result.success).toBe(false);
		expect(firstIssue(result, "message")).toBe(
			"A hint must be 500 characters or fewer"
		);
	});

	it("accepts a short placeholder hint", () => {
		expect(parse({ placeholderHint: "short" }).success).toBe(true);
	});

	it("accepts a description of two characters after trimming", () => {
		expect(parse({ description: "  ab  " }).success).toBe(true);
	});

	it("counts the description without surrounding spaces", () => {
		expect(parse({ description: "a " }).success).toBe(false);
		expect(parse({ description: "  " }).success).toBe(false);
	});

	it("reports a short description against the description field with its own message", () => {
		const result = parse({ description: "a" });
		expect(result.success).toBe(false);
		expect(firstIssue(result, "path")).toEqual(["description"]);
		expect(firstIssue(result, "message")).toBe(
			"Description must be at least 2 characters"
		);
	});

	it("treats a description of only spaces as empty for a placeholder", () => {
		expect(parse({ description: "   ", isPlaceholder: true }).success).toBe(
			true
		);
		expect(parse({ description: "   " }).success).toBe(false);
	});

	it("accepts an empty description only when the element is a placeholder", () => {
		expect(parse({ description: "", isPlaceholder: true }).success).toBe(true);
		expect(parse({ description: "", isPlaceholder: false }).success).toBe(
			false
		);
		expect(parse({ description: "a", isPlaceholder: true }).success).toBe(
			false
		);
	});
});
