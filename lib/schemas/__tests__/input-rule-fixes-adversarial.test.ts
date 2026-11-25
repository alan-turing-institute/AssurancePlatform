import { describe, expect, it } from "vitest";
import type { z } from "zod";
import {
	lenientUrlSchema,
	nullableUrlSchema,
	optionalUrlSchema,
	stringIdSchema,
} from "../base";
import { createCaseFromPatternSchema } from "../case-from-pattern";
import { createCommentSchema, createElementCommentSchema } from "../comment";
import {
	createConnectionSchema,
	quickSetupSchema,
	updateConnectionSchema,
} from "../models";

type Outcome =
	| { ok: true; data: unknown }
	| { ok: false; issues: { path: string; message: string }[] };

function outcome(schema: z.ZodType, input: unknown): Outcome {
	const result = schema.safeParse(input);
	if (result.success) {
		return { ok: true, data: result.data };
	}
	return {
		ok: false,
		issues: result.error.issues.map((issue) => ({
			path: issue.path.join("."),
			message: issue.message,
		})),
	};
}

function refusedWith(path: string, ...messages: string[]): Outcome {
	return {
		ok: false,
		issues: messages.map((message) => ({ path, message })),
	};
}

// ============================================
// Element comments
// ============================================

describe("createElementCommentSchema: text field and length", () => {
	const REQUIRED = "Comment content is required";
	const TOO_LONG = "Comment content must be less than 5000 characters";
	const stored = (content: string, parentId: string | null = null) => ({
		ok: true,
		data: { content, parentId },
	});

	it.each([
		["content only", { content: "new" }, "new"],
		["older field only", { comment: "old" }, "old"],
		[
			"content wins when both hold text",
			{ content: "new", comment: "old" },
			"new",
		],
		[
			"older field used when content is spaces",
			{ content: "   ", comment: "old" },
			"old",
		],
		[
			"older field used when content is empty",
			{ content: "", comment: "old" },
			"old",
		],
		[
			"older field used when content is tabs and newlines",
			{ content: "\t\n ", comment: "old" },
			"old",
		],
		[
			"content used when the older field is blank",
			{ content: "new", comment: "  " },
			"new",
		],
		[
			"each field is trimmed",
			{ content: "  new  ", comment: "  old  " },
			"new",
		],
		["older field trimmed", { content: " ", comment: "  old \n" }, "old"],
		["inner whitespace kept", { content: " a  b\nc " }, "a  b\nc"],
	])("%s", (_label, input, expected) => {
		expect(outcome(createElementCommentSchema, input)).toEqual(
			stored(expected)
		);
	});

	it.each([
		["nothing given", {}],
		["both empty", { content: "", comment: "" }],
		["both spaces", { content: "   ", comment: "\t\n" }],
		["content spaces alone", { content: "   " }],
		["older field spaces alone", { comment: "   " }],
	])("refuses a blank: %s", (_label, input) => {
		expect(outcome(createElementCommentSchema, input)).toEqual(
			refusedWith("content", REQUIRED)
		);
	});

	it("accepts exactly 5000 characters and stores them unchanged", () => {
		const text = "x".repeat(5000);
		expect(outcome(createElementCommentSchema, { content: text })).toEqual(
			stored(text)
		);
		expect(outcome(createElementCommentSchema, { comment: text })).toEqual(
			stored(text)
		);
	});

	it("refuses 5001 characters with the length message", () => {
		const text = "x".repeat(5001);
		expect(outcome(createElementCommentSchema, { content: text })).toEqual(
			refusedWith("content", TOO_LONG)
		);
		expect(outcome(createElementCommentSchema, { comment: text })).toEqual(
			refusedWith("content", TOO_LONG)
		);
	});

	it("counts the length after trimming", () => {
		const text = "x".repeat(5000);
		expect(
			outcome(createElementCommentSchema, { content: `  ${text}\n\t ` })
		).toEqual(stored(text));
		expect(
			outcome(createElementCommentSchema, { content: ` ${"x".repeat(5001)} ` })
		).toEqual(refusedWith("content", TOO_LONG));
	});

	it("does not fall back to the older field when content is too long", () => {
		expect(
			outcome(createElementCommentSchema, {
				content: "x".repeat(5001),
				comment: "short",
			})
		).toEqual(refusedWith("content", TOO_LONG));
	});

	it("skips a blank content that is itself over 5000 characters", () => {
		expect(
			outcome(createElementCommentSchema, {
				content: " ".repeat(6000),
				comment: "old",
			})
		).toEqual(stored("old"));
	});

	it("keeps a reply's parent id and refuses a malformed one", () => {
		const parentId = "3f2b8c1e-5d4a-4b7e-9c10-0a1b2c3d4e5f";
		expect(
			outcome(createElementCommentSchema, { content: "r", parentId })
		).toEqual(stored("r", parentId));
		expect(
			outcome(createElementCommentSchema, { content: "r", parentId: null })
		).toEqual(stored("r"));
		const bad = outcome(createElementCommentSchema, {
			content: "r",
			parentId: "nope",
		});
		expect(bad.ok).toBe(false);
	});

	it("still refuses unknown keys and non-text values", () => {
		expect(
			outcome(createElementCommentSchema, { content: "a", extra: 1 }).ok
		).toBe(false);
		expect(outcome(createElementCommentSchema, { content: 5 }).ok).toBe(false);
		expect(outcome(createElementCommentSchema, { comment: null }).ok).toBe(
			false
		);
	});
});

