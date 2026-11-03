// biome-ignore-all lint/suspicious/noMisplacedAssertion: the shared helpers are called from within it() blocks
import { render } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { extractTextFromHtml } from "@/lib/sanitize-html";

/**
 * What a browser's tokenizer starts a tag, comment or bogus comment on. The
 * result of `extractTextFromHtml` is rendered as a text node, so a literal `<`
 * is fine in honest text; this is only asserted where the input held nothing
 * but well-formed markup, so no angle bracket should be left over.
 */
const TAG_LIKE = /<[a-zA-Z!?/]/;

/** Any whitespace other than a single plain space. */
const UNCOLLAPSED_SPACE = /[^\S ]| {2}/;

const NBSP = String.fromCodePoint(0xa0);
const NUL = String.fromCodePoint(0);

interface Payload {
	html: string;
	name: string;
	/** Set when the payload's markup is character data, so literal angle brackets may remain. */
	tagLikeText?: boolean;
	/** The exact text, or any of several acceptable texts. Omit to check safety only. */
	text?: string | string[];
}

interface Family {
	name: string;
	payloads: Payload[];
	/** Assert the result holds no tag-like substring (the input was all markup). */
	strict: boolean;
}

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

interface Spy {
	mock: { calls: unknown[][] };
	mockRestore: () => void;
}

/** Runs `run` while counting every DOM-building or HTML-parsing primitive it touches. */
function observeDomParsing<T>(run: () => T): { calls: string[]; result: T } {
	const spies: [string, Spy][] = [
		["document.createElement", vi.spyOn(document, "createElement")],
		["document.createElementNS", vi.spyOn(document, "createElementNS")],
		[
			"document.createDocumentFragment",
			vi.spyOn(document, "createDocumentFragment"),
		],
		["document.createRange", vi.spyOn(document, "createRange")],
		["document.write", vi.spyOn(document, "write")],
		["document.writeln", vi.spyOn(document, "writeln")],
		[
			"document.implementation.createHTMLDocument",
			vi.spyOn(document.implementation, "createHTMLDocument"),
		],
		[
			"document.implementation.createDocument",
			vi.spyOn(document.implementation, "createDocument"),
		],
		[
			"DOMParser.parseFromString",
			vi.spyOn(DOMParser.prototype, "parseFromString"),
		],
		[
			"Range.createContextualFragment",
			vi.spyOn(Range.prototype, "createContextualFragment"),
		],
		[
			"Element.insertAdjacentHTML",
			vi.spyOn(Element.prototype, "insertAdjacentHTML"),
		],
		["Element.innerHTML=", vi.spyOn(Element.prototype, "innerHTML", "set")],
		["Element.outerHTML=", vi.spyOn(Element.prototype, "outerHTML", "set")],
	];
	try {
		const result = run();
		const calls = spies
			.filter(([, spy]) => spy.mock.calls.length > 0)
			.map(([name]) => name);
		return { calls, result };
	} finally {
		for (const [, spy] of spies) {
			spy.mockRestore();
		}
	}
}

type BrowserGlobal = "document" | "window";

const WITHOUT: BrowserGlobal[][] = [
	["window"],
	["document"],
	["window", "document"],
];

function without<T>(globals: BrowserGlobal[], run: () => T): T {
	for (const name of globals) {
		vi.stubGlobal(name, undefined);
	}
	try {
		return run();
	} finally {
		vi.unstubAllGlobals();
	}
}

/** Renders the text the way the Discover list does: as a child of an element. */
function renderedAsText(text: string): { elements: number; text: string } {
	const { container, unmount } = render(createElement("p", null, text));
	const host = container.firstElementChild as HTMLElement;
	const seen = {
		elements: host.querySelectorAll("*").length,
		text: host.textContent ?? "",
	};
	unmount();
	return seen;
}

function matchesExpected(text: Payload["text"], actual: string): boolean {
	if (text === undefined) {
		return true;
	}
	return Array.isArray(text) ? text.includes(actual) : text === actual;
}

function contentProblems(
	payload: Payload,
	strict: boolean,
	result: string
): string[] {
	const problems: string[] = [];
	if (!matchesExpected(payload.text, result)) {
		problems.push(
			`expected ${JSON.stringify(payload.text)}, got ${JSON.stringify(result)}`
		);
	}
	if (strict && !payload.tagLikeText && TAG_LIKE.test(result)) {
		problems.push(`tag-like text left in ${JSON.stringify(result)}`);
	}
	if (result !== result.trim() || UNCOLLAPSED_SPACE.test(result)) {
		problems.push(`whitespace not collapsed in ${JSON.stringify(result)}`);
	}
	return problems;
}

function parityProblems(html: string, result: string): string[] {
	return WITHOUT.flatMap((missing) => {
		const other = without(missing, () => extractTextFromHtml(html));
		return other === result
			? []
			: [`differs without ${missing.join(" and ")}: ${JSON.stringify(other)}`];
	});
}

