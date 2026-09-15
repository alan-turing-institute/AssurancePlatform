import { describe, expect, it } from "vitest";
import { generateJsonSchema } from "../../../scripts/generate-json-schema";
import committedSchema from "../json-schema-v1.0.json";

/**
 * ADR 0004 D1: lib/schemas/json-schema-v1.0.json is a generated artifact,
 * never hand-maintained. This fails whenever the committed file and a
 * fresh regeneration disagree — a hand-edit of the JSON file, or a change
 * to CaseExportNestedSchema (or anything it references) that nobody ran
 * `pnpm schema:generate` for afterwards.
 */
describe("json-schema-v1.0.json drift", () => {
	it("matches a fresh generation from CaseExportNestedSchema", () => {
		const fresh = generateJsonSchema();
		expect(committedSchema).toEqual(fresh);
	});

	it("targets draft-07, the dialect the JSON editor's resolver supports", () => {
		// codemirror-json-schema -> json-schema-library only ships draft-04/06/07
		// resolvers; draft 2020-12 ($defs, prefixItems) would break $ref
		// resolution, hover and completion in the editor silently.
		expect(committedSchema.$schema).toBe(
			"http://json-schema.org/draft-07/schema#"
		);
		expect(committedSchema).toHaveProperty("definitions");
		expect(committedSchema).not.toHaveProperty("$defs");
	});
});
