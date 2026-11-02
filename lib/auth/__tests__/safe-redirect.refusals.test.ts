import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "@/lib/auth/safe-redirect";

/**
 * After sign-in the app follows only a same-site path. Every refusal here
 * uses a fallback that no input can reduce to, and a target that is not the
 * default, so a check that is skipped produces a different result instead of
 * passing by accident (a value the URL parser tidies into `/dashboard` would
 * hide a missing check when the fallback is `/dashboard`).
 */

const FALLBACK = "/fallback-sentinel";
const REAL_ORIGIN = "https://app.example";
// Fixtures that name the helper's own placeholder host can only be refused by
// the shape of the value, never by comparing hosts. If the placeholder
// changes they remain ordinary off-site fixtures.
const PLACEHOLDER_HOST = "same-site.invalid";
const TOKEN = "0b5f6b7c-3f0e-4d3a-9a3e-6a1f2c9d8e47";

const call = (value: unknown, fallback: string = FALLBACK) =>
	safeRedirectPath(value as string, fallback);

const REFUSED: Record<string, string[]> = {
	"absolute and scheme URLs": [
		"https://evil.example",
		"http://evil.example/cases/1",
		"HTTPS://EVIL.EXAMPLE",
		"hTtPs://evil.example",
		"https:evil.example",
		"https:/evil.example",
		"https:\\\\evil.example",
		"ftp://evil.example",
		"file:///etc/passwd",
		"mailto:someone@evil.example",
		"about:blank",
		"blob:https://evil.example/x",
		"javascript:alert(1)",
		"JaVaScRiPt:alert(1)",
		"javascript://%0aalert(1)",
		"data:text/html,<script>alert(1)</script>",
		"vbscript:msgbox(1)",
		"java\nscript:alert(1)",
		"htt\tps://evil.example",
		"https://user:pass@evil.example",
		`https://${PLACEHOLDER_HOST}@evil.example/`,
		`https://${PLACEHOLDER_HOST}/cases/1`,
		`HTTPS://${PLACEHOLDER_HOST}/cases/1`,
	],
	"values that do not start with a slash": [
		"cases/1",
		"dashboard",
		"./cases/1",
		"../cases/1",
		"?next=/cases/1",
		"#/cases/1",
		".",
		"..",
		"evil.example/cases/1",
		"%2Fcases%2F1",
		"%2F%2Fevil.example",
		"%2f%2fevil.example",
		"%5Cevil.example",
		"%2F%5Cevil.example",
		"%252F%252Fevil.example",
		"%255Cevil.example",
		"∕∕evil.example",
		"／／evil.example",
		"⁄⁄evil.example",
		"⧸⧸evil.example",
		"＼＼evil.example",
		"∖∖evil.example",
	],
	"leading whitespace": [
		" /cases/1",
		"  //evil.example",
		" https://evil.example",
		" /cases/1",
		" /cases/1",
		"　/cases/1",
	],
	"a second leading slash": [
		"//",
		"///",
		"//evil.example",
		"//evil.example/cases/1",
		"///evil.example",
		"////evil.example",
		"/////evil.example/cases/1",
		`//${PLACEHOLDER_HOST}/cases/1`,
		`//user@${PLACEHOLDER_HOST}/cases/1`,
		`//${PLACEHOLDER_HOST.toUpperCase()}:443/cases/1`,
		`///${PLACEHOLDER_HOST}/cases/1`,
	],
	backslashes: [
		"/\\evil.example",
		"/\\/evil.example",
		"/\\\\evil.example",
		"/\\@evil.example",
		"\\\\evil.example",
		"\\/evil.example",
		"\\evil.example",
		`/\\${PLACEHOLDER_HOST}/cases/1`,
		`/\\/${PLACEHOLDER_HOST}/cases/1`,
		"/cases\\1",
		"/cases/..\\..\\1",
		"/cases/1?next=\\evil",
		"/cases/1#\\evil",
	],
	"dot segments that collapse to two leading slashes": [
		"/.//evil.example",
		"/a/..//evil.example",
		"/..//evil.example",
		"/././/evil.example",
		"/a/b/../..//evil.example",
		"/%2e//evil.example",
		"/%2E//evil.example",
		"/%2e%2e//evil.example",
		"/a/%2E%2E//evil.example",
		"/.%2e//evil.example",
		`/.//${PLACEHOLDER_HOST}/cases/1`,
	],
	"nothing usable": ["", " ", "\t", "\n"],
};

const CONTROL_CHARACTERS = [
	"\t",
	"\n",
	"\r",
	"\0",
	"\v",
	"\f",
	"\x1b",
	"\x7f",
	"\x85",
	"\x9f",
];

// Browsers drop a tab, line feed or carriage return before parsing, so one
// between two slashes turns `/\t/host` into `//host`.
const CONTROL_TEMPLATES: ((c: string) => string)[] = [
	(c) => `/cases/${c}1`,
	(c) => `/cases/1${c}`,
	(c) => `${c}/cases/1`,
	(c) => `/cases/1?next=${c}x`,
	(c) => `/cases/1#${c}x`,
	(c) => `/${c}/${PLACEHOLDER_HOST}/cases/1`,
	(c) => `/${c}/evil.example`,
];

const CONTROL_FIXTURES = CONTROL_CHARACTERS.flatMap((c) =>
	CONTROL_TEMPLATES.map((template) => template(c))
);