function renderProblems(result: string): string[] {
	const rendered = renderedAsText(result);
	return rendered.elements > 0 || rendered.text !== result
		? [
				`rendering created ${rendered.elements} elements, text ${JSON.stringify(rendered.text)}`,
			]
		: [];
}

/** Every way the result of one payload can go wrong; empty when it is fine. */
function problemsWith(payload: Payload, strict: boolean): string[] {
	const { calls, result } = observeDomParsing(() =>
		extractTextFromHtml(payload.html)
	);
	return [
		...(calls.length > 0 ? [`touched the DOM: ${calls.join(", ")}`] : []),
		...contentProblems(payload, strict, result),
		...parityProblems(payload.html, result),
		...renderProblems(result),
	];
}

function problemsInFamily(family: Family): string[] {
	return family.payloads.flatMap((payload) =>
		problemsWith(payload, family.strict).map(
			(problem) =>
				`${payload.name} [${JSON.stringify(payload.html.slice(0, 80))}]: ${problem}`
		)
	);
}

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Payload families
// ---------------------------------------------------------------------------

/** Elements whose contents sanitize-html is told to drop. */
const HIDDEN_CONTENT_TAGS = [
	"script",
	"style",
	"noscript",
	"template",
	"textarea",
	"option",
];

/**
 * Elements whose contents may reasonably be kept or dropped; the tests here
 * only require that the result is safe. The raw-text elements covered by the
 * known-gap tests below are left out of the generated family on purpose.
 */
const EITHER_WAY_TAGS = ["object", "embed", "applet"];

const EVENT_HANDLER_TAGS = [
	...`a abbr address area article aside audio b base bdi bdo blockquote body br button
	canvas caption center cite code col colgroup data dd del details dfn dialog dir div dl dt
	em fieldset figcaption figure font footer form frame frameset h1 h2 h3 h4 h5 h6 head
	header hgroup hr html i img input ins kbd keygen label legend li link listing main map
	mark marquee math menu meta meter mi nav nobr ol optgroup output p param picture pre
	progress q rp rt ruby s samp search section select slot small source span strike strong
	sub summary sup svg table tbody td tfoot th thead time tr track tt u ul var video wbr
	animate set use image foreignObject isindex bgsound blink basefont menuitem my-element
	svg:script x:img o:p`.split(/\s+/),
	...HIDDEN_CONTENT_TAGS,
	...EITHER_WAY_TAGS,
];

const HANDLERS =
	'onerror=alert(1) onload=alert(2) onclick=alert(3) onfocus=alert(4) onmouseover=alert(5) onbegin=alert(6) ontoggle=alert(7) autofocus style="x:expression(alert(8))" href="javascript:alert(9)" src="javascript:alert(10)" formaction="javascript:alert(11)"';

function mixCase(text: string): string {
	return [...text]
		.map((char, index) =>
			index % 2 === 0 ? char.toLowerCase() : char.toUpperCase()
		)
		.join("");
}

function textFor(tag: string): Payload["text"] {
	if (HIDDEN_CONTENT_TAGS.includes(tag)) {
		return "";
	}
	return EITHER_WAY_TAGS.includes(tag) ? ["ok", ""] : "ok";
}

function upperText(text: Payload["text"]): Payload["text"] {
	if (Array.isArray(text)) {
		return text.map((entry) => entry.toUpperCase());
	}
	return text?.toUpperCase();
}

const EVENT_HANDLER_PAYLOADS: Payload[] = EVENT_HANDLER_TAGS.flatMap((tag) => [
	{
		name: `<${tag}> with handlers`,
		html: `<${tag} ${HANDLERS}>ok</${tag}>`,
		text: textFor(tag),
	},
	{
		name: `<${tag}> in upper case`,
		html: `<${tag} ${HANDLERS}>ok</${tag}>`.toUpperCase(),
		text: upperText(textFor(tag)),
	},
	{
		name: `<${tag}> in mixed case`,
		html: `<${mixCase(tag)} ${mixCase(HANDLERS)}>ok</${mixCase(tag)}>`,
		text: textFor(tag),
	},
]);

const HIDDEN_CONTENT_PAYLOADS: Payload[] = HIDDEN_CONTENT_TAGS.flatMap(
	(tag) => {
		const forms = [tag, tag.toUpperCase(), mixCase(tag)];
		return forms.flatMap((form) => [
			{
				name: `<${form}> holding markup`,
				html: `before <${form}>secret <img src=x onerror=alert(1)> <b>bold</b> words</${form}> after`,
				text: "before after",
			},
			{
				name: `<${form}> with attributes inside a paragraph`,
				html: `<p>one <${form} type="x" onload=alert(1)>secret</${form}> two</p><p>three</p>`,
				text: "one two three",
			},
			{
				name: `<${form}> never closed`,
				html: `before <${form}>secret words`,
				text: "before",
			},
			{
				name: `<${form}> closed with a stray space`,
				html: `before <${form}>secret</${form} >after`,
				text: "before after",
			},
			{
				name: `<${form}> closed with a newline`,
				html: `before <${form}>secret</${form}\n>after`,
				text: "before after",
			},
			{
				name: `two <${form}> elements`,
				html: `before <${form}>a</${form}> middle <${form}>b</${form}> after`,
				text: "before middle after",
			},
		]);
	}
);

