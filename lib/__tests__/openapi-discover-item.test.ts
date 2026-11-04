import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

interface Operation {
	description?: string;
	tags?: string[];
}

interface OpenApiDocument {
	paths: Record<string, { get?: Operation } | undefined>;
}

const SPEC_PATH = path.resolve(
	import.meta.dirname,
	"../../public/openapi.json"
);
const ITEM_PATH = "/public/discover/{slug}";
const AS_STORED = /\bstored\b/i;
const HTML_MARKUP = /\bHTML\b/;

function itemOperation(): Operation | undefined {
	const spec = JSON.parse(readFileSync(SPEC_PATH, "utf8")) as OpenApiDocument;
	return spec.paths[ITEM_PATH]?.get;
}

describe("public Discover item route in the OpenAPI document", () => {
	it("has a description", () => {
		expect(itemOperation()?.description?.trim()).toBeTruthy();
	});

	it("says its text is returned as the publisher stored it", () => {
		expect(itemOperation()?.description).toMatch(AS_STORED);
	});

	it("warns that stored text may contain HTML", () => {
		expect(itemOperation()?.description).toMatch(HTML_MARKUP);
	});
});
