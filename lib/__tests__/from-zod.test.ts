import { describe, expect, it } from "vitest";
import { z } from "zod";
import { fromZod } from "@/scripts/openapi/from-zod";

describe("the Zod to OpenAPI 3.0 conversion", () => {
	it("marks a nullable field nullable and describes a transformed field by its input", () => {
		const schema = fromZod(
			z.object({
				note: z.string().nullable(),
				count: z
					.string()
					.trim()
					.transform((value) => value.length),
			})
		) as { properties: Record<string, Record<string, unknown>> };
		expect(schema.properties.note).toEqual({ nullable: true, type: "string" });
		expect(schema.properties.count).toEqual({ type: "string" });
	});

	it("leaves out a format's long pattern and the plain integer bounds", () => {
		const schema = fromZod(
			z.object({ id: z.uuid(), at: z.iso.datetime(), n: z.number().int() })
		) as { properties: Record<string, Record<string, unknown>> };
		expect(schema.properties.id).toEqual({ type: "string", format: "uuid" });
		expect(schema.properties.at).toEqual({
			type: "string",
			format: "date-time",
		});
		expect(schema.properties.n).toEqual({ type: "integer" });
	});

	it("stops on a recursive part that has no name", () => {
		interface Node {
			child?: Node;
		}
		const node: z.ZodType<Node> = z.object({
			child: z.lazy(() => node).optional(),
		});
		const body = z.object({ root: node });
		expect(() => fromZod(body)).toThrow("has no name");
		expect(JSON.stringify(fromZod(body, ["Node"]))).toContain(
			"#/components/schemas/Node"
		);
	});
});
