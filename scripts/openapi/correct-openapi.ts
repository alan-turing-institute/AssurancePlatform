/**
 * Corrects the OpenAPI document that `next-openapi-gen` writes to
 * public/openapi.json. Run straight after the generator by
 * `pnpm docs:generate`.
 *
 * The step is pure and idempotent: the same input gives the same output, and
 * running it on its own output changes nothing. It writes keys in a fixed
 * order so the committed file is byte-identical from run to run.
 *
 * It corrects only what the generator cannot express: each operation's
 * success answers (taken from operations.ts), a path parameter for every
 * `{name}` in a path, the schemas those answers refer to, and references that
 * point at nothing. Anything the generator reads correctly is fixed in the
 * route's comment instead.
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
	OPERATIONS,
	QUERY_PARAMETERS,
	type QueryParameter,
	SCHEMAS,
	type Schema,
	type SuccessAnswer,
} from "./operations";

type Json = Record<string, unknown>;
export type OpenApiDocument = Json;

const SPEC_PATH = path.join(
	import.meta.dirname,
	"..",
	"..",
	"public",
	"openapi.json"
);

const METHOD_ORDER = [
	"get",
	"put",
	"post",
	"delete",
	"options",
	"head",
	"patch",
	"trace",
];
const OPERATION_KEY_ORDER = [
	"operationId",
	"summary",
	"description",
	"tags",
	"security",
	"parameters",
	"requestBody",
	"responses",
];
const TOP_LEVEL_ORDER = ["openapi", "info", "servers", "components", "paths"];
const COMPONENT_ORDER = ["securitySchemes", "schemas", "responses"];
const SCHEMA_REF_PREFIX = "#/components/schemas/";
const OPEN_OBJECT: Schema = { type: "object" };
const PATH_PARAMETER = /\{([^}]+)\}/g;

function asRecord(value: unknown): Json {
	return (value ?? {}) as Json;
}

function isSuccessCode(code: string): boolean {
	return code.startsWith("2") || code.startsWith("3");
}

function sortedKeys(record: Json): string[] {
	return Object.keys(record).sort();
}

function orderKeys(record: Json, preferred: string[]): Json {
	const ordered: Json = {};
	for (const key of preferred) {
		if (key in record) {
			ordered[key] = record[key];
		}
	}
	for (const key of sortedKeys(record)) {
		if (!(key in ordered)) {
			ordered[key] = record[key];
		}
	}
	return ordered;
}

/** The names inside `{}` in a path, in order of appearance. */
export function pathParameterNames(routePath: string): string[] {
	return [...routePath.matchAll(PATH_PARAMETER)].map((match) => match[1] ?? "");
}

function pathParameter(name: string): Json {
	return { name, in: "path", required: true, schema: { type: "string" } };
}

function queryParameter(parameter: QueryParameter): Json {
	return {
		name: parameter.name,
		in: "query",
		required: parameter.required === true,
		description: parameter.description,
		schema: parameter.schema,
	};
}

/**
 * Lists exactly one parameter per path name, then the query parameters in
 * the table, then any parameter of another kind the generator wrote.
 */
function withParameters(
	parameters: unknown,
	routePath: string,
	queries: QueryParameter[]
): Json[] {
	const others = ((parameters ?? []) as Json[]).filter(
		(parameter) => parameter.in !== "path" && parameter.in !== "query"
	);
	return [
		...pathParameterNames(routePath).map(pathParameter),
		...queries.map(queryParameter),
		...others,
	];
}

function answerBody(answer: SuccessAnswer): Json {
	if (!(answer.contentType && answer.schema)) {
		return { description: answer.description };
	}
	return {
		description: answer.description,
		content: { [answer.contentType]: { schema: answer.schema } },
	};
}

function withSuccessAnswers(
	responses: unknown,
	answers: SuccessAnswer[]
): Json {
	const kept = Object.entries(asRecord(responses)).filter(
		([code]) => !isSuccessCode(code)
	);
	const entries = [
		...answers.map((answer) => [String(answer.status), answerBody(answer)]),
		...kept,
	] as [string, unknown][];
	entries.sort(([a], [b]) => a.localeCompare(b));
	return Object.fromEntries(entries);
}

function correctOperation(
	operation: Json,
	routePath: string,
	method: string,
	answers: SuccessAnswer[]
): Json {
	const queries = QUERY_PARAMETERS[operationKey(method, routePath)] ?? [];
	return orderKeys(
		{
			...operation,
			parameters: withParameters(operation.parameters, routePath, queries),
			responses: withSuccessAnswers(operation.responses, answers),
		},
		OPERATION_KEY_ORDER
	);
}

function operationKey(method: string, routePath: string): string {
	return `${method.toUpperCase()} ${routePath}`;
}

