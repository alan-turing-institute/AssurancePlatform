// biome-ignore-all lint/suspicious/noMisplacedAssertion: the shared helper is called from within it() blocks
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SanitisedHtml } from "../sanitised-html";

const ALLOWED_ELEMENTS = new Set(
	"div p br strong em u s a ul ol li blockquote code pre h1 h2 h3 h4 h5 h6 span".split(
		" "
	)
);
const ALLOWED_ADDRESS_SCHEMES = new Set(["http:", "https:", "mailto:"]);
const NUL = String.fromCodePoint(0);

/** Every way the rendered description breaks the item page's rules; empty when it is fine. */
function problemsIn(container: HTMLElement): string[] {
	const problems: string[] = [];
	for (const element of container.querySelectorAll("*")) {
		const tag = element.tagName.toLowerCase();
		if (!ALLOWED_ELEMENTS.has(tag)) {
			problems.push(`element <${tag}>`);
		}
		for (const name of element.getAttributeNames()) {
			const allowed =
				name === "class" ||
				(tag === "a" && ["href", "target", "rel"].includes(name));
			if (!allowed) {
				problems.push(`attribute ${name} on <${tag}>`);
			}
		}
		const href = element.getAttribute("href");
		if (
			href !== null &&
			!ALLOWED_ADDRESS_SCHEMES.has(
				new URL(href, "https://app.example").protocol
			)
		) {
			problems.push(`address ${href} on <${tag}>`);
		}
	}
	return problems;
}

const HOSTILE: [string, string][] = [
	["an image with an error handler", "<img src=x onerror=alert(1)>ok"],
	["an upper-case image", "<IMG SRC=x ONERROR=alert(1)>ok"],
	["a script element", "<script>alert(1)</script>ok"],
	[
		"a script element with a source",
		"<script src=//evil.example/x.js></script>ok",
	],
	["a mixed-case script element", "<ScRiPt>alert(1)</sCrIpT>ok"],
	["an unclosed script element", "ok<script>alert(1)"],
	["an svg with a load handler", "<svg onload=alert(1)>ok</svg>"],
	["a script inside svg", "<svg><script>alert(1)</script></svg>ok"],
	[
		"an svg link with a script address",
		"<svg><a xlink:href=javascript:alert(1)><text>ok</text></a></svg>",
	],
	[
		"an svg animation",
		"<svg><animate onbegin=alert(1) attributeName=x dur=1s>ok",
	],
	["a math link", "<math><mi xlink:href=javascript:alert(1)>ok</mi></math>"],
	[
		"a frame with a script address",
		"<iframe src=javascript:alert(1)></iframe>ok",
	],
	[
		"a frame with a srcdoc",
		'<iframe srcdoc="<script>alert(1)</script>"></iframe>ok',
	],
	[
		"an object with a script address",
		"<object data=javascript:alert(1)>ok</object>",
	],
	["an embed", "<embed src=javascript:alert(1)>ok"],
	[
		"a style element",
		"<style>body{background:url(javascript:alert(1))}</style>ok",
	],
	[
		"a style attribute",
		'<p style="background:url(javascript:alert(1))">ok</p>',
	],
	["a link with a script address", '<a href="javascript:alert(1)">ok</a>'],
	[
		"a link with a mixed-case script address",
		'<a href="JaVaScRiPt:alert(1)">ok</a>',
	],
	[
		"a link with an entity-encoded script address",
		'<a href="&#106;avascript:alert(1)">ok</a>',
	],
	[
		"a link with a tab in the scheme",
		'<a href=" jav&#x09;ascript:alert(1)">ok</a>',
	],
	[
		"a link with a newline in the scheme",
		'<a href="java&#10;script:alert(1)">ok</a>',
	],
	[
		"a link with a null byte in the scheme",
		`<a href="java${NUL}script:alert(1)">ok</a>`,
	],
	["a link with a vbscript address", '<a href="vbscript:msgbox(1)">ok</a>'],
	[
		"a link with a data address",
		'<a href="data:text/html,<script>alert(1)</script>">ok</a>',
	],
	[
		"a link with a handler",
		'<a href="https://example.com" onclick="alert(1)" onmouseover="alert(2)">ok</a>',
	],
	[
		"a form with a script action",
		"<form action=javascript:alert(1)><button formaction=javascript:alert(2)>ok</button></form>",
	],
	["an input with a focus handler", "<input autofocus onfocus=alert(1)>ok"],
	[
		"a details element with a toggle handler",
		"<details open ontoggle=alert(1)>ok</details>",
	],
	["a body with a load handler", "<body onload=alert(1)>ok"],
	["a marquee with a start handler", "<marquee onstart=alert(1)>ok</marquee>"],
	[
		"a meta refresh",
		'<meta http-equiv=refresh content="0;url=javascript:alert(1)">ok',
	],
	["a linked import", "<link rel=import href=//evil.example/x.html>ok"],
	["a base element", "<base href=//evil.example/>ok"],
	[
		"a template holding an image",
		"<template><img src=x onerror=alert(1)></template>ok",
	],
	[
		"a noscript holding an image",
		"<noscript><img src=x onerror=alert(1)></noscript>ok",
	],
	[
		"a textarea holding an image",
		"<textarea><img src=x onerror=alert(1)></textarea>ok",
	],
	["a comment holding an image", "<!-- <img src=x onerror=alert(1)> -->ok"],
	[
		"a conditional comment",
		"<!--[if IE]><img src=x onerror=alert(1)><![endif]-->ok",
	],
	["a CDATA section", "<![CDATA[<img src=x onerror=alert(1)>]]>ok"],
	[
		"a processing instruction",
		'<?xml version="1.0"?><img src=x onerror=alert(1)>ok',
	],
	["an unterminated image", "ok<img src=x onerror=alert(1)"],
	["a null byte in a tag name", `<scr${NUL}ipt>alert(1)</scr${NUL}ipt>ok`],
	["slashes between attributes", "<img/src=x/onerror=alert(1)>ok"],
	["a stray bracket before a tag", "<<img src=x onerror=alert(1)>ok"],
	[
		"a stray bracket and a script that recombine",
		"<<script>x</script>img src=x onerror=alert(1)>",
	],
	[
		"a mutation payload through svg and style",
		'<svg></p><style><a id="</style><img src=1 onerror=alert(1)>">ok',
	],
	[
		"a mutation payload through math and table",
		'<math><mtext><table><mglyph><style><!--</style><img title="--&gt;&lt;img src=1 onerror=alert(1)&gt;">ok',
	],
	[
		"a mutation payload through noscript",
		'<noscript><p title="</noscript><img src=x onerror=alert(1)>">ok',
	],
	[
		"a mutation payload through nested forms",
		"<form><math><mtext></form><form><mglyph><style></math><img src onerror=alert(1)>ok",
	],
	[
		"a paragraph with a handler",
		"<p onmouseover=alert(1) onclick=alert(2)>ok</p>",
	],
	[
		"a div with a handler and a class",
		'<div class="x" onclick="alert(1)" id="y" data-z="1">ok</div>',
	],
];

