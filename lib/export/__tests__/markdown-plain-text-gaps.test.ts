import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";
import {
	ADDRESS_PLACES,
	createDocument,
	exportMarkdown,
	FRONT_MATTER_FIELDS,
	MARK,
	readAs,
	splitFrontMatter,
	TEXT_FIELDS,
} from "@/src/__tests__/utils/markdown-plain-text-kit";

/** A web address directly followed by a tag. */
const ADDRESS_THEN_TAG = [
	"https://example.com/<img src=x onerror=alert(1)>",
	"see http://example.com/path<b>bold</b>",
	"www.example.com/<script>alert(1)</script>",
	"https://example.com/a\\<img src=x onerror=alert(1)>",
	"https://example.com/?q=<!-- x -->",
];

/** Text that a viewer would turn into other characters if it read it as a reference. */
const CHARACTER_REFERENCES = [
	"&lt;b&gt;",
	"&amp;",
	"&amp;lt;",
	"&quot;x&quot;",
	"&#60;script&#62;",
	"&#x3c;b&#x3e;",
	"javascript&colon;alert(1)",
];

const FRONT_MATTER_MARKUP = [
	"<img src=x onerror=alert(1)>",
	"<script>alert(1)</script>",
	"<https://example.com>",
	"[label](javascript:alert(1))",
	"![alt](https://example.com/p.png)",
];

const LINE_ENDING = /\r\n|\r|\n/;

const OPEN_TAG =
	/^<[A-Za-z][A-Za-z0-9-]*(?:\s+[A-Za-z_:][A-Za-z0-9_.:-]*(?:\s*=\s*(?:[^\s"'=<>`]+|'[^']*'|"[^"]*"))?)*\s*\/?>/;
const CLOSE_TAG = /^<\/[A-Za-z][A-Za-z0-9-]*\s*>/;
const COMMENT = /^<!--[\s\S]*?-->/;
const INSTRUCTION = /^<\?[\s\S]*?\?>/;
const DECLARATION = /^<![A-Za-z]+\s[^>]*>/;
const CDATA = /^<!\[CDATA\[[\s\S]*?\]\]>/;
const ADDRESS_START = /(?:https?:\/\/|ftp:\/\/|www\.)[^\s<]*/gi;
const TAG_PATTERNS = [
	OPEN_TAG,
	CLOSE_TAG,
	COMMENT,
	INSTRUCTION,
	DECLARATION,
	CDATA,
];

/**
 * Viewers that link web addresses on sight read a backslash inside the
 * address as part of it, so a tag written straight after one is not hidden by
 * an escape. Returns the tags that follow an address with nothing between.
 */
function tagsRightAfterAnAddress(markdown: string): string[] {
	const found: string[] = [];
	for (const address of markdown.matchAll(ADDRESS_START)) {
		const next = address.index + address[0].length;
		if (markdown.charAt(next) !== "<") {
			continue;
		}
		const rest = markdown.slice(next);
		if (TAG_PATTERNS.some((pattern) => pattern.test(rest))) {
			found.push(rest.slice(0, 40));
		}
	}
	return found;
}

function linesWithMark(body: string): string[] {
	return body.split("\n").filter((line) => line.includes(MARK));
}

describe("a Markdown report does not hide a tag behind a web address", () => {
	describe.each(TEXT_FIELDS)("$name", (field) => {
		it.each(
			ADDRESS_THEN_TAG
		)("writes %j with no tag left standing", async (value) => {
			const markdown = await exportMarkdown(field.build(`${MARK} ${value}`));
			const { body } = splitFrontMatter(markdown);

			expect(tagsRightAfterAnAddress(body)).toEqual([]);
		});
	});
});

describe("a Markdown report shows a typed character reference as typed", () => {
	describe.each(TEXT_FIELDS)("$name", (field) => {
		it.each(
			CHARACTER_REFERENCES
		)("writes %j so a viewer shows exactly that", async (value) => {
			const markdown = await exportMarkdown(field.build(`${MARK} ${value}`));
			const { body } = splitFrontMatter(markdown);

			const lines = linesWithMark(body);
			expect(lines.length).toBeGreaterThan(0);
			for (const line of lines) {
				expect(readAs(line)).toContain(`${MARK} ${value}`);
			}
		});
	});

	describe.each(ADDRESS_PLACES)("in $name", ({ build }) => {
		it("shows the character reference in a non-web address as typed", async () => {
			const value = "javascript&colon;alert(1)";

			const { body } = splitFrontMatter(await exportMarkdown(build(value)));

			expect(readAs(body)).toContain(value);
		});
	});
});

describe("the YAML front matter holds no markup from case text", () => {
	describe.each(FRONT_MATTER_FIELDS)("$key", ({ key, build }) => {
		it.each(
			FRONT_MATTER_MARKUP
		)("writes %j with no angle or square brackets, and reads back unchanged", async (value) => {
			const { frontMatter } = splitFrontMatter(
				await exportMarkdown(build(value))
			);

			expect(frontMatter).not.toContain("<");
			expect(frontMatter).not.toContain("[");
			expect(frontMatter).not.toContain("]");
			const data = parseYaml(frontMatter) as Record<string, unknown>;
			expect(data[key]).toBe(value);
		});
	});
});

describe("a table keeps its shape with carriage returns in a cell", () => {
	it("writes one line per row when a cell holds a carriage return", async () => {
		const markdown = await exportMarkdown(
			createDocument([
				{
					type: "table",
					headers: ["Name", "Value"],
					rows: [
						["one\r\ntwo", "plain"],
						["three\rfour", "plain"],
					],
				},
			])
		);
		const { body } = splitFrontMatter(markdown);

		const tableLines = body
			.split(LINE_ENDING)
			.filter((line) => line.includes("|"));
		expect(tableLines).toHaveLength(4);
	});
});