function correctPathItem(routePath: string, item: Json, unknown: string[]) {
	const methods = Object.keys(item).sort(
		(a, b) => METHOD_ORDER.indexOf(a) - METHOD_ORDER.indexOf(b)
	);
	const corrected: Json = {};
	for (const method of methods) {
		const key = operationKey(method, routePath);
		const answers = OPERATIONS[key];
		if (answers) {
			corrected[method] = correctOperation(
				asRecord(item[method]),
				routePath,
				method,
				answers
			);
		} else {
			unknown.push(key);
		}
	}
	return corrected;
}

function correctPaths(paths: Json): Json {
	const missing: string[] = [];
	const corrected: Json = {};
	for (const routePath of sortedKeys(paths)) {
		corrected[routePath] = correctPathItem(
			routePath,
			asRecord(paths[routePath]),
			missing
		);
	}
	if (missing.length > 0) {
		throw new Error(
			`No entry in scripts/openapi/operations.ts for: ${missing.join(", ")}`
		);
	}
	return corrected;
}

function checkTableHasNoStrays(paths: Json): void {
	const present = new Set<string>();
	for (const [routePath, item] of Object.entries(paths)) {
		for (const method of Object.keys(asRecord(item))) {
			present.add(operationKey(method, routePath));
		}
	}
	const stray = Object.keys(OPERATIONS).filter((key) => !present.has(key));
	if (stray.length > 0) {
		throw new Error(
			`Entries in scripts/openapi/operations.ts with no operation: ${stray.join(", ")}`
		);
	}
}

function collectRefs(node: unknown, found: Set<string>): void {
	if (Array.isArray(node)) {
		for (const child of node) {
			collectRefs(child, found);
		}
		return;
	}
	if (node === null || typeof node !== "object") {
		return;
	}
	for (const [key, value] of Object.entries(node)) {
		if (key === "$ref" && typeof value === "string") {
			found.add(value);
		} else {
			collectRefs(value, found);
		}
	}
}

function schemaName(refValue: string): string | null {
	return refValue.startsWith(SCHEMA_REF_PREFIX)
		? refValue.slice(SCHEMA_REF_PREFIX.length)
		: null;
}

/** Replaces a reference to a schema that does not exist with an open object. */
function closeDanglingRefs(node: unknown, schemas: Json): unknown {
	if (Array.isArray(node)) {
		return node.map((child) => closeDanglingRefs(child, schemas));
	}
	if (node === null || typeof node !== "object") {
		return node;
	}
	const record = node as Json;
	const name = typeof record.$ref === "string" ? schemaName(record.$ref) : null;
	if (name !== null && !(name in schemas)) {
		return { ...OPEN_OBJECT };
	}
	return Object.fromEntries(
		Object.entries(record).map(([key, value]) => [
			key,
			closeDanglingRefs(value, schemas),
		])
	);
}

/** The schemas reachable from the paths and from the other components. */
function reachableSchemas(document: Json, schemas: Json): Set<string> {
	const roots = new Set<string>();
	collectRefs(document.paths, roots);
	collectRefs(asRecord(document.components).responses, roots);
	const reached = new Set<string>();
	const queue = [...roots];
	while (queue.length > 0) {
		const name = schemaName(queue.pop() as string);
		if (name === null || reached.has(name) || !(name in schemas)) {
			continue;
		}
		reached.add(name);
		const inner = new Set<string>();
		collectRefs(schemas[name], inner);
		queue.push(...inner);
	}
	return reached;
}

function pruneSchemas(document: Json, schemas: Json): Json {
	const reached = reachableSchemas(document, schemas);
	const kept: Json = {};
	for (const name of sortedKeys(schemas)) {
		if (reached.has(name)) {
			kept[name] = schemas[name];
		}
	}
	return kept;
}

function correctComponents(components: Json, schemas: Json): Json {
	return orderKeys({ ...components, schemas }, COMPONENT_ORDER);
}

/**
 * Returns the corrected document. The input is not changed.
 */
export function correctOpenApi(input: OpenApiDocument): OpenApiDocument {
	const document = structuredClone(input);
	const paths = correctPaths(asRecord(document.paths));
	checkTableHasNoStrays(paths);
	const components = asRecord(document.components);
	const known = { ...asRecord(components.schemas), ...SCHEMAS };
	const closedPaths = closeDanglingRefs(paths, known) as Json;
	const withPaths = { ...document, paths: closedPaths };
	const schemas = pruneSchemas(withPaths, known);
	return orderKeys(
		{ ...withPaths, components: correctComponents(components, schemas) },
		TOP_LEVEL_ORDER
	);
}

/** The text written to public/openapi.json. */
export function serialiseOpenApi(document: OpenApiDocument): string {
	return JSON.stringify(document, null, 2);
}

function main(): void {
	const current = JSON.parse(readFileSync(SPEC_PATH, "utf8")) as Json;
	writeFileSync(SPEC_PATH, serialiseOpenApi(correctOpenApi(current)));
}

// Runs main() when invoked directly (tsx/pnpm) but not when imported by a test.
if (import.meta.url === `file://${process.argv[1]}`) {
	main();
}