const ENCODED: [string, string, string][] = [
	[
		"entity-encoded image",
		"&lt;img src=x onerror=alert(1)&gt;",
		"<img src=x onerror=alert(1)>",
	],
	[
		"double-encoded image",
		"&amp;lt;img src=x onerror=alert(1)&amp;gt;",
		"&lt;img src=x onerror=alert(1)&gt;",
	],
	[
		"numeric-entity script",
		"&#60;script&#62;alert(1)&#60;/script&#62;",
		"<script>alert(1)</script>",
	],
];

function renderDescription(html: string): HTMLElement {
	return render(<SanitisedHtml html={html} />).container;
}

describe("the item page description (SanitisedHtml)", () => {
	it.each(
		HOSTILE
	)("leaves no unsafe element, attribute or address for %s", (_name, html) => {
		const container = renderDescription(html);
		expect(problemsIn(container)).toEqual([]);
	});

	it.each(
		HOSTILE
	)("serialises to markup that parses back to the same thing for %s", (_name, html) => {
		const container = renderDescription(html);
		const reparsed = document.createElement("div");
		reparsed.innerHTML = container.innerHTML;
		expect(reparsed.innerHTML).toBe(container.innerHTML);
		expect(problemsIn(reparsed)).toEqual([]);
	});

	it.each(
		ENCODED
	)("shows %s as text without an element", (_name, html, text) => {
		const container = renderDescription(html);
		expect(problemsIn(container)).toEqual([]);
		const wrapper = container.firstElementChild as HTMLElement;
		expect(wrapper.childElementCount).toBe(0);
		expect(wrapper.textContent).toBe(text);
	});

	it("keeps the words around a payload", () => {
		const container = renderDescription(
			"<p>Before</p><script>alert(1)</script><p onclick=alert(2)>After</p>"
		);
		expect(container.textContent).toBe("BeforeAfter");
		expect(container.querySelectorAll("p")).toHaveLength(2);
	});

	it("keeps honest formatting", () => {
		const container = renderDescription(
			[
				"<h2>Heading</h2>",
				"<p>Hello <strong>bold</strong>, <em>italic</em>, <u>underlined</u> and <s>struck</s>.</p>",
				"<ul><li>one</li></ul><ol><li>two</li></ol>",
				"<blockquote>quoted</blockquote>",
				"<pre><code>code</code></pre>",
				'<p class="note">classed</p>',
				'<a href="https://example.com/a?b=1" target="_blank" rel="noopener noreferrer">link</a>',
				'<a href="mailto:person@example.com">mail</a>',
			].join("")
		);

		expect(problemsIn(container)).toEqual([]);
		for (const selector of [
			"h2",
			"strong",
			"em",
			"u",
			"s",
			"ul > li",
			"ol > li",
			"blockquote",
			"pre > code",
			"p.note",
		]) {
			expect(container.querySelector(selector)).not.toBeNull();
		}
		const link = container.querySelector('a[href^="https://"]');
		expect(link?.getAttribute("href")).toBe("https://example.com/a?b=1");
		expect(link?.getAttribute("target")).toBe("_blank");
		expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
		expect(
			container.querySelector('a[href^="mailto:"]')?.getAttribute("href")
		).toBe("mailto:person@example.com");
	});

	it("applies the caller's class name to the wrapper", () => {
		const { container } = render(
			<SanitisedHtml className="description" html="<p>Hi</p>" />
		);
		expect(container.firstElementChild?.className).toBe("description");
	});
});
