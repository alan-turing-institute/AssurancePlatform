import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";
import {
	ADDRESS_PLACES,
	createDocument,
	exportMarkdown,
	FRONT_MATTER_FIELDS,
	linkTargets,
	MARK,
	readAs,
	splitFrontMatter,
	TEXT_FIELDS,
	unescapedPositions,
	withoutLinkTargets,
} from "@/src/__tests__/utils/markdown-plain-text-kit";

/** Text that must come out exactly as typed, with nothing in it read as markup. */
const TYPED_TEXT = [
	"plain words",
	"<script>alert(1)</script>",
	"<img src=x onerror=alert(1)>",
	"a <b>bold</b> word",
	"<div onclick=alert(1)>block</div>",
	"<https://example.com>",
	"<mailto:a@b.example>",
	"<!-- note -->",
	"<?note x ?>",
	"<![CDATA[ x ]]>",
	"[label](javascript:alert(1))",
	"[label](JaVaScRiPt:alert(1))",
	"[label](https://example.com)",
	"![alt](https://example.com/p.png)",
	"[label][ref]",
	"[ref]: https://example.com",
	"a [b] c",
	"nested [[a]] and [b[c]]",
	"&#60;script&#62;",
	"&#x3c;b&#x3e;",
	"AT&T and R&D",
	"\\<b>",
	"\\\\<b>",
	"\\[x](y)",
	"back\\slash",
	"ends with a backslash\\",
	"a | b | c",
];

const WEB_OR_MAIL = /^(?:https?:|mailto:)/i;
const WHITESPACE = /\s/;
const IMAGE_TARGET = "./diagram.png";

function linesWithMark(body: string): string[] {
	return body.split("\n").filter((line) => line.includes(MARK));
}

function targetsOtherThanTheImage(body: string): string[] {
	return linkTargets(body).filter((target) => target !== IMAGE_TARGET);
}

describe("a Markdown report shows case text as typed", () => {
	describe.each(TEXT_FIELDS)("$name", (field) => {
		it.each(
			TYPED_TEXT
		)("writes %j so a viewer shows exactly that", async (value) => {
			const markdown = await exportMarkdown(field.build(`${MARK} ${value}`));
			const { body } = splitFrontMatter(markdown);

			const lines = linesWithMark(body);
			expect(lines.length).toBeGreaterThan(0);
			for (const line of lines) {
				expect(readAs(line)).toContain(`${MARK} ${value}`);
			}
		});

		it.each(TYPED_TEXT)("starts no markup from %j", async (value) => {
			const markdown = await exportMarkdown(field.build(`${MARK} ${value}`));
			const { body } = splitFrontMatter(markdown);

			for (const line of linesWithMark(body)) {
				const fromValue = line.slice(line.indexOf(MARK));
				expect(unescapedPositions(fromValue, "<")).toEqual([]);
				if (!field.hasImageSyntax) {
					expect(unescapedPositions(fromValue, "[")).toEqual([]);
					expect(unescapedPositions(fromValue, "]")).toEqual([]);
				}
			}
			expect(targetsOtherThanTheImage(body)).toEqual([]);
		});

		it("starts no markup from a value that spans several lines", async () => {
			const value = [
				`${MARK} first line`,
				"<img src=x onerror=alert(1)>",
				"[x](javascript:alert(1))",
				"<div onclick=alert(1)>last</div>",
			].join("\n");

			const { body } = splitFrontMatter(
				await exportMarkdown(field.build(value))
			);

			expect(unescapedPositions(body, "<")).toEqual([]);
			if (!field.hasImageSyntax) {
				expect(unescapedPositions(body, "[")).toEqual([]);
				expect(unescapedPositions(body, "]")).toEqual([]);
			}
			expect(targetsOtherThanTheImage(body)).toEqual([]);
		});
	});

	describe.each(
		TEXT_FIELDS.filter((field) => field.keepsPunctuation)
	)("$name punctuation", (field) => {
		it("leaves {term} references and hyphens readable in the file", async () => {
			const text = `${MARK} the {defined-term} and a well-known - item {x}`;

			const { body } = splitFrontMatter(
				await exportMarkdown(field.build(text))
			);

			expect(body).toContain(text);
		});
	});
});