describe("createCommentSchema (comments on a case) is unchanged", () => {
	it("accepts 5000 and refuses 5001 with its own message", () => {
		expect(outcome(createCommentSchema, { content: "x".repeat(5000) }).ok).toBe(
			true
		);
		expect(outcome(createCommentSchema, { content: "x".repeat(5001) })).toEqual(
			refusedWith("content", "Content must be less than 5000 characters")
		);
	});

	it("refuses a blank with its own message and ignores no older field", () => {
		expect(outcome(createCommentSchema, { content: "  " })).toEqual(
			refusedWith("content", "Content is required")
		);
		expect(
			outcome(createCommentSchema, { content: " ", comment: "old" }).ok
		).toBe(false);
	});
});

// ============================================
// Starting a case from a pattern
// ============================================

describe("createCaseFromPatternSchema: description and name", () => {
	const source = { patternCaseId: "3f2b8c1e-5d4a-4b7e-9c10-0a1b2c3d4e5f" };
	const build = (name: unknown, description: unknown) =>
		outcome(createCaseFromPatternSchema, { source, name, description });

	it.each([
		["empty", ""],
		["spaces", "   "],
		["tabs and newlines", "\t\n \r\n"],
	])("reports a %s description once", (_label, description) => {
		expect(build("Case", description)).toEqual(
			refusedWith("description", "Description is required")
		);
	});

	it("trims a description and keeps inner whitespace", () => {
		expect(build("Case", "  a  b \n")).toMatchObject({
			ok: true,
			data: { description: "a  b" },
		});
	});

	it("limits a description to 5000 characters after trimming", () => {
		const text = "d".repeat(5000);
		expect(build("Case", ` ${text} `)).toMatchObject({
			ok: true,
			data: { description: text },
		});
		expect(build("Case", "d".repeat(5001))).toEqual(
			refusedWith(
				"description",
				"Description must be less than 5000 characters"
			)
		);
	});

	it("leaves the name rule as it was", () => {
		expect(build("", "d")).toEqual(
			refusedWith("name", "Case name is required")
		);
		expect(build("   ", "d")).toEqual(
			refusedWith("name", "Case name is required")
		);
		expect(build(" Case ", "d")).toMatchObject({
			ok: true,
			data: { name: "Case" },
		});
		expect(build("n".repeat(256), "d")).toEqual(
			refusedWith("name", "Case name must be less than 255 characters")
		);
	});

	it("reports both a blank name and a blank description, one message each", () => {
		expect(build("", " ")).toEqual({
			ok: false,
			issues: [
				{ path: "name", message: "Case name is required" },
				{ path: "description", message: "Description is required" },
			],
		});
	});
});

