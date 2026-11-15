/**
 * Turns the repository's Zod schemas into OpenAPI 3.0 schemas, so a request
 * body in the published description is the schema its route validates with.
 *
 * `z.toJSONSchema` is asked for the OpenAPI 3.0 dialect (a nullable field gets
 * `nullable: true`) and for the shape a caller sends (`io: "input"`), which
 * lets a field that is transformed or has a default be described by what goes
 * in. Anything with no JSON form becomes an unconstrained schema rather than an
 * error. Recursive parts are collected as named component schemas.
 */

import { z } from "zod";

export type Schema = Record<string, unknown>;

type Json = Record<string, unknown>;

const SCHEMA_REF_PREFIX = "#/components/schemas/";
const DEFINITION_REF_PREFIX = "#/definitions/";
const PLACEHOLDER = /^__schema(\d+)$/;
const FORMATS_WITH_OWN_PATTERN = new Set([
	"date-time",
	"email",
	"uri",
	"uuid",
	"date",
	"time",
]);

/** Component schemas collected from recursive parts, by name. */
export const DEFINITIONS: Record<string, Schema> = {};

function isRecord(node: unknown): node is Json {
	return node !== null && typeof node === "object" && !Array.isArray(node);
}

/** The bounds Zod writes for a plain integer carry no information. */
function isSafeIntegerBound(key: string, value: unknown): boolean {
	return (
		(key === "maximum" && value === Number.MAX_SAFE_INTEGER) ||
		(key === "minimum" && value === Number.MIN_SAFE_INTEGER)
	);
}

/** A format such as `uuid` already says what its long pattern says. */
function isFormatPattern(key: string, node: Json): boolean {
	return (
		key === "pattern" &&
		typeof node.format === "string" &&
		FORMATS_WITH_OWN_PATTERN.has(node.format)
	);
}

function refTarget(value: string, names: Map<string, string>): string {
	const name = names.get(value.slice(DEFINITION_REF_PREFIX.length));
	if (!value.startsWith(DEFINITION_REF_PREFIX) || name === undefined) {
		throw new Error(`A recursive schema has no name: ${value}`);
	}
	return `${SCHEMA_REF_PREFIX}${name}`;
}

function rewriteEntry(
	key: string,
	value: unknown,
	node: Json,
	names: Map<string, string>
): [string, unknown][] {
	if (isSafeIntegerBound(key, value) || isFormatPattern(key, node)) {
		return [];
	}
	if (key === "$ref" && typeof value === "string") {
		return [[key, refTarget(value, names)]];
	}
	return [[key, rewrite(value, names)]];
}

function rewrite(node: unknown, names: Map<string, string>): unknown {
	if (Array.isArray(node)) {
		return node.map((child) => rewrite(child, names));
	}
	if (!isRecord(node)) {
		return node;
	}
	return Object.fromEntries(
		Object.entries(node).flatMap(([key, value]) =>
			rewriteEntry(key, value, node, names)
		)
	);
}

function register(name: string, schema: Schema): void {
	const existing = DEFINITIONS[name];
	if (existing && JSON.stringify(existing) !== JSON.stringify(schema)) {
		throw new Error(`Two different schemas are both named ${name}`);
	}
	DEFINITIONS[name] = schema;
}

/** Maps each placeholder index Zod used to the name the caller gave it. */
function nameDefinitions(
	definitions: Json,
	given: string[]
): Map<string, string> {
	const names = new Map<string, string>();
	for (const placeholder of Object.keys(definitions)) {
		const index = PLACEHOLDER.exec(placeholder)?.[1];
		const name = index === undefined ? undefined : given[Number(index)];
		if (name === undefined) {
			throw new Error(`A recursive schema has no name: ${placeholder}`);
		}
		names.set(placeholder, name);
	}
	return names;
}

/**
 * The OpenAPI 3.0 schema for `schema`. `definitionNames` names, in order, the
 * recursive parts Zod pulls out; each becomes a component schema.
 */
export function fromZod(
	schema: z.ZodType,
	definitionNames: string[] = []
): Schema {
	const raw = z.toJSONSchema(schema, {
		target: "openapi-3.0",
		io: "input",
		unrepresentable: "any",
		reused: "inline",
		cycles: "ref",
	}) as Json;
	const { definitions, ...main } = raw;
	const parts = isRecord(definitions) ? definitions : {};
	const names = nameDefinitions(parts, definitionNames);
	for (const [placeholder, definition] of Object.entries(parts)) {
		register(
			names.get(placeholder) ?? placeholder,
			rewrite(definition, names) as Schema
		);
	}
	return rewrite(main, names) as Schema;
}