describe("a table keeps its shape whatever its cells hold", () => {
	const HEADERS = ["Name", "Value"];
	const ROWS = [
		["a|b\n[x](javascript:alert(1))|c", "d"],
		["ends with a backslash\\", "next\\|[x]"],
		["<img src=x onerror=alert(1)>|\n|<b>", "[y]\r\n(z)"],
		["|||", "\n\n"],
	];

	async function tableBody(): Promise<string> {
		const markdown = await exportMarkdown(
			createDocument([{ type: "table", headers: HEADERS, rows: ROWS }])
		);
		return splitFrontMatter(markdown).body;
	}

	it("writes one line per row with the same number of cells in each", async () => {
		const body = await tableBody();

		const tableLines = body.split("\n").filter((line) => line.startsWith("|"));
		expect(tableLines).toHaveLength(2 + ROWS.length);
		for (const line of tableLines) {
			expect(unescapedPositions(line, "|")).toHaveLength(HEADERS.length + 1);
		}
	});

	it("starts no markup from any cell", async () => {
		const body = await tableBody();

		expect(unescapedPositions(body, "<")).toEqual([]);
		expect(unescapedPositions(body, "[")).toEqual([]);
		expect(unescapedPositions(body, "]")).toEqual([]);
		expect(linkTargets(body)).toEqual([]);
	});

	it("shows each cell as typed, with a line break read as a space", async () => {
		const markdown = await exportMarkdown(
			createDocument([
				{
					type: "table",
					headers: HEADERS,
					rows: [["one|two [x] <b>", "plain & simple\nnext"]],
				},
			])
		);

		const row = markdown.split("\n").find((line) => line.includes("one"));
		expect(readAs(row ?? "")).toBe("| one|two [x] <b> | plain & simple next |");
	});
});

describe("a Markdown report links only web and mail addresses", () => {
	const LINKED = [
		"https://example.com/a",
		"http://example.com/a",
		"mailto:a@b.example",
		"mailto:a@b.example?subject=hi&body=there",
		"https://example.com/a)b",
		"https://example.com/a(b)c",
		"https://example.com/a>b",
		"https://example.com/a<b",
		"https://example.com/a\\",
		"https://example.com/a\\)",
		'https://example.com/a"b',
		"https://example.com/a]b(c",
		"https://example.com/?q=[x](javascript:alert(1))",
		"https://example.com/?q=![x](https://t.example/p.png)",
		"https://example.com/a\\>[x](javascript:alert(1))",
		"https://example.com/a)[x](javascript:alert(1))",
		"https://example.com/a](javascript:alert(1))",
		"https://example.com/%3Cscript%3E",
		"http://user:pass@example.com/",
	];

	const TEXT_ONLY = [
		"javascript:alert(1)",
		"JaVaScRiPt:alert(1)",
		"JAVASCRIPT:alert(1)",
		"  javascript:alert(1)",
		"\tjavascript:alert(1)",
		"java\tscript:alert(1)",
		"java\nscript:alert(1)",
		"javascript://example.com/%0aalert(1)",
		"&#106;avascript:alert(1)",
		"data:text/html,<b>x</b>",
		"data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
		"vbscript:msgbox(1)",
		"file:///etc/passwd",
		"ftp://example.com/x",
		"blob:https://example.com/1234",
		"about:blank",
		"tel:+441234567890",
		"//example.com/path",
		"///example.com",
		"/\\example.com",
		"https:/example.com",
		"https:example.com",
		"www.example.com/a",
		"example.com/a",
		"x-https://example.com/",
		"[x](javascript:alert(1))",
	];

	/** Web addresses written to a link or to text: either way, no second link and no stray markup. */
	const AWKWARD_WEB_ADDRESSES = [
		"HTTPS://EXAMPLE.COM/A",
		"MAILTO:a@b.example",
		"https://example.com/a b",
		"https://example.com/a\nb",
		"https://example.com/a\r\nb",
		"https://example.com/a)\n[x](javascript:alert(1))",
		"https://example.com/a\n\n<img src=x onerror=alert(1)>",
		`https://example.com/a${String.fromCharCode(0x20_28)}b`,
		"https://example.com/a\tb",
		"https://example.com/a\u0085b",
		"https://example.com/a\u0000b",
		"mailto:a@b.example?subject=<img src=x onerror=alert(1)>",
	];

	function safeDecode(text: string): string {
		try {
			return decodeURIComponent(text);
		} catch {
			return text;
		}
	}

	describe.each(ADDRESS_PLACES)("in $name", ({ build }) => {
		it.each(
			LINKED
		)("links %j once, to that address, and adds no markup", async (url) => {
			const { body } = splitFrontMatter(await exportMarkdown(build(url)));

			const line = body.split("\n").find((l) => l.includes("]("));
			expect(line).toBeDefined();
			const targets = linkTargets(body);
			expect(targets).toHaveLength(1);
			expect(targets[0]).toMatch(WEB_OR_MAIL);
			expect(safeDecode(targets[0] ?? "")).toBe(safeDecode(url));
			// Outside the target, the link's own brackets are the only markup.
			const outsideTarget = withoutLinkTargets(line ?? "");
			expect(unescapedPositions(outsideTarget, "[")).toHaveLength(1);
			expect(unescapedPositions(outsideTarget, "]")).toHaveLength(1);
			expect(unescapedPositions(outsideTarget, "<")).toEqual([]);
			expect(readAs(outsideTarget)).toContain(url);
		});

		it.each(TEXT_ONLY)("writes %j as text, not as a link", async (url) => {
			const { body } = splitFrontMatter(await exportMarkdown(build(url)));

			expect(linkTargets(body)).toEqual([]);
			expect(unescapedPositions(body, "<")).toEqual([]);
			expect(unescapedPositions(body, "[")).toEqual([]);
			expect(unescapedPositions(body, "]")).toEqual([]);
			expect(readAs(body)).toContain(url);
		});

		it.each(
			AWKWARD_WEB_ADDRESSES
		)("never lets %j end a link early or add a second one", async (url) => {
			const { body } = splitFrontMatter(await exportMarkdown(build(url)));

			const targets = linkTargets(body);
			expect(targets.length).toBeLessThanOrEqual(1);
			for (const target of targets) {
				expect(target).toMatch(WEB_OR_MAIL);
				expect(target).not.toMatch(WHITESPACE);
				expect(target).not.toContain("javascript:");
			}
			expect(unescapedPositions(body, "[")).toHaveLength(targets.length);
			expect(unescapedPositions(body, "]")).toHaveLength(targets.length);
			for (const position of unescapedPositions(body, "<")) {
				expect(body.slice(position - 2, position)).toBe("](");
			}
		});
	});
});

