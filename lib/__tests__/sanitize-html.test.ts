import { afterEach, describe, expect, it, vi } from "vitest";
import { escapeHtml, extractTextFromHtml } from "../sanitize-html";

describe("sanitize-html", () => {
	describe("escapeHtml", () => {
		it("escapes ampersand", () => {
			expect(escapeHtml("Tom & Jerry")).toBe("Tom &amp; Jerry");
		});

		it("escapes less-than", () => {
			expect(escapeHtml("a < b")).toBe("a &lt; b");
		});

		it("escapes greater-than", () => {
			expect(escapeHtml("a > b")).toBe("a &gt; b");
		});

		it("escapes double quotes", () => {
			expect(escapeHtml('say "hi"')).toBe("say &quot;hi&quot;");
		});

		it("escapes single quotes", () => {
			expect(escapeHtml("it's")).toBe("it&#39;s");
		});
	});

	describe("extractTextFromHtml", () => {
		afterEach(() => {
			vi.restoreAllMocks();
			vi.unstubAllGlobals();
		});

		it("returns the words of nested markup", () => {
			const input =
				"<div><p>Nested <span>content</span></p><a href='#'>Link</a></div>";
			expect(extractTextFromHtml(input)).toBe("Nested content Link");
		});

		it("keeps inline tags inside a word", () => {
			const input = '<p>Un<strong>break</strong>able <a href="/x">link</a></p>';
			expect(extractTextFromHtml(input)).toBe("Unbreakable link");
		});

		it("separates paragraphs, list items and line breaks", () => {
			const input =
				"<p>One</p><p>Two</p><ul><li>Three</li><li>Four</li></ul>Five<br>Six<hr>Seven";
			expect(extractTextFromHtml(input)).toBe(
				"One Two Three Four Five Six Seven"
			);
		});

		it("decodes entities once", () => {
			const input =
				"<p>Fish &amp; chips &#8217;n&#x2019; caf&eacute; &quot;ok&quot; &amp;lt;</p>";
			expect(extractTextFromHtml(input)).toBe(
				'Fish & chips ’n’ café "ok" &lt;'
			);
		});

		it("returns entity-encoded markup as text", () => {
			const input = "<p>&lt;script&gt;alert('x')&lt;/script&gt;</p>";
			expect(extractTextFromHtml(input)).toBe("<script>alert('x')</script>");
		});

		it("collapses whitespace and trims", () => {
			const input = "  <p>  Line 1 </p>\n\n<div> Line\t2 <!-- note --> </div> ";
			expect(extractTextFromHtml(input)).toBe("Line 1 Line 2");
		});

		it("returns an empty string when there is no text", () => {
			expect(extractTextFromHtml("")).toBe("");
			expect(extractTextFromHtml("<div><span></span><p> </p></div>")).toBe("");
		});

		it("closes unclosed tags", () => {
			const input = "<p>Unclosed tag<span>Nested<div>Content";
			expect(extractTextFromHtml(input)).toBe("Unclosed tagNested Content");
		});

		it.each([
			"center",
			"dir",
			"hgroup",
			"legend",
			"listing",
			"menu",
			"optgroup",
			"search",
		])("separates the words around <%s>", (tag) => {
			expect(extractTextFromHtml(`<${tag}>A</${tag}><${tag}>B</${tag}>`)).toBe(
				"A B"
			);
		});

		it("removes NUL characters", () => {
			const nul = String.fromCodePoint(0);
			expect(extractTextFromHtml(`a${nul}b <${nul}b>c</b>`)).toBe("ab c");
		});

		it.each([
			[
				"image with an error handler",
				"<img src=x onerror=\"console.log('X')\">",
			],
			["script element", "<script>console.log('X')</script>"],
			["style element", "<style>body{color:red}</style>"],
			["svg load handler", "<svg onload=\"console.log('X')\"><circle /></svg>"],
			[
				"iframe with a script address",
				"<iframe src=\"javascript:console.log('X')\"></iframe>",
			],
			[
				"link with a script address",
				"<a href=\"javascript:console.log('X')\"></a>",
			],
			["nested script", "<div><p><script>console.log('X')</script></p></div>"],
		])("drops a %s and keeps the surrounding words", (_name, payload) => {
			expect(extractTextFromHtml(`Before ${payload} After`)).toBe(
				"Before After"
			);
		});

		it("never creates an element or parses a document", () => {
			const createElement = vi.spyOn(document, "createElement");
			const parseFromString = vi.spyOn(DOMParser.prototype, "parseFromString");

			const result = extractTextFromHtml(
				"<img src=x onerror=\"console.log('X')\"><p>Words &amp; more</p>"
			);

			expect(result).toBe("Words & more");
			expect(createElement).not.toHaveBeenCalled();
			expect(parseFromString).not.toHaveBeenCalled();
		});

		it("returns the same text with and without a browser window", () => {
			const input = "<p>One &amp; two</p>\n<p>Three</p><br>Four ";
			const inBrowser = extractTextFromHtml(input);

			vi.stubGlobal("window", undefined);
			vi.stubGlobal("document", undefined);
			const onServer = extractTextFromHtml(input);

			expect(onServer).toBe("One & two Three Four");
			expect(inBrowser).toBe(onServer);
		});

		it("handles very large and deeply nested input", () => {
			const words = "Content ".repeat(50_000);
			const nested = `${"<div>".repeat(1000)}Content${"</div>".repeat(1000)}`;

			const startTime = performance.now();
			const large = extractTextFromHtml(`<div><p>${words}</p></div>`);
			const deep = extractTextFromHtml(nested);
			const elapsed = performance.now() - startTime;

			expect(large).toBe(words.trim());
			expect(deep).toBe("Content");
			expect(elapsed).toBeLessThan(2000);
		});
	});
});
