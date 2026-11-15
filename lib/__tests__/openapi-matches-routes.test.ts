import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
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
const HELPER_CODES: Record<string, number> = {
	"mediaResponse(": 200,
	"createUIMessageStreamResponse(": 200,
	"answerCriteriaRead(": 200,
	"answerCriteriaChange(": 200,
	"NextResponse.redirect(": 307,
};

interface Handler {
	key: string;
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

function handlersIn(file: string): Handler[] {
	const blocks = readFileSync(file, "utf8").split(TOP_LEVEL_START);
	const found: Handler[] = [];
	blocks.forEach((block, i) => {
		const method = HANDLER.exec(block)?.[1];
		const before = blocks[i - 1] ?? "";
		const ignored = before.startsWith("/**") && before.includes("@ignore");
		if (method && !ignored) {
			found.push({ key: `${method} ${routePath(file)}`, text: block });
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
		.map(([, code]) => code);
}

function handlerSuccessCodes(handler: Handler): number[] {
	const codes = [
		...apiSuccessCodes(handler.text),
		...directResponseCodes(handler.text),
		...helperCodes(handler.text),
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

describe("the published API description matches the routes", () => {
	it("(a) documents exactly the exported handlers, each with a table entry", () => {
		const handlers = allHandlers().map((handler) => handler.key);
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
				const operation = byKey.get(handler.key);
				return (
					operation &&
					documentedSuccessCodes(operation).join() !==
						handlerSuccessCodes(handler).join()
				);
			})
			.map(
				(handler) =>
					`${handler.key}: documented ${documentedSuccessCodes(byKey.get(handler.key) as Json)} / returns ${handlerSuccessCodes(handler)}`
			);
		expect(wrong, `${wrong.length} operations differ`).toEqual([]);
	});

	it("(h) running the correction step on the committed file changes nothing", () => {
		expect(serialiseOpenApi(correctOpenApi(SPEC))).toBe(SPEC_TEXT);
	});
});
