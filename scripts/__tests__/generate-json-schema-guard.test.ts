import { describe, expect, it } from "vitest";
import { z } from "zod";
import { renameRecursiveDef } from "../generate-json-schema";

const GUARD_ERROR_PATTERN = /expected exactly one recursive definition/;
const PLACEHOLDER_PATTERN = /__schema\d+/;

/**
 * The __schema<n> -> TreeNode rename in generate-json-schema.ts assumes
 * exactly one recursive definition is reachable from the schema being
 * generated. These drive that assumption directly with small synthetic
 * schemas (rather than CaseExportNestedSchema, which only ever exercises
 * the "exactly one" case) to prove the guard actually fires.
 */
describe("renameRecursiveDef guard", () => {
	it("throws when two distinct recursive definitions are reachable", () => {
		// Two independent self-referential schemas, not one — z.toJSONSchema
		// extracts each into its own `__schema<n>` definition.
		const nodeA: z.ZodType<unknown> = z.lazy(() =>
			z.object({ a: z.array(nodeA) })
		);
		const nodeB: z.ZodType<unknown> = z.lazy(() =>
			z.object({ b: z.array(nodeB) })
		);
		const wrapper = z.object({ left: nodeA, right: nodeB });
		const generated = z.toJSONSchema(wrapper, {
			target: "draft-7",
		}) as Record<string, unknown>;

		expect(() => renameRecursiveDef(generated, "TreeNode")).toThrow(
			GUARD_ERROR_PATTERN
		);
	});

	it("throws when there is no recursive definition to rename", () => {
		const wrapper = z.object({ flat: z.string() });
		const generated = z.toJSONSchema(wrapper, {
			target: "draft-7",
		}) as Record<string, unknown>;

		expect(() => renameRecursiveDef(generated, "TreeNode")).toThrow(
			GUARD_ERROR_PATTERN
		);
	});

	it("renames the single recursive definition, def and every $ref, when exactly one is reachable", () => {
		const node: z.ZodType<unknown> = z.lazy(() =>
			z.object({ children: z.array(node) })
		);
		const wrapper = z.object({ tree: node });
		const generated = z.toJSONSchema(wrapper, {
			target: "draft-7",
		}) as Record<string, unknown>;

		const renamed = renameRecursiveDef(generated, "TreeNode");
		const serialized = JSON.stringify(renamed);

		expect(renamed.definitions).toHaveProperty("TreeNode");
		expect(serialized).toContain("#/definitions/TreeNode");
		expect(serialized).not.toMatch(PLACEHOLDER_PATTERN);
	});
});
