import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cronDryRunQuerySchema } from "@/lib/schemas/cron-dry-run";
import { evidenceListQuerySchema } from "@/lib/schemas/health-evidence";
import {
	detectAndValidate,
	detectVersion,
} from "@/lib/schemas/version-detection";
import {
	correctOpenApi,
	serialiseOpenApi,
} from "@/scripts/openapi/correct-openapi";
import { OPERATIONS } from "@/scripts/openapi/operations";
import { REQUEST_BODIES } from "@/scripts/openapi/request-bodies";

/**
 * The published API description (public/openapi.json) must say what the
 * routes do. Each check reads the route files' source and compares it with
 * the description, so a route that drifts from the description, or a new
 * route without an entry, fails here.
 */

type Json = Record<string, unknown>;

const ROOT = path.resolve(import.meta.dirname, "../..");
const API_DIR = path.join(ROOT, "app/api");
const SPEC_TEXT = readFileSync(path.join(ROOT, "public/openapi.json"), "utf8");
const SPEC = JSON.parse(SPEC_TEXT) as Json;
const METHODS = ["GET", "PUT", "POST", "DELETE", "PATCH", "OPTIONS", "HEAD"];
const STATUS_OPTION = /status:\s*([^},]*(?:\?[^},]*)?)/;
const SUCCESS_CODE = /^[23]/;
const AUTH_LIBRARY_DIR = "[...nextauth]";
const HANDLER = new RegExp(
	`^export (?:async )?(?:function|const) (${METHODS.join("|")})\\b`
);
const TOP_LEVEL_START =
	/\n(?=(?:\/\*\*|export |async function |function |const |let |interface |type |class ))/;

/** Success codes of handlers that answer through a helper the parser cannot see into. */
const HELPER_CODES: Record<string, number[]> = {
	"mediaResponse(": [200, 304],
	"createUIMessageStreamResponse(": [200],
	"answerCriteriaRead(": [200],
	"answerCriteriaChange(": [200],
};

const REDIRECT_DEFAULT = 307;

interface Handler {
	/** "METHOD /path", as the description writes it. */
	id: string;
	/** Names of the file's own functions and constants that hold the `RATE_LIMITED` code. */
	rateLimitedNames: string[];
	/** Text of the handler and of every function in its file that it calls, directly or not. */
	reach: string;
	text: string;
}

function walk(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const full = path.join(dir, entry.name);
		return entry.isDirectory() ? walk(full) : [full];
	});
}

function routePath(file: string): string {
	const dir = path.dirname(path.relative(API_DIR, file));
	return `/${dir
		.split(path.sep)
		.join("/")
		.replace(/\[([^\]]+)\]/g, "{$1}")}`;
}

const LOCAL_FUNCTION = /^(?:async )?function (\w+)|^const (\w+) = /;
const EXPORT_PREFIX = /^export /;

function localFunctions(
	blocks: string[],
	includeExported = false
): Map<string, string> {
	const local = new Map<string, string>();
	for (const block of blocks) {
		const match = LOCAL_FUNCTION.exec(
			includeExported ? block.replace(EXPORT_PREFIX, "") : block
		);
		const name = match?.[1] ?? match?.[2];
		if (name) {
			local.set(name, block);
		}
	}
	return local;
}

function reachableText(start: string, local: Map<string, string>): string {
	const seen = new Set<string>();
	const texts = [start];
	for (const text of texts) {
		for (const [name, body] of local) {
			if (!seen.has(name) && text.includes(`${name}(`)) {
				seen.add(name);
				texts.push(body);
			}
		}
	}
	return texts.join("\n");
}

/** Where a comment that starts at `i` ends, or -1 when none starts there. */
function commentEnd(text: string, i: number): number {
	if (text.startsWith("//", i)) {
		const lineEnd = text.indexOf("\n", i);
		return lineEnd === -1 ? text.length : lineEnd;
	}
	if (text.startsWith("/*", i)) {
		const close = text.indexOf("*/", i + 2);
		return close === -1 ? text.length : close + 2;
	}
	return -1;
}

/** The code with every `//` and block comment removed; quoted text is kept whole. */
function stripComments(text: string): string {
	let out = "";
	let quote = "";
	let i = 0;
	while (i < text.length) {
		const char = text.charAt(i);
		const end = quote ? -1 : commentEnd(text, i);
		if (end !== -1) {
			out += " ";
			i = end;
			continue;
		}
		if (quote) {
			quote = char === quote && text[i - 1] !== "\\" ? "" : quote;
		} else if ("\"'`".includes(char)) {
			quote = char;
		}
		out += char;
		i++;
	}
	return out;
}

function handlersIn(file: string): Handler[] {
	return handlersInSource(readFileSync(file, "utf8"), routePath(file));
}

