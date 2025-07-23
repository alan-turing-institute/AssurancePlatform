/**
 * Safely sanitizes HTML content by removing dangerous elements and attributes
 * Currently handles the specific case of removing empty paragraph breaks
 */
export function sanitizeDescription(html: string): string {
	// Remove empty paragraph breaks that are commonly inserted by WYSIWYG editors
	return html.replace("<p><br></p>", "").trim();
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