describe("safeRedirectPath refuses", () => {
	describe.each(Object.entries(REFUSED))("%s", (_label, values) => {
		it.each(values)("%j", (value) => {
			expect(call(value)).toBe(FALLBACK);
		});
	});

	describe("a raw control character anywhere in the value", () => {
		it.each(CONTROL_FIXTURES)("%j", (value) => {
			expect(call(value)).toBe(FALLBACK);
		});
	});
});

describe("safeRedirectPath keeps a same-site path as written", () => {
	it.each([
		"/",
		"/dashboard",
		"/cases/1",
		"/cases/1?tab=a#section-2",
		"/discover/some-slug?use=1",
		`/invites/${TOKEN}`,
		"/?x=1",
		"/#top",
		"/cases//1",
		"/search?q=a%20b&r=%E2%9C%93",
		"/cases/caf%C3%A9",
		"/cases/1?next=https://evil.example",
		"/cases/1?next=%2F%2Fevil.example",
		"/cases/1?next=//evil.example#//x",
	])("%j", (value) => {
		expect(call(value)).toBe(value);
	});

	it.each([
		"/%2F%2Fevil.example",
		"/%2f/evil.example",
		"/%5Cevil.example",
		"/%5c%5cevil.example",
		"/%252F%252Fevil.example",
		"/%255Cevil.example",
		"/cases/%091",
		"/cases/%0d%0aSet-Cookie:x=1",
		"/cases/%001",
		"/%09/evil.example",
		"/%0a/evil.example",
	])("leaves the encoded form %j encoded", (value) => {
		expect(call(value)).toBe(value);
	});

	it.each([
		"/@evil.example/x",
		"/evil.example@same/x",
		"/:@evil.example",
		"/cases/1@evil.example",
	])("treats %j as a path, not as a host", (value) => {
		expect(call(value)).toBe(value);
	});

	it.each([
		["/a/../cases/1", "/cases/1"],
		["/./cases/1", "/cases/1"],
		["/a/%2e%2e/cases/1", "/cases/1"],
	])("tidies the dot segments in %j to %j", (value, expected) => {
		expect(call(value)).toBe(expected);
	});
});

describe("safeRedirectPath input types", () => {
	it("uses the first value when several are given", () => {
		expect(call(["/cases/1", "https://evil.example"])).toBe("/cases/1");
	});

	it.each([
		[["https://evil.example", "/cases/1"]],
		[["//evil.example", "/cases/1"]],
		[["", "/cases/1"]],
		[[]],
		[[undefined]],
		[[null]],
		[[42]],
		[[["/cases/1"]]],
	])("does not look past an unusable first value %j", (value) => {
		expect(call(value)).toBe(FALLBACK);
	});

	it.each([
		[undefined],
		[null],
		[42],
		[true],
		[{}],
		[{ toString: () => "/cases/1" }],
		[new Object("/cases/1")],
		[Symbol("/cases/1")],
		[() => "/cases/1"],
	])("falls back for the non-string %#", (value) => {
		expect(call(value)).toBe(FALLBACK);
	});

	it("falls back to /dashboard when no fallback is given", () => {
		expect(safeRedirectPath("//evil.example")).toBe("/dashboard");
		expect(safeRedirectPath(undefined)).toBe("/dashboard");
		expect(safeRedirectPath(null)).toBe("/dashboard");
	});

	it("returns the fallback it was given", () => {
		expect(safeRedirectPath("https://evil.example", "/home")).toBe("/home");
	});
});

describe("safeRedirectPath cannot be talked off-site", () => {
	it.each([
		"/／evil.example",
		"/∕∕evil.example",
		"/＼＼evil.example",
		"/ //evil.example",
		"/cases/1 ",
		"/cases/1 ",
	])("keeps %j on the site or refuses it", (value) => {
		expect(offSiteProblem(value, call(value))).toBeNull();
	});

	it("keeps every combination of slashes, dots, encodings and hosts on the site", () => {
		const tokens = [
			"/",
			"/",
			"\\",
			"\t",
			"\n",
			"\r",
			"\0",
			".",
			"..",
			"%2F",
			"%5C",
			"%2e",
			"@",
			":",
			"evil.example",
			PLACEHOLDER_HOST,
			"a",
			"?",
			"#",
			" ",
			"∕",
			"／",
			"https:",
			"javascript:",
		];
		let state = 20_261_102;
		const next = (limit: number) => {
			state = (state * 48_271) % 2_147_483_647;
			return state % limit;
		};

		const problems: string[] = [];
		for (let run = 0; run < 20_000; run++) {
			const length = 1 + next(6);
			let value = "";
			for (let index = 0; index < length; index++) {
				value += tokens[next(tokens.length)];
			}
			const problem = offSiteProblem(value, call(value));
			if (problem) {
				problems.push(problem);
			}
		}
		expect(problems).toEqual([]);
	});
});

/**
 * Reads the result as a browser would (tab, line feed and carriage return
 * dropped, backslash read as slash) and describes how it could leave this
 * origin, or returns null when it cannot.
 */
function offSiteProblem(input: string, result: string): string | null {
	if (result === FALLBACK) {
		return null;
	}
	const browserView = result.replace(/[\t\n\r]/g, "").replaceAll("\\", "/");
	const parsed = new URL(browserView, REAL_ORIGIN);
	const unsafe =
		!result.startsWith("/") ||
		browserView.startsWith("//") ||
		parsed.origin !== REAL_ORIGIN ||
		parsed.pathname.startsWith("//");
	return unsafe
		? `${JSON.stringify(input)} gave ${JSON.stringify(result)}`
		: null;
}