function handlersInSource(source: string, route: string): Handler[] {
	const blocks = source.split(TOP_LEVEL_START);
	const code = blocks.map(stripComments);
	const local = localFunctions(code);
	const found: Handler[] = [];
	code.forEach((block, i) => {
		const method = HANDLER.exec(block)?.[1];
		const before = blocks[i - 1] ?? "";
		const ignored = before.startsWith("/**") && before.includes("@ignore");
		if (method && !ignored) {
			found.push({
				id: `${method} ${route}`,
				text: block,
				reach: reachableText(block, local),
				rateLimitedNames: [...local.entries()]
					.filter(([, body]) => body.includes('"RATE_LIMITED"'))
					.map(([name]) => name),
			});
		}
	});
	return found;
}

function allHandlers(): Handler[] {
	return walk(API_DIR)
		.filter((file) => file.endsWith("route.ts"))
		.filter((file) => !file.includes(AUTH_LIBRARY_DIR))
		.flatMap(handlersIn);
}

/** The text between the parenthesis opened at `open` and its match. */
function argumentsAt(text: string, open: number): string {
	let depth = 0;
	let quote = "";
	for (let i = open; i < text.length; i++) {
		const char = text.charAt(i);
		if (quote) {
			quote = char === quote && text[i - 1] !== "\\" ? "" : quote;
		} else if ("\"'`".includes(char)) {
			quote = char;
		} else if ("([{".includes(char)) {
			depth++;
		} else if (")]}".includes(char) && --depth === 0) {
			return text.slice(open + 1, i);
		}
	}
	return text.slice(open + 1);
}

function topLevelArguments(args: string): string[] {
	const parts: string[] = [];
	let depth = 0;
	let quote = "";
	let start = 0;
	for (let i = 0; i < args.length; i++) {
		const char = args.charAt(i);
		if (quote) {
			quote = char === quote && args[i - 1] !== "\\" ? "" : quote;
		} else if ("\"'`".includes(char)) {
			quote = char;
		} else if ("([{".includes(char)) {
			depth++;
		} else if (")]}".includes(char)) {
			depth--;
		} else if (char === "," && depth === 0) {
			parts.push(args.slice(start, i));
			start = i + 1;
		}
	}
	parts.push(args.slice(start));
	return parts;
}

function calls(text: string, opener: string): string[][] {
	const found: string[][] = [];
	let from = text.indexOf(opener);
	while (from !== -1) {
		const open = from + opener.length - 1;
		found.push(topLevelArguments(argumentsAt(text, open)));
		from = text.indexOf(opener, from + opener.length);
	}
	return found;
}

function successNumbers(expression: string): number[] {
	return (expression.match(/\b[23]\d\d\b/g) ?? []).map(Number);
}

function apiSuccessCodes(text: string): number[] {
	return calls(text, "apiSuccess(").flatMap((args) =>
		args.length > 1 ? successNumbers(args[1] ?? "") : [200]
	);
}

function optionStatusCodes(options: string | undefined): number[] {
	const status = options?.match(STATUS_OPTION);
	return status ? successNumbers(status[1] ?? "") : [200];
}

function directResponseCodes(text: string): number[] {
	const openers = ["NextResponse.json(", "new Response(", "new NextResponse("];
	return openers.flatMap((opener) =>
		calls(text, opener).flatMap((args) => optionStatusCodes(args[1]))
	);
}

function helperCodes(text: string): number[] {
	return Object.entries(HELPER_CODES)
		.filter(([name]) => text.includes(name))
		.flatMap(([, codes]) => codes);
}

/** The status in a redirect's second argument: a number, or a `status` option; 307 otherwise. */
function redirectStatus(argument: string | undefined): number[] {
	const text = argument?.trim() ?? "";
	const named = text.startsWith("{")
		? (STATUS_OPTION.exec(text)?.[1] ?? "")
		: text;
	const codes = successNumbers(named);
	return codes.length > 0 ? codes : [REDIRECT_DEFAULT];
}

function redirectCodes(text: string): number[] {
	return calls(text, "NextResponse.redirect(").flatMap((args) =>
		redirectStatus(args[1])
	);
}

function handlerSuccessCodes(handler: Handler): number[] {
	const codes = [
		...apiSuccessCodes(handler.text),
		...directResponseCodes(handler.text),
		...helperCodes(handler.text),
		...redirectCodes(handler.text),
	];
	return [...new Set(codes)].sort((a, b) => a - b);
}

function operations(): [string, Json][] {
	const found: [string, Json][] = [];
	const paths = SPEC.paths as Record<string, Record<string, Json>>;
	for (const [routePathName, item] of Object.entries(paths)) {
		for (const [method, operation] of Object.entries(item)) {
			found.push([`${method.toUpperCase()} ${routePathName}`, operation]);
		}
	}
	return found;
}

function documentedSuccessCodes(operation: Json): number[] {
	return Object.keys(operation.responses as Json)
		.filter((code) => SUCCESS_CODE.test(code))
		.map(Number)
		.sort((a, b) => a - b);
}