describe("the YAML front matter", () => {
	const VALUES = [
		"plain",
		"ends with a backslash\\",
		'a "quoted" word',
		'back\\slash and "quote"',
		'\\"',
		'"',
		"'single'",
		"\\",
		"\\\\",
		"a\\nb",
		"line one\nline two",
		"colon: value",
		"# not a comment",
		"---",
		"- dash",
		"  padded  ",
		"{curly} and [square]",
		"%percent",
		"@at",
		"`tick`",
		"*star",
		"&anchor",
		"!tag",
		"|pipe",
		">fold",
		"é — 日本語 😀",
	];

	const KEYS = [
		"description",
		"elementCount",
		"exportedAt",
		"exportedBy",
		"generator",
		"organisation",
		"title",
		"version",
	];

	/** A document with every front-matter field set, one of them to `value`. */

	describe.each(FRONT_MATTER_FIELDS)("$key", ({ key, build }) => {
		it.each(
			VALUES
		)("reads back %j unchanged and adds no other key", async (value) => {
			const { frontMatter, body } = splitFrontMatter(
				await exportMarkdown(build(value))
			);

			const data = parseYaml(frontMatter) as Record<string, unknown>;
			expect(data[key]).toBe(value);
			expect(Object.keys(data).sort()).toEqual(KEYS);
			expect(body.trimStart().startsWith("# ")).toBe(true);
		});
	});

	it("ends where the exporter ends it, whatever the case name holds", async () => {
		const markdown = await exportMarkdown(
			createDocument([], {
				caseName: 'x\\"\n---\nexportedBy: "someone else',
				exportedBy: "me",
			})
		);

		const { frontMatter, body } = splitFrontMatter(markdown);
		const data = parseYaml(frontMatter) as Record<string, unknown>;
		expect(data.exportedBy).toBe("me");
		expect(body.trimStart().startsWith("# ")).toBe(true);
	});
});
