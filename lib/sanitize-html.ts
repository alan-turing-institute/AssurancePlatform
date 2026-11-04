import sanitizeHtml from "sanitize-html";

/**
 * Escapes a user-controlled string for safe interpolation into HTML.
 * Covers the five characters that matter for HTML/attribute contexts.
 */
export function escapeHtml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}

/**
 * Safely sanitizes HTML content by removing dangerous elements and attributes.
 * Strips XSS vectors (script tags, event handlers, etc.) while preserving
 * safe HTML formatting.
 *
 * Uses sanitize-html which works natively in Node.js without requiring jsdom.
 */
export function sanitizeDescription(html: string): string {
	// Sanitize HTML to remove XSS vectors
	const sanitized = sanitizeHtml(html, {
		allowedTags: [
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
		allowedAttributes: {
			a: ["href", "target", "rel"],
		},
		// Ensure javascript: URLs are stripped
		allowedSchemes: ["http", "https", "mailto"],
	});

	// Remove empty paragraph breaks that are commonly inserted by WYSIWYG editors
	return sanitized
		.replace("<p><br></p>", "")
		.replace("<p><br /></p>", "")
		.trim();
}

/**
 * Tags that start or end a line of text. They are the only tags kept while
 * extracting plain text, so each one can be turned into a word break:
 * `<p>One</p><p>Two</p>` reads "One Two", not "OneTwo". Inline tags are
 * dropped without a break, so `Plain <strong>text</strong>` stays one run.
 */
const TEXT_BREAK_TAGS = [
	"address",
	"article",
	"aside",
	"blockquote",
	"br",
	"caption",
	"center",
	"dd",
	"details",
	"dir",
	"div",
	"dl",
	"dt",
	"fieldset",
	"figcaption",
	"figure",
	"footer",
	"form",
	"h1",
	"h2",
	"h3",
	"h4",
	"h5",
	"h6",
	"header",
	"hgroup",
	"hr",
	"legend",
	"li",
	"listing",
	"main",
	"menu",
	"nav",
	"ol",
	"optgroup",
	"p",
	"pre",
	"search",
	"section",
	"summary",
	"table",
	"tbody",
	"td",
	"tfoot",
	"th",
	"thead",
	"tr",
	"ul",
];

/**
 * Elements whose contents are dropped along with their tags. Several of these
 * (title, xmp, noembed, noframes, iframe) hold raw text, so any markup inside
 * would otherwise come out as literal card text; an unclosed plaintext element
 * drops everything after it.
 */
const TEXT_DISCARDED_TAGS = [
	"iframe",
	"noembed",
	"noframes",
	"noscript",
	"option",
	"plaintext",
	"script",
	"style",
	"template",
	"textarea",
	"title",
	"xmp",
];

/** A bare tag as sanitize-html writes it once attributes are removed. */
const BARE_TAG = /<\/?[a-z][a-z0-9]*\s*\/?>/gi;

const NUL = String.fromCodePoint(0);

/** The only entities sanitize-html leaves in text it has already decoded. */
const TEXT_ENTITY = /&(?:amp|lt|gt);/g;
const TEXT_ENTITY_CHARACTERS: Record<string, string> = {
	"&amp;": "&",
	"&lt;": "<",
	"&gt;": ">",
};

/**
 * Extracts plain text from HTML content for display as a text node.
 *
 * A pure string function: it never builds a DOM element, so nothing in the
 * input is parsed into the live document, and the server and the browser
 * return the same text. sanitize-html decodes entities and drops every
 * attribute and all tags except the line-breaking ones, which become spaces;
 * the contents of script, style and similar elements are discarded.
 * NUL characters are removed from the input first, so one inside a tag is
 * parsed as the tag it hides, not left behind as text that reads like a tag.
 * Whitespace is collapsed and the result trimmed. The result is text, not
 * markup: render it as a text node, never as HTML.
 */
export function extractTextFromHtml(html: string): string {
	const stripped = sanitizeHtml(html.replaceAll(NUL, ""), {
		allowedTags: TEXT_BREAK_TAGS,
		allowedAttributes: {},
		nonTextTags: TEXT_DISCARDED_TAGS,
	});

	return stripped
		.replace(BARE_TAG, " ")
		.replace(TEXT_ENTITY, (entity) => TEXT_ENTITY_CHARACTERS[entity] ?? entity)
		.replace(/\s+/g, " ")
		.trim();
}
