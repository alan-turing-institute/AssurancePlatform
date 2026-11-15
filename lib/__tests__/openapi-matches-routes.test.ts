import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cronDryRunQuerySchema } from "@/lib/schemas/cron-dry-run";
import { evidenceListQuerySchema } from "@/lib/schemas/health-evidence";
import {
	correctOpenApi,
	serialiseOpenApi,
} from "@/scripts/openapi/correct-openapi";
import { OPERATIONS } from "@/scripts/openapi/operations";

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

function handlersIn(file: string): Handler[] {
	return handlersInSource(readFileSync(file, "utf8"), routePath(file));
}

function handlersInSource(source: string, route: string): Handler[] {
	const blocks = source.split(TOP_LEVEL_START);
	const local = localFunctions(blocks);
	const found: Handler[] = [];
	blocks.forEach((block, i) => {
		const method = HANDLER.exec(block)?.[1];
		const before = blocks[i - 1] ?? "";
		const ignored = before.startsWith("/**") && before.includes("@ignore");
		if (method && !ignored) {
			found.push({
				id: `${method} ${route}`,
				text: block,
				reach: reachableText(block, local),
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

function redirectCodes(text: string): number[] {
	return calls(text, "NextResponse.redirect(").flatMap((args) =>
		args.length > 1 ? successNumbers(args[1] ?? "") : [REDIRECT_DEFAULT]
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
				readFileSync(file, "utf8").split(TOP_LEVEL_START),
				true
			);
			return [...local.entries()]
				.filter(([, body]) =>
					reachableText(body, local).includes("requireCronSecret(")
				)
				.map(([name]) => `${name}(`);
		});
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

/** A call that looks like a sign-in check. */
const SIGN_IN_CALL =
	/\b(?:validate|get|require|check|authori[sz]e)\w*(?:Session|Auth)\w*\(/g;

/** Sign-in-looking calls in a handler's reach that no marker recognises. */
function unrecognisedSignIns(handler: Handler): string[] {
	const known = new Set(SCHEME_MARKERS.map(([marker]) => marker));
	return [...new Set(handler.reach.match(SIGN_IN_CALL) ?? [])].filter(
		(call) => !known.has(call)
	);
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

	it("(g5) no handler signs in through a call the markers do not recognise", () => {
		const unknown = allHandlers()
			.filter(
				(handler) =>
					requiredSchemes(handler).length === 0 &&
					unrecognisedSignIns(handler).length > 0
			)
			.map((handler) => `${handler.id}: ${unrecognisedSignIns(handler)}`);
		expect(unknown).toEqual([]);
		const [handler] = handlersInSource(
			"export async function GET() {\n\tawait checkUserSession();\n\treturn apiSuccess({});\n}\n",
			"/x"
		);
		expect(handler ? unrecognisedSignIns(handler) : []).toEqual([
			"checkUserSession(",
		]);
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

	it("(h) running the correction step on the committed file changes nothing", () => {
		expect(serialiseOpenApi(correctOpenApi(SPEC))).toBe(SPEC_TEXT);
	});
});
