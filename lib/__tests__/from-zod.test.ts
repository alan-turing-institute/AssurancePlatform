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
		const schema = fromZod(z.object({ id: z.uuid(), n: z.number().int() })) as {
			properties: Record<string, Record<string, unknown>>;
		};
		expect(schema.properties.id).toEqual({ type: "string", format: "uuid" });
		expect(schema.properties.n).toEqual({ type: "integer" });
	});

	it("keeps a short UTC-only rule for a date-time that refuses offsets, and none for one that allows them", () => {
		const schema = fromZod(
			z.object({
				utc: z.string().datetime(),
				any: z.string().datetime({ offset: true }),
			})
		) as { properties: Record<string, Record<string, string>> };
		const utc = schema.properties.utc ?? {};
		expect(utc.format).toBe("date-time");
		expect(utc.description).toContain("UTC");
		const pattern = new RegExp(utc.pattern ?? "(?!)");
		expect(pattern.test("2026-11-15T10:00:00Z")).toBe(true);
		expect(pattern.test("2026-11-15T10:00:00.250Z")).toBe(true);
		expect(pattern.test("2026-11-15T10:00:00+01:00")).toBe(false);
		expect(schema.properties.any).toEqual({
			type: "string",
			format: "date-time",
		});
	});

	it("stops on a date-time field that fixes its precision", () => {
		expect(() =>
			fromZod(z.object({ at: z.iso.datetime({ precision: 3 }) }))
		).toThrow("fixes its precision");
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