// ============================================
// Text ID
// ============================================

describe("stringIdSchema: trimmed before the length check", () => {
	it.each([
		["empty", ""],
		["spaces", "     "],
		["tab", "\t"],
		["newlines", "\n\r\n"],
		["mixed whitespace", " \t\n "],
	])("refuses %s with 'ID is required' once", (_label, input) => {
		expect(outcome(stringIdSchema, input)).toEqual(
			refusedWith("", "ID is required")
		);
	});

	it.each([
		["plain", "abc", "abc"],
		["padded", "  abc  ", "abc"],
		["inner space kept", " a b ", "a b"],
		["one character", " x ", "x"],
	])("accepts %s", (_label, input, expected) => {
		expect(outcome(stringIdSchema, input)).toEqual({
			ok: true,
			data: expected,
		});
	});

	it("counts 100 characters after trimming", () => {
		const id = "i".repeat(100);
		expect(outcome(stringIdSchema, id)).toEqual({ ok: true, data: id });
		expect(outcome(stringIdSchema, `   ${id}   `)).toEqual({
			ok: true,
			data: id,
		});
		expect(outcome(stringIdSchema, `i${id}`)).toEqual(
			refusedWith("", "ID must be less than 100 characters")
		);
		expect(outcome(stringIdSchema, ` ${"i".repeat(101)} `)).toEqual(
			refusedWith("", "ID must be less than 100 characters")
		);
	});

	it("refuses non-text", () => {
		expect(outcome(stringIdSchema, 5).ok).toBe(false);
		expect(outcome(stringIdSchema, null).ok).toBe(false);
	});
});

// ============================================
// API key
// ============================================

describe("apiKeySchema: one message for the problem found", () => {
	const EMPTY = "apiKey must not be empty";
	const CONTROL = "apiKey must not contain control characters";
	const ASCII = "apiKey must contain only printable ASCII characters";
	const TOO_LONG = "apiKey must be at most 2048 characters";

	const bodies: [string, (key: unknown) => unknown, z.ZodType, string][] = [
		[
			"create",
			(apiKey) => ({ label: "L", type: "OPENROUTER", apiKey }),
			createConnectionSchema,
			"apiKey",
		],
		["update", (apiKey) => ({ apiKey }), updateConnectionSchema, "apiKey"],
		[
			"quick setup",
			(openRouterKey) => ({ openRouterKey }),
			quickSetupSchema,
			"openRouterKey",
		],
	];

	describe.each(bodies)("%s body", (_name, body, schema, field) => {
		it.each([
			["empty", "", EMPTY],
			["spaces", "     ", EMPTY],
			["tabs and newlines", "\t\n \r", EMPTY],
			["a control character inside", "sk-\u0001abc", CONTROL],
			["a NUL inside", "sk-\u0000abc", CONTROL],
			["a newline inside", "sk-a\nbc", CONTROL],
			["DEL inside", "sk-a\u007fbc", CONTROL],
			["a letter outside ASCII", "sk-café", ASCII],
			["a character above U+00FF", "sk-☃", ASCII],
			["a space inside", "sk abc", ASCII],
			["a control and a non-ASCII character", "sk-\u0001é", CONTROL],
			["over the length limit", "k".repeat(2049), TOO_LONG],
		])("%s: gives only that message", (_label, key, message) => {
			expect(outcome(schema, body(key))).toEqual(refusedWith(field, message));
		});

		it("accepts a printable ASCII key and trims it", () => {
			expect(outcome(schema, body("  sk-abc_123  ")).ok).toBe(true);
			expect(outcome(schema, body("k".repeat(2048))).ok).toBe(true);
		});

		it("refuses a key that is not text, with the type message", () => {
			expect(outcome(schema, body(5))).toEqual(
				refusedWith(field, "apiKey must be a string")
			);
		});
	});

	it("gives the trimmed key back", () => {
		expect(outcome(quickSetupSchema, { openRouterKey: " sk-abc " })).toEqual({
			ok: true,
			data: { openRouterKey: "sk-abc" },
		});
	});

	it("still removes a key on update with null, and refuses null on create", () => {
		expect(outcome(updateConnectionSchema, { apiKey: null })).toEqual({
			ok: true,
			data: { apiKey: null },
		});
		expect(
			outcome(createConnectionSchema, {
				label: "L",
				type: "OPENROUTER",
				apiKey: null,
			}).ok
		).toBe(false);
		expect(outcome(quickSetupSchema, { openRouterKey: null }).ok).toBe(false);
	});

	it("leaves the other connection fields as they were", () => {
		expect(
			outcome(createConnectionSchema, { label: "  ", type: "OPENROUTER" })
		).toEqual(refusedWith("label", "label is required"));
		expect(
			outcome(createConnectionSchema, {
				label: "a\u0001b",
				type: "OPENROUTER",
			})
		).toEqual(
			refusedWith("label", "label must not contain control characters")
		);
		expect(outcome(updateConnectionSchema, {})).toEqual(
			refusedWith("", "Give at least one of label, baseUrl or apiKey")
		);
		expect(outcome(updateConnectionSchema, { baseUrl: "  " })).toEqual(
			refusedWith("baseUrl", "baseUrl must not be empty")
		);
		expect(
			outcome(createConnectionSchema, {
				label: "L",
				type: "OPENROUTER",
				extra: 1,
			}).ok
		).toBe(false);
	});
});

