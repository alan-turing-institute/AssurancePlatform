import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { correctOpenApi } from "@/scripts/openapi/correct-openapi";
import { withPlainErrors } from "@/scripts/openapi/errors";
import { OPERATIONS, QUERY_PARAMETERS } from "@/scripts/openapi/operations";
import { REQUEST_BODIES } from "@/scripts/openapi/request-bodies";

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
	it("describes both import bodies as the nested or the flat case export", () => {
		const corrected = correctOpenApi(freshSpec()) as Json;
		for (const method of ["post", "put"]) {
			expect(
				corrected.paths["/cases/import"][method].requestBody.content[
					"application/json"
				].schema
			).toEqual({
				oneOf: [
					{ $ref: "#/components/schemas/CaseExport" },
					{ $ref: "#/components/schemas/CaseExportFlat" },
				],
			});
		}
	});

	it("gives the event stream and the account-link route an error body with a message and no code", () => {
		const corrected = correctOpenApi(freshSpec()) as Json;
		const events = corrected.paths["/cases/{id}/events"].get.responses;
		const link = corrected.paths["/auth/link/{provider}"].get.responses;
		for (const answer of [events["401"], link["400"]]) {
			expect(answer.content["application/json"].schema).toEqual({
				$ref: "#/components/schemas/ErrorMessage",
			});
		}
		expect(corrected.components.schemas.ErrorMessage.required).toEqual([
			"error",
		]);
		expect(corrected.paths["/teams"].post.responses["401"].$ref).toBe(
			"#/components/responses/401"
		);
	});

	it("replaces a request body the generator wrote with the table's, and drops one the table lacks", () => {
		const spec = freshSpec();
		spec.paths["/health"].get.requestBody = { content: {} };
		spec.paths["/teams"].post.requestBody = { content: {} };
		const corrected = correctOpenApi(spec) as Json;
		expect(corrected.paths["/health"].get.requestBody).toBeUndefined();
		expect(
			corrected.paths["/teams"].post.requestBody.content["application/json"]
				.schema.required
		).toEqual(["name"]);
	});

	it("gives the shared answers the error body, adds 413 and 429, and references them", () => {
		const spec = freshSpec();
		spec.components.responses = {
			"400": {
				description: "Bad Request",
				content: {
					"application/json": { schema: { type: "object", properties: {} } },
				},
			},
		};
		const corrected = correctOpenApi(spec) as Json;
		expect(Object.keys(corrected.components.responses)).toEqual([
			"400",
			"413",
			"429",
		]);
		expect(
			corrected.components.responses["400"].content["application/json"].schema
		).toEqual({ $ref: "#/components/schemas/ApiError" });
		expect(corrected.paths["/teams"].post.responses["413"]).toEqual({
			$ref: "#/components/responses/413",
		});
		expect(
			corrected.paths["/machine/whoami"].get.responses["429"]
		).toBeDefined();
		expect(corrected.paths["/health"].get.responses["413"]).toBeUndefined();
	});

	it("throws on a reference to a schema that does not exist", () => {
		const spec = freshSpec();
		spec.paths["/health"].get.responses["400"] = {
			description: "x",
			content: {
				"application/json": {
					schema: { $ref: "#/components/schemas/Teem" },
				},
			},
		};
		expect(() => correctOpenApi(spec)).toThrow("Teem");
	});

	it("throws on a missing schema referred to from a kept schema", () => {
		const spec = freshSpec();
		spec.components.schemas.Holder = {
			type: "object",
			properties: { inner: { $ref: "#/components/schemas/Gone" } },
		};
		spec.paths["/health"].get.responses["400"] = {
			description: "x",
			content: {
				"application/json": {
					schema: { $ref: "#/components/schemas/Holder" },
				},
			},
		};
		expect(() => correctOpenApi(spec)).toThrow("Gone");
	});

	it("throws when a shared answer has no description to reuse", () => {
		expect(() =>
			withPlainErrors(
				{ "400": { $ref: "#/components/responses/BadRequest" } },
				"GET /auth/link/{provider}",
				{}
			)
		).toThrow("no description for 400");
	});

	it("throws for a request body entry with no operation", () => {
		const entry = REQUEST_BODIES["POST /teams"];
		if (!entry) {
			throw new Error("fixture missing");
		}
		REQUEST_BODIES["POST /not-a-route"] = entry;
		try {
			expect(() => correctOpenApi(freshSpec())).toThrow("POST /not-a-route");
		} finally {
			Reflect.deleteProperty(REQUEST_BODIES, "POST /not-a-route");
		}
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