function refsIn(node: unknown, found: string[] = []): string[] {
	if (Array.isArray(node)) {
		for (const child of node) {
			refsIn(child, found);
		}
	} else if (node && typeof node === "object") {
		for (const [key, value] of Object.entries(node)) {
			if (key === "$ref" && typeof value === "string") {
				found.push(value);
			} else {
				refsIn(value, found);
			}
		}
	}
	return found;
}

function resolves(ref: string): boolean {
	if (!ref.startsWith("#/")) {
		return false;
	}
	let node: unknown = SPEC;
	for (const part of ref.slice(2).split("/")) {
		const key = decodeURIComponent(part)
			.replace(/~1/g, "/")
			.replace(/~0/g, "~");
		node = (node as Json | undefined)?.[key];
		if (node === undefined) {
			return false;
		}
	}
	return true;
}

/** Any use of `searchParams` other than building a URL with `.set(`. */
const READS_QUERY = /searchParams(?!\.set\()/;
const QUERY_GET = /searchParams\.get\("([^"]+)"\)/g;

/** Query parameters read through a schema rather than by name. */
const SCHEMA_QUERY_NAMES: Record<string, string[]> = {
	"parseCronDryRunQuery(": Object.keys(cronDryRunQuerySchema.shape),
	"parseHealthEvidenceThinningQuery(": [
		...Object.keys(cronDryRunQuerySchema.shape),
		"now",
	],
	"evidenceListQuerySchema.safeParse(": Object.keys(
		evidenceListQuerySchema.shape
	),
};

function queryNamesRead(handler: Handler): string[] {
	const named = [...handler.reach.matchAll(QUERY_GET)].map((m) => m[1] ?? "");
	const fromSchemas = Object.entries(SCHEMA_QUERY_NAMES)
		.filter(([marker]) => handler.reach.includes(marker))
		.flatMap(([, names]) => names);
	return [...new Set([...named, ...fromSchemas])].sort();
}

/** Handlers that touch the query string but yielded no parameter names. */
function unreadQueryStrings(handlers: Handler[]): string[] {
	return handlers
		.filter(
			(handler) =>
				READS_QUERY.test(handler.reach) && queryNamesRead(handler).length === 0
		)
		.map((handler) => handler.id);
}