// ============================================
// Web address with a port and no scheme
// ============================================

const URL_REFUSED = "Enter a web address, such as example.com/report.pdf";
const refusedUrl = (): Outcome => refusedWith("", URL_REFUSED);

describe("lenientUrlSchema: a host and a port gets https://", () => {
	it.each([
		["example.com:8080/report", "https://example.com:8080/report"],
		["10.0.0.5:8443", "https://10.0.0.5:8443"],
		["localhost:3000", "https://localhost:3000"],
		["localhost:3000/", "https://localhost:3000/"],
		["LocalHost:3000", "https://LocalHost:3000"],
		["LOCALHOST:3000/x", "https://LOCALHOST:3000/x"],
		["EXAMPLE.COM:8080", "https://EXAMPLE.COM:8080"],
		["  example.com:8080/report  ", "https://example.com:8080/report"],
		["\n\texample.com:8080\n", "https://example.com:8080"],
		["example.com:8080?x=1", "https://example.com:8080?x=1"],
		["example.com:8080#top", "https://example.com:8080#top"],
		["example.com:80", "https://example.com:80"],
		["example.com:1", "https://example.com:1"],
		["example.com:65535", "https://example.com:65535"],
		[
			"sub-domain.example.co.uk:9/a/b?c#d",
			"https://sub-domain.example.co.uk:9/a/b?c#d",
		],
		["a.b:1", "https://a.b:1"],
		["a.b:1/x", "https://a.b:1/x"],
	])("%j is stored as %j", (input, stored) => {
		expect(outcome(lenientUrlSchema, input)).toEqual({
			ok: true,
			data: stored,
		});
	});
});