const NAMESPACE_PAYLOADS: Payload[] = [
	{
		name: "script inside svg",
		html: "<svg><script>alert(1)</script></svg>ok",
		text: "ok",
	},
	{
		name: "style holding an image inside svg",
		html: "<svg><style><img src=x onerror=alert(1)></style></svg>ok",
		text: "ok",
	},
	{
		name: "svg load handler",
		html: "<svg onload=alert(1)>ok</svg>",
		text: "ok",
	},
	{
		name: "svg link with a script address",
		html: "<svg><a xlink:href=javascript:alert(1)><text>ok</text></a></svg>",
		text: "ok",
	},
	{
		name: "svg animation handler",
		html: "<svg><animate onbegin=alert(1) attributeName=x dur=1s>ok",
		text: "ok",
	},
	{
		name: "svg set that writes a handler attribute",
		html: "<svg><set attributeName=onmouseover to=alert(1)>ok",
		text: "ok",
	},
	{
		name: "svg use pointing at a data address",
		html: "<svg><use href=data:image/svg+xml,<svg id=x onload=alert(1)>#x>ok",
	},
	{
		name: "foreignObject holding a frame",
		html: "<svg><foreignObject><iframe srcdoc='<script>alert(1)</script>'></iframe></foreignObject></svg>ok",
	},
	{
		name: "title inside svg holding an image",
		html: "<svg><title><img src=x onerror=alert(1)></title></svg>ok",
		text: "ok",
	},
	{
		name: "math link with a script address",
		html: "<math><mi xlink:href=javascript:alert(1)>x</mi></math>ok",
	},
	{
		name: "math annotation holding an image",
		html: '<math><annotation-xml encoding="text/html"><img src=x onerror=alert(1)></annotation-xml></math>ok',
		text: "ok",
	},
	{
		name: "svg desc with a CDATA section",
		html: "<svg><desc><![CDATA[</desc><img src=x onerror=alert(1)>]]></desc></svg>ok",
	},
	{
		// Inside svg a CDATA section is character data, so its words are kept as text.
		name: "svg CDATA that closes a tag",
		html: "<svg><![CDATA[><img src onerror=alert(1)>]]>ok",
		tagLikeText: true,
	},
	{
		name: "namespace-confusion mutation payload 1",
		html: '<math><mtext><table><mglyph><style><!--</style><img title="--&gt;&lt;img src=1 onerror=alert(1)&gt;">ok',
	},
	{
		name: "namespace-confusion mutation payload 2",
		html: '<svg></p><style><a id="</style><img src=1 onerror=alert(1)>">ok',
	},
	{
		name: "namespace-confusion mutation payload 3",
		html: '<noscript><p title="</noscript><img src=x onerror=alert(1)>">ok',
	},
	{
		name: "namespace-confusion mutation payload 4",
		html: "<form><math><mtext></form><form><mglyph><style></math><img src onerror=alert(1)>ok",
	},
	{
		name: "unclosed attribute quote swallowing the rest",
		html: '<img src="x onerror=alert(1)>ok',
	},
	{
		name: "prefixed script element",
		html: "<svg:script>alert(1)</svg:script>ok",
	},
	{
		name: "word-processor namespace tags",
		html: "<o:p>kept</o:p><o:p></o:p>",
		text: "kept",
	},
];

const ADDRESS_PAYLOADS: Payload[] = [
	{
		name: "link with a script address",
		html: '<a href="javascript:alert(1)">ok</a>',
		text: "ok",
	},
	{
		name: "link with a mixed-case script address",
		html: '<a href="JaVaScRiPt:alert(1)">ok</a>',
		text: "ok",
	},
	{
		name: "link with an entity-encoded script address",
		html: '<a href="&#106;avascript:alert(1)">ok</a>',
		text: "ok",
	},
	{
		name: "link with a tab inside the scheme",
		html: '<a href=" jav&#x09;ascript:alert(1)">ok</a>',
		text: "ok",
	},
	{
		name: "link with a newline inside the scheme",
		html: '<a href="java&#10;script:alert(1)">ok</a>',
		text: "ok",
	},
	{
		name: "link with a vbscript address",
		html: '<a href="vbscript:msgbox(1)">ok</a>',
		text: "ok",
	},
	{
		name: "link with a data address",
		html: '<a href="data:text/html,<script>alert(1)</script>">ok</a>',
		text: "ok",
	},
	{
		name: "image with a script address",
		html: '<img src="javascript:alert(1)">ok',
		text: "ok",
	},
	{
		name: "frame with a script address",
		html: "<iframe src=javascript:alert(1)></iframe>ok",
		text: "ok",
	},
	{
		name: "frame with a srcdoc",
		html: '<iframe srcdoc="<script>alert(1)</script>"></iframe>ok',
		text: "ok",
	},
	{
		name: "object with a script address",
		html: "<object data=javascript:alert(1)></object>ok",
		text: "ok",
	},
	{
		name: "embed with an unquoted data address",
		html: "<embed src=data:text/html,<script>alert(1)</script>>ok",
	},
	{
		name: "form with a script action",
		html: "<form action=javascript:alert(1)><button>ok</button></form>",
		text: "ok",
	},
	{
		name: "meta refresh to a script address",
		html: '<meta http-equiv=refresh content="0;url=javascript:alert(1)">ok',
		text: "ok",
	},
	{
		name: "linked import",
		html: "<link rel=import href=//evil.example/x.html>ok",
		text: "ok",
	},
	{
		name: "base element",
		html: "<base href=//evil.example/>ok",
		text: "ok",
	},
	{
		name: "attribute values are not leaked into the text",
		html: '<a href="https://private.example/token" title="private tooltip" data-x="leak">visible</a>',
		text: "visible",
	},
];