/** Reads the checks cannot follow: a built `URLSearchParams`, or a method other than `.get("name")` and `.set(`. */
const UNFOLLOWABLE_QUERY_READ =
	/new URLSearchParams\(|searchParams\.(?!get\("[^"]+"\)|set\()\w+\(/;

function unfollowableQueryReads(handlers: Handler[]): string[] {
	return handlers
		.filter((handler) => UNFOLLOWABLE_QUERY_READ.test(handler.reach))
		.map((handler) => handler.id);
}

function documentedQueryNames(operation: Json): string[] {
	return ((operation.parameters ?? []) as Json[])
		.filter((parameter) => parameter.in === "query")
		.map((parameter) => parameter.name as string)
		.sort();
}

const SERVICES_DIR = path.join(ROOT, "lib/services");

/**
 * The service functions that check the scheduled-job secret themselves, found
 * by reading which functions in lib/services reach `requireCronSecret(`.
 */
function cronGuardedServiceCalls(): string[] {
	return walk(SERVICES_DIR)
		.filter((file) => file.endsWith(".ts"))
		.flatMap((file) => {
			const local = localFunctions(
				stripComments(readFileSync(file, "utf8")).split(TOP_LEVEL_START),
				true
			);
			return [...local.entries()]
				.filter(([, body]) =>
					reachableText(body, local).includes("requireCronSecret(")
				)
				.map(([name]) => `${name}(`);
		});
}

const LIB_DIR = path.join(ROOT, "lib");

/**
 * The calls that can end in a rate limited answer: `apiRateLimited(` itself and
 * every function in lib/ whose body reaches it or names the `RATE_LIMITED` code.
 */
function rateLimitedCalls(): string[] {
	const names = walk(LIB_DIR)
		.filter((file) => file.endsWith(".ts") && !file.includes("__tests__"))
		.flatMap((file) => {
			const local = localFunctions(
				stripComments(readFileSync(file, "utf8")).split(TOP_LEVEL_START),
				true
			);
			return [...local.entries()]
				.filter(([, body]) => {
					const text = reachableText(body, local);
					return (
						text.includes("apiRateLimited(") || text.includes('"RATE_LIMITED"')
					);
				})
				.map(([name]) => `${name}(`);
		});
	return [...new Set(names)];
}

const RATE_LIMITED_CALLS = rateLimitedCalls();

function canAnswerRateLimited(handler: Handler): boolean {
	return (
		handler.rateLimitedNames.some((name) => mentions(handler.reach, name)) ||
		RATE_LIMITED_CALLS.some((call) => handler.reach.includes(call))
	);
}

/** What each call in a handler's reach asks of the caller. */
const SCHEME_MARKERS: [string, string][] = [
	["requireApiToken(", "BearerAuth"],
	["requireAuth(", "SessionAuth"],
	["requireAuthSession(", "SessionAuth"],
	["authoriseModelRoute(", "SessionAuth"],
	["requireClaimRequest(", "SessionAuth"],
	["handleHealthRecordAction(", "SessionAuth"],
	["validateSession(", "SessionAuth"],
	["getServerSession(", "SessionAuth"],
	["requireCronSecret(", "CronSecret"],
	...cronGuardedServiceCalls().map((marker): [string, string] => [
		marker,
		"CronSecret",
	]),
];

/** Calls that read a request body, and which argument holds the schema (-1: none passed). */
const BODY_READERS: [string, number][] = [
	["parseJsonBody(", 1],
	["parseHealthBody(", 1],
	["handleHealthRecordAction(", 2],
	["readJsonBody(", -1],
	["readFormDataWithLimit(", -1],
];

/** A body read the checks do not know how to compare with the description. */
const UNRECOGNISED_BODY_READ =
	/\b(?:request|req)\.(?:json|text|formData|arrayBuffer|blob)\(|\.formData\(/;

function readsBody(handler: Handler): boolean {
	return BODY_READERS.some(([marker]) => handler.reach.includes(marker));
}

/** The schema names a handler passes to its body readers. */
function bodySchemaArguments(handler: Handler): string[] {
	return BODY_READERS.filter(([, position]) => position >= 0).flatMap(
		([marker, position]) =>
			calls(handler.reach, marker).map((args) => args[position]?.trim() ?? "")
	);
}

function mentions(text: string, name: string): boolean {
	return new RegExp(`\\b${name}\\b`).test(text);
}

/** What is wrong with the body a handler reads compared with the table's entry; empty when nothing. */
function bodyProblems(handler: Handler): string[] {
	const entry = REQUEST_BODIES[handler.id];
	const problems: string[] = [];
	if (UNRECOGNISED_BODY_READ.test(handler.reach)) {
		problems.push("reads the body in a way the checks do not recognise");
	}
	if (readsBody(handler) !== (entry !== undefined)) {
		problems.push(
			entry ? "has a body entry but reads none" : "reads a body with no entry"
		);
	}
	if (!entry) {
		return problems;
	}
	for (const source of entry.sources) {
		if (!mentions(handler.reach, source)) {
			problems.push(`does not use ${source}`);
		}
	}
	for (const schema of bodySchemaArguments(handler)) {
		if (!entry.sources.includes(schema)) {
			problems.push(`validates with ${schema}, not in the entry`);
		}
	}
	if (entry.required === handler.reach.includes("emptyBodyAs")) {
		problems.push(`required is ${entry.required}`);
	}
	return problems;
}

function documentedBody(operation: Json): Json | undefined {
	return operation.requestBody as Json | undefined;
}

interface AnswerLiteral {
	keys: string[];
	spread: boolean;
}

/** The fields of each object literal a handler passes straight to `apiSuccess(`. */
function answerLiterals(handler: Handler): AnswerLiteral[] {
	return calls(handler.reach, "apiSuccess(")
		.filter(
			(args) => args.length < 2 || SUCCESS_CODE.test(args[1]?.trim() ?? "")
		)
		.map((args) => (args[0] ?? "").trim())
		.filter((first) => first.startsWith("{"))
		.map((first) => {
			const entries = topLevelArguments(first.slice(1, first.lastIndexOf("}")))
				.map((entry) => entry.trim())
				.filter(Boolean);
			return {
				spread: entries.some((entry) => entry.startsWith("...")),
				keys: entries
					.filter((entry) => !entry.startsWith("..."))
					.map((entry) => entry.split(":")[0]?.trim() ?? ""),
			};
		});
}

/** The property names a described schema lists, following references and `allOf` / `oneOf`. */
function propertyNames(schema: unknown): string[] {
	const node = (schema ?? {}) as Json;
	const target = typeof node.$ref === "string" ? lookup(node.$ref) : node;
	const parts = [
		...Object.keys((target.properties ?? {}) as Json),
		...((target.allOf ?? []) as unknown[]).flatMap(propertyNames),
		...((target.oneOf ?? []) as unknown[]).flatMap(propertyNames),
	];
	return [...new Set(parts)];
}

function lookup(ref: string): Json {
	const name = ref.slice("#/components/schemas/".length);
	return (
		((SPEC.components as Json).schemas as Record<string, Json>)[name] ?? {}
	);
}

/** Names the described success answers of an operation list as properties. */
function documentedAnswerNames(operation: Json): string[] {
	const responses = operation.responses as Record<string, Json>;
	return Object.entries(responses)
		.filter(([code]) => SUCCESS_CODE.test(code))
		.flatMap(([, response]) => {
			const content = (response.content ?? {}) as Record<string, Json>;
			return Object.values(content).flatMap((media) =>
				propertyNames(media.schema)
			);
		});
}

/** Routes whose answers programs read, so the listed fields must be exactly what is sent. */
const EXACT_ANSWER = /^(?:GET|POST|PUT) \/(?:machine|cron)\b/;

/** What differs between the object literals a handler sends and the fields the description lists. */
function answerFieldProblems(handler: Handler, operation: Json): string[] {
	const documented = documentedAnswerNames(operation);
	if (documented.length === 0) {
		return [];
	}
	const literals = answerLiterals(handler);
	const problems = literals.flatMap((literal) =>
		literal.keys
			.filter((key) => !documented.includes(key))
			.map((key) => `${key} is sent but not described`)
	);
	const [only] = literals;
	if (
		EXACT_ANSWER.test(handler.id) &&
		literals.length === 1 &&
		only &&
		!only.spread
	) {
		problems.push(
			...documented
				.filter((name) => !only.keys.includes(name))
				.map((name) => `${name} is described but not sent`)
		);
	}
	return problems;
}

/** The operations that ask for no sign-in on purpose. */
const PUBLIC_OPERATIONS = [
	"GET /auth/reset-password",
	"GET /health",
	"GET /public/discover/{slug}",
	"GET /public/discover/{slug}/image/{versionId}",
	"POST /auth/forgot-password",
	"POST /auth/reset-password",
	"POST /users/register",
];

/** Handlers with no detected sign-in that are not on the public list. */
function unlistedWithoutSignIn(handlers: Handler[]): string[] {
	return handlers
		.filter(
			(handler) =>
				requiredSchemes(handler).length === 0 &&
				!PUBLIC_OPERATIONS.includes(handler.id)
		)
		.map((handler) => handler.id);
}

function requiredSchemes(handler: Handler): string[] {
	const schemes = SCHEME_MARKERS.filter(([marker]) =>
		handler.reach.includes(marker)
	).map(([, scheme]) => scheme);
	return [...new Set(schemes)].sort();
}

function documentedSchemes(operation: Json): string[] {
	const security = (operation.security ?? []) as Json[];
	return [...new Set(security.flatMap((entry) => Object.keys(entry)))].sort();
}

describe("the published API description matches the routes", () => {
	it("(a) documents exactly the exported handlers, each with a table entry", () => {
		const handlers = allHandlers().map((handler) => handler.id);
		const documented = operations().map(([key]) => key);
		expect(documented.sort()).toEqual([...handlers].sort());
		expect(Object.keys(OPERATIONS).sort()).toEqual([...handlers].sort());
	});

	it("(b) every reference resolves", () => {
		const dangling = [...new Set(refsIn(SPEC))].filter((ref) => !resolves(ref));
		expect(dangling, `${dangling.length} references point at nothing`).toEqual(
			[]
		);
	});

	it("(c) every path placeholder has exactly one path parameter", () => {
		const wrong = operations()
			.filter(([key, operation]) => {
				const names = [...key.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]);
				const listed = ((operation.parameters ?? []) as Json[])
					.filter((parameter) => parameter.in === "path")
					.map((parameter) => parameter.name as string);
				return [...names].sort().join() !== [...listed].sort().join();
			})
			.map(([key]) => key);
		expect(
			wrong,
			`${wrong.length} operations list the wrong path parameters`
		).toEqual([]);
	});

	it("(d) documented success codes equal what the handler returns", () => {
		const byKey = new Map(operations());
		const wrong = allHandlers()
			.filter((handler) => {
				const operation = byKey.get(handler.id);
				return (
					operation &&
					documentedSuccessCodes(operation).join() !==
						handlerSuccessCodes(handler).join()
				);
			})
			.map(
				(handler) =>
					`${handler.id}: documented ${documentedSuccessCodes(byKey.get(handler.id) as Json)} / returns ${handlerSuccessCodes(handler)}`
			);
		expect(wrong, `${wrong.length} operations differ`).toEqual([]);
	});

	it("(e) query parameters equal those the handler reads", () => {
		const byKey = new Map(operations());
		const wrong = allHandlers()
			.map((handler) => ({
				id: handler.id,
				read: queryNamesRead(handler).join(),
				documented: documentedQueryNames(byKey.get(handler.id) as Json).join(),
			}))
			.filter(({ read, documented }) => read !== documented)
			.map(
				({ id, read, documented }) =>
					`${id}: documented [${documented}] / reads [${read}]`
			);
		expect(wrong, `${wrong.length} operations differ`).toEqual([]);
	});

	it("(e2) no handler reads the query string without a recognised name", () => {
		expect(unreadQueryStrings(allHandlers())).toEqual([]);
	});

	it("(e3) the checks notice a query string read by a name they cannot see", () => {
		const [handler] = handlersInSource(
			'export async function GET(request: Request) {\n\tconst key = "a";\n\treturn apiSuccess(new URL(request.url).searchParams.get(key));\n}\n',
			"/x"
		);
		expect(unreadQueryStrings(handler ? [handler] : [])).toEqual(["GET /x"]);
	});

	it("(g2) every scheduled-job handler is detected as checking the secret", () => {
		const unguarded = allHandlers()
			.filter((handler) => handler.id.split(" ")[1]?.startsWith("/cron/"))
			.filter((handler) => !requiredSchemes(handler).includes("CronSecret"))
			.map((handler) => handler.id);
		expect(unguarded).toEqual([]);
	});

	it("(g3) a scheduled-job handler with no secret check is not detected as guarded", () => {
		const [handler] = handlersInSource(
			"export async function POST(request: Request) {\n\treturn apiSuccess({ success: true });\n}\n",
			"/cron/new-job"
		);
		expect(handler ? requiredSchemes(handler) : ["missing"]).toEqual([]);
	});

	it("(g4) the secret check is found through the service functions that make it", () => {
		expect(cronGuardedServiceCalls()).toEqual(
			expect.arrayContaining(["purgeExpiredCases(", "sweepHealthStaleness("])
		);
	});

	it("(g5) every handler with no detected sign-in is on the public list", () => {
		expect(unlistedWithoutSignIn(allHandlers())).toEqual([]);
	});

	it("(g6) every operation on the public list exists and has no detected sign-in", () => {
		const byId = new Map(allHandlers().map((handler) => [handler.id, handler]));
		const stale = PUBLIC_OPERATIONS.filter((id) => {
			const handler = byId.get(id);
			return !handler || requiredSchemes(handler).length > 0;
		});
		expect(stale).toEqual([]);
	});

	it("(g7) a sign-in through an unknown call is not mistaken for a public route", () => {
		const [handler] = handlersInSource(
			"export async function GET() {\n\tawait checkUserSession();\n\treturn apiSuccess({});\n}\n",
			"/x"
		);
		expect(unlistedWithoutSignIn(handler ? [handler] : [])).toEqual(["GET /x"]);
	});

	it("(g8) a comment that names a sign-in check does not count as the check", () => {
		const [handler] = handlersInSource(
			"export async function GET() {\n\t// requireAuth() runs first\n\t/* requireApiToken( */\n\treturn apiSuccess({});\n}\n",
			"/x"
		);
		expect(handler ? requiredSchemes(handler) : ["missing"]).toEqual([]);
	});

	it("(g9) text that looks like a comment inside a string is kept", () => {
		const [handler] = handlersInSource(
			'export async function GET() {\n\tconst url = "https://x.test/";\n\tawait requireAuth();\n\treturn apiSuccess(url);\n}\n',
			"/x"
		);
		expect(handler ? requiredSchemes(handler) : []).toEqual(["SessionAuth"]);
	});

	it("(e4) no handler reads the query string in a way the checks cannot follow", () => {
		expect(unfollowableQueryReads(allHandlers())).toEqual([]);
	});

	it("(e5) the checks notice URLSearchParams and other searchParams methods", () => {
		const reads = [
			"const q = new URLSearchParams(request.url);",
			'const all = new URL(request.url).searchParams.getAll("a");',
			'const has = new URL(request.url).searchParams.has("a");',
		];
		const handlers = reads.flatMap((read, i) =>
			handlersInSource(
				`export async function GET(request: Request) {\n\t${read}\n\treturn apiSuccess({});\n}\n`,
				`/r${i}`
			)
		);
		expect(unfollowableQueryReads(handlers)).toEqual([
			"GET /r0",
			"GET /r1",
			"GET /r2",
		]);
	});

	it("(d2) a redirect's status is its number, its status option, or 307", () => {
		const redirects = [
			"NextResponse.redirect(url)",
			"NextResponse.redirect(url, 302)",
			"NextResponse.redirect(url, { status: 302 })",
			'NextResponse.redirect(url, { headers: { "x-cache": "max-age=300" } })',
		];
		const codes = redirects.map((redirect, i) => {
			const [handler] = handlersInSource(
				`export async function GET(request: Request) {\n\treturn ${redirect};\n}\n`,
				`/r${i}`
			);
			return handler ? handlerSuccessCodes(handler) : [];
		});
		expect(codes).toEqual([[307], [302], [302], [307]]);
	});

	it("(g) sign-in schemes equal those the handler requires", () => {
		const byKey = new Map(operations());
		const wrong = allHandlers()
			.map((handler) => ({
				id: handler.id,
				required: requiredSchemes(handler).join(),
				documented: documentedSchemes(byKey.get(handler.id) as Json).join(),
			}))
			.filter(({ required, documented }) => required !== documented)
			.map(
				({ id, required, documented }) =>
					`${id}: documented [${documented}] / requires [${required}]`
			);
		expect(wrong, `${wrong.length} operations differ`).toEqual([]);
	});

	it("(f) every handler that reads a body has the right body, and none else has one", () => {
		const byKey = new Map(operations());
		const wrong = allHandlers().flatMap((handler) => {
			const documented = documentedBody(byKey.get(handler.id) as Json);
			const entry = REQUEST_BODIES[handler.id];
			const problems = bodyProblems(handler);
			if (Boolean(documented) !== Boolean(entry)) {
				problems.push("the description and the table disagree");
			}
			return problems.map((problem) => `${handler.id}: ${problem}`);
		});
		expect(wrong, `${wrong.length} problems`).toEqual([]);
	});

	it("(f2) the described body is the table's schema", () => {
		const byKey = new Map(operations());
		const wrong = Object.entries(REQUEST_BODIES)
			.filter(([key, entry]) => {
				const content = (documentedBody(byKey.get(key) as Json)?.content ??
					{}) as Record<string, Json>;
				return (
					JSON.stringify(content[entry.contentType]?.schema) !==
					JSON.stringify(entry.schema)
				);
			})
			.map(([key]) => key);
		expect(wrong).toEqual([]);
	});

	it("(f3) a body read the checks do not recognise is reported", () => {
		const reads = [
			"const body = await request.json();",
			"const form = await request.formData();",
		];
		const problems = reads.map((read, i) => {
			const [handler] = handlersInSource(
				`export async function POST(request: Request) {\n\t${read}\n\treturn apiSuccess({});\n}\n`,
				`/f${i}`
			);
			return handler ? bodyProblems(handler) : [];
		});
		expect(problems.map((list) => list.length > 0)).toEqual([true, true]);
	});

	it("(f4) a body read with no table entry, or the wrong schema, is reported", () => {
		const [none] = handlersInSource(
			"export async function POST(request: Request) {\n\tawait parseJsonBody(request, someSchema);\n\treturn apiSuccess({});\n}\n",
			"/f-none"
		);
		expect(none ? bodyProblems(none) : []).toContain(
			"reads a body with no entry"
		);
		const [wrong] = handlersInSource(
			"export async function POST(request: Request) {\n\tawait parseJsonBody(request, otherSchema);\n\treturn apiSuccess({});\n}\n",
			"/teams"
		);
		expect(wrong ? bodyProblems(wrong) : []).toEqual(
			expect.arrayContaining([
				"does not use createTeamSchema",
				"validates with otherSchema, not in the entry",
			])
		);
	});

	it("(i) the fields a handler sends are described, and exactly so on the machine routes", () => {
		const byKey = new Map(operations());
		const wrong = allHandlers().flatMap((handler) =>
			answerFieldProblems(handler, byKey.get(handler.id) as Json).map(
				(problem) => `${handler.id}: ${problem}`
			)
		);
		expect(wrong, `${wrong.length} problems`).toEqual([]);
	});

	it("(i2) a field the handler sends and the description lacks is reported", () => {
		const [handler] = handlersInSource(
			"export async function GET() {\n\treturn apiSuccess({ name, extra: 1 });\n}\n",
			"/machine/x"
		);
		const operation = {
			responses: {
				"200": {
					content: {
						"application/json": {
							schema: { type: "object", properties: { name: {}, gone: {} } },
						},
					},
				},
			},
		};
		expect(handler ? answerFieldProblems(handler, operation) : []).toEqual([
			"extra is sent but not described",
			"gone is described but not sent",
		]);
	});

	it("(i3) answers that can be null say so", () => {
		const schemas = (SPEC.components as Json).schemas as Record<string, Json>;
		const status = (schemas.ClaimHealthStatus?.properties as Json)
			.status as Json;
		expect(status.nullable).toBe(true);
		const paths = SPEC.paths as Record<string, Record<string, Json>>;
		const information = paths["/cases/{id}/information"]?.get as Json;
		const answer = (information.responses as Record<string, Json>)[
			"200"
		] as Json;
		const media = (answer.content as Record<string, Json>)["application/json"];
		expect((media?.schema as Json).nullable).toBe(true);
	});

	it("(i4) both import bodies describe every format the import accepts, each by its own schema", () => {
		const schemas = (SPEC.components as Json).schemas as Record<string, Json>;
		const paths = SPEC.paths as Record<string, Record<string, Json>>;
		const flatDocument = {
			version: "2.0",
			exportedAt: "2026-01-01T00:00:00Z",
			case: { name: "A case", description: "" },
			elements: [],
			evidenceLinks: [],
		};
		expect(detectAndValidate(flatDocument)).toMatchObject({
			isValid: true,
			version: "flat",
		});
		for (const method of ["post", "put"]) {
			const body = (
				(paths["/cases/import"]?.[method]?.requestBody as Json).content as Json
			)["application/json"] as Json;
			const names = ((body.schema as Json).oneOf as Json[]).map((option) =>
				String(option.$ref).replace("#/components/schemas/", "")
			);
			expect(names).toEqual(["CaseExport", "CaseExportFlat"]);
			const versions = names.flatMap(
				(name) =>
					((schemas[name]?.properties as Json).version as { enum: string[] })
						.enum
			);
			expect(versions).toEqual(["1.0", "1.1", "2.0"]);
			for (const version of versions) {
				expect(detectVersion({ version })).not.toBeNull();
			}
			for (const field of schemas.CaseExportFlat?.required as string[]) {
				expect(Object.keys(flatDocument)).toContain(field);
			}
		}
	});

	it("(j) a handler that reads a body documents 413, and a handler that can be rate limited documents 429", () => {
		const byKey = new Map(operations());
		const wrong = allHandlers().flatMap((handler) => {
			const codes = Object.keys(
				(byKey.get(handler.id) as Json).responses as Json
			);
			const problems: string[] = [];
			if (readsBody(handler) && !codes.includes("413")) {
				problems.push("reads a body but lacks 413");
			}
			if (
				handler.reach.includes("requireApiToken(") &&
				!codes.includes("429")
			) {
				problems.push("takes a machine token but lacks 429");
			}
			if (canAnswerRateLimited(handler) && !codes.includes("429")) {
				problems.push("can answer rate limited but lacks 429");
			}
			return problems.map((problem) => `${handler.id}: ${problem}`);
		});
		expect(wrong, `${wrong.length} problems`).toEqual([]);
	});

	it("(j2) every shared error answer carries the shared error body", () => {
		const shared = (SPEC.components as Json).responses as Record<string, Json>;
		const bodies = Object.entries(shared).map(([code, response]) => [
			code,
			JSON.stringify(response.content),
		]);
		for (const [code, body] of bodies) {
			expect(body, code).toContain("#/components/schemas/ApiError");
		}
		expect(Object.keys(shared)).toEqual(
			expect.arrayContaining(["400", "413", "429"])
		);
	});

	it("(j3) the error body lists exactly the error codes the routes can raise", () => {
		const source = readFileSync(path.join(ROOT, "lib/errors.ts"), "utf8");
		const union = source.slice(
			source.indexOf("export type ErrorCode"),
			source.indexOf(";", source.indexOf("export type ErrorCode"))
		);
		const raised = [...union.matchAll(/"([A-Z_]+)"/g)].map((m) => m[1]);
		const schemas = (SPEC.components as Json).schemas as Record<string, Json>;
		const listed = (
			(schemas.ApiError?.properties as Json).code as { enum: string[] }
		).enum;
		expect([...listed].sort()).toEqual([...raised].sort());
		expect(Object.keys((schemas.ApiError?.properties as Json) ?? {})).toEqual(
			expect.arrayContaining(["error", "code", "fieldErrors"])
		);
	});

	it("(j4) the session scheme names both cookies", () => {
		const schemes = (SPEC.components as Json).securitySchemes as Record<
			string,
			Json
		>;
		const description = String(schemes.SessionAuth?.description);
		expect(description).toContain("__Secure-next-auth.session-token");
		expect(description).toContain("`next-auth.session-token`");
	});

	it("(j5) the description cites no internal design record", () => {
		expect(SPEC_TEXT).not.toContain("ADR ");
	});

	it("(j6) a rate limit is found through a code constant and through a library call", () => {
		const [viaConstant] = handlersInSource(
			'const MAP = { RATE_LIMITED: "RATE_LIMITED" };\nexport async function POST() {\n\treturn MAP[code];\n}\n',
			"/x"
		);
		const [viaLibrary] = handlersInSource(
			"export async function POST() {\n\treturn await takeModelCall(userId);\n}\n",
			"/y"
		);
		const [neither] = handlersInSource(
			"export async function POST() {\n\treturn apiSuccess({});\n}\n",
			"/z"
		);
		expect(viaConstant && canAnswerRateLimited(viaConstant)).toBe(true);
		expect(viaLibrary && canAnswerRateLimited(viaLibrary)).toBe(true);
		expect(neither && canAnswerRateLimited(neither)).toBe(false);
	});

	it("(j7) the two plain-error routes document only the answers they send, and the import preview its own 400", () => {
		const paths = SPEC.paths as Record<string, Record<string, Json>>;
		const link = paths["/auth/link/{provider}"]?.get?.responses as Json;
		const events = paths["/cases/{id}/events"]?.get?.responses as Json;
		expect(Object.keys(link)).not.toEqual(
			expect.arrayContaining(["401", "403", "500"])
		);
		expect(Object.keys(link)).toContain("400");
		expect(Object.keys(events)).not.toContain("500");
		const refusal = JSON.stringify(
			(paths["/cases/import"]?.put?.responses as Json)["400"]
		);
		expect(refusal).toContain("isValid");
		expect(refusal).not.toContain("ApiError");
	});

	it("(h) running the correction step on the committed file changes nothing", () => {
		expect(serialiseOpenApi(correctOpenApi(SPEC))).toBe(SPEC_TEXT);
	});
});
