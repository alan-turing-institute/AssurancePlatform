import { afterEach, describe, expect, it, vi } from "vitest";
import {
	escapeHtml,
	extractTextFromHtml,
	sanitizeDescription,
} from "../sanitize-html";

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

	describe("sanitizeDescription", () => {
		it("should remove empty paragraph breaks", () => {
			const input = "<p>Valid content</p><p><br></p><p>More content</p>";
			const expected = "<p>Valid content</p><p>More content</p>";
			expect(sanitizeDescription(input)).toBe(expected);
		});

		it("should remove empty paragraph breaks in output", () => {
			const input = "<p><br></p><p><br></p><p>Content</p><p><br></p>";
			// sanitize-html uses XHTML-style self-closing tags
			const expected = "<p><br /></p><p>Content</p><p><br /></p>";
			expect(sanitizeDescription(input)).toBe(expected);
		});

		it("should trim whitespace from result", () => {
			const input = "  <p>Content</p><p><br></p>  ";
			const expected = "<p>Content</p>";
			expect(sanitizeDescription(input)).toBe(expected);
		});

		it("should handle empty strings", () => {
			expect(sanitizeDescription("")).toBe("");
		});

		it("should handle strings with only whitespace", () => {
			expect(sanitizeDescription("   ")).toBe("");
		});

		it("should handle strings with only empty paragraph breaks", () => {
			const input = "<p><br></p><p><br></p>";
			// sanitize-html uses XHTML-style self-closing tags
			const expected = "<p><br /></p>";
			expect(sanitizeDescription(input)).toBe(expected);
		});

		it("should preserve valid HTML content", () => {
			const input = "<p>Hello <strong>world</strong></p><div>Content</div>";
			expect(sanitizeDescription(input)).toBe(input);
		});

		it("should handle br tags with attributes", () => {
			const input = '<p><br class="clear"></p><p>Content</p>';
			// With the class removed the paragraph is a bare empty one, which is dropped
			const expected = "<p>Content</p>";
			expect(sanitizeDescription(input)).toBe(expected);
		});

		it.each([
			"p",
			"strong",
			"em",
			"u",
			"s",
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
		])("should remove a class from <%s> and keep its text", (tag) => {
			const input = `<${tag} class="x y">Text</${tag}>`;
			expect(sanitizeDescription(input)).toBe(`<${tag}>Text</${tag}>`);
		});

		it("should remove a class from a link and keep its address", () => {
			const input = '<a class="x" href="https://example.com">Link</a>';
			expect(sanitizeDescription(input)).toBe(
				'<a href="https://example.com">Link</a>'
			);
		});

		it("should remove a class from a line break", () => {
			expect(sanitizeDescription('<p>One<br class="x">Two</p>')).toBe(
				"<p>One<br />Two</p>"
			);
		});

		it("should only remove exact match pattern", () => {
			const input = "<p><br>Text</p><p>Content</p>";
			// sanitize-html uses XHTML-style self-closing tags
			const expected = "<p><br />Text</p><p>Content</p>";
			expect(sanitizeDescription(input)).toBe(expected);
		});

		it("should handle content with line breaks and formatting", () => {
			const input = `<p>Line 1</p>
<p><br></p>
<p>Line 2</p>`;
			const expected = `<p>Line 1</p>

<p>Line 2</p>`;
			expect(sanitizeDescription(input)).toBe(expected);
		});

		it("should handle nested HTML structures", () => {
			const input = "<div><p><br></p></div><p>Content</p>";
			const expected = "<div></div><p>Content</p>";
			expect(sanitizeDescription(input)).toBe(expected);
		});

		it("should preserve paragraph breaks with content", () => {
			const input = "<p><br>Some text after br</p>";
			// sanitize-html uses XHTML-style self-closing tags
			const expected = "<p><br />Some text after br</p>";
			expect(sanitizeDescription(input)).toBe(expected);
		});

		it("should handle HTML entities", () => {
			const input = "<p>&nbsp;</p><p><br></p><p>Content &amp; more</p>";
			// sanitize-html decodes &nbsp; to a non-breaking space (U+00A0) and uses XHTML-style br tags
			const expected = "<p>\xA0</p><p>Content &amp; more</p>";
			expect(sanitizeDescription(input)).toBe(expected);
		});

		// Security-focused tests
		it("should strip script tags (XSS prevention)", () => {
			const input = '<p><br></p><script>alert("xss")</script><p>Content</p>';
			const expected = "<p>Content</p>";
			expect(sanitizeDescription(input)).toBe(expected);
		});

		it("should strip event handler attributes (XSS prevention)", () => {
			const input = '<p><br></p><p onclick="alert()">Content</p>';
			const expected = "<p>Content</p>";
			expect(sanitizeDescription(input)).toBe(expected);
		});

		it("should strip onerror attributes (XSS prevention)", () => {
			const input = '<img src=x onerror="alert(document.cookie)">';
			const expected = "";
			expect(sanitizeDescription(input)).toBe(expected);
		});

		it("should strip javascript: URLs (XSS prevention)", () => {
			const input = '<a href="javascript:alert(1)">Click me</a>';
			const result = sanitizeDescription(input);
			expect(result).not.toContain("javascript:");
		});

		it("should handle very long strings efficiently", () => {
			const longContent = "A".repeat(10_000);
			const input = `<p>${longContent}</p><p><br></p><p>${longContent}</p>`;
			const expected = `<p>${longContent}</p><p>${longContent}</p>`;

			const startTime = performance.now();
			const result = sanitizeDescription(input);
			const endTime = performance.now();

			expect(result).toBe(expected);
			expect(endTime - startTime).toBeLessThan(100); // Should be fast
		});

		it("should handle input with many replacements", () => {
			const input = `${new Array(100).fill("<p><br></p>").join("")}<p>Final</p>`;
			// sanitize-html uses XHTML-style self-closing tags, only removes first <p><br /></p>
			const expected = `${new Array(99).fill("<p><br /></p>").join("")}<p>Final</p>`;
			expect(sanitizeDescription(input)).toBe(expected);
		});

		it("should handle Unicode content correctly", () => {
			const input =
				"<p>🚀 Émojis and açcénts</p><p><br></p><p>More ünïcode</p>";
			const expected = "<p>🚀 Émojis and açcénts</p><p>More ünïcode</p>";
			expect(sanitizeDescription(input)).toBe(expected);
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