const COMMENT_PAYLOADS: Payload[] = [
	{
		name: "comment holding an image",
		html: "<!-- <img src=x onerror=alert(1)> -->ok",
		text: "ok",
	},
	{
		name: "empty comment form <!-->",
		html: "<!--><img src=x onerror=alert(1)>ok",
		text: "ok",
	},
	{
		name: "empty comment form <!--->",
		html: "<!---><img src=x onerror=alert(1)>ok",
		text: "ok",
	},
	{
		name: "conditional comment",
		html: "<!--[if IE]><img src=x onerror=alert(1)><![endif]-->ok",
		text: "ok",
	},
	{
		name: "comment never closed",
		html: "<!-- <img src=x onerror=alert(1)>",
		text: "",
	},
	{
		name: "comment closed with --!>",
		html: "<!-- x --!><img src=x onerror=alert(1)>ok",
	},
	{
		name: "doctype",
		html: "<!DOCTYPE html><img src=x onerror=alert(1)>ok",
		text: "ok",
	},
	{
		name: "bogus declaration",
		html: "<!x><img src=x onerror=alert(1)>ok",
		text: "ok",
	},
	{
		name: "CDATA section holding an image",
		html: "<![CDATA[<img src=x onerror=alert(1)>]]>ok",
	},
	{
		name: "processing instruction",
		html: "<?php echo 1; ?>ok",
		text: "ok",
	},
	{
		name: "xml declaration then an image",
		html: '<?xml version="1.0"?><img src=x onerror=alert(1)>ok',
		text: "ok",
	},
	{
		name: "end tag with a space as a bogus comment",
		html: "</ x><img src=x onerror=alert(1)>ok",
	},
];

const UNTERMINATED_PAYLOADS: Payload[] = [
	{
		name: "image tag never closed",
		html: "<img src=x onerror=alert(1)",
		text: "",
	},
	{
		name: "image tag never closed, trailing space",
		html: "<img src=x onerror=alert(1) ",
		text: "",
	},
	{
		name: "image tag never closed after words",
		html: "Hello <img src=x onerror=alert(1)",
		text: "Hello",
	},
	{
		name: "script never closed",
		html: "<script>alert(1)",
		text: "",
	},
	{
		name: "script end tag cut short",
		html: "<script>alert(1)</scr",
		text: "",
	},
	{
		name: "link never closed",
		html: '<a href="javascript:alert(1)',
		text: "",
	},
	{
		name: "paragraphs never closed",
		html: "<p>one<p>two<p>three",
		text: "one two three",
	},
	{
		name: "bold never closed",
		html: "<div><b>x",
		text: "x",
	},
	{
		name: "many openings and no closings",
		html: "<a <a <a <a ok",
	},
];

const CASE_AND_NULL_PAYLOADS: Payload[] = [
	{
		name: "upper-case image",
		html: "<IMG SRC=x ONERROR=alert(1)>ok",
		text: "ok",
	},
	{
		name: "mixed-case image",
		html: "<ImG sRc=x OnErRoR=alert(1)>ok",
		text: "ok",
	},
	{
		name: "upper-case script",
		html: "<SCRIPT>alert(1)</SCRIPT>ok",
		text: "ok",
	},
	{
		name: "mixed-case script",
		html: "<ScRiPt>alert(1)</sCrIpT>ok",
		text: "ok",
	},
	{
		name: "slashes between attributes",
		html: "<img/src=x/onerror=alert(1)>ok",
		text: "ok",
	},
	{
		name: "null byte after the tag name",
		html: `<img${NUL} src=x onerror=alert(1)>ok`,
		text: "ok",
	},
	{
		name: "null byte inside an attribute name",
		html: `<img src=x on${NUL}error=alert(1)>ok`,
		text: "ok",
	},
	{
		name: "null byte inside a script address",
		html: `<a href="java${NUL}script:alert(1)">ok</a>`,
		text: "ok",
	},
	{
		name: "null byte inside a script tag name",
		html: `<scr${NUL}ipt>alert(1)</scr${NUL}ipt>ok`,
	},
	{
		name: "null byte right after the bracket",
		html: `<${NUL}img src=x onerror=alert(1)>ok`,
	},
	{
		name: "null byte in a closing tag",
		html: `<script>alert(1)</scr${NUL}ipt>ok`,
	},
];

