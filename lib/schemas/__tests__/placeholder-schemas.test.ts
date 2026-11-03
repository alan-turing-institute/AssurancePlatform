import { describe, expect, it } from "vitest";
import { CaseExportNestedSchema } from "../case-export";
import { nodeEditFormSchema } from "../element";

/**
 * Where a placeholder may appear: in a case file only from version 1.1, and in
 * the edit dialog's form with no text only while the element is a placeholder.
 */

function nestedFile(
	version: "1.0" | "1.1",
	nodeFields: Record<string, unknown>
) {
	return {
		version,
		exportedAt: "2030-01-01T00:00:00.000Z",
		case: { name: "A case", description: "About it" },
		tree: {
			id: "00000000-0000-4000-8000-000000000001",
			type: "GOAL",
			name: "G1",
			description: "The goal",
			inSandbox: false,
			children: [],
			...nodeFields,
		},
	};
}

describe("a case file with a placeholder", () => {
	it.each([
		["a marker", { isPlaceholder: true }],
		["a hint", { placeholderHint: "Say what to write" }],
	])("is refused as version 1.0 for %s, naming the field", (_label, fields) => {
		const result = CaseExportNestedSchema.safeParse(nestedFile("1.0", fields));

		expect(result.success).toBe(false);
		expect(result.error?.issues[0]?.message).toContain("placeholders");
		expect(result.error?.issues[0]?.path.slice(0, 2)).toEqual([
			"tree",
			Object.keys(fields)[0],
		]);
	});

	it("is accepted as version 1.1, and a file that marks nothing is still version 1.0", () => {
		const marked = nestedFile("1.1", {
			isPlaceholder: true,
			placeholderHint: "Say what to write",
		});

		expect(CaseExportNestedSchema.safeParse(marked).success).toBe(true);
		expect(
			CaseExportNestedSchema.safeParse(
				nestedFile("1.0", { isPlaceholder: false })
			).success
		).toBe(true);
	});
});

describe("nodeEditFormSchema description", () => {
	const form = { description: "", urls: [] };

	it("may be empty for a placeholder and not otherwise", () => {
		expect(
			nodeEditFormSchema.safeParse({ ...form, isPlaceholder: true }).success
		).toBe(true);
		expect(nodeEditFormSchema.safeParse(form).success).toBe(false);
	});

	it("still needs two characters once a placeholder has some text", () => {
		const result = nodeEditFormSchema.safeParse({
			...form,
			description: "x",
			isPlaceholder: true,
		});

		expect(result.error?.issues[0]?.message).toBe(
			"Description must be at least 2 characters"
		);
	});
});
