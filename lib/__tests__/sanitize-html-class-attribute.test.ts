import { describe, expect, it } from "vitest";
import { sanitizeDescription } from "../sanitize-html";

/** The elements a published description may contain. */
const ALLOWED_TAGS = [
	"p",
	"strong",
	"em",
	"u",
	"s",
	"a",
	"ul",
	"ol",
	"li",
	"blockquote",
	"code",
	"pre",
	"h1",
	"h2",
	"h3",
	"h4",
	"h5",
	"h6",
	"div",
	"span",
];

/** Elements the allow-list does not contain today, to catch a later addition. */
const OTHER_TAGS = [
	"table",
	"thead",
	"tbody",
	"tr",
	"td",
	"th",
	"img",
	"font",
	"center",
	"section",
	"article",
	"nav",
	"header",
	"footer",
	"main",
	"aside",
	"details",
	"summary",
	"label",
	"button",
	"input",
	"dl",
	"dt",
	"dd",
	"sub",
	"sup",
	"mark",
	"small",
	"b",
	"i",
];

/** Ways of writing a class attribute that a parser may still read as one. */
const CLASS_SPELLINGS = [
	'class="fixed inset-0 z-50"',
	"class='fixed inset-0 z-50'",
	"class=fixed",
	"class",
	'CLASS="fixed inset-0"',
	'ClAsS="fixed inset-0"',
	'class = "fixed inset-0"',
	'class="a" class="b"',
	'id="x" class="fixed" title="t"',
	'data-x="1" class="fixed"',
	'class="fixed"\n',
	'\nclass="fixed"',
	'\tclass="fixed"',
	'class="&quot;fixed&quot;"',
	'class="fixed" style="position:fixed"',
	'/class="fixed"',
];

const SCRIPT_SCHEME = /^\s*(javascript|data|vbscript):/i;

/** Parses sanitised output the way a browser would. */
function parse(html: string): HTMLElement {
	const root = document.createElement("div");
	root.innerHTML = html;
	return root;
}

function elementsWithAClass(html: string): string[] {
	return Array.from(parse(html).querySelectorAll("[class]")).map(
		(element) => element.tagName
	);
}

describe("sanitizeDescription — class attribute", () => {
	it.each(
		ALLOWED_TAGS
	)("removes a class from <%s> and keeps its text", (tag) => {
		const output = sanitizeDescription(
			`<${tag} class="fixed inset-0 z-50">kept text</${tag}>`
		);

		const root = parse(output);
		expect(elementsWithAClass(output)).toEqual([]);
		expect(root.querySelector(tag)).not.toBeNull();
		expect(root.textContent).toBe("kept text");
	});

	it.each(OTHER_TAGS)("lets no class through on <%s>", (tag) => {
		const output = sanitizeDescription(
			`<p>before</p><${tag} class="fixed inset-0">inside</${tag}><p>after</p>`
		);

		expect(elementsWithAClass(output)).toEqual([]);
		expect(parse(output).textContent).toContain("before");
		expect(parse(output).textContent).toContain("after");
	});

	it.each(CLASS_SPELLINGS)("removes the class written as %j", (spelling) => {
		const output = sanitizeDescription(
			`<p ${spelling}>kept</p><span ${spelling}>also kept</span><a href="https://example.com/" ${spelling}>link</a>`
		);

		expect(elementsWithAClass(output)).toEqual([]);
		expect(parse(output).textContent).toBe("keptalso keptlink");
	});

	it("removes a class from every element of a nested description", () => {
		const output = sanitizeDescription(
			'<div class="fixed inset-0 z-[9999] bg-white"><h1 class="text-4xl">Heading</h1><ul class="list"><li class="item"><strong class="b">one</strong></li></ul><blockquote class="q"><code class="c">x</code></blockquote></div>'
		);

		expect(elementsWithAClass(output)).toEqual([]);
		const root = parse(output);
		expect(root.querySelector("div > h1")?.textContent).toBe("Heading");
		expect(root.querySelector("ul > li > strong")?.textContent).toBe("one");
		expect(root.querySelector("blockquote > code")?.textContent).toBe("x");
	});

	it("leaves no attribute on any element other than links", () => {
		const output = sanitizeDescription(
			'<div class="a" id="b" style="color:red" data-x="1" title="t" role="button" aria-label="l"><p class="a" lang="en" hidden>text</p><span class="c" tabindex="0">more</span></div>'
		);

		for (const element of Array.from(parse(output).querySelectorAll("*"))) {
			expect(element.getAttributeNames()).toEqual([]);
		}
		expect(parse(output).textContent).toBe("textmore");
	});

	it("keeps only href, target and rel on a link", () => {
		const output = sanitizeDescription(
			'<a class="fixed" id="x" style="color:red" onclick="alert(1)" href="https://example.com/a" target="_blank" rel="noopener">go</a>'
		);

		const link = parse(output).querySelector("a");
		expect(link?.getAttributeNames().sort()).toEqual(["href", "rel", "target"]);
		expect(link?.getAttribute("href")).toBe("https://example.com/a");
	});

	it("keeps the words 'class' and 'classes' in text", () => {
		const output = sanitizeDescription(
			'<p class="x">The class attribute: class="not an attribute"</p>'
		);

		expect(parse(output).textContent).toBe(
			'The class attribute: class="not an attribute"'
		);
		expect(elementsWithAClass(output)).toEqual([]);
	});

	it("keeps formatting, lists and web links", () => {
		const output = sanitizeDescription(
			'<p class="x"><strong>bold</strong> and <em>italic</em></p><ol class="y"><li>one</li><li>two</li></ol><a class="z" href="mailto:a@example.com">mail</a>'
		);

		expect(output).toBe(
			'<p><strong>bold</strong> and <em>italic</em></p><ol><li>one</li><li>two</li></ol><a href="mailto:a@example.com">mail</a>'
		);
	});

	it.each([
		"javascript:alert(1)",
		"JaVaScRiPt:alert(1)",
		"  javascript:alert(1)",
		"\tjavascript:alert(1)",
		"java\tscript:alert(1)",
		"java\nscript:alert(1)",
		"&#106;avascript:alert(1)",
		"javascript&colon;alert(1)",
		"data:text/html,<b>x</b>",
		"vbscript:msgbox(1)",
	])("still drops the link address %j", (href) => {
		const output = sanitizeDescription(`<a href="${href}" class="x">go</a>`);

		const link = parse(output).querySelector("a");
		expect(link?.getAttribute("href") ?? "").not.toMatch(SCRIPT_SCHEME);
		expect(parse(output).textContent).toBe("go");
	});
});