/** Input whose decoded text legitimately contains angle brackets. */
const ENCODED_PAYLOADS: Payload[] = [
	{
		name: "named entities for an image tag",
		html: "&lt;img src=x onerror=alert(1)&gt;",
		text: "<img src=x onerror=alert(1)>",
	},
	{
		name: "decimal entities for an image tag",
		html: "&#60;img src=x onerror=alert(1)&#62;",
		text: "<img src=x onerror=alert(1)>",
	},
	{
		name: "hex entities for an image tag",
		html: "&#x3c;img src=x onerror=alert(1)&#x3e;",
		text: "<img src=x onerror=alert(1)>",
	},
	{
		name: "upper-case named entities",
		html: "&LT;img src=x onerror=alert(1)&GT;",
		text: "<img src=x onerror=alert(1)>",
	},
	{
		name: "entities for a script element",
		html: "&lt;script&gt;alert(1)&lt;/script&gt;",
		text: "<script>alert(1)</script>",
	},
	{
		name: "double-encoded image tag decodes once",
		html: "&amp;lt;img src=x onerror=alert(1)&amp;gt;",
		text: "&lt;img src=x onerror=alert(1)&gt;",
	},
	{
		name: "triple-encoded script decodes once",
		html: "&amp;amp;lt;script&amp;amp;gt;",
		text: "&amp;lt;script&amp;gt;",
	},
	{
		name: "decimal ampersand before lt",
		html: "&#38;lt;script&#38;gt;",
		text: "&lt;script&gt;",
	},
	{
		name: "hex ampersand before lt",
		html: "&#x26;lt;b&#x26;gt;",
		text: "&lt;b&gt;",
	},
	{
		name: "entity-encoded paragraphs are text, not breaks",
		html: "&lt;p&gt;one&lt;/p&gt;&lt;p&gt;two&lt;/p&gt;",
		text: "<p>one</p><p>two</p>",
	},
	{
		name: "entities inside a code element",
		html: "<code>&lt;img src=x onerror=alert(1)&gt;</code>",
		text: "<img src=x onerror=alert(1)>",
	},
	{
		name: "entity-encoded markup in an attribute value",
		html: '<a title="&lt;img src=x onerror=alert(1)&gt;" href="#">ok</a>',
		text: "ok",
	},
	{
		name: "entity-encoded letter in a handler",
		html: "<img src=x onerror=&#97;lert(1)>ok",
		text: "ok",
	},
	{
		name: "entities next to a real tag",
		html: "<b>&lt;i&gt;</b>x",
		text: "<i>x",
	},
	{
		name: "a name that is not decoded a second time",
		html: "&amp;copy;",
		text: "&copy;",
	},
	{
		name: "every spelling of an ampersand",
		html: "&amp;&#38;&#x26;&AMP;",
		text: "&&&&",
	},
	{
		name: "full-width brackets are only text",
		html: "＜script＞alert(1)＜/script＞",
		text: "＜script＞alert(1)＜/script＞",
	},
	{ name: "a number that is not a character", html: "&#0;" },
	{ name: "a surrogate half as a number", html: "&#xD800;" },
	{ name: "a number past the last code point", html: "&#x110000;" },
	{ name: "an enormous number", html: "&#99999999999;" },
	{
		name: "a stray bracket that recombines with later text",
		html: "<<script>x</script>img src=x onerror=alert(1)>",
	},
	{
		name: "a stray bracket before an image",
		html: "<<img src=x onerror=alert(1)>ok",
	},
	{
		name: "a bracket and a hidden element between the parts of a tag",
		html: "<<style>x</style>script>alert(1)<</style>/script>",
	},
	{
		name: "an end tag cut off",
		html: "<p>x</",
	},
	{
		name: "a bracket followed by a space and a tag name",
		html: "< script>alert(1)</ script>ok",
	},
];

const MARKUP_FAMILIES: Family[] = [
	{
		name: "event handlers on every kind of element",
		payloads: EVENT_HANDLER_PAYLOADS,
		strict: true,
	},
	{
		name: "elements whose contents are dropped",
		payloads: HIDDEN_CONTENT_PAYLOADS,
		strict: true,
	},
	{
		name: "svg and mathml tricks",
		payloads: NAMESPACE_PAYLOADS,
		strict: true,
	},
	{
		name: "script, data and other addresses",
		payloads: ADDRESS_PAYLOADS,
		strict: true,
	},
	{
		name: "comments, CDATA, declarations and processing instructions",
		payloads: COMMENT_PAYLOADS,
		strict: true,
	},
	{
		name: "unterminated markup",
		payloads: UNTERMINATED_PAYLOADS,
		strict: true,
	},
	{
		name: "upper and mixed case, null bytes",
		payloads: CASE_AND_NULL_PAYLOADS,
		strict: true,
	},
];