describe("lenientUrlSchema: what was refused is still refused", () => {
	it.each([
		["mailto:someone@example.com"],
		["tel:12345"],
		["javascript:alert(1)"],
		["data:text/plain,x"],
		["foo:bar"],
		["JAVASCRIPT:alert(1)"],
		["JavaScript:alert(1)"],
		["  javascript:alert(1)  "],
		["\tjavascript:alert(1)"],
		["javascript:alert(1)//example.com:8080"],
		["javascript:alert(document.domain);example.com:80"],
		["vbscript:msgbox(1)"],
		["file:/etc/passwd"],
		["blob:https://example.com:8080/x"],
		["about:blank"],
		["user:pass@example.com"],
		["user:pass@example.com:8080"],
		["user:8080"],
		["intranet:8080"],
		["intranet:8080/x"],
		["INTRANET:80"],
		["localhost2:3000"],
		["local-host:3000"],
		["example.com:"],
		["example.com:/x"],
		["example.com:123456"],
		["example.com:000000"],
		["example.com:80x"],
		["example.com:8080x"],
		["example.com:8080 x"],
		["example.com:80 80"],
		["example.com:8080@evil.example"],
		["example.com:8080javascript:alert(1)"],
		["example.com:8080:alert(1)"],
		["example.com:8080\\evil.example"],
		["example.com:80@evil.example"],
		["example.com:８０"],
		["localhost:3000@evil.example"],
		["localhost:3000.evil.example"],
		["localhost:abc"],
		["localhost:-1"],
		["localhost:+80"],
		["localhost: 80"],
		[":8080"],
		["https:"],
		["http:example.com"],
		["a:b:c"],
		["javascript\n:alert(1)"],
		["java\nscript:alert(1)"],
		["java\tscript:alert(1)"],
		["javascript\u0000:alert(1)"],
		["\u0000javascript:alert(1)"],
		["​javascript:alert(1)"],
		["ja​vascript:alert(1)"],
	])("%j is refused", (input) => {
		expect(outcome(lenientUrlSchema, input)).toEqual(refusedUrl());
	});

	it("refuses a port the address parser cannot hold", () => {
		expect(outcome(lenientUrlSchema, "example.com:99999")).toEqual(
			refusedUrl()
		);
		expect(outcome(lenientUrlSchema, "localhost:65536/x")).toEqual(
			refusedUrl()
		);
	});
});

describe("lenientUrlSchema: addresses that already worked", () => {
	it.each([
		["https://example.com/x", "https://example.com/x"],
		["http://example.com:8080/x", "http://example.com:8080/x"],
		["HTTP://example.com", "HTTP://example.com"],
		["example.com", "https://example.com"],
		["example.com/report.pdf", "https://example.com/report.pdf"],
		["//example.com", "https://example.com"],
		["//example.com:8080/x", "https://example.com:8080/x"],
		["  https://example.com  ", "https://example.com"],
	])("%j is stored as %j", (input, stored) => {
		expect(outcome(lenientUrlSchema, input)).toEqual({
			ok: true,
			data: stored,
		});
	});

	it.each([
		["ftp://example.com"],
		["javascript://example.com/%0aalert(1)"],
		["file:///etc/passwd"],
		["data://x"],
		[""],
		["   "],
		["not a url"],
	])("%j is refused", (input) => {
		expect(outcome(lenientUrlSchema, input).ok).toBe(false);
	});
});

describe("lenientUrlSchema: whatever is stored is an http or https address", () => {
	const probes = [
		"example.com:8080/report",
		"10.0.0.5:8443",
		"localhost:3000",
		"a.b:1",
		"-.:80",
		".:80",
		"..:80",
		"-:80",
		".:80/x",
		"a.:80",
		".a:80",
		"-a.-b:80",
		"a..b:80",
		"javascript.alert:1",
		"javascript.x:80/%0aalert(1)",
		"example.com:8080/\\evil.example",
		"example.com:8080/a b",
		"example.com:8080/\u0001",
		"example.com:8080/\n",
		"exam\nple.com:8080",
		"exam\tple.com:8080",
		"example.com:8080?javascript:alert(1)",
		"example.com:8080#javascript:alert(1)",
		"example.com:8080/javascript:alert(1)",
		"localhost:3000/‮",
		"example.com:0",
		"example.com:00080",
		"1.2.3.4.5:80",
		"256.256.256.256:80",
		"0x7f.1:80",
		"[::1]:80",
		"::1:80",
		"1.:80",
	];

	it.each(
		probes
	)("%j: stored value, if any, is http(s) with a real host", (input) => {
		const result = lenientUrlSchema.safeParse(input);
		if (!result.success) {
			expect(result.error.issues.map((i) => i.message)).toEqual([URL_REFUSED]);
			return;
		}
		const parsed = new URL(result.data);
		expect(["http:", "https:"]).toContain(parsed.protocol);
		expect(parsed.hostname).not.toBe("");
		expect(result.data.startsWith("https://")).toBe(true);
		expect(parsed.username).toBe("");
	});

	it("never gives a host-and-port value a user name or another scheme", () => {
		const hostile = [
			"example.com:8080@evil.example",
			"localhost:3000@evil.example",
			"example.com:8080:80@evil.example",
			"a.b:1@c.d",
			"a.b:1:2",
		];
		for (const input of hostile) {
			expect(outcome(lenientUrlSchema, input)).toEqual(refusedUrl());
		}
	});

	it("answers a very long value without a long wait", () => {
		const inputs = [
			".".repeat(50_000),
			"a.".repeat(25_000),
			`${"a.".repeat(25_000)}:`,
			`${"a".repeat(50_000)}:8080x`,
		];
		const started = Date.now();
		for (const input of inputs) {
			lenientUrlSchema.safeParse(input);
		}
		expect(Date.now() - started).toBeLessThan(300);
	});

	it("handles a long value: ordinary long host and port is stored whole", () => {
		const host = `${"a".repeat(60)}.example.com`;
		expect(outcome(lenientUrlSchema, `${host}:8080/x`)).toEqual({
			ok: true,
			data: `https://${host}:8080/x`,
		});
	});
});

