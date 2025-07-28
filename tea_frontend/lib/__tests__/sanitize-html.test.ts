import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { extractTextFromHtml, sanitizeDescription } from "../sanitize-html";

describe("sanitize-html", () => {
	describe("sanitizeDescription", () => {
		it("should remove empty paragraph breaks", () => {
			const input = "<p>Valid content</p><p><br></p><p>More content</p>";
			const expected = "<p>Valid content</p><p>More content</p>";
			expect(sanitizeDescription(input)).toBe(expected);
		});

		it("should remove only first empty paragraph break", () => {
			const input = "<p><br></p><p><br></p><p>Content</p><p><br></p>";
			const expected = "<p><br></p><p>Content</p><p><br></p>";
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
			const expected = "<p><br></p>"; // Only removes first occurrence
			expect(sanitizeDescription(input)).toBe(expected);
		});

		it("should preserve valid HTML content", () => {
			const input = "<p>Hello <strong>world</strong></p><div>Content</div>";
			expect(sanitizeDescription(input)).toBe(input);
		});

		it("should handle mixed case HTML tags", () => {
			const input = "<P><BR></P><p>Content</p>";
			const expected = "<P><BR></P><p>Content</p>"; // Case-sensitive, doesn't match
			expect(sanitizeDescription(input)).toBe(expected);
		});

		it("should handle self-closing br tags", () => {
			const input = "<p><br/></p><p>Content</p>";
			const expected = "<p><br/></p><p>Content</p>";
			expect(sanitizeDescription(input)).toBe(expected);
		});

		it("should handle br tags with attributes", () => {
			const input = '<p><br class="clear"></p><p>Content</p>';
			const expected = '<p><br class="clear"></p><p>Content</p>';
			expect(sanitizeDescription(input)).toBe(expected);
		});

		it("should only remove exact match pattern", () => {
			const input = "<p><br>Text</p><p>Content</p>";
			const expected = "<p><br>Text</p><p>Content</p>";
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
			expect(sanitizeDescription(input)).toBe(input);
		});

		it("should handle HTML entities", () => {
			const input = "<p>&nbsp;</p><p><br></p><p>Content &amp; more</p>";
			const expected = "<p>&nbsp;</p><p>Content &amp; more</p>";
			expect(sanitizeDescription(input)).toBe(expected);
		});

		// Security-focused tests
		it("should not execute or interpret script content", () => {
			const input = '<p><br></p><script>alert("xss")</script><p>Content</p>';
			const expected = '<script>alert("xss")</script><p>Content</p>';
			expect(sanitizeDescription(input)).toBe(expected);
		});

		it("should handle potentially malicious input", () => {
			const input = '<p><br></p><p onclick="alert()">Content</p>';
			const expected = '<p onclick="alert()">Content</p>';
			expect(sanitizeDescription(input)).toBe(expected);
		});

		it("should handle very long strings efficiently", () => {
			const longContent = "A".repeat(10000);
			const input = `<p>${longContent}</p><p><br></p><p>${longContent}</p>`;
			const expected = `<p>${longContent}</p><p>${longContent}</p>`;

			const startTime = performance.now();
			const result = sanitizeDescription(input);
			const endTime = performance.now();

			expect(result).toBe(expected);
			expect(endTime - startTime).toBeLessThan(100); // Should be fast
		});

		it("should handle input with many replacements", () => {
			const input = Array(100).fill("<p><br></p>").join("") + "<p>Final</p>";
			// Only removes the first occurrence
			const expected = Array(99).fill("<p><br></p>").join("") + "<p>Final</p>";
			expect(sanitizeDescription(input)).toBe(expected);
		});

		it("should handle Unicode content correctly", () => {
			const input = "<p>🚀 Émojis and açcénts</p><p><br></p><p>More ünïcode</p>";
			const expected = "<p>🚀 Émojis and açcénts</p><p>More ünïcode</p>";
			expect(sanitizeDescription(input)).toBe(expected);
		});

		it("should handle null and undefined gracefully", () => {
			// TypeScript should prevent this, but test runtime safety
			expect(() => sanitizeDescription(null as any)).toThrow();
			expect(() => sanitizeDescription(undefined as any)).toThrow();
		});
	});

	describe("extractTextFromHtml", () => {
		// Mock DOM environment tests
		describe("browser environment", () => {
			beforeEach(() => {
				// Mock window object to simulate browser environment
				Object.defineProperty(global, "window", {
					value: {
						document: {
							createElement: vi.fn(() => ({
								innerHTML: "",
								textContent: "",
								innerText: "",
							})),
						},
					},
					writable: true,
					configurable: true,
				});

				// Mock document.createElement
				const mockDiv = {
					innerHTML: "",
					textContent: "",
					innerText: "",
				};

				global.document = {
					createElement: vi.fn(() => mockDiv),
				} as any;
			});

			afterEach(() => {
				delete (global as any).window;
				delete (global as any).document;
				vi.restoreAllMocks();
			});

			it("should extract text using DOM manipulation in browser", () => {
				const mockDiv = {
					innerHTML: "",
					textContent: "Plain text content",
					innerText: "Plain text content",
				};

				vi.mocked(document.createElement).mockReturnValue(mockDiv as any);

				const input = "<p>Plain text <strong>content</strong></p>";
				const result = extractTextFromHtml(input);

				expect(document.createElement).toHaveBeenCalledWith("div");
				expect(mockDiv.innerHTML).toBe(input);
				expect(result).toBe("Plain text content");
			});

			it("should prioritise textContent over innerText", () => {
				const mockDiv = {
					innerHTML: "",
					textContent: "textContent value",
					innerText: "innerText value",
				};

				vi.mocked(document.createElement).mockReturnValue(mockDiv as any);

				const result = extractTextFromHtml("<p>Test</p>");
				expect(result).toBe("textContent value");
			});

			it("should fallback to innerText when textContent is empty", () => {
				const mockDiv = {
					innerHTML: "",
					textContent: "",
					innerText: "innerText value",
				};

				vi.mocked(document.createElement).mockReturnValue(mockDiv as any);

				const result = extractTextFromHtml("<p>Test</p>");
				expect(result).toBe("innerText value");
			});

			it("should return empty string when both textContent and innerText are empty", () => {
				const mockDiv = {
					innerHTML: "",
					textContent: "",
					innerText: "",
				};

				vi.mocked(document.createElement).mockReturnValue(mockDiv as any);

				const result = extractTextFromHtml("<p></p>");
				expect(result).toBe("");
			});

			it("should handle null textContent and innerText", () => {
				const mockDiv = {
					innerHTML: "",
					textContent: null,
					innerText: null,
				};

				vi.mocked(document.createElement).mockReturnValue(mockDiv as any);

				const result = extractTextFromHtml("<p>Test</p>");
				expect(result).toBe("");
			});
		});

		// Server-side environment tests
		describe("server-side environment", () => {
			beforeEach(() => {
				// Ensure window is undefined for server-side tests
				delete (global as any).window;
			});

			it("should remove HTML tags using regex on server-side", () => {
				const input = "<p>Plain <strong>text</strong> content</p>";
				const expected = "Plain text content";
				const result = extractTextFromHtml(input);
				expect(result).toBe(expected);
			});

			it("should handle complex nested HTML", () => {
				const input = "<div><p>Nested <span>content</span></p><br><a href='#'>Link</a></div>";
				const expected = "Nested contentLink";
				const result = extractTextFromHtml(input);
				expect(result).toBe(expected);
			});

			it("should handle self-closing tags", () => {
				const input = "Before<br/>Middle<hr>After";
				const expected = "BeforeMiddleAfter";
				const result = extractTextFromHtml(input);
				expect(result).toBe(expected);
			});

			it("should handle HTML with attributes", () => {
				const input = '<p class="test" id="content">Text with <a href="http://example.com" target="_blank">link</a></p>';
				const expected = "Text with link";
				const result = extractTextFromHtml(input);
				expect(result).toBe(expected);
			});

			it("should handle malformed HTML gracefully", () => {
				const input = "<p>Unclosed tag<span>Nested<div>Content";
				const expected = "Unclosed tagNestedContent";
				const result = extractTextFromHtml(input);
				expect(result).toBe(expected);
			});

			it("should handle HTML entities", () => {
				const input = "<p>&lt;script&gt;alert('xss')&lt;/script&gt;</p>";
				// Server-side regex doesn't decode HTML entities
				const expected = "&lt;script&gt;alert('xss')&lt;/script&gt;";
				const result = extractTextFromHtml(input);
				expect(result).toBe(expected);
			});

			it("should trim whitespace from result", () => {
				const input = "<p>  Content with spaces  </p>";
				const expected = "Content with spaces";
				const result = extractTextFromHtml(input);
				expect(result).toBe(expected);
			});

			it("should handle empty HTML", () => {
				expect(extractTextFromHtml("")).toBe("");
				expect(extractTextFromHtml("<p></p>")).toBe("");
				expect(extractTextFromHtml("<div><span></span></div>")).toBe("");
			});

			it("should handle HTML with only whitespace", () => {
				const input = "<p>   </p><div>  </div>";
				expect(extractTextFromHtml(input)).toBe("");
			});

			it("should handle mixed content types", () => {
				const input = "Plain text <p>Paragraph</p> more text <span>span content</span>";
				const expected = "Plain text Paragraph more text span content";
				const result = extractTextFromHtml(input);
				expect(result).toBe(expected);
			});

			it("should handle comments in HTML", () => {
				const input = "<p>Before <!-- comment --> After</p>";
				const expected = "Before  After";
				const result = extractTextFromHtml(input);
				expect(result).toBe(expected);
			});

			it("should handle script and style tags", () => {
				const input = '<p>Content</p><script>alert("xss")</script><style>body{color:red}</style><p>More</p>';
				const expected = "Contentalert(\"xss\")body{color:red}More";
				const result = extractTextFromHtml(input);
				expect(result).toBe(expected);
			});

			// Security-focused tests
			it("should not execute JavaScript during text extraction", () => {
				const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
				const input = '<script>console.log("Should not execute")</script><p>Safe content</p>';

				const result = extractTextFromHtml(input);

				expect(result).toBe('console.log("Should not execute")Safe content');
				expect(consoleSpy).not.toHaveBeenCalled();

				consoleSpy.mockRestore();
			});

			it("should handle potentially dangerous HTML attributes", () => {
				const input = '<p onload="alert()" onclick="evil()">Content</p>';
				const expected = "Content";
				const result = extractTextFromHtml(input);
				expect(result).toBe(expected);
			});

			it("should handle Unicode and special characters", () => {
				const input = "<p>🚀 Test with émojis and spéciål characters ñ</p>";
				const expected = "🚀 Test with émojis and spéciål characters ñ";
				const result = extractTextFromHtml(input);
				expect(result).toBe(expected);
			});

			it("should handle very long HTML strings efficiently", () => {
				const longText = "A".repeat(10000);
				const input = `<div><p>${longText}</p></div>`;

				const startTime = performance.now();
				const result = extractTextFromHtml(input);
				const endTime = performance.now();

				expect(result).toBe(longText);
				expect(endTime - startTime).toBeLessThan(100); // Should be reasonably fast
			});

			it("should handle deeply nested HTML", () => {
				const input = "<div><p><span><strong><em>Deeply nested content</em></strong></span></p></div>";
				const expected = "Deeply nested content";
				const result = extractTextFromHtml(input);
				expect(result).toBe(expected);
			});

			it("should handle HTML with newlines and formatting", () => {
				const input = `<p>Line 1</p>
<p>Line 2</p>
<div>
  <span>Indented content</span>
</div>`;
				const expected = "Line 1\nLine 2\n\n  Indented content";
				const result = extractTextFromHtml(input);
				expect(result).toBe(expected);
			});

			it("should handle edge case with angle brackets in content", () => {
				const input = "Text with < and > symbols <p>and HTML</p>";
				// The regex removes < and > when they form tags, but preserves standalone ones
				const expected = "Text with  symbols and HTML";
				const result = extractTextFromHtml(input);
				expect(result).toBe(expected);
			});

			it("should handle null and undefined input", () => {
				expect(() => extractTextFromHtml(null as any)).toThrow();
				expect(() => extractTextFromHtml(undefined as any)).toThrow();
			});
		});

		// Cross-environment consistency tests
		describe("environment consistency", () => {
			it("should produce consistent results between browser and server-side for simple HTML", () => {
				const input = "<p>Simple <strong>text</strong> content</p>";
				const expectedText = "Simple text content";

				// Test server-side (no window)
				delete (global as any).window;
				const serverResult = extractTextFromHtml(input);

				// Test browser-side (with window)
				const mockDiv = {
					innerHTML: "",
					textContent: expectedText,
					innerText: expectedText,
				};

				Object.defineProperty(global, "window", {
					value: { document: { createElement: () => mockDiv } },
					writable: true,
					configurable: true,
				});

				global.document = {
					createElement: vi.fn(() => mockDiv),
				} as any;

				const browserResult = extractTextFromHtml(input);

				expect(serverResult).toBe(expectedText);
				expect(browserResult).toBe(expectedText);
				expect(serverResult).toBe(browserResult);

				// Cleanup
				delete (global as any).window;
				delete (global as any).document;
			});
		});

		// Performance and edge case tests
		describe("performance and edge cases", () => {
			beforeEach(() => {
				delete (global as any).window;
			});

			it("should handle extremely large HTML documents", () => {
				const largeContent = "Content ".repeat(50000); // 350KB+ of text
				const input = `<div><p>${largeContent}</p></div>`;

				const startTime = performance.now();
				const result = extractTextFromHtml(input);
				const endTime = performance.now();

				expect(result.trim()).toBe(largeContent.trim());
				expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
			});

			it("should handle HTML with many nested tags", () => {
				let input = "Content";
				const tagCount = 1000;

				// Wrap content in many nested divs
				for (let i = 0; i < tagCount; i++) {
					input = `<div>${input}</div>`;
				}

				const result = extractTextFromHtml(input);
				expect(result).toBe("Content");
			});

			it("should handle HTML with unusual but valid tag structures", () => {
				const input = "<article><header><h1>Title</h1></header><main><section><p>Content</p></section></main></article>";
				const expected = "TitleContent";
				const result = extractTextFromHtml(input);
				expect(result).toBe(expected);
			});
		});
	});
});