const ALL_FAMILIES: Family[] = [
	...MARKUP_FAMILIES,
	{
		name: "entity-encoded and double-encoded markup",
		payloads: ENCODED_PAYLOADS,
		strict: false,
	},
];

const FAMILY_CASES = ALL_FAMILIES.map(
	(family) => [family.name, family] as const
);

const HONEST_TEXT: [string, string, string][] = [
	["plain words", "Just some words.", "Just some words."],
	["nothing", "", ""],
	["only whitespace", "  \n\t  \r\n ", ""],
	["paragraphs", "<p>One</p><p>Two</p>", "One Two"],
	[
		"paragraphs with attributes",
		'<p class="x" onclick="y">One</p><p>Two</p>',
		"One Two",
	],
	["upper-case paragraphs", "<P>One</P><P>Two</P>", "One Two"],
	["paragraphs split by newlines", "<p>one</p>\n\n<p>two</p>", "one two"],
	["tags with space before the bracket", "A<p\n>B</p\n>C", "A B C"],
	["list items", "<ul><li>A</li><li>B</li><li>C</li></ul>", "A B C"],
	[
		"a numbered list followed by a paragraph",
		"<ol><li>A</li></ol><p>B</p>",
		"A B",
	],
	["headings and body", "<h1>Title</h1><p>Body</p>", "Title Body"],
	["nested blocks", "<div><div><p>A</p></div><p>B</p></div>", "A B"],
	["table cells", "<table><tr><td>A</td><td>B</td></tr></table>", "A B"],
	["preformatted lines", "<pre>line1\nline2</pre>", "line1 line2"],
	["line breaks", "Line one.<br><br>Line two.", "Line one. Line two."],
	["every spelling of a line break", "a<br>b<br/>c<BR>d<br />e", "a b c d e"],
	[
		"inline emphasis stays one run",
		"Plain <strong>text</strong>",
		"Plain text",
	],
	["inline tags inside a word", "un<b>believ</b>able", "unbelievable"],
	[
		"a link",
		'<a href="https://example.com/?a=1&b=2" title="t">link</a> and more',
		"link and more",
	],
	["tabs and newlines", "line1\nline2\ttab", "line1 line2 tab"],
	["non-breaking spaces", "&nbsp;a&nbsp;&nbsp;b&nbsp;", "a b"],
	[
		"a paragraph break through a non-breaking space",
		"<p>a</p>&nbsp;<p>b</p>",
		"a b",
	],
	["a non-breaking space character", `a${NBSP}${NBSP}b`, "a b"],
	["leading and trailing space", "   padded   ", "padded"],
	["an ampersand entity", "Tom &amp; Jerry", "Tom & Jerry"],
	["a bare ampersand", "R&D", "R&D"],
	["an encoded ampersand", "R&amp;D", "R&D"],
	[
		"ampersands in running text",
		"AT&T and R&D and Q&A",
		"AT&T and R&D and Q&A",
	],
	["an ampersand with no semicolon", "a&ampb", "a&b"],
	["an unknown entity", "&unknown;", "&unknown;"],
	[
		"other named and numeric entities",
		"&copy; &eacute; &#233; &#xE9; &hellip; &mdash;",
		"© é é é … —",
	],
	["accents, emoji and right-to-left text", "héllo 🌍 مرحبا", "héllo 🌍 مرحبا"],
	["a spaced less-than", "5 < 6", "5 < 6"],
	["a tight less-than and greater-than", "1<2 and 3>2", "1<2 and 3>2"],
	["a spaced greater-than", "a > b", "a > b"],
	["less-than before a digit", "I <3 you", "I <3 you"],
	["comparison operators", "x <= y and y >= z", "x <= y and y >= z"],
	["arrows", "a -> b <- c", "a -> b <- c"],
	[
		"entity-encoded comparison",
		"x &lt; y &amp;&amp; y &gt; z",
		"x < y && y > z",
	],
	["a lone less-than", "<", "<"],
	["a lone greater-than", ">", ">"],
	["a lone ampersand", "&", "&"],
	["an empty angle pair", "<>ok", "<>ok"],
];

const BLOCK_TAGS =
	`address article aside blockquote caption dd details div dl dt fieldset
figcaption figure footer form h1 h2 h3 h4 h5 h6 header li main nav ol p pre section
summary table tbody td tfoot th thead tr ul`.split(/\s+/);