describe("optionalUrlSchema: host and port, blank means not given", () => {
	it.each([
		["example.com:8080/report", "https://example.com:8080/report"],
		["10.0.0.5:8443", "https://10.0.0.5:8443"],
		["localhost:3000", "https://localhost:3000"],
		["  localhost:3000  ", "https://localhost:3000"],
		["LocalHost:3000", "https://LocalHost:3000"],
		["a.b:1", "https://a.b:1"],
	])("%j is stored as %j", (input, stored) => {
		expect(outcome(optionalUrlSchema, input)).toEqual({
			ok: true,
			data: stored,
		});
	});

	it.each([
		["mailto:someone@example.com"],
		["tel:12345"],
		["javascript:alert(1)"],
		["JAVASCRIPT:alert(1)"],
		["data:text/plain,x"],
		["foo:bar"],
		["intranet:8080"],
		["example.com:8080@evil.example"],
		["example.com:8080javascript:alert(1)"],
		["example.com:80x"],
		["example.com:123456"],
		["example.com:"],
		["user:pass@example.com"],
	])("%j is refused", (input) => {
		const result = outcome(optionalUrlSchema, input);
		expect(result.ok).toBe(false);
		expect(result).toMatchObject({ issues: [{ path: "" }] });
	});

	it.each([
		[""],
		["   "],
		["\t\n"],
		[null],
		[undefined],
	])("%j means not given", (input) => {
		expect(outcome(optionalUrlSchema, input)).toEqual({
			ok: true,
			data: undefined,
		});
	});
});

describe("nullableUrlSchema: host and port, blank means clear", () => {
	it.each([
		["example.com:8080/report", "https://example.com:8080/report"],
		["10.0.0.5:8443", "https://10.0.0.5:8443"],
		["localhost:3000", "https://localhost:3000"],
		["  localhost:3000  ", "https://localhost:3000"],
		["LocalHost:3000", "https://LocalHost:3000"],
		["a.b:1", "https://a.b:1"],
	])("%j is stored as %j", (input, stored) => {
		expect(outcome(nullableUrlSchema, input)).toEqual({
			ok: true,
			data: stored,
		});
	});

	it.each([
		["mailto:someone@example.com"],
		["tel:12345"],
		["javascript:alert(1)"],
		["JAVASCRIPT:alert(1)"],
		["data:text/plain,x"],
		["foo:bar"],
		["intranet:8080"],
		["example.com:8080@evil.example"],
		["example.com:8080javascript:alert(1)"],
		["example.com:80x"],
		["example.com:123456"],
		["example.com:"],
		["user:pass@example.com"],
	])("%j is refused with only the web address message", (input) => {
		expect(outcome(nullableUrlSchema, input)).toEqual(refusedUrl());
	});

	it.each([[""], ["   "], ["\t\n"], [null]])("%j clears", (input) => {
		expect(outcome(nullableUrlSchema, input)).toEqual({
			ok: true,
			data: null,
		});
	});

	it("leaves an absent value absent", () => {
		expect(outcome(nullableUrlSchema, undefined)).toEqual({
			ok: true,
			data: undefined,
		});
	});
});
