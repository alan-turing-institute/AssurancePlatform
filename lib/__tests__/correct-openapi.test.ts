import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { correctOpenApi } from "@/scripts/openapi/correct-openapi";
import { OPERATIONS, QUERY_PARAMETERS } from "@/scripts/openapi/operations";

type Json = Record<string, any>;

const SPEC_PATH = path.resolve(
	import.meta.dirname,
	"../../public/openapi.json"
);

function freshSpec(): Json {
	return JSON.parse(readFileSync(SPEC_PATH, "utf8")) as Json;
}

function schemaOf(document: Json, route: string, method: string): Json {
	return document.paths[route][method].responses["200"].content[
		"application/json"
	].schema;
}

describe("the correction step", () => {
	it("replaces the two import references that point at nothing", () => {
		const spec = freshSpec();
		const body = {
			content: {
				"application/json": {
					schema: { $ref: "#/components/schemas/JSON case data to validate" },
				},
			},
		};
		spec.paths["/cases/import"].put.requestBody = body;
		spec.paths["/cases/import"].post.requestBody = {
			content: {
				"application/json": {
					schema: {
						$ref: "#/components/schemas/JSON case data in any supported format",
					},
				},
			},
		};
		const corrected = correctOpenApi(spec) as Json;
		expect(
			corrected.paths["/cases/import"].put.requestBody.content[
				"application/json"
			].schema
		).toEqual({ type: "object" });
		expect(
			corrected.paths["/cases/import"].post.requestBody.content[
				"application/json"
			].schema
		).toEqual({ type: "object" });
	});

	it("throws on a reference to any other missing schema", () => {
		const spec = freshSpec();
		spec.paths["/health"].get.requestBody = {
			content: {
				"application/json": {
					schema: { $ref: "#/components/schemas/Teem" },
				},
			},
		};
		expect(() => correctOpenApi(spec)).toThrow("Teem");
	});

	it("throws when a table entry names a schema that does not exist", () => {
		const original = OPERATIONS["GET /health"];
		OPERATIONS["GET /health"] = [
			{
				status: 200,
				description: "x",
				contentType: "application/json",
				schema: { $ref: "#/components/schemas/Teem" },
			},
		];
		try {
			expect(() => correctOpenApi(freshSpec())).toThrow("Teem");
		} finally {
			OPERATIONS["GET /health"] = original ?? [];
		}
	});

	it("keeps a table schema that refers to a defined one", () => {
		expect(
			schemaOf(correctOpenApi(freshSpec()) as Json, "/cases/import", "post")
		).toEqual({ $ref: "#/components/schemas/ImportResult" });
	});

	it("throws for an operation with no table entry", () => {
		const spec = freshSpec();
		spec.paths["/brand-new"] = { get: { responses: {} } };
		expect(() => correctOpenApi(spec)).toThrow("GET /brand-new");
	});

	it("throws for a table entry with no operation", () => {
		const spec = freshSpec();
		Reflect.deleteProperty(spec.paths, "/health");
		expect(() => correctOpenApi(spec)).toThrow("GET /health");
	});

	it("throws for a query parameter entry with no operation", () => {
		QUERY_PARAMETERS["GET /not-a-route"] = [];
		try {
			expect(() => correctOpenApi(freshSpec())).toThrow("GET /not-a-route");
		} finally {
			Reflect.deleteProperty(QUERY_PARAMETERS, "GET /not-a-route");
		}
	});
});