const INLINE_TAGS = "a abbr b code em i mark small span strong sub sup u".split(
	" "
);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("extractTextFromHtml builds no DOM", () => {
	it("is watched by spies that really see each way of building or parsing DOM", () => {
		const ways: Record<string, () => unknown> = {
			"document.createElement": () => document.createElement("div"),
			"document.createElementNS": () =>
				document.createElementNS("http://www.w3.org/2000/svg", "svg"),
			"document.createDocumentFragment": () =>
				document.createDocumentFragment(),
			"document.createRange": () => document.createRange(),
			"document.implementation.createHTMLDocument": () =>
				document.implementation.createHTMLDocument(""),
			"DOMParser.parseFromString": () =>
				new DOMParser().parseFromString("<b>x</b>", "text/html"),
			"Range.createContextualFragment": () =>
				document.createRange().createContextualFragment("<b>x</b>"),
			"Element.insertAdjacentHTML": () => {
				const host = document.createElement("div");
				host.insertAdjacentHTML("beforeend", "<b>x</b>");
			},
			"Element.innerHTML=": () => {
				const host = document.createElement("div");
				host.innerHTML = "<b>x</b>";
			},
		};
		for (const [name, run] of Object.entries(ways)) {
			expect(observeDomParsing(run).calls).toContain(name);
		}
	});

	it.each(FAMILY_CASES)("calls none of them for %s", (_name, family) => {
		const touched = family.payloads.flatMap((payload) => {
			const { calls } = observeDomParsing(() =>
				extractTextFromHtml(payload.html)
			);
			return calls.length > 0 ? [`${payload.name}: ${calls.join(", ")}`] : [];
		});
		expect(touched).toEqual([]);
	});

	it("calls none of them for deeply nested input either", () => {
		const { calls } = observeDomParsing(() =>
			extractTextFromHtml(`${"<div>".repeat(5000)}deep${"</div>".repeat(5000)}`)
		);
		expect(calls).toEqual([]);
	});

	it("gives the same text whether or not window and document exist", () => {
		const everyPayload = ALL_FAMILIES.flatMap((family) => family.payloads);
		const differing = everyPayload.flatMap(({ html, name }) => {
			const inBrowser = extractTextFromHtml(html);
			const same = WITHOUT.every(
				(missing) =>
					without(missing, () => extractTextFromHtml(html)) === inBrowser
			);
			return same ? [] : [name];
		});
		expect(differing).toEqual([]);
	});

	it("gives the same text without window and document for honest descriptions", () => {
		const differing = HONEST_TEXT.flatMap(([name, html]) => {
			const inBrowser = extractTextFromHtml(html);
			const onServer = without(["window", "document"], () =>
				extractTextFromHtml(html)
			);
			return onServer === inBrowser ? [] : [name];
		});
		expect(differing).toEqual([]);
	});
});

describe("extractTextFromHtml returns text, never markup, for hostile input", () => {
	it.each(FAMILY_CASES)("for %s", (_name, family) => {
		expect(problemsInFamily(family)).toEqual([]);
	});

	it("decodes an entity once and never twice", () => {
		expect(extractTextFromHtml("&amp;lt;b&amp;gt;")).toBe("&lt;b&gt;");
		expect(extractTextFromHtml("&amp;amp;")).toBe("&amp;");
		expect(extractTextFromHtml("&amp;")).toBe("&");
		expect(extractTextFromHtml("&lt;b&gt;bold&lt;/b&gt;")).toBe("<b>bold</b>");
	});

	it("keeps entity-encoded markup as literal text instead of treating it as markup", () => {
		// If entities were decoded before the tags were stripped, these would vanish.
		expect(extractTextFromHtml("&lt;p&gt;kept&lt;/p&gt;")).toBe("<p>kept</p>");
		expect(extractTextFromHtml("&lt;script&gt;kept&lt;/script&gt;")).toBe(
			"<script>kept</script>"
		);
		expect(extractTextFromHtml("<b>a</b>&lt;b&gt;b&lt;/b&gt;")).toBe(
			"a<b>b</b>"
		);
	});

	it("shows the same words however the payload is wrapped", () => {
		const wrappers = [
			(inner: string) => `<p>${inner}</p>`,
			(inner: string) => `<div><span>${inner}</span></div>`,
			(inner: string) => `<ul><li>${inner}</li></ul>`,
			(inner: string) => `<table><tr><td>${inner}</td></tr></table>`,
			(inner: string) => `<blockquote><pre>${inner}</pre></blockquote>`,
		];
		const inner = "<img src=x onerror=alert(1)><script>alert(2)</script>words";
		for (const wrap of wrappers) {
			expect(extractTextFromHtml(wrap(inner))).toBe("words");
		}
	});

	it("is stateless across repeated and interleaved calls", () => {
		const inputs = [
			["<p>One</p><p>Two</p>", "One Two"],
			["<script>alert(1)</script>after", "after"],
			["R&amp;D", "R&D"],
			["<img src=x onerror=alert(1)>", ""],
			["plain", "plain"],
		] as const;
		for (let round = 0; round < 3; round++) {
			for (const [html, text] of inputs) {
				expect(extractTextFromHtml(html)).toBe(text);
			}
		}
	});
});

