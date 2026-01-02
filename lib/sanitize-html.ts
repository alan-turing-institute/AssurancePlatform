import DOMPurify from "isomorphic-dompurify";

/**
 * Safely sanitizes HTML content by removing dangerous elements and attributes.
 * Uses DOMPurify to strip XSS vectors (script tags, event handlers, etc.)
 * while preserving safe HTML formatting.
 */
export function sanitizeDescription(html: string): string {
	// Sanitize HTML to remove XSS vectors
	const sanitized = DOMPurify.sanitize(html, {
		ALLOWED_TAGS: [
			"p",
			"br",
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
		],
		ALLOWED_ATTR: ["href", "target", "rel", "class"],
	});

	// Remove empty paragraph breaks that are commonly inserted by WYSIWYG editors
	return sanitized.replace("<p><br></p>", "").trim();
}

/**
 * Extracts plain text from HTML content for safe display
 * This removes all HTML tags and returns only the text content
 */
export function extractTextFromHtml(html: string): string {
	// Create a temporary DOM element to safely extract text
	if (typeof window !== "undefined") {
		const tempDiv = document.createElement("div");
		tempDiv.innerHTML = html;
		return tempDiv.textContent || tempDiv.innerText || "";
	}

	// Server-side fallback: basic HTML tag removal
	return html.replace(/<[^>]*>/g, "").trim();
}
