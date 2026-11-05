import { describe, expect, it } from "vitest";
import { escapeMarkdown, escapeMarkdownText } from "../utils";

/** Typed text with an address, then what escapeMarkdownText and escapeMarkdown write. */
const CASES: [string, string, string, string][] = [
	[
		"a query string",
		"See https://example.com/search?a=1&b=2 for details",
		"See <https://example.com/search?a=1&b=2> for details",
		"See <https://example.com/search?a=1&b=2> for details",
	],
	[
		"a tilde",
		"https://example.com/~user/page",
		"<https://example.com/~user/page>",
		"<https://example.com/~user/page>",
	],
	[
		"square brackets",
		"https://example.com/a[1]",
		"<https://example.com/a[1]>",
		"<https://example.com/a[1]>",
	],
	[
		"underscores and hyphens",
		"https://example.com/my_report-v2",
		"<https://example.com/my_report-v2>",
		"<https://example.com/my_report-v2>",
	],
	[
		"a full stop after the address",
		"Visit https://example.com/page.",
		"Visit <https://example.com/page>.",
		"Visit <https://example.com/page>.",
	],
	[
		"a quote and a comma after the address",
		'say "http://example.com/q",',
		'say "<http://example.com/q>",',
		'say "<http://example.com/q>",',
	],
	[
		"a closing bracket with no opening one",
		"https://c.example)",
		"<https://c.example>)",
		"<https://c.example>\\)",
	],
	[
		"a closing bracket that matches an opening one",
		"https://example.com/wiki/Foo_(bar)",
		"<https://example.com/wiki/Foo_(bar)>",
		"<https://example.com/wiki/Foo_(bar)>",
	],
	[
		"a full stop and a closing bracket after the address",
		"(see https://c.example/x.)",
		"(see <https://c.example/x>.)",
		"\\(see <https://c.example/x>.\\)",
	],
	[
		"a tag straight after the address",
		"https://example.com/<b>x</b>",
		"<https://example.com/>&lt;b>x&lt;/b>",
		"<https://example.com/>\\<b\\>x\\</b\\>",
	],
	[
		"two addresses in one line",
		"https://a.example/x and https://b.example/y?q=1&r=2",
		"<https://a.example/x> and <https://b.example/y?q=1&r=2>",
		"<https://a.example/x> and <https://b.example/y?q=1&r=2>",
	],
	[
		"an address at the start and a mail address at the end",
		"https://a.example/x then mailto:me@example.com",
		"<https://a.example/x> then <mailto:me@example.com>",
		"<https://a.example/x> then <mailto:me@example.com>",
	],
	[
		"a capital scheme",
		"HTTPS://EXAMPLE.COM/A",
		"<HTTPS://EXAMPLE.COM/A>",
		"<HTTPS://EXAMPLE.COM/A>",
	],
];

/** Text that is not a bare web or mail address, so nothing is wrapped. */
const NOT_WRAPPED = [
	"ftp://example.com/x",
	"www.example.com/a",
	"x-https://example.com/",
	"blob:https://example.com/1234",
	"https://",
	"https://.",
	"mailto:",
];

describe("web and mail addresses in escaped text", () => {
	it.each(
		CASES
	)("escapeMarkdownText writes %s as an autolink", (_label, typed, written) => {
		expect(escapeMarkdownText(typed)).toBe(written);
	});

	it.each(
		CASES
	)("escapeMarkdown writes %s as an autolink", (_label, typed, _text, written) => {
		expect(escapeMarkdown(typed)).toBe(written);
	});

	it.each(NOT_WRAPPED)("leaves %j as text", (typed) => {
		expect(escapeMarkdownText(typed)).toBe(typed);
		expect(escapeMarkdown(typed)).not.toContain("<");
	});

	it("escapes the text around an address in both escapers", () => {
		expect(escapeMarkdownText("[a] see https://c.example & `x`")).toBe(
			"\\[a\\] see <https://c.example> \\& \\`x\\`"
		);
		expect(escapeMarkdown("*a* see https://c.example & `x`")).toBe(
			"\\*a\\* see <https://c.example> \\& \\`x\\`"
		);
	});
});