describe("extractTextFromHtml reads honest descriptions as people wrote them", () => {
	it.each(HONEST_TEXT)("%s", (_name, html, text) => {
		expect(extractTextFromHtml(html)).toBe(text);
	});

	it.each(BLOCK_TAGS)("separates the words either side of <%s>", (tag) => {
		expect(extractTextFromHtml(`A<${tag}>B</${tag}>C`)).toBe("A B C");
		expect(extractTextFromHtml(`<${tag}>A</${tag}><${tag}>B</${tag}>`)).toBe(
			"A B"
		);
	});

	it.each(["br", "hr"])("separates the words either side of <%s>", (tag) => {
		expect(extractTextFromHtml(`A<${tag}>B`)).toBe("A B");
		expect(extractTextFromHtml(`A<${tag}/>B`)).toBe("A B");
	});

	it.each(INLINE_TAGS)("does not split a word at <%s>", (tag) => {
		expect(extractTextFromHtml(`A<${tag}>B</${tag}>C`)).toBe("ABC");
	});

	it.each(HIDDEN_CONTENT_TAGS)("drops what is inside <%s>", (tag) => {
		const text = extractTextFromHtml(
			`before <${tag}>secret words</${tag}> after`
		);
		expect(text).toBe("before after");
		expect(text).not.toContain("secret");
	});
});

describe("extractTextFromHtml copes with very long and deeply nested input", () => {
	const BUDGET_MS = 5000;

	function timed<T>(run: () => T): { ms: number; result: T } {
		const start = performance.now();
		const result = run();
		return { ms: performance.now() - start, result };
	}

	it("handles ten thousand nested blocks", () => {
		const html = `${"<div>".repeat(10_000)}deep${"</div>".repeat(10_000)}`;
		const { ms, result } = timed(() => extractTextFromHtml(html));
		expect(result).toBe("deep");
		expect(ms).toBeLessThan(BUDGET_MS);
	});

	it("handles five thousand nested list items", () => {
		const html = `${"<ul><li>".repeat(5000)}deep${"</li></ul>".repeat(5000)}`;
		expect(extractTextFromHtml(html)).toBe("deep");
	});

	it("handles fifty thousand elements that are never closed", () => {
		expect(extractTextFromHtml(`${"<b>".repeat(50_000)}x`)).toBe("x");
		expect(extractTextFromHtml(`${"<p>".repeat(50_000)}x`)).toBe("x");
	});

	it("handles a megabyte of words", () => {
		const html = "word ".repeat(200_000);
		const { ms, result } = timed(() => extractTextFromHtml(html));
		expect(result).toBe(html.trim());
		expect(ms).toBeLessThan(BUDGET_MS);
	});

	it("handles a hundred thousand angle brackets and entities", () => {
		expect(extractTextFromHtml("<".repeat(100_000))).toBe("<".repeat(100_000));
		expect(extractTextFromHtml("&amp;".repeat(100_000))).toBe(
			"&".repeat(100_000)
		);
		expect(extractTextFromHtml("&lt;".repeat(100_000))).toBe(
			"<".repeat(100_000)
		);
		expect(extractTextFromHtml("&#x41;".repeat(100_000))).toBe(
			"A".repeat(100_000)
		);
	});

	it("handles tags that are never finished", () => {
		const unfinished = [
			"<a ".repeat(50_000),
			"<a".repeat(100_000),
			`<a${" ".repeat(200_000)}`,
			"<!--".repeat(50_000),
			"<script>".repeat(10_000),
			`<img ${'a="b" '.repeat(50_000)}`,
		];
		for (const html of unfinished) {
			const { ms, result } = timed(() => extractTextFromHtml(html));
			expect(result).toBe("");
			expect(ms).toBeLessThan(BUDGET_MS);
		}
	});

	it("collapses a long run of mixed spaces to one", () => {
		const { ms, result } = timed(() =>
			extractTextFromHtml(`a${` ${NBSP}`.repeat(200_000)}b`)
		);
		expect(result).toBe("a b");
		expect(ms).toBeLessThan(BUDGET_MS);
	});

	it("handles a very long run of line breaks", () => {
		const { ms, result } = timed(() =>
			extractTextFromHtml("<br>".repeat(200_000))
		);
		expect(result).toBe("");
		expect(ms).toBeLessThan(BUDGET_MS);
	});
});

// The five raw-text elements below, and iframe, keep their contents in the
// output today, so any markup inside them shows up as literal text.
describe("extractTextFromHtml and raw-text elements", () => {
	it.each([
		"title",
		"xmp",
		"noembed",
		"noframes",
		"iframe",
	])("drops what is inside <%s>", (tag) => {
		const text = extractTextFromHtml(
			`before <${tag}><img src=x onerror=alert(1)> hidden words</${tag}> after`
		);
		expect(text).toBe("before after");
		expect(text).not.toMatch(TAG_LIKE);
	});

	it("drops what follows an unclosed <plaintext>", () => {
		const text = extractTextFromHtml(
			"before <plaintext><img src=x onerror=alert(1)> trailing words"
		);
		expect(text).toBe("before");
		expect(text).not.toMatch(TAG_LIKE);
	});
});
